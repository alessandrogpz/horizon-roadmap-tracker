// Sign-in, the session cookie and sign-out, end to end against the local
// replica set. The Google token check is replaced by a stand-in (it has its
// own tests in googleIdToken.test.ts); everything else is the real code.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { connectDb, mongoose } from "../server/db";
import { Session, User } from "../server/models";
import { handleGetSession, handleSignIn, handleSignOut } from "../server/auth/handlers";
import { InvalidIdTokenError, type GoogleIdentity } from "../server/auth/googleIdToken";
import { hashSessionToken, SESSION_COOKIE } from "../server/auth/session";

const ORIGIN = "http://localhost:3007";
const ADA: GoogleIdentity = { sub: "google-sub-ada", email: "ada@example.com", name: "Ada" };

/** Accepts exactly one credential, "good-token", as Ada. */
const verifyIdToken = vi.fn(async (token: string): Promise<GoogleIdentity> => {
  if (token === "good-token") return ADA;
  throw new InvalidIdTokenError("stand-in rejection");
});
const deps = { clientId: "test-client", verifyIdToken };

const call = (method: string, { body, cookie, origin = ORIGIN }: { body?: unknown; cookie?: string; origin?: string | null } = {}) => {
  const headers: Record<string, string> = { host: "localhost:3007" };
  if (origin) headers.origin = origin;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = `${SESSION_COOKIE}=${cookie}`;
  return new NextRequest(`${ORIGIN}/api/auth/session`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

/** The session token the response set, or undefined. */
const sessionCookieOf = (response: Response) =>
  response.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
const tokenOf = (response: Response) => sessionCookieOf(response)?.split(";")[0].split("=")[1];

const signIn = () => handleSignIn(call("POST", { body: { credential: "good-token" } }), deps);

beforeAll(async () => {
  await connectDb();
  await Promise.all([User.init(), Session.init()]); // indexes, including the unique one
});
beforeEach(async () => {
  verifyIdToken.mockClear();
  await Promise.all([User.deleteMany({}), Session.deleteMany({})]);
});
afterAll(() => mongoose.disconnect());

describe("sign-in", () => {
  it("creates the user and a session, and sets a locked-down cookie", async () => {
    const response = await signIn();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ account: { name: "Ada", email: "ada@example.com" } });

    const cookie = sessionCookieOf(response)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Domain=/i);

    const users = await User.find().lean();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ googleSub: "google-sub-ada", email: "ada@example.com" });
  });

  it("stores only the token's hash (S4): the token itself is nowhere in the database", async () => {
    const token = tokenOf(await signIn())!;
    const sessions = await Session.find().lean();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]._id).toBe(hashSessionToken(token));
    expect(JSON.stringify(sessions)).not.toContain(token);
  });

  it("finds the same user on the next sign-in, by Google's subject id", async () => {
    await signIn();
    await signIn();
    expect(await User.countDocuments()).toBe(1);
    expect(await Session.countDocuments()).toBe(2); // one per browser
  });

  it("rejects a token the verifier refuses (401), and creates nothing", async () => {
    const response = await handleSignIn(call("POST", { body: { credential: "forged-token" } }), deps);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign-in failed." });
    expect(await User.countDocuments()).toBe(0);
    expect(sessionCookieOf(response)).toBeUndefined();
  });

  it("refuses another site's page before even checking the token (CSRF)", async () => {
    const response = await handleSignIn(call("POST", { body: { credential: "good-token" }, origin: "https://evil.example" }), deps);
    expect(response.status).toBe(403);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("refuses a body carrying anything but the credential (T2)", async () => {
    const response = await handleSignIn(call("POST", { body: { credential: "good-token", googleSub: "someone-else" } }), deps);
    expect(response.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });
});

describe("the session", () => {
  const whoAmI = async (cookie?: string) => (await (await handleGetSession(call("GET", { cookie }))).json()).account;

  it("identifies the browser that holds the cookie", async () => {
    const token = tokenOf(await signIn());
    expect(await whoAmI(token)).toEqual({ name: "Ada", email: "ada@example.com" });
  });

  it("is nobody without a cookie, or with one the server didn't issue", async () => {
    await signIn();
    expect(await whoAmI()).toBeNull();
    expect(await whoAmI("A".repeat(43))).toBeNull();
    expect(await whoAmI("not-even-token-shaped")).toBeNull();
  });

  it("stops working once expired, even before the TTL index deletes it", async () => {
    const token = tokenOf(await signIn())!;
    await Session.updateOne({ _id: hashSessionToken(token) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await whoAmI(token)).toBeNull();
  });

  it("has a TTL index, so MongoDB deletes expired sessions by itself", async () => {
    const indexes = await Session.collection.indexes();
    expect(indexes.find((index) => index.key.expiresAt === 1)?.expireAfterSeconds).toBe(0);
  });
});

describe("sign-out", () => {
  it("deletes the session on the server, so a copied cookie stops working", async () => {
    const token = tokenOf(await signIn())!;
    const response = await handleSignOut(call("DELETE", { cookie: token }));
    expect(response.status).toBe(204);
    expect(sessionCookieOf(response)).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    expect(await Session.countDocuments()).toBe(0);

    const stillSignedIn = await (await handleGetSession(call("GET", { cookie: token }))).json();
    expect(stillSignedIn.account).toBeNull();
  });

  it("refuses another site's page (CSRF)", async () => {
    const token = tokenOf(await signIn())!;
    const response = await handleSignOut(call("DELETE", { cookie: token, origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(await Session.countDocuments()).toBe(1);
  });
});

describe("query filters (T1)", () => {
  const smuggled = JSON.parse('{"$ne": null}'); // what an attacker's JSON would parse to

  it("would let a smuggled operator match any user, through the unprotected native driver", async () => {
    await signIn();
    // The attack. sanitizeFilter is Mongoose's, and the global setting can't
    // be switched off per query, so show it on the raw driver instead. That's
    // also why every body is validated with zod before any query, native or not.
    const leaked = await User.collection.findOne({ googleSub: smuggled });
    expect(leaked).not.toBeNull();
  });

  it("refuse the smuggled operator instead of running it, with the app's setting", async () => {
    await signIn();
    // Wrapped in $eq, it's a value again, and an object can't be a googleSub.
    await expect(User.findOne({ googleSub: smuggled }).lean()).rejects.toThrow(/Cast to string failed/);
  });
});
