import type { NextRequest } from "next/server";
import { verifyGoogleIdToken } from "@/lib/server/auth/googleIdToken";
import { handleGetSession, handleSignIn, handleSignOut } from "@/lib/server/auth/handlers";

// Mongoose needs Node, not the edge runtime.
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return handleGetSession(request);
}

export function POST(request: NextRequest) {
  return handleSignIn(request, {
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    verifyIdToken: verifyGoogleIdToken,
  });
}

export function DELETE(request: NextRequest) {
  return handleSignOut(request);
}
