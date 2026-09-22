// The app's state: one workspace, loaded from SQLite on start and written back
// on every change.
//
// Every rule about what an edit *means* comes from the shared core in ../lib —
// the same code the website runs. This file only decides when to read, when to
// write, and what the screens can call. That split is the whole reason a second
// platform is a few weeks of work rather than a rewrite (MOBILE_PLAN.md §3).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { TrackState, Workspace } from "@shared/types";
import { setItemCompletion, type DayItemRef } from "@shared/completions";
import { activeTrack, withActiveTrack } from "@shared/selectors";
import { migrateWorkspace } from "@shared/migrations";
import { blankTrack } from "@shared/templates";
import { todayYMD } from "@shared/dates";
import { loadWorkspace, saveWorkspace } from "../storage/db";

interface WorkspaceValue {
  workspace: Workspace | null;
  track: TrackState | null;
  /** Recomputed when the app comes back from the background, so a phone left
   *  open overnight shows the new day rather than yesterday's. */
  today: string;
  loading: boolean;
  toggleItem: (item: DayItemRef, completed: boolean) => void;
  switchTrack: (trackId: string) => void;
  /** After a sync: the merged workspace the server sent back, already stored. */
  replaceWorkspace: (workspace: Workspace) => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(todayYMD);

  // What is on screen is the truth for the next write; a ref keeps the save
  // path from capturing a stale copy when two taps land in the same tick.
  const current = useRef<Workspace | null>(null);
  current.current = workspace;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadWorkspace();
      if (cancelled) return;

      if (stored) {
        // Data written by an older version is brought up to date by the same
        // migrations the web app runs, so a phone that has been closed for
        // months opens correctly.
        setWorkspace(migrateWorkspace(stored).workspace);
      } else {
        // A first run with no account: start on something usable rather than
        // an empty screen, exactly as the website does.
        const track = blankTrack("My Track", todayYMD());
        const fresh: Workspace = { activeTrackId: track.meta.id, tracks: { [track.meta.id]: track } };
        setWorkspace(fresh);
        await saveWorkspace(fresh);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Android may kill this process while it is in the background, and the date
  // may have changed by the time it comes back. Re-read both on resume.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== "active") return;
      setToday(todayYMD());
      loadWorkspace().then((stored) => {
        if (stored) setWorkspace(migrateWorkspace(stored).workspace);
      });
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);

  /** Applies a change and writes it immediately: there is no "save" moment on
   *  a phone, because there is no reliable moment before being killed. */
  const apply = useCallback((next: Workspace) => {
    setWorkspace(next);
    void saveWorkspace(next);
  }, []);

  const track = workspace ? activeTrack(workspace) : null;

  const toggleItem = useCallback(
    (item: DayItemRef, completed: boolean) => {
      const workspaceNow = current.current;
      if (!workspaceNow) return;
      const trackNow = activeTrack(workspaceNow);
      if (!trackNow) return;
      apply(withActiveTrack(workspaceNow, setItemCompletion(trackNow, item, completed)));
    },
    [apply]
  );

  const switchTrack = useCallback(
    (trackId: string) => {
      const workspaceNow = current.current;
      if (!workspaceNow || !workspaceNow.tracks[trackId]) return;
      apply({ ...workspaceNow, activeTrackId: trackId });
    },
    [apply]
  );

  const replaceWorkspace = useCallback((next: Workspace) => setWorkspace(next), []);

  const value = useMemo<WorkspaceValue>(
    () => ({ workspace, track, today, loading, toggleItem, switchTrack, replaceWorkspace }),
    [workspace, track, today, loading, toggleItem, switchTrack, replaceWorkspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
