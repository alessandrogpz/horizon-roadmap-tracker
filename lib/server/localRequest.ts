// Guard for API routes that touch the host machine (spawn processes, read
// local git repos). These only make sense when the app is running on the
// user's own PC. They must not be reachable from other devices when the dev
// server is exposed on the LAN, nor on the Vercel deployment, nor from other
// websites open in the user's own browser.
//
// A request has to pass three checks:
//
// 1. Host is localhost. Blocks other devices on the LAN (their browsers send
//    the LAN IP) and DNS rebinding (the browser sends the attacker's hostname).
// 2. Origin, when present, is this exact origin. Check 1 alone is not enough:
//    a page on any website can send a request *to* localhost, and the browser
//    sets Host to localhost for it. Browsers send Origin on every cross-origin
//    POST, including the no-cors ones that skip the CORS preflight.
// 3. Sec-Fetch-Site, when present, is "same-origin" or "none" (a URL typed
//    into the address bar). Catches cross-site GETs, which carry no Origin.
//
// A request with neither header comes from a non-browser client such as curl;
// modern browsers always send at least Sec-Fetch-Site, and page scripts cannot
// remove it. What stays open: when the dev server is bound to the LAN
// (`npm run dev:lan`), someone on the LAN with a raw client can forge every
// header. Only a firewall closes that.

import os from "os";
import path from "path";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isLocalRequest(req: Request): boolean {
  // Parsed rather than split on ":", so "[::1]:3000" reads as "[::1]" and
  // tricks like "localhost@evil.com" resolve to the host they really name.
  const host = parseUrl(`http://${req.headers.get("host") ?? ""}`);
  if (!host || !LOCAL_HOSTNAMES.has(host.hostname)) return false;

  // "null" (sandboxed frames, file:// pages) doesn't parse, so it's refused too.
  const origin = req.headers.get("origin");
  if (origin !== null && parseUrl(origin)?.host !== host.host) return false;

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  return true;
}

export function localOnlyResponse(): Response {
  return Response.json(
    { error: "This endpoint is only available from localhost." },
    { status: 403 }
  );
}

/** A path a local tool may have written with a `~`. Only the leading `~/` is
 *  expanded; anywhere else it is an ordinary character in a filename. */
export function resolveHomePath(inputPath: string): string {
  return inputPath.startsWith("~/") ? path.join(os.homedir(), inputPath.slice(2)) : inputPath;
}
