"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  LayoutGrid,
  Eye,
  EyeOff,
  CalendarDays,
  Milestone,
  Activity,
  Timer,
  FolderGit2,
  BookOpen,
} from "lucide-react";

export interface ModuleState {
  id: string;
  label: string;
  visible: boolean;
}

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

// Mirrors each panel's own section icon so the menu reads as the same modules.
const MODULE_ICONS: Record<string, IconType> = {
  weeklyPlan: CalendarDays,
  phaseTracker: Milestone,
  streakGraph: Activity,
  pomodoroTimer: Timer,
  portfolioTracker: FolderGit2,
  materialsTracker: BookOpen,
};

/** Header popover to open/close dashboard modules for the active track.
 *  Closing a module is a pure view change — the toggle handler only edits the
 *  track's layout, never its data. */
export default function ModulesMenu({
  modules,
  trackName,
  onToggle,
}: {
  modules: ModuleState[];
  trackName: string;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-7 px-2 rounded-md bg-transparent border border-card-border text-muted-foreground cursor-pointer hover:text-foreground hover:border-card-border-hover transition-colors text-[0.8rem] font-medium"
        title="Show or hide dashboard modules"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <LayoutGrid size={14} strokeWidth={2} />
        Modules
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-64 z-50 glass-surface p-1.5 flex flex-col"
          role="menu"
        >
          <div className="px-2.5 py-1.5 flex items-center justify-between gap-2">
            <span className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground font-semibold">
              Modules
            </span>
            <span className="text-[0.65rem] text-subtle-foreground truncate max-w-[120px]" title={trackName}>
              {trackName}
            </span>
          </div>

          {modules.map((m) => {
            const Icon = MODULE_ICONS[m.id] ?? LayoutGrid;
            return (
              <button
                key={m.id}
                onClick={() => onToggle(m.id)}
                role="menuitemcheckbox"
                aria-checked={m.visible}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left cursor-pointer hover:bg-surface-hover transition-colors"
              >
                <Icon
                  size={15}
                  strokeWidth={2}
                  className={`shrink-0 ${m.visible ? "text-muted-foreground" : "text-subtle-foreground"}`}
                />
                <span className={`flex-1 text-[0.85rem] ${m.visible ? "text-foreground" : "text-muted-foreground"}`}>
                  {m.label}
                </span>
                {m.visible ? (
                  <Eye size={15} strokeWidth={2} className="text-accent shrink-0" />
                ) : (
                  <EyeOff size={15} strokeWidth={2} className="text-subtle-foreground shrink-0" />
                )}
              </button>
            );
          })}

          <div className="px-2.5 pt-2 pb-1 mt-1 border-t border-card-border">
            <span className="text-[0.65rem] text-subtle-foreground leading-snug block">
              Closing a module only hides it for this track — its data is kept.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
