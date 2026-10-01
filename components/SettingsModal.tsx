"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Download,
  Info,
  MessagesSquare,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import packageJson from "../package.json";
import { exportSingleFile, exportZipBundle } from "@/lib/export";
import {
  InvalidBackupError,
  readBackupFile,
  restoreBackup,
  summarizeBackup,
  wipeLocalData,
  type BackupSummary,
} from "@/lib/import";
import type { BackupBundle } from "@/lib/export";
import { updateSettings } from "@/lib/settings";
import { useAppSettings } from "@/lib/useAppSettings";
import { googleClientId, signOut } from "@/lib/account";
import { buildDemoTracks, DEMO_TRACK_NAMES, isDemoTrack } from "@/lib/demoTracks";
import { DISCORD_INVITE, hasCommunity } from "@/lib/community";
import { todayYMD } from "@/lib/dates";
import { visibleTracks } from "@/lib/selectors";
import { useWorkspace, useWorkspaceActions } from "@/components/workspace/WorkspaceProvider";
import AccountRow from "./AccountRow";

/**
 * App-level settings: the choices that belong to this device rather than to a
 * track. Track identity, rhythm and rotations stay in their own dialogs — a
 * user looking for "start date" should never find it next to "Client ID".
 */

function Row({
  icon,
  title,
  hint,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-card-border py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex gap-2.5">
        {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.9rem] font-semibold text-foreground">{title}</span>
          {hint && <span className="text-[0.78rem] leading-snug text-muted-foreground">{hint}</span>}
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-[var(--radius-control)] border border-card-border bg-surface-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex cursor-pointer items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[0.78rem] transition-colors ${
            option.value === value
              ? "bg-accent/15 text-accent font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

const selectClass =
  "rounded-[var(--radius-control)] border border-card-border bg-input-bg px-2.5 py-1.5 text-[0.8rem] text-foreground outline-none focus-visible:shadow-[0_0_0_3px_var(--ring)]";

const quietButton =
  "rounded-[var(--radius-control)] border border-card-border bg-surface-muted px-3 py-1.5 text-[0.78rem] text-foreground cursor-pointer transition-colors hover:border-card-border-hover hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50";

export default function SettingsModal({
  onClose,
  onRestored,
}: {
  onClose: () => void;
  /** Opens the existing Drive connect/backup dialog — connection lives there. */
  /** Called after a restore or a wipe, so the app can reload the workspace. */
  onRestored: () => void;
}) {
  const settings = useAppSettings();
  // A lazy initializer rather than an effect: it reads browser state that
  // can't change while this dialog is open, and the dialog only ever mounts
  // client-side (it's rendered behind a click), so there's no SSR snapshot to
  // mismatch.
  const [storage, setStorage] = useState<string>("");
  const [busy, setBusy] = useState<"export-json" | "export-zip" | "restore" | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ bundle: BackupBundle; summary: BackupSummary } | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { workspace } = useWorkspace();
  const { addTrack, commitWorkspace, switchTrack } = useWorkspaceActions();
  const demoTracks = workspace ? visibleTracks(workspace).filter(isDemoTrack) : [];

  // How much this origin is actually holding — worth knowing before deciding
  // whether a backup matters. Async, so it lands after first paint.
  useEffect(() => {
    navigator.storage?.estimate?.().then((estimate) => {
      if (estimate.usage === undefined) return;
      const mb = estimate.usage / (1024 * 1024);
      setStorage(mb < 0.1 ? "< 0.1 MB" : `${mb.toFixed(1)} MB`);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleExport = async (kind: "export-json" | "export-zip") => {
    setBusy(kind);
    setError("");
    try {
      await (kind === "export-json" ? exportSingleFile() : exportZipBundle());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      const bundle = await readBackupFile(file);
      setPending({ bundle, summary: summarizeBackup(bundle) });
    } catch (err) {
      setError(
        err instanceof InvalidBackupError ? err.message : "That file couldn't be read as a backup."
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmRestore = async () => {
    if (!pending) return;
    setBusy("restore");
    setError("");
    try {
      await restoreBackup(pending.bundle);
      setPending(null);
      onRestored();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
      setBusy(null);
    }
  };

  /**
   * Three tracks with a year of history, and a way to take them away again.
   *
   * Everything that shows more than one track at once — the stacked view in
   * Consistency, the years under each name in the switcher — is impossible to
   * judge on an account in its first month, and ticking several hundred days
   * by hand to see it is not a reasonable ask. They are ordinary tracks,
   * recognised by name rather than by a flag, so nothing else in the app has
   * to know they are different.
   */
  const addDemoTracks = async () => {
    const wasOpen = workspace?.activeTrackId;
    for (const track of buildDemoTracks(todayYMD())) await addTrack(track);
    // `addTrack` opens what it adds, which is right when a person made the
    // track and wrong when three arrived at once from a settings dialog.
    if (wasOpen) await switchTrack(wasOpen);
  };

  const removeDemoTracks = async () => {
    if (!workspace || demoTracks.length === 0) return;
    const keep = visibleTracks(workspace).find((track) => !isDemoTrack(track));
    const ids = new Set(demoTracks.map((track) => track.meta.id));
    const tracks = { ...workspace.tracks };
    // Archived, not removed: the sync merge reconciles two devices by
    // comparing records, so a track deleted by *absence* here would simply be
    // handed back by the next sync from the account's copy.
    ids.forEach((id) => {
      tracks[id] = { ...tracks[id], meta: { ...tracks[id].meta, archived: true } };
    });
    await commitWorkspace({
      ...workspace,
      tracks,
      // Off the track being deleted first: archiving the open one leaves the
      // app standing on a track nothing will show it.
      activeTrackId: ids.has(workspace.activeTrackId) && keep ? keep.meta.id : workspace.activeTrackId,
    });
  };

  const doWipe = async () => {
    // The session cookie is a credential in this browser too. Best effort: a
    // server that can't be reached shouldn't stop the local wipe.
    if (googleClientId()) await signOut().catch(() => {});
    await wipeLocalData();
    onRestored();
    // A full page load on purpose: the app must start again from nothing, with
    // no in-memory copy of the data that was just wiped.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };

  return (
    <div
      onClick={onClose}
      className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel relative flex max-h-[90vh] w-full max-w-[640px] flex-col gap-1 overflow-y-auto border-accent-muted"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <h3 className="m-0 pr-8 text-[1.1rem] font-semibold text-foreground">Settings</h3>
        <p className="m-0 mb-2 text-[0.8rem] text-muted-foreground">
          These apply to this device, and to every track on it. A track&apos;s own name, dates,
          rhythm and rotations live in its settings.
        </p>

        {/* Appearance is not here any more. The theme is the icon in the top
            bar: it starts on whatever the OS is set to, and the button flips
            it. Three chips in a modal was a lot of screen for a decision made
            in a second, and a "System" option that only mattered on first run
            was the least useful third of it. */}

        {/* ── Behaviour ──────────────────────────────────────────────── */}
        {/* One row, not two. When a week begins and when a day rolls over are
            the same kind of decision — "how this app reads a calendar" — and
            splitting them made the answer to one of them easy to miss. The
            phone groups them the same way. */}
        <Row
          icon={<Clock size={16} strokeWidth={2} />}
          title="Your week and day"
          hint="Monday and midnight unless you say otherwise. Work logged before the hour you pick counts for the previous day, so a late session doesn't land on tomorrow and break a streak."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<"sun" | "mon">
              value={settings.weekStartsOn}
              onChange={(weekStartsOn) => updateSettings({ weekStartsOn })}
              options={[
                { value: "mon", label: "Monday" },
                { value: "sun", label: "Sunday" },
              ]}
            />
            <select
              value={settings.dayRolloverHour}
              onChange={(e) => updateSettings({ dayRolloverHour: Number(e.target.value) })}
              className={selectClass}
              aria-label="My day starts at"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h === 0 ? "Day starts at midnight" : `Day starts at ${String(h).padStart(2, "0")}:00`}
                </option>
              ))}
            </select>
          </div>
        </Row>

        {/* ── Data ───────────────────────────────────────────────────── */}
        {googleClientId() && <AccountRow />}

        <Row
          icon={<Download size={16} strokeWidth={2} />}
          title="Export a backup"
          hint="Every track, roadmap, rotation, material and note. The .zip additionally breaks each document out as readable markdown."
        >
          <button
            onClick={() => handleExport("export-json")}
            disabled={busy !== null}
            className={quietButton}
          >
            {busy === "export-json" ? "Exporting…" : ".json"}
          </button>
          <button
            onClick={() => handleExport("export-zip")}
            disabled={busy !== null}
            className={quietButton}
          >
            {busy === "export-zip" ? "Exporting…" : ".zip"}
          </button>
        </Row>

        <Row
          icon={<Upload size={16} strokeWidth={2} />}
          title="Restore from a backup"
          hint="Replaces everything on this device with the contents of a .json or .zip export."
        >
          <input
            ref={fileRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
          <button onClick={() => fileRef.current?.click()} disabled={busy !== null} className={quietButton}>
            Choose file…
          </button>
        </Row>

        {pending && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-inner)] border border-accent-muted bg-accent/[0.06] px-4 py-3">
            <div className="flex flex-col gap-1">
              <span className="text-[0.85rem] font-semibold text-foreground">
                Restore this backup?
              </span>
              <span className="text-[0.8rem] leading-snug text-muted-foreground">
                {pending.summary.trackCount} track
                {pending.summary.trackCount === 1 ? "" : "s"} (
                {pending.summary.trackNames.slice(0, 3).join(", ")}
                {pending.summary.trackNames.length > 3 ? "…" : ""}), {pending.summary.noteCount} note
                {pending.summary.noteCount === 1 ? "" : "s"}, {pending.summary.activeDays} active day
                {pending.summary.activeDays === 1 ? "" : "s"}
                {pending.summary.exportedAt
                  ? `, exported ${new Date(pending.summary.exportedAt).toLocaleDateString()}`
                  : ""}
                . Everything currently on this device is replaced — export first if you&apos;re not
                sure.
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmRestore} disabled={busy === "restore"} className="btn btn-sm btn-solid">
                {busy === "restore" ? "Restoring…" : "Replace my data"}
              </button>
              <button onClick={() => setPending(null)} className={quietButton}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <Row
          icon={<Info size={16} strokeWidth={2} />}
          title="This device"
          hint={`Horizon v${packageJson.version}${storage ? ` · about ${storage} stored locally` : ""}`}
        >
          {/* Plain links, not router pushes: these are separate pages outside
              the app shell, and a full navigation is what should happen. */}
          <a href="/security" className={quietButton}>
            Security
          </a>
          <a href="/privacy" className={quietButton}>
            Privacy
          </a>
          <a href="/landing" className={quietButton}>
            About
          </a>
        </Row>

        {/* Reachable from inside the app, not only from the page that sells
            it. Somebody who wants to report something is already in here. */}
        {hasCommunity() && (
          <Row
            icon={<MessagesSquare size={16} strokeWidth={2} />}
            title="Community"
            hint="A Discord: ask something, say what is broken, or show the track you are running. New versions get announced there too."
          >
            <a href={DISCORD_INVITE} target="_blank" rel="noreferrer noopener" className={quietButton}>
              Join
            </a>
          </Row>
        )}

        <Row
          icon={<Sparkles size={16} strokeWidth={2} />}
          title="Demo tracks"
          hint={`${DEMO_TRACK_NAMES.join(", ")} — three tracks in three colours, each with a year or more of days already ticked. They give the views that show several tracks at once something to show, and are something to break in without touching a real track. Ordinary tracks otherwise: open them, edit them, delete them.`}
        >
          <button
            onClick={() => void addDemoTracks()}
            disabled={demoTracks.length > 0}
            className={quietButton}
          >
            {demoTracks.length > 0 ? `${demoTracks.length} added` : "Add them"}
          </button>
          <button
            onClick={() => void removeDemoTracks()}
            disabled={demoTracks.length === 0}
            className={quietButton}
          >
            Remove them
          </button>
        </Row>

        {/* ── Danger zone ────────────────────────────────────────────── */}
        <div className="mt-2 flex flex-col gap-3 rounded-[var(--radius-inner)] border border-red-500/30 bg-red-500/[0.05] px-4 py-3">
          <div className="flex gap-2.5">
            <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-red-400" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.9rem] font-semibold text-foreground">Delete local data</span>
              <span className="text-[0.78rem] leading-snug text-muted-foreground">
                Clears every track, note and credential from this browser, and signs it out.
                Anything already synced stays in your Drive; this device just forgets it.
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {confirmWipe ? (
              <>
                <button
                  onClick={doWipe}
                  className="cursor-pointer rounded-[var(--radius-control)] border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-[0.78rem] font-semibold text-red-400"
                >
                  Yes, delete everything
                </button>
                <button onClick={() => setConfirmWipe(false)} className={quietButton}>
                  Keep my data
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmWipe(true)}
                className="cursor-pointer rounded-[var(--radius-control)] border border-red-500/30 bg-transparent px-3 py-1.5 text-[0.78rem] text-red-400 transition-colors hover:bg-red-500/10"
              >
                Delete local data…
              </button>
            )}
          </div>
        </div>

        {error && <p className="m-0 pt-2 text-[0.8rem] text-red-400">{error}</p>}
      </div>
    </div>
  );
}
