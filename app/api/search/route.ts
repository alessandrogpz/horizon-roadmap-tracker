import type { NextRequest } from "next/server";
import { handleSearch } from "@/lib/server/insights/handlers";

// Mongoose needs Node, not the edge runtime.
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return handleSearch(request);
}
