// The dashboard's Notepad and To-do List: one of each per track.
//
// Both live in the same notes table as material notes, so they sync to Drive
// as their own note_<id>.md files (newest edit wins) and ride along in every
// backup, without touching the track or its configVersion — typing in the
// notepad isn't a structural edit. Ids embed the track id, which is already
// unique and filename-safe; material note ids start with "m_", so these can't
// collide with one.

export const notepadNoteId = (trackId: string) => `notepad_${trackId}`;
export const todoNoteId = (trackId: string) => `todo_${trackId}`;

export interface TodoItem {
  text: string;
  done: boolean;
}

const CHECKLIST_LINE = /^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/;

/** The list is stored as a markdown checklist ("- [ ] text", "- [x] text"),
 *  so the synced file stays readable. Any other non-empty line — say, from
 *  editing the file by hand — is kept as an open item rather than dropped. */
export function parseTodos(markdown: string): TodoItem[] {
  return markdown
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const match = line.match(CHECKLIST_LINE);
      return match
        ? { text: match[2].trim(), done: match[1] !== " " }
        : { text: line.trim(), done: false };
    })
    .filter((item) => item.text.length > 0);
}

export function serializeTodos(items: TodoItem[]): string {
  return items.map((item) => `- [${item.done ? "x" : " "}] ${item.text}`).join("\n");
}

export const addTodo = (items: TodoItem[], text: string): TodoItem[] => {
  const trimmed = text.trim();
  return trimmed ? [...items, { text: trimmed, done: false }] : items;
};

export const toggleTodo = (items: TodoItem[], index: number): TodoItem[] =>
  items.map((item, i) => (i === index ? { ...item, done: !item.done } : item));

export const removeTodo = (items: TodoItem[], index: number): TodoItem[] =>
  items.filter((_, i) => i !== index);

/**
 * Changes what an item says, keeping whether it is done.
 *
 * Blank text leaves the item alone rather than emptying it: a line with no
 * text is not a to-do, `serializeTodos` would write a bare "- [ ]", and
 * `parseTodos` would drop it on the next read — so the item would vanish from
 * a rename, which is not what anybody means by one. Deleting is its own
 * button.
 */
export const renameTodo = (items: TodoItem[], index: number, text: string): TodoItem[] => {
  const trimmed = text.trim();
  if (!trimmed) return items;
  return items.map((item, i) => (i === index ? { ...item, text: trimmed } : item));
};

export const clearDoneTodos = (items: TodoItem[]): TodoItem[] => items.filter((item) => !item.done);
