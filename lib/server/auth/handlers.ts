// The account API, /api/auth/session:
//   GET    who is signed in on this browser, if anyone
//   POST   sign in with a Google ID token; sets the session cookie
//   DELETE sign out; deletes the session and clears the cookie
//
// Kept apart from the route file so tests can call them with a stand-in
// token verifier and a test database.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DbUnavailableError } from "../db";
import { openDb } from "../collections";
import { clientAddress, hit, LIMITS, tooManyRequests } from "../rateLimit";
import { User, type UserRecord } from "../models";
import { errorResponse, isSameOrigin, jsonResponse, readJsonBody } from "../http";
import { InvalidIdTokenError, type GoogleIdentity } from "./googleIdToken";
import {
  createSession,
  deleteSession,
  findSessionUser,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./session";

export interface SignInDeps {
  /** Horizon's Google OAuth client ID: the audience every token must name. */
  clientId: string;
  verifyIdToken: (token: string, audience: string) => Promise<GoogleIdentity>;
}

/** What the browser is told about its account. Deliberately not the whole
 *  user document: no ids, no Google subject. */
export interface AccountView {
  name: string;
  email: string;
}

const toView = (user: UserRecord): AccountView => ({ name: user.name ?? "", email: user.email });

/** An ID token is about 1 KB; anything much bigger isn't one. */
const MAX_SIGN_IN_BYTES = 8 * 1024;
const SignInBody = z.object({ credential: z.string().min(1).max(4096) }).strict();

const unavailable = (error: unknown): Response => {
  // The error's name only: messages can carry connection strings.
  console.error("Accounts unavailable:", error instanceof Error ? error.name : "unknown error");
  return errorResponse(503, "Accounts aren't available right now.");
};

export async function handleGetSession(request: NextRequest): Promise<Response> {
  try {
    await openDb();
    const limited = await hit(LIMITS.session, clientAddress(request));
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);
    const user = await findSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
    return jsonResponse({ account: user ? toView(user) : null });
  } catch (error) {
    return unavailable(error);
  }
}

export async function handleSignIn(request: NextRequest, deps: SignInDeps): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse(403, "Forbidden.");

  // Counted before anything else costs time: each attempt below means a
  // signature check and, on success, a database write (threat D2).
  try {
    await openDb();
    const limited = await hit(LIMITS.signIn, clientAddress(request));
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);
  } catch (error) {
    return unavailable(error);
  }

  const body = await readJsonBody(request, SignInBody, MAX_SIGN_IN_BYTES);
  if (!body.ok) return body.response;

  let identity: GoogleIdentity;
  try {
    identity = await deps.verifyIdToken(body.data.credential, deps.clientId);
  } catch (error) {
    // Logged for spotting attacks (threat R2), by reason only: never the token.
    console.warn("Sign-in rejected:", error instanceof InvalidIdTokenError ? error.reason : "verifier error");
    return errorResponse(401, "Sign-in failed.");
  }

  try {
    const user = await upsertUser(identity);
    const { token, expiresAt } = await createSession(user._id);

    const response = NextResponse.json({ account: toView(user) }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    return unavailable(error);
  }
}

export async function handleSignOut(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse(403, "Forbidden.");
  try {
    await openDb();
    const limited = await hit(LIMITS.session, clientAddress(request));
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);
    await deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
  } catch (error) {
    if (!(error instanceof DbUnavailableError)) return unavailable(error);
  }
  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
  return response;
}

/** Finds the account by Google's subject id, creating it on first sign-in.
 *  Every field comes from the verified token, none from the request. */
async function upsertUser(identity: GoogleIdentity, now = new Date()): Promise<UserRecord> {
  const upsert = () =>
    User.findOneAndUpdate(
      { googleSub: identity.sub },
      { $set: { email: identity.email, name: identity.name, lastSeenAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: "after", lean: true }
    ) as Promise<UserRecord | null>;

  try {
    const user = await upsert();
    if (user) return user;
  } catch (error) {
    // Two first sign-ins for the same account at once: the unique index lets
    // one insert win, and the other's retry finds that document.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const user = await upsert();
  if (!user) throw new Error("User upsert returned nothing");
  return user;
}
