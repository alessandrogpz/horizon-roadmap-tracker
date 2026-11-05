"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarCog,
  Ellipsis,
  Eye,
  EyeOff,
  LayoutGrid,
  Map,
  Pencil,
  Plus,
  Repeat,
  Search,
  Settings,
} from "lucide-react";
import { panelFor } from "@/components/panels/registry";
import { useDismiss } from "@/components/useDismiss";

/**
 * The top bar's overflow menu. The bar keeps what you *read* — the mark, the
 * track you're on, the sync status, the four metrics — and everything you
 * *do* occasionally moved in here. On a phone that's the difference between a
 * three-line wrapped header and a single row.
 *
 * Module visibility lives here as a section rather than its own popover: a
 * menu that opens a menu is a worse trade than one slightly longer list.
 */

export interface ModuleState {
  id: string;
  label: string;
  visible: boolean;
}

interface TopBarMenuProps {
  trackName: string;
  /** Locked until the workspace is synced, like the header's roadmap link. */
  roadmapEnabled: boolean;
  modules: ModuleState[];
  onToggleModule: (id: string) => void;
  onEditTrack: () => void;
  onEditRhythm: () => void;
  onNewRotation: () => void;
  onNewTrack: () => void;
  onOpenSettings: () => void;
  /** Only when signed in: search and history come from the account. */
  onOpenInsights?: () => void;
  /** The master view is open, so there is no track here to edit: everything
   *  that would change one is left out rather than shown disabled. A disabled
   *  row is a thing that looks like it should work. */
  readOnly?: boolean;
}

function Item({
  icon,
  label,
  onClick,
  disabled,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
      title={hint}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex-1 type-body text-foreground">{label}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block px-2.5 pb-1 pt-2 type-micro font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </span>
  );
}

export default function TopBarMenu({
  trackName,
  roadmapEnabled,
  modules,
  onToggleModule,
  onEditTrack,
  onEditRhythm,
  onNewRotation,
  onNewTrack,
  onOpenSettings,
  onOpenInsights,
  readOnly = false,
}: TopBarMenuProps) {
  const [open, setOpen] = useState(false);
  // Which edge the popover aligns to, chosen on open so it always lands fully
  // inside the viewport — the trigger sits near the right edge on wide screens
  // and near the left on narrow ones.
  const [alignRight, setAlignRight] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const MENU_WIDTH = 260;
  const EDGE_MARGIN = 8;

  // The menu plays its exit before it is taken off the page, which means
  // every way out of it — the trigger, a click outside, Escape, picking an
  // item — has to go through one place rather than closing the menu itself
  // from four.
  const { closing, dismiss } = useDismiss(useCallback(() => setOpen(false), []));

  const handleToggle = () => {
    if (open) {
      dismiss();
      return;
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setAlignRight(rect.left + MENU_WIDTH > window.innerWidth - EDGE_MARGIN);
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) dismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // `dismiss` is stable — `useDismiss` memoises it on an `onClose` that is
    // itself a dependency-free `useCallback` — so listing it does not make
    // this effect re-run; it just stops the linter having to take that on
    // trust.
  }, [open, dismiss]);

  /** Menu items are one-shot actions: run, then close. The action fires at
   *  once and the menu fades out behind it; waiting for the animation before
   *  doing the thing would be an animation costing the user 140ms. */
  const run = (action: () => void) => () => {
    dismiss();
    action();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="tap-44 flex h-7 w-7 items-center justify-center rounded-md border border-card-border bg-transparent text-muted-foreground transition-colors hover:border-card-border-hover hover:text-foreground cursor-pointer shrink-0"
        title="Menu"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Ellipsis size={15} strokeWidth={2} />
      </button>

      {open && (
        <div
          className={`${closing ? "popover-out" : "popover-in"} !absolute ${alignRight ? "right-0" : "left-0"} glass-surface z-50 mt-2 flex max-h-[75vh] w-[260px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto p-1.5`}
          // The menu grows out of the button that opened it, which means out
          // of whichever corner it just aligned itself to — the same decision
          // `alignRight` already made for the position.
          style={{ "--popover-origin": alignRight ? "top right" : "top left" } as React.CSSProperties}
          role="menu"
        >
          <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-1.5">
            <span className="type-micro font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Track
            </span>
            <span className="max-w-[130px] truncate type-micro text-subtle-foreground" title={trackName}>
              {trackName}
            </span>
          </div>

          {!readOnly && (
            <>
              <Item icon={<Pencil size={15} strokeWidth={2} />} label="Track settings…" onClick={run(onEditTrack)} />
              <Item icon={<CalendarCog size={15} strokeWidth={2} />} label="Weekly rhythm…" onClick={run(onEditRhythm)} />
              <Item icon={<Repeat size={15} strokeWidth={2} />} label="New rotation…" onClick={run(onNewRotation)} />
            </>
          )}
          <Item
            icon={<Map size={15} strokeWidth={2} />}
            label={roadmapEnabled ? (readOnly ? "All roadmaps" : "Full roadmap") : "Full roadmap (locked)"}
            disabled={!roadmapEnabled}
            hint={roadmapEnabled ? undefined : "Connect Google Drive to unlock"}
            // A full page load on purpose: it fires `pagehide`, which flushes any
            // pending save in WorkspaceProvider. router.push would unmount the
            // provider without that flush and could drop the last edit.
            onClick={run(() => window.location.assign(readOnly ? "/roadmap?all=1" : "/roadmap"))}
          />
          <Item icon={<Plus size={15} strokeWidth={2} />} label="New track" onClick={run(onNewTrack)} />

          {/* The master view has a fixed board — there is nothing stored for
              it to remember an arrangement in, so there is nothing to
              arrange. */}
          {!readOnly && (
          <div className="mt-1 border-t border-card-border pt-0.5">
            <SectionLabel>Panels</SectionLabel>
            {modules.map((m) => {
              // Same icon the panel itself renders — one registry, no second
              // list to keep in step.
              const Icon = panelFor(m.id)?.icon ?? LayoutGrid;
              return (
                <button
                  key={m.id}
                  onClick={() => onToggleModule(m.id)}
                  role="menuitemcheckbox"
                  aria-checked={m.visible}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <Icon
                    size={15}
                    strokeWidth={2}
                    className={`shrink-0 ${m.visible ? "text-muted-foreground" : "text-subtle-foreground"}`}
                  />
                  <span
                    className={`flex-1 type-body ${m.visible ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {m.label}
                  </span>
                  {m.visible ? (
                    <Eye size={15} strokeWidth={2} className="shrink-0 text-accent" />
                  ) : (
                    <EyeOff size={15} strokeWidth={2} className="shrink-0 text-subtle-foreground" />
                  )}
                </button>
              );
            })}
            <span className="block px-2.5 pb-1 pt-1 type-micro text-subtle-foreground">
              Closing a panel only hides it for this track — its data is kept.
            </span>
          </div>
          )}

          <div className="mt-1 border-t border-card-border pt-0.5">
            <SectionLabel>This device</SectionLabel>
            {onOpenInsights && (
              <Item icon={<Search size={15} strokeWidth={2} />} label="Search & insights…" onClick={run(onOpenInsights)} />
            )}
            <Item icon={<Settings size={15} strokeWidth={2} />} label="Settings…" onClick={run(onOpenSettings)} />
          </div>
        </div>
      )}
    </div>
  );
}
