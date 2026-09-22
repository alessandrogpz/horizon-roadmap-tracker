// Server-side sessions. Signing in gives the browser a random token in a
// cookie; the database keeps only the token's hash, which user it belongs to,
// and when it expires. Because the session lives on the server, signing out
// really ends it: the document is deleted, and a copied cookie stops working.

import { createHash, randomBytes } from "node:crypto";
import { mongoose } from "../db";
import { Session, User, type UserRecord } from "../models";

/** The `__Host-` prefix makes browsers refuse the cookie unless it's Secure,
 *  has Path=/ and names no Domain, so no subdomain can plant or overwrite it. */
export const SESSION_COOKIE = "__Host-horizon_session";

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, then sign in again

/** 32 random bytes (256 bits) from the OS's secure generator, as base64url:
 *  43 characters, far beyond guessing (threat S4). */
export const newSessionToken = (): string => randomBytes(32).toString("base64url");

/** What the database stores in place of the token. */
export const hashSessionToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/** A token that can't be one of ours is rejected before any hashing or query. */
const looksLikeToken = (token: string | undefined): token is string =>
  typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);

export async function createSession(
  userId: mongoose.Types.ObjectId,
  now = new Date()
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
  await Session.create({ _id: hashSessionToken(token), userId, createdAt: now, expiresAt });
  return { token, expiresAt };
}

/**
 * The session token a request carries, from either of the two ways a client can
 * hold one.
 *
 * A browser uses the cookie: it is set and sent by the browser itself, marked
 * HttpOnly so no script can read it, which is the strongest place a web page
 * has to keep a secret.
 *
 * A phone has no such place. React Native's networking does have a cookie jar,
 * but relying on it means the app cannot see or manage its own session, and the
 * token would sit in a general-purpose store rather than the platform's
 * protected one. So a native client keeps the token in the Android Keystore or
 * the iOS Keychain and sends it explicitly, the way any API client would.
 *
 * `Bearer` is deliberate: unlike a cookie, it is never attached automatically,
 * so a request carrying it cannot be forged by another site simply by pointing
 * a browser at this API — which is the whole shape of CSRF (threat T5).
 */
export function sessionTokenFrom(request: { cookies: { get(name: string): { value: string } | undefined }; headers: Headers }): string | undefined {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return request.cookies.get(SESSION_COOKIE)?.value;
}

/** The signed-in user for a cookie's token, or null. */
export async function findSessionUser(token: string | undefined, now = new Date()): Promise<UserRecord | null> {
  if (!looksLikeToken(token)) return null;
  const session = await Session.findOne({
    _id: hashSessionToken(token),
    // The TTL index deletes expired sessions within about a minute; this
    // closes that gap. trusted(): $gt is ours, not from the request.
    expiresAt: mongoose.trusted({ $gt: now }),
  }).lean<{ userId: mongoose.Types.ObjectId }>();
  if (!session) return null;
  return User.findById(session.userId).lean<UserRecord>();
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!looksLikeToken(token)) return;
  await Session.deleteOne({ _id: hashSessionToken(token) });
}

/** Cookie flags (threat S3): HttpOnly, so page scripts, and any injected
 *  script, can't read it; Secure, HTTPS only (browsers treat localhost as
 *  secure too); SameSite=Lax, so other sites' pages can't make the browser
 *  send it with a POST. */
export const sessionCookieOptions = (expiresAt: Date) =>
  ({ httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: expiresAt }) as const;
