import { handleHealth } from "@/lib/server/health";

// Mongoose needs Node, not the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handleHealth();
}
