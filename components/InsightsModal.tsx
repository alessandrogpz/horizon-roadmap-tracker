"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * Search & insights: full-text search across the account's tracks and notes,
 * and history computed from the account's data. Both run on the server, in
 * MongoDB ($text search, aggregation pipelines; see lib/server/insights), so
 * they cover what has been synced, from every device.
 */

interface TrackHit {
  trackId: string;
  name: string;
  materials: { id: string; title: string; author?: string }[];
  phases: { id: number; title: string }[];
}
interface NoteHit {
  noteId: string;
  kind: "material" | "notepad" | "todo";
  about: string;
  snippet: string;
}
interface SearchResult {
  tracks: TrackHit[];
  notes: NoteHit[];
}
interface Figures {
  activeDays: number;
  accomplishments: number;
  ticks: number;
}
interface Stats {
  totals: Figures & { firstDay: string | null; lastDay: string | null };
  byWeekday: (Figures & { weekday: number; rate: number })[];
  byMonth: (Figures & { month: string })[];
  byTrack: (Figures & {
    trackId: string;
    name: string;
    archived: boolean;
    longestStreak: { length: number; from: string; to: string } | null;
  })[];
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const KIND_LABEL: Record<NoteHit["kind"], string> = { material: "Material note", notepad: "Notepad", todo: "To-do list" };

const shortDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" });

const quietButton =
  "rounded-[var(--radius-control)] border border-card-border bg-surface-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground cursor-pointer transition-colors hover:text-foreground hover:bg-surface-hover";

/** A stat tile: a label and one number. */
function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-w-[130px] flex-1 flex-col gap-1 rounded-[10px] border border-card-border bg-card/60 px-3.5 py-2.5">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className="font-mono text-[1.3rem] font-bold leading-none text-foreground">{value}</span>
      {note && <span className="text-[0.7rem] text-muted-foreground">{note}</span>}
    </div>
  );
}

/**
 * One series of columns. Each column grows from a hairline baseline, is at
 * most 24px wide with a 4px rounded top, and is its own hover and focus
 * target, showing its label and value. "Table" shows the same numbers as
 * text, so nothing depends on hovering.
 */
