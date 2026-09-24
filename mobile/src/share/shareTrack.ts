// Sending something out of the app.
//
// Half of "inter-app communication" on Android is Intents, and the share sheet
// is the everyday one: the app hands the system a piece of text, the system
// offers whatever can receive it, and another app takes it from there. Horizon
// never learns which app that was, and no permission is involved — the user
// picked the destination, which is the whole security model of the share sheet.
//
// The other half — receiving — is the deep link in ../app/track/[id].tsx.

import { Share } from "react-native";
import type { TrackState } from "@shared/types";
import { currentStreakLength } from "@shared/streak";

export interface ShareCounts {
  done: number;
  total: number;
}

/** A plain-text summary of where a track stands today. Text rather than a
 *  link, because the receiving app is unknown: a message, a note-taking app and
 *  an email client all understand text, and none of them need Horizon installed
 *  to make sense of it. */
export function summaryFor(track: TrackState, today: string, { done, total }: ShareCounts): string {
  const streak = currentStreakLength(track.streakHistory ?? [], today);
  const parts = [
    track.meta.name,
    total ? `${done} of ${total} done today` : "nothing scheduled today",
    streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} in a row` : "no streak yet",
  ];
  return `${parts.join(" · ")}\n\nhttps://horizonroadmap.com`;
}

export async function shareTrack(track: TrackState, today: string, counts: ShareCounts): Promise<void> {
  try {
    await Share.share({ message: summaryFor(track, today, counts) });
  } catch {
    // Dismissing the sheet is not a failure, and no other app's problem is
    // this app's to report.
  }
}
