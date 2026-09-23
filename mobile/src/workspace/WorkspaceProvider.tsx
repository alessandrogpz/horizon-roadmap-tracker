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
import { applyTrackBookkeeping } from "@shared/bookkeeping";
import { blankTrack } from "@shared/templates";
import { todayYMD } from "@shared/dates";
import { applyDailyResetIfNeeded } from "@shared/dailyReset";
import { clearAll, loadWorkspace, saveWorkspace } from "../storage/db";

interface WorkspaceValue {
  workspace: Workspace | null;
  track: TrackState | null;
  /** Recomputed when the app comes back from the background, so a phone left
   *  open overnight shows the new day rather than yesterday's. */
  today: string;
  loading: boolean;
  toggleItem: (item: DayItemRef, completed: boolean) => void;
  /** Any other change to the open track, expressed with the shared core's own
   *  mutations (`trackActions`), stamped and stored the same way. */
  editTrack: (change: (track: TrackState) => TrackState) => void;
  switchTrack: (trackId: string) => void;
  /** After a sync: the merged workspace the server sent back, already stored. */
  replaceWorkspace: (workspace: Workspace) => void;
  /** Forgets everything this device holds and starts again, as on first run.
   *  What is in the account is untouched — signing in brings it back. */
  resetLocal: () => Promise<void>;
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
        setWorkspace(await withDailyReset(migrateWorkspace(stored).workspace));
      } else {
        setWorkspace(await freshWorkspace());
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
      loadWorkspace().then(async (stored) => {
        if (stored) setWorkspace(await withDailyReset(migrateWorkspace(stored).workspace));
      });
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);

  /**
   * Applies a change and writes it immediately: there is no "save" moment on a
   * phone, because there is no reliable moment before being killed.
   *
   * `applyTrackBookkeeping` first, and it is not optional. It stamps which
   * items changed on this device and when — the timestamps the server's merge
   * compares. Without them an untick carries no evidence that it happened, so
   * the account's timestamped copy wins and the tick reappears on the next
   * sync. The website has always run this on every save; the phone skipped it
   * until a real untick came back from the server.
   */
  const apply = useCallback((previous: Workspace, next: Workspace, trackId: string) => {
    const { track: bookkept } = applyTrackBookkeeping(previous.tracks[trackId], next.tracks[trackId], false);
    const stamped: Workspace = { ...next, tracks: { ...next.tracks, [trackId]: bookkept } };
    setWorkspace(stamped);
    void saveWorkspace(stamped);
  }, []);

  const track = workspace ? activeTrack(workspace) : null;

  const toggleItem = useCallback(
    (item: DayItemRef, completed: boolean) => {
      const workspaceNow = current.current;
      if (!workspaceNow) return;
      const trackNow = activeTrack(workspaceNow);
      if (!trackNow) return;
      apply(workspaceNow, withActiveTrack(workspaceNow, setItemCompletion(trackNow, item, completed)), trackNow.meta.id);
    },
    [apply]
  );

  const editTrack = useCallback(
    (change: (track: TrackState) => TrackState) => {
      const workspaceNow = current.current;
      if (!workspaceNow) return;
      const trackNow = activeTrack(workspaceNow);
      if (!trackNow) return;
      apply(workspaceNow, withActiveTrack(workspaceNow, change(trackNow)), trackNow.meta.id);
    },
    [apply]
  );

  const switchTrack = useCallback(
    (trackId: string) => {
      const workspaceNow = current.current;
      if (!workspaceNow || !workspaceNow.tracks[trackId]) return;
      // Switching tracks changes no track's contents, so it needs no stamping.
      const next = { ...workspaceNow, activeTrackId: trackId };
      setWorkspace(next);
      void saveWorkspace(next);
    },
    [apply]
  );

  const replaceWorkspace = useCallback((next: Workspace) => setWorkspace(next), []);

  const resetLocal = useCallback(async () => {
    await clearAll();
    setWorkspace(await freshWorkspace());
  }, []);

  const value = useMemo<WorkspaceValue>(
    () => ({ workspace, track, today, loading, toggleItem, editTrack, switchTrack, replaceWorkspace, resetLocal }),
    [workspace, track, today, loading, toggleItem, editTrack, switchTrack, replaceWorkspace, resetLocal]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** A first run: something usable rather than an empty screen, exactly as the
 *  website does. Also what "delete local data" leaves behind. */
async function freshWorkspace(): Promise<Workspace> {
  const track = blankTrack("My Track", todayYMD());
  const fresh: Workspace = { activeTrackId: track.meta.id, tracks: { [track.meta.id]: track } };
  await saveWorkspace(fresh);
  return fresh;
}

/**
 * Yesterday's ticks don't carry into today. The website runs this on load and
 * whenever a track comes into view; a phone needs it in the same places and one
 * more — coming back from the background, where the day may have rolled over
 * while the app sat in the switcher.
 *
 * It is written back immediately, because a reset that exists only in memory
 * would be undone by the next process kill.
 */
async function withDailyReset(workspace: Workspace): Promise<Workspace> {
  const today = todayYMD();
  let changedAny = false;
  const tracks: Workspace["tracks"] = {};

  for (const [id, track] of Object.entries(workspace.tracks)) {
    const { data, changed } = applyDailyResetIfNeeded(track, today);
    tracks[id] = data;
    changedAny ||= changed;
  }

  if (!changedAny) return workspace;
  const next = { ...workspace, tracks };
  await saveWorkspace(next);
  return next;
}
