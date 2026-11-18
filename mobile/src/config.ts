// The handful of values that differ between this app and the server it talks
// to. Kept in one file so a build for a different environment changes one
// place, and so nothing secret is needed here: the Google client ID and the
// server address are both public by design.

import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

/** Where Horizon's API lives. Point this at a laptop to work against a local
 *  server: `HORIZON_SERVER=http://192.168.0.2:3000 npm start`. */
export const SERVER_URL = (process.env.EXPO_PUBLIC_SERVER_URL ?? extra.serverUrl ?? "https://horizonroadmap.com").replace(/\/$/, "");

/** Horizon's Google OAuth *web* client, the audience the server verifies. The
 *  phone asks Google for a token addressed to it, so the server needs no
 *  second client ID to trust (docs/MOBILE.md §3). */
export const WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
  extra.googleClientId ??
  "82064719586-e6s5ajaef0qrun4g7j3667mii5etojm5.apps.googleusercontent.com";
