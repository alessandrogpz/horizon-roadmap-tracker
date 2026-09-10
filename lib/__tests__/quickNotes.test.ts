import { describe, it, expect } from "vitest";
import { addTodo, clearDoneTodos, notepadNoteId, parseTodos, removeTodo, serializeTodos, todoNoteId, toggleTodo } from "../quickNotes";

describe("quick note ids", () => {
  it("gives every track its own notepad and to-do list, distinct from each other", () => {
    const ids = [notepadNoteId("track_a"), todoNoteId("track_a"), notepadNoteId("track_b"), todoNoteId("track_b")];
    expect(new Set(ids).size).toBe(4);
    ids.forEach((id) => expect(id).not.toMatch(/^m_/));
  });
});

describe("to-do list storage", () => {
  it("round-trips through a markdown checklist", () => {
    const items = [
      { text: "Email the professor", done: false },
      { text: "Buy the Stewart book", done: true },
    ];
    const markdown = serializeTodos(items);
    expect(markdown).toBe("- [ ] Email the professor\n- [x] Buy the Stewart book");
    expect(parseTodos(markdown)).toEqual(items);
  });

  it("stores an empty list as an empty note", () => {
    expect(serializeTodos([])).toBe("");
    expect(parseTodos("")).toEqual([]);
  });

  it("keeps hand-written lines as open items instead of dropping them", () => {
    expect(parseTodos("* [X] done\nplain line\n\n  - [ ]   spaced  ")).toEqual([
      { text: "done", done: true },
      { text: "plain line", done: false },
      { text: "spaced", done: false },
    ]);
  });
});

describe("to-do list edits", () => {
  const list = [
    { text: "a", done: false },
    { text: "b", done: true },
    { text: "c", done: false },
  ];

  it("adds a trimmed item at the end, and ignores a blank one", () => {
    expect(addTodo(list, "  d  ").at(-1)).toEqual({ text: "d", done: false });
    expect(addTodo(list, "   ")).toBe(list);
  });

  it("toggles and removes by position", () => {
    expect(toggleTodo(list, 0)[0].done).toBe(true);
    expect(toggleTodo(list, 1)[1].done).toBe(false);
    expect(removeTodo(list, 1).map((i) => i.text)).toEqual(["a", "c"]);
  });

  it("clears only the finished items", () => {
    expect(clearDoneTodos(list).map((i) => i.text)).toEqual(["a", "c"]);
  });
});
