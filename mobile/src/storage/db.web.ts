// The same storage API as db.ts, for when this app runs in a browser.
//
// Metro picks this file over db.ts on web automatically, on the `.web.ts`
// extension — the bundler's answer to "one API, different platforms". Nothing
// that imports `../storage/db` knows or cares which one it got.
//
// Why a different file at all: expo-sqlite is native SQLite on a phone, and on
// web it needs a WebAssembly build of SQLite plus cross-origin isolation
// headers to reach its worker. That is a lot of machinery for a target that
// already has a first-class Horizon — the Next.js app, which keeps the same
// data in IndexedDB through Dexie. So the browser build of *this* app keeps
// its copy in localStorage: enough to develop and demonstrate against, and
// honest about being the lesser storage.
//
// The trade-off, since the module asks for it: localStorage is synchronous,
// capped around 5 MB, string-only and blocks the main thread. SQLite has none
// of those limits and can query without loading everything. On a phone the
// choice is easy; here it is a deliberate compromise on a platform that is not
// this app's real home.

import type { Workspace } from "@shared/types";

export interface StoredNote {
  id: string;
  content: string;
  updatedAt: number;
}

const WORKSPACE_KEY = "horizon.workspace";
const NOTES_KEY = "horizon.notes";

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Private windows and blocked site data both throw here.
    return fallback;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Out of quota, or storage denied: the app keeps working on what is in
    // memory rather than crashing on a save.
  }
};

export async function loadWorkspace(): Promise<Workspace | null> {
  return read<Workspace | null>(WORKSPACE_KEY, null);
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  write(WORKSPACE_KEY, workspace);
}

export async function loadNotes(): Promise<StoredNote[]> {
  return read<StoredNote[]>(NOTES_KEY, []);
}

export async function saveNote(note: StoredNote): Promise<void> {
  const notes = read<StoredNote[]>(NOTES_KEY, []).filter((n) => n.id !== note.id);
  write(NOTES_KEY, [...notes, note]);
}

export async function clearAll(): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(WORKSPACE_KEY);
    globalThis.localStorage?.removeItem(NOTES_KEY);
  } catch {
    // Nothing to do: there was nothing readable to clear.
  }
}
