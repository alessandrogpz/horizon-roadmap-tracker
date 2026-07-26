// Per-material study notes. They live in their own Dexie table (one row per
// material id) and sync to Drive as individual note_<materialId>.md files,
// separately from the workspace record.

import { db } from "./localDb";

export const fetchNotes = async (id: string): Promise<{ content: string }> => {
  try {
    const record = await db.notes.get(id);
    if (record) return { content: record.content };

    // Migration fallback: older versions kept notes as markdown files in the
    // repo. Pull one down once and adopt it into IndexedDB.
    const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (res.ok) {
      const serverData = await res.json();
      const content = serverData.content || "";
      if (content) {
        await db.notes.put({ id, content, updatedAt: Date.now() });
      }
      return { content };
    }
    return { content: "" };
  } catch (error) {
    console.error("fetchNotes local error:", error);
    return { content: "" };
  }
};

export const saveNotes = async (id: string, content: string) => {
  try {
    await db.notes.put({ id, content, updatedAt: Date.now() });
    return { success: true };
  } catch (error) {
    console.error("saveNotes local error:", error);
    throw error;
  }
};
