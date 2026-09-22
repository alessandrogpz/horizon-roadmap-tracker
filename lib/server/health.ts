// GET /api/health: can this deployment actually serve a request?
//
// Watched every half hour by .github/workflows/uptime.yml, which fails the run
// — and so sends an email — when this stops answering 200. It exists because
// "the site is up" and "the site works" are different claims: the page is
// static and served by the CDN, so it keeps loading perfectly while the
// database is unreachable and every sync fails.
//
// What it answers with is deliberately dull: `{"ok":true}` or `{"ok":false}`,
// and an HTTP status. No version, no hostname, no error text, no counts —
// nothing that helps someone map the system (threat I4). The check is one
// `ping` command, cheap enough to run on a schedule and not worth flooding.

import { connectDb, mongoose } from "./db";

const NO_STORE = { "Cache-Control": "no-store", "Content-Type": "application/json" };

export async function handleHealth(): Promise<Response> {
  try {
    await connectDb();
    await mongoose.connection.db!.admin().command({ ping: 1 });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("Health check failed:", error instanceof Error ? error.name : "unknown error");
    return new Response(JSON.stringify({ ok: false }), { status: 503, headers: NO_STORE });
  }
}
