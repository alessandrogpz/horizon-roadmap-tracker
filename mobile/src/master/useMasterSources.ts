// The tracks every all-tracks tab is built from: the list, in the order the
// user put it in, minus whatever has been switched off.
//
// One hook so the four tabs cannot disagree about what "all tracks" means —
// and so switching a track off repaints all of them, not just the tab the
// switch was on.

import { useMemo } from "react";
import { orderedTracks } from "@shared/selectors";
import { masterSources } from "@shared/masterTrack";
import type { TrackState } from "@shared/types";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { useMasterMode } from "./MasterMode";

export function useMasterSources(): { tracks: TrackState[]; sources: TrackState[]; today: string } {
  const { workspace, today } = useWorkspace();
  const { excluded } = useMasterMode();

  const tracks = useMemo(() => (workspace ? orderedTracks(workspace) : []), [workspace]);
  const sources = useMemo(() => masterSources(tracks, excluded), [excluded, tracks]);

  return { tracks, sources, today };
}