function Columns({ title, data }: { title: string; data: { label: string; value: number; display: string }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(...data.map((d) => d.value), 0);

  return (
    <figure className="m-0 flex min-w-[240px] flex-1 flex-col gap-2">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-[0.8rem] font-semibold text-foreground">{title}</span>
        <button onClick={() => setAsTable((t) => !t)} className={quietButton}>
          {asTable ? "Chart" : "Table"}
        </button>
      </figcaption>

      {asTable ? (
        <table className="w-full text-[0.75rem]">
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b border-card-border last:border-b-0">
                <td className="py-1 text-muted-foreground">{d.label}</td>
                <td className="py-1 text-right font-mono text-foreground">{d.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div>
          {/* The top margin is the tooltip's room, so it never covers the title. */}
          <div className="relative mt-7 flex h-28 items-end gap-[2px] border-b border-card-border">
            {data.map((d, i) => (
              <button
                key={d.label}
                type="button"
                aria-label={`${d.label}: ${d.display}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="flex h-full flex-1 cursor-default items-end justify-center rounded-sm outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
              >
                <span
                  className={`block w-full max-w-[24px] rounded-t-[4px] bg-accent transition-opacity ${active === null || active === i ? "opacity-100" : "opacity-45"}`}
                  style={{ height: max ? `${(d.value / max) * 100}%` : "0%", minHeight: d.value ? 2 : 0 }}
                />
              </button>
            ))}
            {active !== null && (
              <div
                role="status"
                className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-card-border bg-card px-2 py-1 text-[0.7rem] shadow-sm"
                style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
              >
                <span className="text-muted-foreground">{data[active].label}</span>{" "}
                <span className="font-mono font-semibold text-foreground">{data[active].display}</span>
              </div>
            )}
          </div>
          <div className="mt-1 flex gap-[2px]">
            {data.map((d) => (
              <span key={d.label} className="flex-1 text-center text-[0.65rem] text-muted-foreground">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}

export default function InsightsModal({ onClose, onOpenTrack }: { onClose: () => void; onOpenTrack: (trackId: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    fetch("/api/stats", { cache: "no-store" })
      .then(async (res) => (res.ok ? setStats(await res.json()) : setError("Couldn't load your history.")))
      .catch(() => setError("Couldn't load your history."));
  }, []);

  // Search as you type: 300 ms after the last keystroke, and a newer search
  // cancels an older one still in flight.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal, cache: "no-store" })
        .then(async (res) => {
          if (res.ok) setResults(await res.json());
          else setError(res.status === 429 ? "Slow down a little, then try again." : "Search failed.");
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setError("Search failed.");
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Results belong to a query: an emptied box shows none, without an effect.
  const shown = query.trim() ? results : null;

  const best = stats?.byTrack.reduce<Stats["byTrack"][number]["longestStreak"]>(
    (top, t) => (t.longestStreak && (!top || t.longestStreak.length > top.length) ? t.longestStreak : top),
    null
  );

  return (
    <div
      onClick={onClose}
      className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Search and insights"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel relative flex max-h-[90vh] w-full max-w-[760px] flex-col gap-4 overflow-y-auto border-accent-muted"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div>
          <h3 className="m-0 pr-8 text-[1.1rem] font-semibold text-foreground">Search & insights</h3>
          <p className="m-0 text-[0.8rem] text-muted-foreground">
            Everything your account has synced, from every device. Sync first to include this device&apos;s latest changes.
          </p>
        </div>

        {/* ── Search ─────────────────────────────────────────────────── */}
        <label className="flex items-center gap-2 rounded-[var(--radius-control)] border border-card-border bg-input-bg px-3 py-2 focus-within:shadow-[0_0_0_3px_var(--ring)]">
          <Search size={15} strokeWidth={2} className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            maxLength={100}
            onChange={(e) => {
              setError("");
              setQuery(e.target.value);
            }}
            placeholder="Search materials, phases, roadmaps and notes…"
            className="w-full bg-transparent text-[0.85rem] text-foreground outline-none placeholder:text-subtle-foreground"
          />
          {searching && <span className="text-[0.7rem] text-muted-foreground">Searching…</span>}
        </label>

        {shown && (
          <div className="flex flex-col gap-2">
            {shown.tracks.length === 0 && shown.notes.length === 0 && (
              <p className="m-0 text-[0.8rem] text-muted-foreground">Nothing found for “{query.trim()}”.</p>
            )}
            {shown.tracks.map((t) => (
              <button
                key={t.trackId}
                onClick={() => {
                  onOpenTrack(t.trackId);
                  onClose();
                }}
                className="flex cursor-pointer flex-col gap-1 rounded-[var(--radius-inner)] border border-card-border px-3 py-2 text-left transition-colors hover:border-card-border-hover hover:bg-surface-hover"
                title="Open this track"
              >
                <span className="text-[0.85rem] font-semibold text-foreground">{t.name}</span>
                {[...t.materials.map((m) => `${m.title}${m.author ? ` · ${m.author}` : ""}`), ...t.phases.map((p) => `Phase: ${p.title}`)].map(
                  (line) => (
                    <span key={line} className="text-[0.78rem] text-muted-foreground">
                      {line}
                    </span>
                  )
                )}
              </button>
            ))}
            {shown.notes.map((n) => (
              <div key={n.noteId} className="flex flex-col gap-0.5 rounded-[var(--radius-inner)] border border-card-border px-3 py-2">
                <span className="text-[0.7rem] uppercase tracking-[0.06em] text-muted-foreground">
                  {KIND_LABEL[n.kind]} · {n.about}
                </span>
                <span className="text-[0.8rem] text-foreground">{n.snippet}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── History ────────────────────────────────────────────────── */}
        {!stats && !error && <p className="m-0 text-[0.8rem] text-muted-foreground">Loading your history…</p>}
        {stats && stats.totals.activeDays === 0 && (
          <p className="m-0 text-[0.8rem] text-muted-foreground">
            No history synced yet. Tick something off, sync from the top bar, and it shows up here.
          </p>
        )}
        {stats && stats.totals.activeDays > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              <Tile label="Active days" value={String(stats.totals.activeDays)} note="days with an accomplishment" />
              <Tile label="Accomplishments" value={String(stats.totals.accomplishments)} />
              <Tile
                label="Longest streak"
                value={best ? `${best.length} ${best.length === 1 ? "day" : "days"}` : "—"}
                note={best ? `${shortDate(best.from)} – ${shortDate(best.to)}` : undefined}
              />
              {stats.totals.firstDay && (
                <Tile
                  label="Since"
                  value={new Date(`${stats.totals.firstDay}T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                  note={shortDate(stats.totals.firstDay)}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-6">
              <Columns
                title="How often each weekday is active"
                data={stats.byWeekday.map((w) => ({
                  label: WEEKDAYS[w.weekday - 1],
                  value: w.rate,
                  display: `${Math.round(w.rate * 100)}%`,
                }))}
              />
              <Columns
                title="Active days per month"
                data={stats.byMonth.map((m) => ({ label: monthLabel(m.month), value: m.activeDays, display: String(m.activeDays) }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[0.8rem] font-semibold text-foreground">By track</span>
              <table className="w-full text-[0.78rem]">
                <thead>
                  <tr className="text-left text-[0.7rem] uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="py-1 font-semibold">Track</th>
                    <th className="py-1 text-right font-semibold">Active days</th>
                    <th className="py-1 text-right font-semibold">Accomplishments</th>
                    <th className="py-1 text-right font-semibold">Longest streak</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byTrack.map((t) => (
                    <tr key={t.trackId} className="border-t border-card-border">
                      <td className="py-1.5 text-foreground">
                        {t.name}
                        {t.archived && <span className="text-muted-foreground"> (archived)</span>}
                      </td>
                      <td className="py-1.5 text-right font-mono text-foreground">{t.activeDays}</td>
                      <td className="py-1.5 text-right font-mono text-foreground">{t.accomplishments}</td>
                      <td className="py-1.5 text-right font-mono text-foreground">
                        {t.longestStreak ? `${t.longestStreak.length} d` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {error && <p className="m-0 text-[0.8rem] text-red-400">{error}</p>}
      </div>
    </div>
  );
}
