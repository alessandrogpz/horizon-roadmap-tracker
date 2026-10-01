"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Flame, GripVertical, Layers, Lock, Plus, Trash2 } from "lucide-react";
import type { StreakDay } from "@/lib/stats";
import type { TrackState } from "@/lib/types";
import { streakCalendar } from "@/lib/stats";
import { restScheduleOf, trackStreak, type RestOn } from "@/lib/restDays";
import { todayYMD } from "@/lib/dates";
import { useAppSettings } from "@/lib/useAppSettings";
import TrackYearStrip from "@/components/TrackYearStrip";

interface TrackSwitcherProps {
  tracks: TrackState[];
  activeTrackId: string;
  onSwitch: (trackId: string) => void;
  onNewTrack: () => void;
  /** Archives a track. Absent, the rows carry no delete affordance. */
  onDelete?: (trackId: string) => void;
  /** Saves a new order for the list. Absent, the rows cannot be dragged. */
  onReorder?: (orderedIds: string[]) => void;
  /** Opens the master view — every track at once, read-only. Absent, the row
   *  that reaches it is not drawn. */
  onOpenMaster?: () => void;
  /** Whether the master view is the thing currently on screen, in which case
   *  the button names it rather than naming a track. */
  masterOpen?: boolean;
}

interface Row {
  track: TrackState;
  color: string;
  days: StreakDay[];
  streak: number;
  rest: RestOn;
  /** Carried on the row because `TrackRow` needs it and the strip cannot tell
   *  a day that has passed from one that has not without it. */
  today: string;
}

/**
 * The track list, which is also the place you go to see how each one is
 * going.
 *
 * It used to be a column of names, which answered "which tracks exist" and
 * nothing else. Each row now carries a year of that track's days in the
 * track's own colour and the run it is on, because the question anyone
 * actually opens this for is which ones they are keeping up.
 *
 * The rows can also be put in an order. They used to sit in the order they
 * were made in, for good, which is the one order nobody chose — the track you
 * open every morning ends up third because you happened to think of it third.
 */
