"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SyncResult, TrackState, Workspace } from "@/lib/types";
import { createTrack, ensureStarterTrack, fetchWorkspace, updateWorkspace } from "@/lib/workspaceRepo";
import { activeTrack, visibleTracks, withActiveTrack } from "@/lib/selectors";
import { applyDailyResetIfNeeded } from "@/lib/dailyReset";
import { todayYMD } from "@/lib/dates";
import { syncWithServer } from "@/lib/serverSync";
import { accountStore } from "@/lib/account";

/** How long a high-frequency edit (typing, a checkbox) waits before hitting
 *  IndexedDB. Long enough to coalesce a burst of keystrokes, short enough
 *  that the flush-on-hide safety net rarely has to do anything. */
const SAVE_DEBOUNCE_MS = 1000;

export type WorkspaceStatus = "loading" | "ready" | "error";
export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface WorkspaceState {
  workspace: Workspace | null;
  /** The active track, or null while loading / when there are none. */
  track: TrackState | null;
  status: WorkspaceStatus;
  error: string;
  syncStatus: SyncStatus;
  syncError: string;
}

/** Either the next track, or a function receiving the newest one. Prefer the
 *  function form from anything debounced or async — it reads current state at
 *  apply time, so a late write can't clobber an edit made in between. */
export type TrackUpdate = TrackState | ((previous: TrackState) => TrackState);

export interface WorkspaceActions {
  /** Optimistic update plus a debounced save. For high-frequency edits —
   *  typing in a field, ticking a checkbox. */
  updateTrack: (update: TrackUpdate) => void;
  /** Optimistic update plus an immediate save. For discrete commits —
   *  adding, deleting, saving a settings dialog. */
  commitTrack: (update: TrackUpdate, context?: string) => Promise<void>;
  /** Same, for changes that span the workspace rather than one track. */
  commitWorkspace: (workspace: Workspace, options?: { isReset?: boolean }) => Promise<void>;
  /** Writes any pending debounced edit immediately. */
  flush: () => Promise<void>;
  /** Makes another track active, applying its daily reset if one is due. */
  switchTrack: (trackId: string) => Promise<void>;
  /** Adds a new track and makes it active. */
  addTrack: (track: TrackState) => Promise<void>;
  /** Syncs with the account and reloads the merged result. */
  /** The same through the signed-in Horizon account (MongoDB on the server). */
  syncAccount: () => Promise<void>;
  /** Re-reads the workspace from storage. For changes made underneath the
   *  provider — a restored backup, a wiped database — rather than through it. */
  reload: () => Promise<void>;
}

/** Reads the stored workspace, first giving it a starter track if there's
 *  nothing to show — a fresh install, or every track archived — so the app
 *  always opens onto a usable dashboard. */
const loadWorkspace = async (): Promise<Workspace> => {
  const loaded = await fetchWorkspace();
  return visibleTracks(loaded).length > 0 ? loaded : ensureStarterTrack(todayYMD());
};

const StateContext = createContext<WorkspaceState | null>(null);
const ActionsContext = createContext<WorkspaceActions | null>(null);

/** Subscribes to workspace data. Re-renders whenever it changes. */
export function useWorkspace(): WorkspaceState {
  const value = useContext(StateContext);
  if (!value) throw new Error("useWorkspace must be used inside a <WorkspaceProvider>");
  return value;
}

/** Subscribes to the write API only. The returned object is referentially
 *  stable for the provider's lifetime, so components that only mutate — and
 *  never read — don't re-render when the workspace changes. */
export function useWorkspaceActions(): WorkspaceActions {
  const value = useContext(ActionsContext);
  if (!value) throw new Error("useWorkspaceActions must be used inside a <WorkspaceProvider>");
  return value;
}

