"use client";

import React from "react";
import { Check, NotebookPen } from "lucide-react";
import { useQuickNote } from "@/components/useQuickNote";

/** A plain scratchpad for getting something down before it has a proper home.
 *  One per track; `noteId` comes from notepadNoteId() in lib/quickNotes.ts. */
export default function Notepad({ noteId }: { noteId: string }) {
  const { content, update, flush, saveState } = useQuickNote(noteId, 800);

  return (
    <div className="glass-panel flex flex-col gap-3">
      <div className="flex justify-between items-center border-b border-card-border pb-3">
        <h2 className="section-title !mb-0">
          <NotebookPen size={14} strokeWidth={2.5} className="section-icon" />
          Notepad
        </h2>
        <span className={`text-[0.7rem] font-mono inline-flex items-center gap-1 ${saveState === "error" ? "text-red-500" : "text-muted-foreground"}`}>
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && (<><Check size={12} strokeWidth={2.5} /> Saved</>)}
          {saveState === "error" && "Couldn't save"}
        </span>
      </div>
      <textarea
        value={content ?? ""}
        onChange={(e) => update(e.target.value)}
        onBlur={() => void flush()}
        disabled={content === null}
        placeholder="Jot it down here, sort it out later."
        aria-label="Notepad"
        spellCheck
        className="w-full min-h-[180px] resize-y p-3 rounded bg-input-bg border border-card-border text-foreground outline-none font-[inherit] text-[0.85rem] leading-relaxed placeholder:text-muted-foreground focus:border-accent"
      />
    </div>
  );
}
