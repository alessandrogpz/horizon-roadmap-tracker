// Full-text search across one user's tracks and notes, with MongoDB's $text
// operator and the compound text indexes in collections.ts.
//
// $text ranks whole documents by a relevance score (textScore), weighted by
// field: a word in a material's title counts ten times one in the roadmap
// text. It says *that* a track matched, not *where*, so this also points at
// the materials and phases containing a search word, for display.
//
// Native driver, not Mongoose: see docs/nosql/DATA_LAYER.md §3. Its inputs: the session's user id
// and a query string that already passed the zod schema. A $text search is a
// string, so there's no operator to inject; its only syntax is "quoted
// phrases" and -excluded words, which are the user's to use.

import type { mongo } from "mongoose";
import { mongoose } from "../db";
import { NOTES, TRACKS } from "../collections";

type ObjectId = mongoose.Types.ObjectId;

export type { NoteHit, SearchResult, TrackHit } from "../../apiTypes";
import type { NoteHit, SearchResult, TrackHit } from "../../apiTypes";

const LIMIT = 20;

/** The words to point at: a rough stem of each (the first letters), so "books"
 *  still points at "Book". Negated words and short noise are left out. */
function needles(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9äöüß-]+/i)
    .filter((w) => w.length >= 3 && !w.startsWith("-"))
    .map((w) => w.slice(0, Math.max(4, w.length - 2)));
}

const contains = (text: string | undefined, words: string[]) =>
  !!text && words.some((w) => text.toLowerCase().includes(w));

/** Up to ~160 characters around the first search word. */
function snippet(content: string, words: string[]): string {
  const lower = content.toLowerCase();
  const at = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0), content.length);
  const start = at === content.length ? 0 : Math.max(0, at - 60);
  const text = content.slice(start, start + 160).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${text}${start + 160 < content.length ? "…" : ""}`;
}

export async function searchUserData(userId: ObjectId, query: string): Promise<SearchResult> {
  const db = mongoose.connection.db!;
  const words = needles(query);
  const byScore: mongo.Sort = { score: { $meta: "textScore" } };

  const trackDocs = await db
    .collection(TRACKS)
    .find(
      { userId, $text: { $search: query } },
      { projection: { score: { $meta: "textScore" }, trackId: 1, "meta.name": 1, materials: 1, phases: 1 }, sort: byScore, limit: LIMIT }
    )
    .toArray();

  const tracks: TrackHit[] = trackDocs.map((t) => ({
    trackId: t.trackId,
    name: t.meta?.name ?? "",
    score: t.score,
    materials: (t.materials ?? [])
      .filter((m: { title?: string; author?: string }) => contains(m.title, words) || contains(m.author, words))
      .slice(0, 10)
      .map((m: { id: string; title: string; author?: string }) => ({ id: m.id, title: m.title, ...(m.author ? { author: m.author } : {}) })),
    phases: (t.phases ?? [])
      .filter((p: { title?: string; description?: string }) => contains(p.title, words) || contains(p.description, words))
      .slice(0, 10)
      .map((p: { id: number; title: string }) => ({ id: p.id, title: p.title })),
  }));

  const noteDocs = await db
    .collection(NOTES)
    .find(
      { userId, $text: { $search: query } },
      { projection: { score: { $meta: "textScore" }, noteId: 1, kind: 1, trackId: 1, content: 1 }, sort: byScore, limit: LIMIT }
    )
    .toArray();

  // What each note is about: its material's title, or its track's name.
  const names = noteDocs.length
    ? await db
        .collection(TRACKS)
        .find({ userId }, { projection: { trackId: 1, "meta.name": 1, "materials.id": 1, "materials.title": 1 } })
        .toArray()
    : [];
  const trackName = new Map(names.map((t) => [t.trackId as string, (t.meta?.name as string) ?? ""]));
  const materialTitle = new Map(
    names.flatMap((t) => ((t.materials ?? []) as { id: string; title: string }[]).map((m) => [m.id, m.title] as const))
  );

  const notes: NoteHit[] = noteDocs.map((n) => ({
    noteId: n.noteId,
    kind: n.kind,
    about: n.kind === "material" ? (materialTitle.get(n.noteId) ?? "A material") : (trackName.get(n.trackId) ?? "A track"),
    snippet: snippet(n.content ?? "", words),
    score: n.score,
  }));

  return { tracks, notes };
}
