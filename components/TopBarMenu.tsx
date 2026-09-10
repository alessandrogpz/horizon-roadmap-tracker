"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CalendarCog,
  Cloud,
  Ellipsis,
  Eye,
  EyeOff,
  LayoutGrid,
  Map,
  Pencil,
  Plus,
  Repeat,
  Settings,
} from "lucide-react";
import { panelFor } from "@/components/panels/registry";

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
  onOpenCloud: () => void;
  onOpenSettings: () => void;
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
      <span className="flex-1 text-[0.85rem] text-foreground">{label}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block px-2.5 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
  onOpenCloud,
  onOpenSettings,
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

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setAlignRight(rect.left + MENU_WIDTH > window.innerWidth - EDGE_MARGIN);
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /** Menu items are one-shot actions: run, then close. */
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-card-border bg-transparent text-muted-foreground transition-colors hover:border-card-border-hover hover:text-foreground cursor-pointer shrink-0"
        title="Menu"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Ellipsis size={15} strokeWidth={2} />
      </button>

      {open && (
        <div
          className={`!absolute ${alignRight ? "right-0" : "left-0"} glass-surface z-50 mt-2 flex max-h-[75vh] w-[260px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto p-1.5`}
          role="menu"
        >
          <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-1.5">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Track
            </span>
            <span className="max-w-[130px] truncate text-[0.65rem] text-subtle-foreground" title={trackName}>
              {trackName}
            </span>
          </div>

          <Item icon={<Pencil size={15} strokeWidth={2} />} label="Track settings…" onClick={run(onEditTrack)} />
          <Item icon={<CalendarCog size={15} strokeWidth={2} />} label="Weekly rhythm…" onClick={run(onEditRhythm)} />
          <Item icon={<Repeat size={15} strokeWidth={2} />} label="New rotation…" onClick={run(onNewRotation)} />
          <Item
            icon={<Map size={15} strokeWidth={2} />}
            label={roadmapEnabled ? "Full roadmap" : "Full roadmap (locked)"}
            disabled={!roadmapEnabled}
            hint={roadmapEnabled ? undefined : "Connect Google Drive to unlock"}
            // A full page load on purpose: it fires `pagehide`, which flushes any
            // pending save in WorkspaceProvider. router.push would unmount the
            // provider without that flush and could drop the last edit.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            onClick={run(() => window.location.assign("/roadmap"))}
          />
          <Item icon={<Plus size={15} strokeWidth={2} />} label="New track" onClick={run(onNewTrack)} />

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
                    className={`flex-1 text-[0.85rem] ${m.visible ? "text-foreground" : "text-muted-foreground"}`}
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
            <span className="block px-2.5 pb-1 pt-1 text-[0.65rem] leading-snug text-subtle-foreground">
              Closing a panel only hides it for this track — its data is kept.
            </span>
          </div>

          <div className="mt-1 border-t border-card-border pt-0.5">
            <SectionLabel>This device</SectionLabel>
            <Item icon={<Cloud size={15} strokeWidth={2} />} label="Cloud & backup…" onClick={run(onOpenCloud)} />
            <Item icon={<Settings size={15} strokeWidth={2} />} label="Settings…" onClick={run(onOpenSettings)} />
          </div>
        </div>
      )}
    </div>
  );
}
