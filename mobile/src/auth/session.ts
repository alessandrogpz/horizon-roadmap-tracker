// Signing in on the phone, and holding the session afterwards.
//
// The server is the one the website uses, unchanged. Google gives this app an
// ID token, the app posts it to /api/auth/session, the server checks Google's
// signature the same way it does for a browser, and answers with a session
// token.
//
// Where that token then lives is the one real difference between the platforms.
// A browser gets an HttpOnly cookie, which scripts cannot read — the strongest
// place a web page has. A phone has something better: the Android Keystore (and
// the iOS Keychain), hardware-backed storage that other apps cannot read and
// that survives an app restart without being readable from a file dump. So the
// token goes there, and every request carries it as a Bearer header.
//
// Bearer rather than a cookie is also a security property, not a workaround:
// nothing attaches it automatically, so no other app or page can make an
// authenticated request by accident.

import { SERVER_URL, WEB_CLIENT_ID } from "../config";

// Both of these are *native* modules: code compiled into the app, not
// JavaScript downloaded at runtime. A build that predates them — an older
// development build, or Expo Go, which can only ever contain what Expo chose to
// put in it — simply doesn't have them, and importing one at the top of this
// file would crash the whole app on startup.
//
// So they are required lazily, and a missing one is reported as "this build
// can't sign in" rather than taking the rest of the app down with it. That
// distinction between JavaScript and native code, and what it means for
// shipping, is the thing to understand about this platform: new JavaScript can
// be handed to an installed app; new native code needs a new build in the
// user's hands (MOBILE_PLAN.md §6).

type SecureStoreModule = typeof import("expo-secure-store");
type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");

function nativeModule<T>(load: () => T, name: string): T {
  try {
    return load();
  } catch {
    throw new SignInError(`This build of Horizon doesn't include ${name}. Install the newest build to sign in.`);
  }
}

const secureStore = (): SecureStoreModule => nativeModule(() => require("expo-secure-store") as SecureStoreModule, "secure storage");
const googleSignin = (): GoogleSigninModule =>
  nativeModule(() => require("@react-native-google-signin/google-signin") as GoogleSigninModule, "Google sign-in");

const TOKEN_KEY = "horizon.session";

export interface Account {
  name: string;
  email: string;
}

export class SignInError extends Error {
  constructor(
    message: string,
    /** Whether the person simply backed out, which is not worth shouting about. */
    readonly cancelled = false
  ) {
    super(message);
    this.name = "SignInError";
  }
}

let configured = false;

function configure(): void {
  if (configured) return;
  googleSignin().GoogleSignin.configure({
    // Ask Google for an ID token whose audience is the *web* client — the one
    // the server already verifies against. That way the phone needs no change
    // on the server, and one client ID stays the single source of truth for
    // "this is Horizon" (MOBILE_PLAN.md §4).
    webClientId: WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

/** The stored session token, if this device has one. */
export async function storedToken(): Promise<string | null> {
  try {
    return await secureStore().getItemAsync(TOKEN_KEY);
  } catch {
    // A keystore that refuses to open (a corrupted keychain entry after a
    // restore, say) should look like "not signed in", not like a crash.
    return null;
  }
}

async function store(token: string): Promise<void> {
  const SecureStore = secureStore();
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    // Available after the first unlock, so a background sync can run without
    // the phone being unlocked, but not while the device has never been
    // unlocked since boot.
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

async function forget(): Promise<void> {
  await secureStore().deleteItemAsync(TOKEN_KEY).catch(() => undefined);
}

/** Every request to the account API, with the session attached. */
export async function authorized(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await storedToken();
  return fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Horizon-Client": "native",
    },
  });
}

/**
 * Google, then Horizon. Two steps, and the second is the one that matters:
 * Google says who this is, and the server decides whether that means an account
 * here — it never trusts anything the app claims about the person.
 */
export async function signIn(): Promise<Account> {
  configure();

  const { GoogleSignin, statusCodes } = googleSignin();

  let idToken: string | null = null;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    idToken = result.type === "success" ? result.data.idToken : null;
    if (result.type === "cancelled") throw new SignInError("Sign-in cancelled.", true);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === statusCodes.SIGN_IN_CANCELLED) throw new SignInError("Sign-in cancelled.", true);
    if (error instanceof SignInError) throw error;
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new SignInError("This phone has no Google Play services, so Google sign-in isn't available.");
    }
    throw new SignInError("Google sign-in didn't complete.");
  }

  if (!idToken) throw new SignInError("Google didn't return an identity token.");

  const response = await fetch(`${SERVER_URL}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Horizon-Client": "native" },
    body: JSON.stringify({ credential: idToken }),
  });

  if (!response.ok) {
    // The server's messages are deliberately vague (threat I4); say something
    // useful about what the person can do instead of repeating it.
    if (response.status === 429) throw new SignInError("Too many attempts just now. Try again in a minute.");
    throw new SignInError("Horizon couldn't accept that sign-in.");
  }

  const payload = (await response.json()) as { account: Account; token: string };
  await store(payload.token);
  return payload.account;
}

/** Who this device is signed in as, or null. Also the check that a stored
 *  token is still good: the server may have expired or revoked it. */
export async function currentAccount(): Promise<Account | null> {
  if (!(await storedToken())) return null;
  try {
    const response = await authorized("/api/auth/session");
    if (!response.ok) return null;
    return ((await response.json()) as { account: Account | null }).account;
  } catch {
    // Offline: the app still knows it has a token and carries on with the
    // copy on the device. Being unreachable is not being signed out.
    return null;
  }
}

/** Ends the session on the server as well as here, so a copied token dies. */
export async function signOut(): Promise<void> {
  await authorized("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
  // Signing out must always finish, even from a build missing these modules:
  // ending the server's session is the part that matters, and it already has.
  try {
    await googleSignin().GoogleSignin.signOut();
  } catch {
    // Nothing to sign out of here.
  }
  await forget().catch(() => undefined);
}
