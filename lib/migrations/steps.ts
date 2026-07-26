// The individual workspace migration steps. Each one is a pure
// `Workspace -> Workspace` rewrite, registered in ./index.ts's ordered
// MIGRATIONS list. Keeping the steps here (policy) separate from the
// pipeline there (mechanism) means adding a migration is one new function
// plus one new list entry — nothing else in the app has to know.
//
// Every step must stay idempotent: they ran unconditionally on every load
// before the schemaVersion stamp existed, and a device that syncs down data
// written by an older device replays them against that data too.

import type { Material, PanelColumns, PortfolioProject, RotationDef, TrackId, TrackState, Workspace } from "../types";
import { defaultPanelColumns } from "../modules";
import { LEGACY_PATH_TO_REPO, MATERIAL_REPO_MAP, PORTFOLIO_REPO_MAP } from "../migrationConfig";
import { LEGACY_TRACK_ID } from "../legacyPersonalData";
import { DEFAULT_WEEK_SCHEDULE } from "../constants";

/** Applies a per-track rewrite across every track in the workspace. */
const mapTracks = (workspace: Workspace, rewrite: (track: TrackState) => TrackState): Workspace => {
  const tracks: Record<TrackId, TrackState> = {};
  Object.entries(workspace.tracks).forEach(([id, track]) => {
    tracks[id] = rewrite(track);
  });
  return { ...workspace, tracks };
};

/**
 * migrationConfig.ts's repo maps (m1, p1, ...) were only ever meaningful for
 * the one track created by the pre-multi-track app, so this must never run
 * against any other track — a new track's own material could reuse the id
 * "m1" and must not be silently rewritten.
 */
export const migrateLocalPaths = (workspace: Workspace): Workspace =>
  mapTracks(workspace, (track) => {
    if (track.meta.id !== LEGACY_TRACK_ID) return track;

    const migrateEntry = <T extends { id: string; localPath?: string; repoUrl?: string }>(
      entry: T,
      repoMap: Record<string, string>
    ): T => {
      const updated = { ...entry };
      // Convert old local path → GitHub URL in localPath
      if (entry.localPath && LEGACY_PATH_TO_REPO[entry.localPath]) {
        updated.localPath = LEGACY_PATH_TO_REPO[entry.localPath];
      }
      // Inject repoUrl by ID — always authoritative
      if (repoMap[entry.id]) {
        updated.repoUrl = repoMap[entry.id];
      }
      return updated;
    };

    const next: TrackState = { ...track };
    if (next.portfolio) {
      next.portfolio = next.portfolio.map((proj: PortfolioProject) => migrateEntry(proj, PORTFOLIO_REPO_MAP));
    }
    if (next.materials) {
      next.materials = next.materials.map((mat: Material) => migrateEntry(mat, MATERIAL_REPO_MAP));
    }
    return next;
  });

/**
 * One-time upgrade of the pre-multi-rotation shape (a single rotationConfig
 * + dsaStartWeek, both retired from TrackState) into the general `rotations`
 * list. Only ever touches data synced before this feature existed — every
 * track created since is seeded with `rotations` (or nothing) directly.
 * Splits the old single pattern-vs-interleave rotation into the two
 * rotations it implied, using whatever weekSchedule the track actually has.
 */
export const migrateLegacyRotation = (workspace: Workspace): Workspace =>
  mapTracks(workspace, (track) => {
    const legacy = track as TrackState & {
      rotationConfig?: { weeks: { pattern: string; problems: string }[]; appliesToScheduleType: string };
      dsaStartWeek?: number;
    };
    if (!legacy.rotationConfig) return track;

    const startWeek = legacy.dsaStartWeek || 1;
    const schedule = track.weekSchedule || DEFAULT_WEEK_SCHEDULE;
    const ALL_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const patternDays = schedule.filter((d) => d.type === legacy.rotationConfig!.appliesToScheduleType).map((d) => d.name);
    const interleaveDays = ALL_WEEKDAYS.filter((d) => !patternDays.includes(d));

    const rotations: RotationDef[] = [
      {
        id: "legacy_pattern_rotation",
        label: "Weekly Algorithm",
        items: legacy.rotationConfig.weeks.map((w) => ({ title: w.pattern, description: w.problems })),
        daysOfWeek: patternDays,
        target: "revision",
        startWeek,
      },
    ];
    if (interleaveDays.length > 0) {
      rotations.push({
        id: "legacy_math_interleave",
        label: "Linear Algebra",
        items: [{ title: "Linear Algebra", description: "Practice vector spaces, transforms, and equations" }],
        daysOfWeek: interleaveDays,
        target: "revision",
        startWeek: 1,
      });
    }

    const next = { ...legacy, rotations };
    delete next.rotationConfig;
    delete next.dsaStartWeek;
    return next;
  });

/**
 * One-time move of dashboard layout from the old shared workspace level to
 * per-track. Seeds a track that has no layout of its own from the legacy
 * workspace-wide columns (so an arrangement made before this feature is
 * preserved), or the default. Tracks created since already carry their own.
 */
export const migratePerTrackLayout = (workspace: Workspace): Workspace => {
  const legacyColumns: PanelColumns | undefined = workspace.panelColumns;
  const seeded = mapTracks(workspace, (track) => {
    if (track.panelColumns) return track;
    const seed: PanelColumns = legacyColumns
      ? { left: [...legacyColumns.left], right: [...legacyColumns.right] }
      : defaultPanelColumns();
    return { ...track, panelColumns: seed };
  });
  // Layout now lives per-track; drop the retired workspace-level copy.
  const next = { ...seeded };
  delete next.panelColumns;
  return next;
};
