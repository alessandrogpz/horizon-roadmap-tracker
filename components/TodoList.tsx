"use client";

import React, { useState } from "react";
import { ListTodo, X } from "lucide-react";
import {
  addTodo,
  clearDoneTodos,
  parseTodos,
  removeTodo,
  renameTodo,
  serializeTodos,
  toggleTodo,
  type TodoItem,
} from "@/lib/quickNotes";
import { useQuickNote } from "@/components/useQuickNote";
import { LIMITS } from "@/lib/limits";

/** A plain to-do list: add, tick, rename, delete. One per track; `noteId`
 *  comes from todoNoteId() in lib/quickNotes.ts. */
export default function TodoList({ noteId }: { noteId: string }) {
  const { content, update } = useQuickNote(noteId, 0);
  const [draft, setDraft] = useState("");
  // Which item is open for editing, and what it currently says. Held by index
  // because that is what the list is keyed by; it is cleared on every commit,
  // so an edit can never be left pointing at a row that has moved.
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);

  const items = parseTodos(content ?? "");
  const doneCount = items.filter((item) => item.done).length;
  const commit = (next: TodoItem[]) => {
    setEditing(null);
    update(serializeTodos(next));
  };

  /** Blank text is a cancel rather than a delete — see `renameTodo`. */
  const saveEdit = () => {
    if (!editing) return;
    commit(renameTodo(items, editing.index, editing.text));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    commit(addTodo(items, draft));
    setDraft("");
  };

  return (
    <div className="glass-panel flex flex-col gap-3">
      <div className="flex justify-between items-center border-b border-card-border pb-3">
        <h2 className="section-title !mb-0">
          <ListTodo size={14} strokeWidth={2.5} className="section-icon" />
          To-do
        </h2>
        {doneCount > 0 && (
          <button
            onClick={() => commit(clearDoneTodos(items))}
            className="bg-transparent border-none text-muted-foreground cursor-pointer text-[0.7rem] px-1 py-px font-[inherit] hover:text-foreground"
          >
            Clear done ({doneCount})
          </button>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          maxLength={LIMITS.title}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={content === null}
          placeholder="Add a to-do…"
          aria-label="New to-do"
          className="flex-1 min-w-0 p-1.5 rounded bg-input-bg border border-card-border text-foreground outline-none font-[inherit] text-[0.85rem] placeholder:text-muted-foreground focus:border-accent"
        />
        <button type="submit" disabled={!draft.trim()} className="btn px-2.5 py-1 text-xs disabled:opacity-40">
          Add
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-[0.8rem] italic text-muted-foreground m-0">Nothing to do yet.</p>
      ) : (
        <ul className="flex flex-col m-0 p-0 list-none">
          {items.map((item, index) => (
            <li
              key={`${index}-${item.text}`}
              className="group flex items-center gap-2.5 py-1.5 border-b border-card-border last:border-b-0"
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => commit(toggleTodo(items, index))}
                aria-label={`Mark "${item.text}" ${item.done ? "not done" : "done"}`}
                className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--accent)]"
              />
              {editing?.index === index ? (
                <input
                  type="text"
                  maxLength={LIMITS.title}
                  value={editing.text}
                  autoFocus
                  onChange={(e) => setEditing({ index, text: e.target.value })}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  aria-label={`Edit "${item.text}"`}
                  className="flex-1 min-w-0 rounded border border-accent bg-input-bg px-1 py-0.5 font-[inherit] text-[0.85rem] text-foreground outline-none"
                />
              ) : (
                <button
                  onClick={() => setEditing({ index, text: item.text })}
                  title="Click to edit"
                  aria-label={`Edit "${item.text}"`}
                  className={`flex-1 min-w-0 cursor-text break-words border-none bg-transparent p-0 text-left font-[inherit] text-[0.85rem] ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {item.text}
                </button>
              )}
              <button
                onClick={() => commit(removeTodo(items, index))}
                aria-label={`Delete "${item.text}"`}
                className="shrink-0 bg-transparent border-none p-0.5 cursor-pointer text-muted-foreground opacity-40 group-hover:opacity-100 focus:opacity-100 hover:text-danger transition-opacity"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
