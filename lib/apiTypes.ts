// The shapes the API answers with: the contract between the server and every
// client that calls it — the website, the phone, and anything else later.
//
// They live here, apart from the code that produces them, because that code
// imports Mongoose and a phone cannot. A type-only import is erased at build
// time, but TypeScript still has to *read* the file it came from, and reading
// `lib/server/**` on a React Native project means resolving the driver's types
// in an environment that has no business having them.
//
// One definition, imported by both sides, so a change to the wire format is a
// change both sides see.

export interface TrackHit {
  trackId: string;
  name: string;
  score: number;
  materials: { id: string; title: string; author?: string }[];
  phases: { id: number; title: string }[];
}

export interface NoteHit {
  noteId: string;
  kind: "material" | "notepad" | "todo";
  /** The material's title, or the track's name for a notepad or to-do list. */
  about: string;
  snippet: string;
  score: number;
}

export interface SearchResult {
  tracks: TrackHit[];
  notes: NoteHit[];
}
