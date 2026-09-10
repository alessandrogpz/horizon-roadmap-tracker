import type { NextRequest } from "next/server";
import { handleSyncGet, handleSyncPut } from "@/lib/server/sync/handlers";

// Mongoose needs Node, not the edge runtime.
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return handleSyncGet(request);
}

export function PUT(request: NextRequest) {
  return handleSyncPut(request);
}
