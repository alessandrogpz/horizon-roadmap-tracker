"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Workspace } from "@/lib/types";
import { useWorkspace, useWorkspaceActions } from "@/components/workspace/WorkspaceProvider";

/**
 * Undo, instead of "are you sure?".
 *
 * The phone app has had this since it was written, and its reasoning is worth
 * repeating rather than paraphrasing: a dialog in front of every destructive
 * action teaches people to click through dialogs, so by the time one actually
 * matters it has already been dismissed by reflex. The action happens
 * immediately — which is what the person asked for — and a bar offers to put
 * it back for a few seconds.
 *
 * The web app inherited the half of that policy that removes the guard and
 * not the half that replaces it. Deleting a deliverable, a material or a
 * to-do happened on the first click of a 14x14 target, with no confirmation,
 * no undo and no trace. This is a local-first app with no server-side
 * history, so that click was final.
 *
 * The undo restores a whole previous workspace rather than inverting the
 * operation. Reversing a removal exactly would mean knowing where in the list
 * the thing sat and what else the same edit touched; keeping the previous
 * state is both simpler and actually correct — and `commitWorkspace` already
 * takes a whole workspace, so there is nothing to build underneath it.
 */

const SHOWN_FOR_MS = 7000;

interface Offer {
  /** "Deliverable removed" — what just happened, in three words. */
  what: string;
  undo: () => void;
}

export interface UndoValue {
  /**
   * Call straight after a destructive edit, with a function that puts things
   * back. Deliberately a plain callback rather than a workspace, because not
   * everything here lives in the workspace: the to-do list is a note, and its
   * undo restores the note's previous text. `useUndoableEdit` below is the
   * workspace case built on top.
   */
  offer: (what: string, undo: () => void) => void;
}

const UndoContext = createContext<UndoValue | null>(null);

/** Safe anywhere; a component outside the provider gets a no-op. */
export function useUndo(): UndoValue {
  return useContext(UndoContext) ?? { offer: () => undefined };
}

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [offerState, setOfferState] = useState<Offer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setOfferState(null);
  }, []);

  const offer = useCallback<UndoValue["offer"]>((what, undo) => {
    if (timer.current) clearTimeout(timer.current);
    setOfferState({ what, undo });
    timer.current = setTimeout(() => {
      timer.current = null;
      setOfferState(null);
    }, SHOWN_FOR_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const value = useMemo<UndoValue>(() => ({ offer }), [offer]);

  return (
    <UndoContext.Provider value={value}>
      {children}
      {offerState && <Bar offer={offerState} onDone={clear} />}
    </UndoContext.Provider>
  );
}

function Bar({ offer, onDone }: { offer: Offer; onDone: () => void }) {
  // Escape dismisses without undoing — the same key that closes everything
  // else here, and the bar is the only thing on screen listening for it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    // Bottom centre, clear of the version badge in the corner. `role="status"`
    // rather than `alert`: it is worth announcing, but it must not interrupt
    // whatever a screen reader was in the middle of saying.
    <div
      role="status"
      aria-live="polite"
      className="modal-in fixed bottom-5 left-1/2 z-[1100] flex -translate-x-1/2 items-center gap-3 rounded-[var(--radius-card)] border border-card-border bg-card py-1.5 pl-4 pr-1.5 shadow-[var(--shadow-float)]"
    >
      <Trash2 size={15} strokeWidth={2} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="type-label font-semibold text-foreground">{offer.what}</span>
      <button
        onClick={() => {
          offer.undo();
          onDone();
        }}
        className="tap-44 cursor-pointer rounded-[var(--radius-control)] border-none bg-transparent px-3 py-2 type-body font-bold text-accent transition-colors hover:bg-surface-hover"
      >
        Undo
      </button>
    </div>
  );
}

/**
 * The common case in one call: take a snapshot, do the thing, offer it back.
 *
 * Every caller needs the same three steps in the same order, and getting the
 * order wrong — snapshotting after the edit — produces an undo that restores
 * the state you were trying to leave.
 */
export function useUndoableEdit(): (what: string, edit: () => void) => void {
  const { workspace } = useWorkspace();
  const { commitWorkspace } = useWorkspaceActions();
  const { offer } = useUndo();
  return useCallback(
    (what, edit) => {
      const previous: Workspace | null = workspace;
      edit();
      // Nothing loaded yet means nothing to go back to; the edit still
      // happens, it just cannot be offered back.
      if (previous) offer(what, () => void commitWorkspace(previous));
    },
    [workspace, commitWorkspace, offer]
  );
}
