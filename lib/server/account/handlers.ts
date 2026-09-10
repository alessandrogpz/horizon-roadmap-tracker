// DELETE /api/account: deletes the signed-in account and everything stored
// for it on the server. The right to erasure (GDPR, article 17).
//
// MongoDB has no foreign keys and no cascading deletes: removing a user
// doesn't remove the documents that point at it. So the application does
// the cascade itself, over every collection that holds a userId, inside one
// transaction: either everything goes, or (if anything fails) nothing does,
// and the account is never left half-deleted.
//
// The data on the device stays. The app keeps working offline, and signing
// in again later starts a new, empty account.

import { NextResponse, type NextRequest } from "next/server";
import { AUDIT_LOG, COMPLETIONS, NOTES, openDb, TRACKS } from "../collections";
import { errorResponse, isSameOrigin } from "../http";
import { clientAddress, hit, LIMITS, tooManyRequests } from "../rateLimit";
import { requireUser } from "../sync/handlers";
import { inTransaction } from "../sync/store";
import { SESSION_COOKIE, sessionCookieOptions } from "../auth/session";

/** Every collection holding documents with the user's id, the user last. */
const OWNED = [TRACKS, COMPLETIONS, NOTES, AUDIT_LOG, "sessions"] as const;

export async function handleDeleteAccount(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse(403, "Forbidden.");
  try {
    const db = await openDb();
    const limited = await hit(LIMITS.session, clientAddress(request));
    if (!limited.allowed) return tooManyRequests(limited.retryAfterSeconds);
    const user = await requireUser(request);
    if (!user) return errorResponse(401, "Sign in to delete your account.");

    const deleted = await inTransaction(async (session) => {
      const counts: Record<string, number> = {};
      for (const name of OWNED) {
        counts[name] = (await db.collection(name).deleteMany({ userId: user._id }, { session })).deletedCount;
      }
      counts.users = (await db.collection("users").deleteOne({ _id: user._id }, { session })).deletedCount;
      return counts;
    });
    // Counts only: no id, no email. The account no longer exists.
    console.info("Account deleted:", JSON.stringify(deleted));

    const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Account deletion failed:", error instanceof Error ? error.name : "unknown error");
    return errorResponse(503, "Couldn't delete the account right now. Nothing was deleted; please try again.");
  }
}
