import type { AppState, TrackState, Workspace } from "../types";
import { LEGACY_TRACK_ID, LEGACY_ROADMAP_CONTENT } from "../legacyPersonalData";
import { DSA_PATTERN_WEEKS } from "../constants";

/** Wraps a pre-multi-track AppState row into the single legacy track. Used
 *  both by the v1→v2 Dexie migration (lib/localDb.ts) and by lib/googleDrive.ts
 *  when it encounters an old-shape database.json — both call sites use the
 *  exact same LEGACY_TRACK_ID so local and remote data resolve to the same
 *  track instead of forking into duplicates. */
export function wrapLegacyAppState(legacy: AppState): Workspace {
  // hasUnsyncedChanges/lastSyncTime/isReset are workspace-level bookkeeping,
  // not part of TrackState — strip them out of the spread below. The old
  // dsaStartWeek field predates the multi-rotation model; pull it out too
  // so it can seed the migrated rotation's startWeek instead of round-tripping
  // as a dead field.
  const {
    hasUnsyncedChanges: _hasUnsyncedChanges,
    lastSyncTime: _lastSyncTime,
    isReset: _isReset,
    dsaStartWeek: legacyDsaStartWeek,
    ...rest
  } = legacy as AppState & { dsaStartWeek?: number };
  void _hasUnsyncedChanges;
  void _lastSyncTime;
  void _isReset;
  const startWeek = legacyDsaStartWeek || 1;

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
    // Split into the two rotations the old single rotationConfig implied:
    // the pattern itself on the "math"-type days, and a static filler on
    // the rest, matching DEFAULT_WEEK_SCHEDULE's default Mon/Wed/Fri split.
    rotations: [
      {
        id: "legacy_pattern_rotation",
        label: "Weekly Algorithm",
        items: DSA_PATTERN_WEEKS.map((w) => ({ title: w.pattern, description: w.problems })),
        daysOfWeek: ["Mon", "Wed", "Fri"],
        target: "revision",
        startWeek,
      },
      {
        id: "legacy_math_interleave",
        label: "Linear Algebra",
        items: [{ title: "Linear Algebra", description: "Practice vector spaces, transforms, and equations" }],
        daysOfWeek: ["Tue", "Thu", "Sat"],
        target: "revision",
        startWeek: 1,
      },
    ],
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
