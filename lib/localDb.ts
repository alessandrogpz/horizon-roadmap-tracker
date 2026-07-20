import Dexie, { type Table } from "dexie";
import type { AppState, TrackState, Workspace } from "./types";
import { LEGACY_TRACK_ID, LEGACY_ROADMAP_CONTENT } from "./legacyPersonalData";
import { DSA_PATTERN_WEEKS } from "./constants";

export { LEGACY_TRACK_ID };

export interface AppStateRecord {
  id: string;
  data: AppState;
}

export interface NoteRecord {
  id: string; // materialId
  content: string;
  updatedAt: number;
}

export interface WorkspaceRecord {
  id: string;
  data: Workspace;
}

/** Wraps a pre-multi-track AppState row into the single legacy track. Used
 *  both by the v1→v2 Dexie migration below and by lib/googleDrive.ts when it
 *  encounters an old-shape database.json — both call sites use the exact
 *  same LEGACY_TRACK_ID so local and remote data resolve to the same track
 *  instead of forking into duplicates. */
export function wrapLegacyAppState(legacy: AppState): Workspace {
  // hasUnsyncedChanges/lastSyncTime/isReset are workspace-level bookkeeping,
  // not part of TrackState — strip them out of the spread below.
  const { hasUnsyncedChanges: _hasUnsyncedChanges, lastSyncTime: _lastSyncTime, isReset: _isReset, ...rest } = legacy;
  void _hasUnsyncedChanges;
  void _lastSyncTime;
  void _isReset;

  const track: TrackState = {
    ...rest,
    meta: {
      id: LEGACY_TRACK_ID,
      name: "Game Engine & Graphics",
      color: "#0ea5e9",
      templateId: "engine-graphics",
      createdAt: Date.now(),
    },
    // The rotation feature itself (weekly DSA/math pattern cycling) is kept
    // — just decoupled from the general template system, since it's this
    // one personal track's own data, not something offered to other users.
    rotationConfig: {
      weeks: DSA_PATTERN_WEEKS,
      appliesToScheduleType: "math",
    },
    // Seeded once from the project's former engine_dev_roadmap.md, so this
    // content isn't lost now that every track's roadmap lives in its own
    // private, editable field instead of a shipped file.
    roadmapContent: LEGACY_ROADMAP_CONTENT,
  };

  return {
    activeTrackId: LEGACY_TRACK_ID,
    tracks: { [LEGACY_TRACK_ID]: track },
    isSynced: legacy.isSynced,
    hasUnsyncedChanges: legacy.hasUnsyncedChanges,
    lastSyncTime: legacy.lastSyncTime,
  };
}

export class ProductivityDb extends Dexie {
  /** Legacy v1 table — kept declared (never dropped) so the row that lived
   *  here before the multi-track upgrade survives untouched as an automatic
   *  rollback snapshot. Nothing writes to it after v2. */
  appState!: Table<AppStateRecord>;
  notes!: Table<NoteRecord>;
  workspace!: Table<WorkspaceRecord>;

  /** dbName is overridable so tests can exercise the real migration logic
   *  against an isolated, uniquely-named database. */
  constructor(dbName: string = "ProductivityDb") {
    super(dbName);

    this.version(1).stores({
      appState: "id",
      notes: "id",
    });

    this.version(2)
      .stores({
        appState: "id",
        notes: "id",
        workspace: "id",
      })
      .upgrade(async (tx) => {
        const legacy = await tx.table("appState").get("current");
        if (!legacy) return; // fresh install, nothing to migrate

        const workspace = wrapLegacyAppState(legacy.data as AppState);
        await tx.table("workspace").put({ id: "current", data: workspace });
        // The v1 "appState" row is deliberately left in place as a rollback snapshot.
      });
  }
}

export const db = new ProductivityDb();