export default function TrackSwitcher({
  tracks,
  activeTrackId,
  onSwitch,
  onNewTrack,
  onDelete,
  onReorder,
  onOpenMaster,
  masterOpen = false,
}: TrackSwitcherProps) {
  const [open, setOpen] = useState(false);
  /** Which row has been armed for deletion. One decision per intent: the
   *  trash icon asks, the second tap does it, and opening the menu again
   *  forgets. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const settings = useAppSettings();
  const today = todayYMD();
  const activeTrack = tracks.find((t) => t.meta.id === activeTrackId) || tracks[0];

  /**
   * The order being dragged, which is not always the stored one.
   *
   * dnd-kit reports a move as it happens; the save is a round trip through
   * IndexedDB and the provider. Holding the result here means the row lands
   * where it was dropped on the frame it was dropped, rather than snapping
   * back for however long the write takes. Cleared whenever the stored list
   * catches up.
   */
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const ordered = useMemo(() => {
    if (!dragOrder) return tracks;
    const byId = new Map(tracks.map((track) => [track.meta.id, track]));
    const moved = dragOrder.map((id) => byId.get(id)).filter((track): track is TrackState => Boolean(track));
    // Anything the drag order has not heard of — a track added on another
    // device mid-drag — keeps its place at the end rather than vanishing.
    const seen = new Set(dragOrder);
    return [...moved, ...tracks.filter((track) => !seen.has(track.meta.id))];
  }, [dragOrder, tracks]);

  // A year per track is real work on an account with several, and it is only
  // ever looked at while the menu is open.
  const rows = useMemo<Row[]>(
    () =>
      open
        ? ordered.map((track) => ({
            track,
            color: track.meta.color || "var(--accent)",
            days: streakCalendar(track, today, settings.weekStartsOn),
            streak: trackStreak(track, today),
            rest: restScheduleOf(track),
            today,
          }))
        : [],
    [open, ordered, settings.weekStartsOn, today]
  );

  const sensors = useSensors(
    // Mouse: the small handle only, and a few pixels of travel, so clicking a
    // row still switches to it.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: a hold. The handle is wired to the whole row on a phone (see
    // below), where a 24-point icon is not a target anyone can hit, and the
    // delay is what keeps a tap a tap and a swipe a scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /** Closing forgets both the half-made decisions: a row armed for deletion,
   *  and an order that has been dragged but whose save has not come back yet.
   *  Dropping the drag order on the way out is what lets a change made on
   *  another device show up the next time the menu is opened. */
  const close = useCallback(() => {
    setConfirming(null);
    setDragOrder(null);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [close, open]);

  /**
   * The page behind the menu is held still while the menu is open.
   *
   * On a phone the menu is pinned to the viewport, so a finger dragged over
   * it scrolled the dashboard underneath: the list sat still and the whole
   * page moved behind it, which looks like the app coming apart. Three things
   * together, because no one of them covers every browser:
   *
   * - `overscroll-contain` on the list stops a scroll that *runs out* of list
   *   from carrying on into the page.
   * - `overflow: hidden` on the document stops the wheel and, on Android,
   *   the touch — but not a programmatic scroll, which is why the page keeps
   *   its position rather than jumping to the top.
   * - a `touchmove` that did not start inside the menu is refused outright.
   *   Safari on iOS ignores the overflow lock, and the alternative there is
   *   pinning the body with `position: fixed` and putting the scroll offset
   *   back afterwards, which repaints the whole page to stop it moving.
   */
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    // Only where the menu covers the viewport. On a desk it hangs off the
    // button and the page behind it is still the page.
    if (!window.matchMedia("(max-width: 639px)").matches) return;

    const root = document.documentElement;
    const { body } = document;
    const previous = { root: root.style.overflow, body: body.style.overflow };
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const holdStill = (event: TouchEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      event.preventDefault();
    };
    document.addEventListener("touchmove", holdStill, { passive: false });

    return () => {
      root.style.overflow = previous.root;
      body.style.overflow = previous.body;
      document.removeEventListener("touchmove", holdStill);
    };
  }, [open]);

  if (!activeTrack) return null;

  // One track cannot be deleted: the app has nowhere to stand without it.
  const canDelete = Boolean(onDelete) && tracks.length > 1;
  const canReorder = Boolean(onReorder) && tracks.length > 1;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = rows.map((row) => row.track.meta.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setDragOrder(next);
    onReorder?.(next);
  };

  const list = rows.map((row) => (
    <TrackRow
      key={row.track.meta.id}
      row={row}
      active={row.track.meta.id === activeTrackId}
      armed={confirming === row.track.meta.id}
      canDelete={canDelete}
      canReorder={canReorder}
      // Always reported, even for the track already open. Choosing the open
      // track is still a choice — from the all-tracks view it is how you get
      // back to that one track — and swallowing it here meant the only row in
      // the list that did nothing was the one you were looking at. What that
      // choice costs is the caller's to decide.
      onOpen={() => {
        close();
        onSwitch(row.track.meta.id);
      }}
      onArm={() => setConfirming(row.track.meta.id)}
      onDisarm={() => setConfirming((current) => (current === row.track.meta.id ? null : current))}
      onDelete={() => {
        close();
        onDelete?.(row.track.meta.id);
      }}
    />
  ));

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className="flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer text-[0.85rem] font-semibold text-accent hover:underline"
        title="Switch track"
      >
        {masterOpen ? (
          <Layers size={11} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
        ) : (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: activeTrack.meta.color || "var(--accent)" }}
            aria-hidden="true"
          />
        )}
        <span>{masterOpen ? "All tracks" : activeTrack.meta.name}</span>
        <ChevronDown size={12} strokeWidth={2.5} className={`text-subtle-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Pinned to the viewport on a phone and hung off the button on a desk.
          A 360-point menu anchored to a button sixty points from the left edge
          is 400 points wide on a 375-point screen, and the page — the only
          page in this app that had to — scrolled sideways.

          `overscroll-contain` keeps a scroll that runs out of list inside the
          list; the body lock above covers the case where there was no list to
          scroll in the first place. */}
      {open && (
        <div
          ref={menuRef}
          className="fixed inset-x-2 top-[3.6rem] z-50 max-h-[70vh] overflow-y-auto overscroll-contain rounded-md border border-card-border bg-card shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+0.5rem)] sm:max-h-none sm:w-[360px]"
        >
          {onOpenMaster && tracks.length > 1 && (
            <button
              onClick={() => {
                close();
                onOpenMaster();
              }}
              aria-current={masterOpen}
              className={`flex w-full items-center gap-2 border-b border-card-border px-3 py-2.5 text-left text-[0.8rem] font-semibold transition-colors ${
                masterOpen ? "bg-accent/[0.10] text-accent" : "bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              } cursor-pointer border-x-0 border-t-0`}
            >
              <Layers size={13} strokeWidth={2.5} className="shrink-0" />
              <span className="flex-1">All tracks</span>
              <span className="inline-flex items-center gap-1 text-[0.62rem] font-semibold uppercase tracking-[0.05em] text-subtle-foreground">
                <Lock size={9} strokeWidth={2.5} />
                Read only
              </span>
            </button>
          )}

          {canReorder ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rows.map((row) => row.track.meta.id)} strategy={verticalListSortingStrategy}>
                {list}
              </SortableContext>
            </DndContext>
          ) : (
            list
          )}

          <button
            onClick={() => {
              close();
              onNewTrack();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[0.8rem] bg-transparent border-none cursor-pointer text-accent hover:bg-accent/[0.08]"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>New track…</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One track in the list: its colour, its name, its run, and a year of its
 * days — plus the two things you can do to it that are not opening it.
 *
 * The drag handle is a mouse affordance. On a phone it is also wired to the
 * whole row through `onTouchStart`, the same trick the dashboard's panels use:
 * a 24-point icon is not a target anyone can hit with a thumb, and the touch
 * sensor's delay means a tap is still a tap and a swipe is still a scroll.
 */
function TrackRow({
  row,
  active,
  armed,
  canDelete,
  canReorder,
  onOpen,
  onArm,
  onDisarm,
  onDelete,
}: {
  row: Row;
  active: boolean;
  armed: boolean;
  canDelete: boolean;
  canReorder: boolean;
  onOpen: () => void;
  onArm: () => void;
  onDisarm: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.track.meta.id,
    disabled: !canReorder,
  });

  return (
    <div
      ref={setNodeRef}
      // Translate only. dnd-kit's full transform also carries the scale it
      // computes from the ratio between the dragged row and whatever it is
      // over, and these rows differ in height by whether a track has a streak
      // badge — enough to squash the name mid-drag.
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      onTouchStart={canReorder ? (listeners?.onTouchStart as React.TouchEventHandler<HTMLDivElement>) : undefined}
      className={`group relative border-b border-card-border last:border-b-0 ${
        isDragging ? "opacity-60 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)]" : ""
      }`}
    >
      {/* The track's colour laid over the row rather than replacing
          its background, so the row keeps the surface it sits on. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: row.color, opacity: active ? 0.12 : 0.04 }}
      />
      <button
        onClick={onOpen}
        aria-current={active}
        className="relative flex w-full flex-col gap-2 border-none bg-transparent px-3 py-2.5 text-left transition-colors duration-150 cursor-pointer hover:bg-surface-hover"
      >
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
          <span className="flex-1 truncate text-[0.85rem] font-semibold text-foreground">{row.track.meta.name}</span>
          {row.streak > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[0.65rem] font-bold"
              style={{ color: row.color, backgroundColor: "var(--surface-hover)" }}
            >
              <Flame size={9} strokeWidth={2.5} />
              {row.streak}
            </span>
          )}
          {/* Room for the controls, which sit over this end of the line rather
              than inside the row's own button — a button cannot contain
              another one. */}
          {(canDelete || canReorder) && <span className="shrink-0" style={{ width: canDelete && canReorder ? 48 : 24 }} />}
        </span>
        <TrackYearStrip
          days={row.days}
          color={row.color}
          cell={4}
          gap={2}
          start={row.track.startDate}
          today={row.today}
          markToday={false}
          rest={row.rest}
        />
      </button>

      <div className="absolute right-2.5 top-2 flex items-center gap-1">
        {canDelete && (
          <button
            onClick={() => (armed ? onDelete() : onArm())}
            onBlur={onDisarm}
            title={armed ? "Tap again to delete" : `Delete ${row.track.meta.name}`}
            aria-label={armed ? `Confirm deleting ${row.track.meta.name}` : `Delete ${row.track.meta.name}`}
            className={`flex h-6 items-center gap-1 rounded-[var(--radius-control)] border px-1.5 text-[0.62rem] font-semibold transition-colors cursor-pointer ${
              armed
                ? "border-red-500/50 bg-red-500/15 text-red-400"
                : "border-transparent bg-transparent text-subtle-foreground hover:border-card-border hover:bg-surface-hover hover:text-red-400"
            }`}
          >
            <Trash2 size={12} strokeWidth={2} />
            {armed && <span>Sure?</span>}
          </button>
        )}
        {canReorder && (
          <button
            {...attributes}
            {...listeners}
            title="Drag to reorder"
            aria-label={`Reorder ${row.track.meta.name}`}
            className="flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-[var(--radius-control)] border border-transparent bg-transparent text-subtle-foreground transition-colors hover:border-card-border hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical size={13} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
