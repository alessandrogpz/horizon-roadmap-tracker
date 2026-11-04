"use client";

import React, { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { accountStore, AccountsUnavailableError, deleteAccount, fetchAccount, googleClientId, signIn, signOut } from "@/lib/account";
import { getGoogleAccountsId } from "@/lib/googleSignIn";
import { loadGoogleGisScript } from "@/lib/googleSignIn";
import { resolvedTheme } from "@/lib/theme";
import { useAccount } from "@/components/useAccount";
import { useWorkspaceActions } from "@/components/workspace/WorkspaceProvider";

const quietButton =
  "rounded-[var(--radius-control)] border border-card-border bg-surface-muted px-3 py-1.5 text-[0.8rem] text-foreground cursor-pointer transition-colors hover:border-card-border-hover hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Settings' Account row: Google's own sign-in button when signed out, the
 * account and a sign-out button when signed in. Only rendered when the
 * deployment has a client ID (see googleClientId).
 *
 * Signed in, the top bar's sync button syncs through the account instead of
 * Drive. Signing in runs that first sync straight away, so the account gets
 * this device's data (or, on a device with nothing of its own yet, this device
 * gets the account's).
 */
export default function AccountRow() {
  const account = useAccount(false);
  const { syncAccount } = useWorkspaceActions();
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Ask afresh each time Settings opens: the session may have ended elsewhere.
  useEffect(() => {
    let cancelled = false;
    fetchAccount()
      .then((fresh) => {
        if (!cancelled) accountStore.set(fresh);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signedOut = account === null && !unavailable;

  // Google renders its own button, in an iframe, into this div. The ID token
  // it returns goes straight to our server, which verifies it.
  useEffect(() => {
    if (!signedOut) return;
    let cancelled = false;
    loadGoogleGisScript()
      .then(() => {
        const accountsId = getGoogleAccountsId();
        if (cancelled || !accountsId || !buttonRef.current) return;
        accountsId.initialize({
          client_id: googleClientId(),
          ux_mode: "popup",
          auto_select: false,
          callback: async ({ credential }) => {
            setBusy(true);
            setError("");
            try {
              accountStore.set(await signIn(credential));
              void syncAccount();
            } catch (err) {
              if (err instanceof AccountsUnavailableError) setUnavailable(true);
              else setError(err instanceof Error ? err.message : "Sign-in failed.");
            } finally {
              setBusy(false);
            }
          },
        });
        accountsId.renderButton(buttonRef.current, {
          type: "standard",
          theme: resolvedTheme() === "dark" ? "filled_black" : "outline",
          size: "medium",
          text: "signin_with",
          shape: "rectangular",
        });
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load Google sign-in. Check your connection.");
      });
    return () => {
      cancelled = true;
    };
  }, [signedOut, syncAccount]);

  const handleSignOut = async () => {
    setBusy(true);
    setError("");
    try {
      await signOut();
      getGoogleAccountsId()?.disableAutoSelect();
      accountStore.set(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign out.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
      getGoogleAccountsId()?.disableAutoSelect();
      setConfirmDelete(false);
      setDeleted(true);
      accountStore.set(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the account.");
    } finally {
      setBusy(false);
    }
  };

  const hint = unavailable
    ? "Accounts aren't available on this server right now."
    : account
      ? `Signed in as ${account.name || account.email} (${account.email}). The sync button at the top syncs through this account; your data stays on this device too.`
      : account === null
        ? `${deleted ? "Your account and everything it stored on the server are deleted; this device keeps its own copy. " : ""}Sign in with Google to sync your tracks and notes through your own Horizon account. Signed out, Cloud sync below works through Drive as before.`
        : "Checking…";

  return (
    <div className="flex flex-col gap-2 border-b border-card-border py-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-6 sm:gap-y-3">
      <div className="flex gap-2.5">
        <span className="mt-0.5 text-muted-foreground">
          <UserRound size={16} strokeWidth={2} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.95rem] font-semibold text-foreground">Account</span>
          <span className="text-[0.8rem] leading-snug text-muted-foreground">{hint}</span>
          {error && <span className="text-[0.8rem] text-red-400">{error}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {signedOut && <div ref={buttonRef} aria-busy={busy} />}
        {account && (
          <>
            <button onClick={handleSignOut} disabled={busy} className={quietButton}>
              {busy && !confirmDelete ? "Signing out…" : "Sign out"}
            </button>
            {!confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="cursor-pointer rounded-[var(--radius-control)] border border-red-500/30 bg-transparent px-3 py-1.5 text-[0.8rem] text-red-400 transition-colors hover:bg-red-500/10"
              >
                Delete account…
              </button>
            )}
          </>
        )}
      </div>
      {account && confirmDelete && (
        <div className="flex basis-full flex-col gap-2 rounded-[var(--radius-inner)] border border-red-500/30 bg-red-500/[0.05] px-3 py-2.5 sm:order-last">
          <span className="text-[0.8rem] leading-snug text-foreground">
            Delete your Horizon account and everything it stores on the server: tracks, progress, notes and
            history, from every device. This can&apos;t be undone. The data on this device stays, and the app keeps
            working without an account.
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={busy}
              className="cursor-pointer rounded-[var(--radius-control)] border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-[0.8rem] font-semibold text-red-400 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Yes, delete my account"}
            </button>
            <button onClick={() => setConfirmDelete(false)} disabled={busy} className={quietButton}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