/**
 * Owns the loaded workspace and every path that writes it.
 *
 * Before this existed, the dashboard and the roadmap page each re-implemented
 * load / optimistic-update / debounce / persist on their own, and modals took
 * four separate mutation callbacks as props. Everything now goes through the
 * two hooks above, so there is one place where a save can be scheduled,
 * flushed, or ordered against a sync.
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>("loading");
  const [error, setError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState("");

  // Debounced saves and the beforeunload flush both read the newest workspace
  // through this ref, so a save that fires later never persists a stale
  // snapshot. It's written synchronously alongside setWorkspace rather than
  // in an effect, so it is already correct by the time a handler runs.
  const workspaceRef = useRef<Workspace | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const applyWorkspace = useCallback((next: Workspace) => {
    workspaceRef.current = next;
    setWorkspace(next);
  }, []);

  const persist = useCallback(
    async (next: Workspace, context: string) => {
      try {
        const { hasUnsyncedChanges } = await updateWorkspace(next);
        // The header's sync status reads this flag from memory, but only the
        // save decides it (it sets it when something really changed). Copy it
        // onto the newest in-memory workspace: just the flag, so an edit made
        // in the meantime isn't overwritten.
        const current = workspaceRef.current;
        if (hasUnsyncedChanges && current && !current.hasUnsyncedChanges) {
          applyWorkspace({ ...current, hasUnsyncedChanges: true });
        }
      } catch (err) {
        console.error(`Failed to save ${context}`, err);
      }
    },
    [applyWorkspace]
  );

  const flush = useCallback(async () => {
    if (!saveTimeoutRef.current) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    const pending = workspaceRef.current;
    if (pending) await persist(pending, "pending changes");
  }, [persist]);

  /** Resolves an updater against the newest active track. */
  const resolve = useCallback((update: TrackUpdate): Workspace | null => {
    const current = workspaceRef.current;
    if (!current) return null;
    const previous = activeTrack(current);
    if (!previous) return null;
    return withActiveTrack(current, typeof update === "function" ? update(previous) : update);
  }, []);

  const updateTrack = useCallback(
    (update: TrackUpdate) => {
      const next = resolve(update);
      if (!next) return;
      applyWorkspace(next);

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        const pending = workspaceRef.current;
        if (pending) void persist(pending, "auto-saved changes");
      }, SAVE_DEBOUNCE_MS);
    },
    [applyWorkspace, persist, resolve]
  );

  const commitWorkspace = useCallback(
    async (next: Workspace, options?: { isReset?: boolean }) => {
      // An immediate write supersedes anything the debounce still owes.
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      applyWorkspace(next);
      await persist(options?.isReset ? { ...next, isReset: true } : next, "changes");
    },
    [applyWorkspace, persist]
  );

  const commitTrack = useCallback(
    async (update: TrackUpdate, context = "changes") => {
      const next = resolve(update);
      if (!next) return;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      applyWorkspace(next);
      await persist(next, context);
    },
    [applyWorkspace, persist, resolve]
  );

  const switchTrack = useCallback(
    async (trackId: string) => {
      const current = workspaceRef.current;
      if (!current || !current.tracks[trackId]) return;

      // A track that hasn't been looked at since yesterday still has
      // yesterday's checkboxes ticked — run its reset as it comes into view,
      // exactly as the initial load does for whichever track was active then.
      const { data: resetTrack } = applyDailyResetIfNeeded(current.tracks[trackId], todayYMD());
      const next: Workspace = {
        ...current,
        activeTrackId: trackId,
        tracks: { ...current.tracks, [trackId]: resetTrack },
      };
      await commitWorkspace(next, { isReset: true });
    },
    [commitWorkspace]
  );

  const reload = useCallback(async () => {
    applyWorkspace(await loadWorkspace());
    setStatus("ready");
  }, [applyWorkspace]);

  const addTrack = useCallback(
    async (track: TrackState) => {
      // createTrack builds on what's stored, so an edit still waiting in the
      // debounce has to land first or the new track's write would drop it.
      await flush();
      await createTrack(track);
      await reload();
      await switchTrack(track.meta.id); // applies its first daily reset
    },
    [flush, reload, switchTrack]
  );

  /** Shared by both sync targets: status, the pre-sync flush, the reload. */
  const runSync = useCallback(
    async (run: () => Promise<SyncResult>) => {
      setSyncStatus("syncing");
      setSyncError("");
      try {
        // Make sure a just-made edit (a checkbox toggled seconds ago) has
        // actually landed in Dexie before the sync engine reads it — otherwise
        // this sync can push a snapshot missing the very change the user made
        // and then clicked Sync to send.
        await flush();
        const res = await run();
        if (!res.success) throw new Error(res.error || "Unknown sync error");

        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 3000);
        await reload();
      } catch (err) {
        console.error("Workspace sync failed:", err);
        setSyncStatus("error");
        setSyncError(err instanceof Error ? err.message : "Failed to sync workspace");
        setTimeout(() => setSyncStatus("idle"), 5000);
      }
    },
    [flush, reload]
  );

  const syncAccount = useCallback(
    () =>
      runSync(async () => {
        const res = await syncWithServer();
        // The session ended (expired, or signed out elsewhere): show it.
        if (res.authRequired) accountStore.set(null);
        return res;
      }),
    [runSync]
  );

  // Initial load: adopt the stored workspace, fall back off an archived active
  // track, and apply the daily reset before the first paint of real data.
  useEffect(() => {
    let cancelled = false;

    loadWorkspace()
      .then(async (loaded) => {
        if (cancelled) return;

        const visible = visibleTracks(loaded);

        // The active track may have been archived from another device since
        // this one last synced — fall back to the first visible track rather
        // than rendering an archived one.
        const activeIsVisible = !loaded.tracks[loaded.activeTrackId]?.meta.archived;
        const effective = activeIsVisible ? loaded : { ...loaded, activeTrackId: visible[0].meta.id };

        const { data: resetTrack, changed } = applyDailyResetIfNeeded(
          effective.tracks[effective.activeTrackId],
          todayYMD()
        );
        const final = withActiveTrack(effective, resetTrack);
        applyWorkspace(final);
        setStatus("ready");

        if (changed || !activeIsVisible) {
          await persist({ ...final, isReset: true }, "daily reset");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Workspace load failed:", err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [applyWorkspace, persist]);

  // Flush any pending debounced save when the tab is backgrounded or closed,
  // so a checkbox ticked right before closing the app isn't silently lost.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => {
      void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [flush]);

  const state = useMemo<WorkspaceState>(
    () => ({
      workspace,
      track: workspace ? activeTrack(workspace) : null,
      status,
      error,
      syncStatus,
      syncError,
    }),
    [workspace, status, error, syncStatus, syncError]
  );

  const actions = useMemo<WorkspaceActions>(
    () => ({ updateTrack, commitTrack, commitWorkspace, flush, switchTrack, addTrack, syncAccount, reload }),
    [updateTrack, commitTrack, commitWorkspace, flush, switchTrack, addTrack, syncAccount, reload]
  );

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
}
