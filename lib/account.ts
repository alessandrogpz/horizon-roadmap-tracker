// The browser's side of accounts: talks to /api/auth/session. The session
// itself is an HttpOnly cookie that no script here can read; the server is the
// only judge of who is signed in.

export interface Account {
  name: string;
  email: string;
}

/** Horizon's Google OAuth client ID. Public by design (every visitor's
 *  browser sees it); Google only honours it on the origins listed for it.
 *  Unset means accounts are switched off on this deployment. */
export const googleClientId = (): string => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export class AccountsUnavailableError extends Error {}

const ENDPOINT = "/api/auth/session";

/** Who is signed in on this browser, or null. */
export async function fetchAccount(): Promise<Account | null> {
  const res = await fetch(ENDPOINT, { cache: "no-store" });
  if (!res.ok) throw new AccountsUnavailableError(`HTTP ${res.status}`);
  return ((await res.json()) as { account: Account | null }).account;
}

/** Trades the ID token Google gave the browser for a session cookie. */
export async function signIn(credential: string): Promise<Account> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (res.status === 503) throw new AccountsUnavailableError("HTTP 503");
  if (!res.ok) throw new Error("Sign-in failed. Please try again.");
  return ((await res.json()) as { account: Account }).account;
}

export async function signOut(): Promise<void> {
  const res = await fetch(ENDPOINT, { method: "DELETE" });
  if (!res.ok) throw new Error("Couldn't sign out. Please try again.");
}

// ── Who is signed in, shared across the app ──────────────────────────────
// Settings' Account row and the top bar's sync button both need to know,
// and must agree. `undefined` means not asked yet; `null`, signed out.

type Listener = () => void;
let current: Account | null | undefined;
const listeners = new Set<Listener>();

export const accountStore = {
  get: (): Account | null | undefined => current,
  set(account: Account | null) {
    current = account;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Asks the server, once accounts are switched on. Leaves the store
   *  unknown if the server can't answer. */
  async refresh(): Promise<void> {
    if (!googleClientId()) return accountStore.set(null);
    try {
      accountStore.set(await fetchAccount());
    } catch {
      // Unreachable or not configured: stay unknown, so nothing assumes a session.
    }
  },
};
