// Pure, synchronous queries over a Workspace. No I/O — components can import
// these freely without pulling in Dexie or the network layer.

import type { TrackState, Workspace } from "./types";

/** Tracks a user actually sees — excludes archived (soft-deleted) ones.
 *  Archiving instead of hard-deleting means the deletion itself is just an
 *  ordinary track field change that flows through the normal sync/merge
 *  path, so it propagates correctly across devices instead of a device
 *  that still has the track re-creating it on the next merge (mergeWorkspace
 *  treats "missing on one side" as "not yet synced there," not "deleted"). */
export const visibleTracks = (workspace: Workspace): TrackState[] =>
  Object.values(workspace.tracks).filter((t) => !t.meta.archived);

/**
 * The same tracks, in the order the user put them in.
 *
 * What every list of tracks should render from. Until someone reorders them
 * nothing carries an `order`, and they fall back to the order they were made
 * in — which is what the app did before, and the only sensible default.
 */
export const orderedTracks = (workspace: Workspace): TrackState[] =>
  [...visibleTracks(workspace)].sort(
    (a, b) =>
      (a.meta.order ?? Number.MAX_SAFE_INTEGER) - (b.meta.order ?? Number.MAX_SAFE_INTEGER) ||
      (a.meta.createdAt ?? 0) - (b.meta.createdAt ?? 0)
  );

/** The track the dashboard is currently showing, or null if there isn't one. */
export const activeTrack = (workspace: Workspace): TrackState | null =>
  workspace.tracks[workspace.activeTrackId] ?? null;

/** Replaces the active track, returning a new Workspace. The single spot that
 *  knows how a track update folds back into the workspace shape. */
export const withActiveTrack = (workspace: Workspace, track: TrackState): Workspace => ({
  ...workspace,
  tracks: { ...workspace.tracks, [workspace.activeTrackId]: track },
});
