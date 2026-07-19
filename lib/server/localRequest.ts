// Guard for API routes that touch the host machine (spawn processes, read
// local git repos). These only make sense when the app is running on the
// user's own PC, and must not be reachable from other devices when the dev
// server is exposed on the LAN, nor on the Vercel deployment.
//
// Note: the Host header can be forged with a raw client (e.g. curl) by
// someone already on the LAN, but browsers cannot forge it, which blocks
// cross-site and DNS-rebinding requests.

export function isLocalRequest(req: Request): boolean {
  const host = (req.headers.get("host") || "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function localOnlyResponse(): Response {
  return Response.json(
    { error: "This endpoint is only available from localhost." },
    { status: 403 }
  );
}
