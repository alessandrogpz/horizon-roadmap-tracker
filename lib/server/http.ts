// Request checks shared by the account and sync routes. Everything a browser
// sends is untrusted until it has been through here.

import type { z } from "zod";

/** Every response from these routes is personal: never cache it anywhere. */
const NO_STORE = { "Cache-Control": "no-store" };

/** Generic messages only: details go to the server log, never to the client
 *  (threat I4). */
export const jsonResponse = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: NO_STORE });

export const errorResponse = (status: number, message: string): Response =>
  jsonResponse({ error: message }, status);

/**
 * For requests that change something (sign in, sign out, sync): refuse anything
 * not sent by this site's own pages. SameSite=Lax cookies already stop other
 * sites' pages from sending the session with a POST; this is the second line
 * against cross-site request forgery (CSRF).
 *
 * Browsers attach Origin to every POST, PUT and DELETE, and page scripts
 * can't forge it. Sec-Fetch-Site, when present, must agree. A request without
 * Origin didn't come from a browser page, and has no business here either.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false; // includes "null", sent by sandboxed frames and file:// pages
  }
  if (originHost !== host) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === null || fetchSite === "same-origin";
}

export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * Reads a JSON body and validates it against a zod schema, rejecting before
 * any of it reaches the database:
 * - anything but application/json (other sites can't send that type without a
 *   CORS preflight, which these routes never approve);
 * - bodies over `maxBytes` (threat D1), judged by the declared length first,
 *   then by what actually arrived;
 * - malformed JSON, and anything the schema doesn't describe exactly (use
 *   strict schemas, so unexpected keys such as `userId` are refused: threats
 *   T1 and T2).
 */
export async function readJsonBody<T>(request: Request, schema: z.ZodType<T>, maxBytes: number): Promise<BodyResult<T>> {
  const fail = (status: number, message: string): BodyResult<T> => ({ ok: false, response: errorResponse(status, message) });

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return fail(415, "Expected application/json.");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return fail(413, "Request too large.");

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return fail(413, "Request too large.");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(400, "Malformed request.");
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? { ok: true, data: parsed.data } : fail(400, "Malformed request.");
}
