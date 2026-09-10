import type { NextRequest } from "next/server";
import { handleDeleteAccount } from "@/lib/server/account/handlers";

// Mongoose needs Node, not the edge runtime.
export const runtime = "nodejs";

export function DELETE(request: NextRequest) {
  return handleDeleteAccount(request);
}
