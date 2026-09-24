// Sync, as something the whole app can see and trigger.
//
// It used to live on the Account screen, four taps from anywhere — which meant
// that in practice the phone synced when someone remembered to go and make it,
// and the rest of the time nobody could tell whether it had. Both halves of
// that are wrong: on a phone, syncing should be ambient.
//
// So this holds one status for the app. The header shows it, every scrollable
// screen can pull down to trigger it, and it runs by itself when the app comes
// back to the foreground — the moment most likely to follow an edit made on
// the laptop.
//
// The status deliberately distinguishes offline from broken. A phone is
// offline constantly and that is not a failure: the app works entirely on its
// own copy, and saying "error" every time a train enters a tunnel teaches
// people to ignore the indicator.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { storedToken } from "../auth/session";
import { syncWithServer } from "./syncWithServer";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export type SyncState =
  /** No account on this device. Everything works; nothing leaves the phone. */
  | "signed-out"
  /** Signed in, nothing in flight. */
  | "idle"
  | "syncing"
  /** The request never reached the server. Normal, and not an error. */
  | "offline"
  /** The server answered and said no. */
  | "error";

interface SyncValue {
  state: SyncState;
  /** The last thing sync said, for screens that want to show it in full. */
  message: string;
  /** When the last successful sync finished, as ms since the epoch. */
  lastSyncedAt: number | null;
  /** Runs a sync. Safe to call from anywhere; overlapping calls collapse. */
  sync: () => Promise<void>;
  /** Re-reads whether there is an account, after signing in or out. */
  refreshAccount: () => Promise<void>;
}

const SyncContext = createContext<SyncValue | null>(null);

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useSync must be used inside SyncProvider");
  return value;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { replaceWorkspace } = useWorkspace();

  const [state, setState] = useState<SyncState>("signed-out");
  const [message, setMessage] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // Two syncs at once would each merge against a copy the other is about to
  // replace. A ref rather than state because the guard has to be read and set
  // within a single call, before React has re-rendered anything.
  const inFlight = useRef(false);
  const signedIn = useRef(false);

  const refreshAccount = useCallback(async () => {
    signedIn.current = !!(await storedToken());
    setState((current) => {
      if (!signedIn.current) return "signed-out";
      return current === "signed-out" ? "idle" : current;
    });
  }, []);

  const sync = useCallback(async () => {
    if (inFlight.current) return;
    if (!signedIn.current) {
      // Pulling to refresh while signed out is a fair thing to do; it should
      // say why nothing happened rather than appear to work.
      setMessage("Not signed in, so there is nothing to sync with.");
      setState("signed-out");
      return;
    }

    inFlight.current = true;
    setState("syncing");
    try {
      const outcome = await syncWithServer();
      setMessage(outcome.message);
      if (outcome.workspace) replaceWorkspace(outcome.workspace);
      if (outcome.ok) {
        setLastSyncedAt(Date.now());
        setState("idle");
      } else if (/connection/i.test(outcome.message)) {
        setState("offline");
      } else if (/signed out/i.test(outcome.message)) {
        signedIn.current = false;
        setState("signed-out");
      } else {
        setState("error");
      }
    } finally {
      inFlight.current = false;
    }
  }, [replaceWorkspace]);

  // On open, and whenever the app returns to the foreground: the laptop may
  // have moved on while the phone was in a pocket.
  useEffect(() => {
    void (async () => {
      await refreshAccount();
      void sync();
    })();

    const onChange = (status: AppStateStatus) => {
      if (status !== "active") return;
      void (async () => {
        await refreshAccount();
        void sync();
      })();
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [refreshAccount, sync]);

  const value = useMemo<SyncValue>(
    () => ({ state, message, lastSyncedAt, sync, refreshAccount }),
    [state, message, lastSyncedAt, sync, refreshAccount]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/** "just now", "12 min ago", "yesterday" — enough to answer "is this current?"
 *  without a timestamp nobody wants to parse on a header chip. */
export function describeLastSync(at: number | null): string {
  if (at === null) return "not yet";
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
