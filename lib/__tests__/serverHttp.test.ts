import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isSameOrigin, readJsonBody } from "../server/http";
import { hashSessionToken, newSessionToken, sessionCookieOptions } from "../server/auth/session";

const request = (headers: Record<string, string>, body?: string) =>
  new Request("http://localhost:3007/api/auth/session", { method: "POST", headers, body });

describe("isSameOrigin", () => {
  const host = { host: "localhost:3007" };

  it("accepts the site's own pages", () => {
    expect(isSameOrigin(request({ ...host, origin: "http://localhost:3007", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(request({ ...host, origin: "http://localhost:3007" }))).toBe(true);
  });

  it("refuses another site (CSRF)", () => {
    expect(isSameOrigin(request({ ...host, origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(request({ ...host, origin: "http://localhost:3007", "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(request({ ...host, origin: "http://localhost:3007", "sec-fetch-site": "same-site" }))).toBe(false);
  });

  it("refuses a browser-shaped request with no usable Origin", () => {
    // A cookie means a browser attached credentials by itself, which is exactly
    // the case Origin exists to police — so a missing or unusable one is fatal.
    expect(isSameOrigin(request({ ...host, cookie: "__Host-horizon_session=x" }))).toBe(false);
    expect(isSameOrigin(request({ ...host, origin: "null", cookie: "__Host-horizon_session=x" }))).toBe(false);
    expect(isSameOrigin(request({ ...host, origin: "null" }))).toBe(false);
  });

  it("allows a request that carries no cookie at all (the phone, curl, a script)", () => {
    // Nothing was attached on its behalf, so it cannot be a confused deputy:
    // whatever authenticates it — a Bearer token — was supplied deliberately.
    expect(isSameOrigin(request(host))).toBe(true);
    expect(isSameOrigin(request({ ...host, authorization: "Bearer " + "x".repeat(43) }))).toBe(true);
  });

  it("compares the port too", () => {
    expect(isSameOrigin(request({ ...host, origin: "http://localhost:3000" }))).toBe(false);
  });
});

describe("readJsonBody", () => {
  const Schema = z.object({ credential: z.string() }).strict();
  const json = { "content-type": "application/json" };
  const read = (req: Request, max = 100) => readJsonBody(req, Schema, max);

  it("returns the validated body", async () => {
    await expect(read(request(json, '{"credential":"abc"}'))).resolves.toEqual({ ok: true, data: { credential: "abc" } });
  });

  const statusOf = async (req: Request, max?: number) => {
    const result = await read(req, max);
    return result.ok ? 200 : result.response.status;
  };

  it("refuses anything but JSON (415)", async () => {
    expect(await statusOf(request({ "content-type": "text/plain" }, '{"credential":"abc"}'))).toBe(415);
    expect(await statusOf(request({}, '{"credential":"abc"}'))).toBe(415);
  });

  it("refuses oversized bodies, declared or actual (413)", async () => {
    expect(await statusOf(request({ ...json, "content-length": "5000" }, '{"credential":"abc"}'))).toBe(413);
    expect(await statusOf(request(json, JSON.stringify({ credential: "x".repeat(200) })))).toBe(413);
  });

  it("refuses malformed JSON (400)", async () => {
    expect(await statusOf(request(json, "{credential:"))).toBe(400);
  });

  it("refuses unexpected keys, such as a smuggled userId (T2: mass assignment)", async () => {
    expect(await statusOf(request(json, '{"credential":"abc","userId":"someone-else"}'))).toBe(400);
  });

  it("refuses an operator where a plain value belongs (T1: injection)", async () => {
    expect(await statusOf(request(json, '{"credential":{"$ne":null}}'))).toBe(400);
  });
});

describe("session tokens", () => {
  it("are 256 random bits, URL-safe, and never repeat", () => {
    const tokens = new Set(Array.from({ length: 1000 }, newSessionToken));
    expect(tokens.size).toBe(1000);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("are stored as a SHA-256 hash, never as themselves", () => {
    const token = newSessionToken();
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
  });

  it("travel in an HttpOnly, Secure, SameSite=Lax cookie", () => {
    expect(sessionCookieOptions(new Date(0))).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  });
});
