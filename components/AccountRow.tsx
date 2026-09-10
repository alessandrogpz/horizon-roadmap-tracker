"use client";

import React, { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { AccountsUnavailableError, fetchAccount, googleClientId, signIn, signOut, type Account } from "@/lib/account";
import { getGoogleAccountsId } from "@/lib/googleSignIn";
import { loadGoogleGisScript } from "@/lib/googleDrive";
import { resolvedTheme } from "@/lib/theme";

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; account: Account }
  | { status: "unavailable" };

const quietButton =
  "rounded-[var(--radius-control)] border border-card-border bg-surface-muted px-3 py-1.5 text-[0.78rem] text-foreground cursor-pointer transition-colors hover:border-card-border-hover hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Settings' Account row: Google's own sign-in button when signed out, the
 * account and a sign-out button when signed in. Only rendered when the
 * deployment has a client ID (see googleClientId).
 *
 * Signing in only creates the account for now. Syncing tracks through it
 * comes next (MODULES_PLAN.md step 4f); until then Drive sync is unchanged.
 */
export default function AccountRow() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAccount()
      .then((account) => {
        if (!cancelled) setState(account ? { status: "signed-in", account } : { status: "signed-out" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Google renders its own button, in an iframe, into this div. The ID token
  // it returns goes straight to our server, which verifies it.
  useEffect(() => {
    if (state.status !== "signed-out") return;
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
              const account = await signIn(credential);
              setState({ status: "signed-in", account });
            } catch (err) {
              if (err instanceof AccountsUnavailableError) setState({ status: "unavailable" });
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
  }, [state.status]);

  const handleSignOut = async () => {
    setBusy(true);
    setError("");
    try {
      await signOut();
      getGoogleAccountsId()?.disableAutoSelect();
      setState({ status: "signed-out" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign out.");
    } finally {
      setBusy(false);
    }
  };

  const hint =
    state.status === "signed-in"
      ? `Signed in as ${state.account.name || state.account.email} (${state.account.email}).`
      : state.status === "unavailable"
        ? "Accounts aren't available on this server right now."
        : "Sign in with Google to create your Horizon account. Syncing your tracks through it is coming; until then, Cloud sync below works as before.";

  return (
    <div className="flex flex-col gap-2 border-b border-card-border py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex gap-2.5">
        <span className="mt-0.5 text-muted-foreground">
          <UserRound size={16} strokeWidth={2} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.9rem] font-semibold text-foreground">Account</span>
          <span className="text-[0.78rem] leading-snug text-muted-foreground">{hint}</span>
          {error && <span className="text-[0.78rem] text-red-400">{error}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {state.status === "signed-out" && <div ref={buttonRef} aria-busy={busy} />}
        {state.status === "signed-in" && (
          <button onClick={handleSignOut} disabled={busy} className={quietButton}>
            {busy ? "Signing out…" : "Sign out"}
          </button>
        )}
      </div>
    </div>
  );
}
