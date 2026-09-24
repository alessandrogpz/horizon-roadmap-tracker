// Searching what is already on the phone.
//
// The server's search is better — it spans every track the account owns,
// including archived ones, and reads note bodies through a text index. But it
// needs a connection and an account, and the phone has the current workspace
// and every note sitting in SQLite either way. On a train, a search that
// answers "nothing, you're offline" is worse than one that answers from what
// it has.
//
// So this runs first and always: it is instant and cannot fail. The server's
// result replaces it only when one actually arrives — a local answer
// overwritten by a failed remote one would be a regression.

import type { Workspace } from "@shared/types";
import type { StoredNote } from "../storage/db";

export interface LocalHit {
  kind: "track" | "material" | "note";
  title: string;
  /** Where it was found, for the line under the title. */
  context: string;
  trackId: string;
}

const MAX_PER_KIND = 8;

/** Case-insensitive substring matching. Deliberately not fuzzy: someone
 *  searching their own notes knows roughly what they wrote, and fuzzy matching
 *  on a small corpus mostly returns things they did not mean. */
export function searchLocally(
  workspace: Workspace | null,
  notes: StoredNote[],
  query: string
): LocalHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle || !workspace) return [];

  const hits: LocalHit[] = [];
  const tracks = Object.values(workspace.tracks ?? {});

  for (const track of tracks) {
    if (track.meta?.archived) continue;
    const name = track.meta?.name ?? "";
    if (name.toLowerCase().includes(needle)) {
      hits.push({ kind: "track", title: name, context: "Track", trackId: track.meta.id });
    }

    for (const material of track.materials ?? []) {
      if (hits.filter((hit) => hit.kind === "material").length >= MAX_PER_KIND) break;
      const haystack = `${material.title} ${material.author ?? ""}`.toLowerCase();
      if (haystack.includes(needle)) {
        hits.push({
          kind: "material",
          title: material.title,
          context: [material.author, name].filter(Boolean).join(" · "),
          trackId: track.meta.id,
        });
      }
    }
  }

  // Notes are keyed by the id of whatever they belong to, so a title has to
  // come from the body: its first non-empty line, which is what someone would
  // recognise it by.
  const byTrack = new Map(tracks.map((track) => [track.meta.id, track.meta.name]));
  for (const note of notes) {
    if (hits.filter((hit) => hit.kind === "note").length >= MAX_PER_KIND) break;
    if (!note.content?.toLowerCase().includes(needle)) continue;

    const firstLine = note.content.split("\n").find((line) => line.trim())?.trim() ?? "Note";
    const owner = [...byTrack.entries()].find(([id]) => note.id.includes(id));
    hits.push({
      kind: "note",
      title: firstLine.slice(0, 80),
      context: owner ? `Note · ${owner[1]}` : "Note",
      trackId: owner?.[0] ?? "",
    });
  }

  return hits;
}
