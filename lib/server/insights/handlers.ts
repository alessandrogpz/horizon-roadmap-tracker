// GET /api/search?q=…  full-text search across the signed-in user's data
// GET /api/stats        the signed-in user's history, from aggregation pipelines

import type { NextRequest } from "next/server";
import { z } from "zod";
import { openDb } from "../collections";
import { errorResponse, jsonResponse } from "../http";
import { hit, LIMITS, tooManyRequests } from "../rateLimit";
import { requireUser } from "../sync/handlers";
import { searchUserData } from "./search";
import { userStats } from "./stats";

const unavailable = (error: unknown): Response => {
  console.error("Insights unavailable:", error instanceof Error ? error.name : "unknown error");
  return errorResponse(503, "This isn't available right now.");
};

/** One to 100 characters of search text. */
const Query = z.string().trim().min(1).max(100);

async function signedInUser(request: NextRequest) {
  await openDb();
  const user = await requireUser(request);
  if (!user) return { response: errorResponse(401, "Sign in to use this.") };
  const limited = await hit(LIMITS.query, user._id.toString());
  if (!limited.allowed) return { response: tooManyRequests(limited.retryAfterSeconds) };
  return { user };
}

export async function handleSearch(request: NextRequest): Promise<Response> {
  const query = Query.safeParse(request.nextUrl.searchParams.get("q") ?? "");
  if (!query.success) return errorResponse(400, "Search for 1 to 100 characters.");
  try {
    const { user, response } = await signedInUser(request);
    if (!user) return response;
    return jsonResponse(await searchUserData(user._id, query.data));
  } catch (error) {
    return unavailable(error);
  }
}

export async function handleStats(request: NextRequest): Promise<Response> {
  try {
    const { user, response } = await signedInUser(request);
    if (!user) return response;
    return jsonResponse(await userStats(user._id));
  } catch (error) {
    return unavailable(error);
  }
}
