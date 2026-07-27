"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Download,
  HardDrive,
  Info,
  LoaderCircle,
  Monitor,
  Moon,
  Check,
  Sparkles,
  Sun,
  Upload,
  X,
  XCircle,
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
import {
  aiKeyFor,
  aiModelFor,
  setAIKeyFor,
  setAIModelFor,
  updateAISettings,
  updateSettings,
} from "@/lib/settings";
import { useAppSettings } from "@/lib/useAppSettings";
import { checkProvider, getProvider, PROVIDERS } from "@/lib/ai/provider";
import type { AIModelInfo } from "@/lib/ai/types";
import { getThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme";

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
  onOpenCloudMenu,
  onRestored,
}: {
  onClose: () => void;
  /** Opens the existing Drive connect/backup dialog — connection lives there. */
  onOpenCloudMenu: () => void;
  /** Called after a restore or a wipe, so the app can reload the workspace. */
  onRestored: () => void;
}) {
  const settings = useAppSettings();
  // A lazy initializer rather than an effect: it reads browser state that
  // can't change while this dialog is open, and the dialog only ever mounts
  // client-side (it's rendered behind a click), so there's no SSR snapshot to
  // mismatch.
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  const [storage, setStorage] = useState<string>("");
  const [busy, setBusy] = useState<"export-json" | "export-zip" | "restore" | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ bundle: BackupBundle; summary: BackupSummary } | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [models, setModels] = useState<AIModelInfo[]>([]);
  const [keyCheck, setKeyCheck] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [keyCheckMessage, setKeyCheckMessage] = useState("");

  const activeAIProvider = getProvider(settings.ai.provider);

  /** Verifies the key *and* that the selected model will actually answer.
   *  Provider-agnostic — a provider without a model list simply reports the
   *  generation result. */
  const runKeyCheck = async () => {
    setKeyCheck("checking");
    setKeyCheckMessage("");
    const result = await checkProvider();
    setModels(result.models);
    setKeyCheck(result.ok ? "ok" : "error");
    setKeyCheckMessage(result.message);
  };

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

  const doWipe = async () => {
    await wipeLocalData();
    onRestored();
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

        {/* ── Appearance ─────────────────────────────────────────────── */}
        <Row
          icon={<Sun size={16} strokeWidth={2} />}
          title="Theme"
          hint="System follows your OS setting and keeps following it."
        >
          <Segmented<ThemePreference>
            value={theme}
            onChange={(next) => {
              setTheme(next);
              setThemePreference(next);
            }}
            options={[
              { value: "light", label: "Light", icon: <Sun size={13} /> },
              { value: "dark", label: "Dark", icon: <Moon size={13} /> },
              { value: "system", label: "System", icon: <Monitor size={13} /> },
            ]}
          />
        </Row>

        {/* ── Behaviour ──────────────────────────────────────────────── */}
        <Row
          icon={<Clock size={16} strokeWidth={2} />}
          title="My day starts at"
          hint="Work logged before this hour counts for the previous day, so a late session doesn't land on tomorrow and break a streak."
        >
          <select
            value={settings.dayRolloverHour}
            onChange={(e) => updateSettings({ dayRolloverHour: Number(e.target.value) })}
            className={selectClass}
          >
            {Array.from({ length: 12 }, (_, h) => (
              <option key={h} value={h}>
                {h === 0 ? "Midnight" : `${String(h).padStart(2, "0")}:00`}
              </option>
            ))}
          </select>
        </Row>

        <Row
          title="Weeks start on"
          hint="Which day each column of the consistency grid begins with."
        >
          <Segmented<"sun" | "mon">
            value={settings.weekStartsOn}
            onChange={(weekStartsOn) => updateSettings({ weekStartsOn })}
            options={[
              { value: "sun", label: "Sunday" },
              { value: "mon", label: "Monday" },
            ]}
          />
        </Row>

        {/* ── AI ─────────────────────────────────────────────────────── */}
        <Row
          icon={<Sparkles size={16} strokeWidth={2} />}
          title="AI roadmap drafting"
          hint="Optional. Bring your own API key to generate a starting roadmap from a goal. Horizon runs no AI of its own — requests go from this browser straight to the provider you pick, and a Content-Security-Policy header blocks connections to anywhere else. Check it yourself in devtools; don't take our word for it."
        >
          <select
            value={settings.ai.provider}
            onChange={(e) => updateAISettings({ provider: e.target.value as typeof settings.ai.provider })}
            className={selectClass}
          >
            <option value="">Off</option>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Row>

        {activeAIProvider && (
          <>
            <Row
              title={`${activeAIProvider.label} API key`}
              hint={`Stored on this device only, in this browser — never synced to Drive and never included in a backup. Restrict the key and set a spend limit at the provider: that protection is yours, not ours to promise.${
                activeAIProvider.keyUrl ? ` Get one at ${activeAIProvider.keyUrl.replace(/^https?:\/\//, "")}.` : ""
              }`}
            >
              <input
                type="password"
                value={aiKeyFor(settings.ai.provider, settings)}
                onChange={(e) => {
                  setAIKeyFor(settings.ai.provider, e.target.value);
                  // The old result described a different key.
                  setKeyCheck("idle");
                  setKeyCheckMessage("");
                }}
                placeholder={activeAIProvider.keyPlaceholder ?? "API key"}
                autoComplete="off"
                spellCheck={false}
                className={`${selectClass} w-[210px] font-mono`}
              />
            </Row>
            <Row
              title={`${activeAIProvider.label} model`}
              hint="Check the key to confirm it works and that this model will actually answer — a model with no quota reports as a rate limit, which is confusing on a first try."
            >
              <div className="flex flex-col items-end gap-2">
                {models.length > 0 ? (
                  <select
                    value={aiModelFor(settings.ai.provider, settings)}
                    onChange={(e) => setAIModelFor(settings.ai.provider, e.target.value)}
                    className={`${selectClass} w-[210px]`}
                  >
                    {models.some((m) => m.id === aiModelFor(settings.ai.provider, settings)) ? null : (
                      <option value={aiModelFor(settings.ai.provider, settings)}>
                        {aiModelFor(settings.ai.provider, settings)} (not listed)
                      </option>
                    )}
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={aiModelFor(settings.ai.provider, settings)}
                    onChange={(e) => setAIModelFor(settings.ai.provider, e.target.value)}
                    spellCheck={false}
                    className={`${selectClass} w-[210px] font-mono`}
                  />
                )}
                <div className="flex items-center gap-2">
                  {keyCheck === "ok" && <Check size={15} strokeWidth={2.5} className="text-emerald-500" />}
                  {keyCheck === "error" && <XCircle size={15} strokeWidth={2.5} className="text-red-500" />}
                  <button onClick={runKeyCheck} disabled={keyCheck === "checking"} className={quietButton}>
                    {keyCheck === "checking" ? (
                      <span className="flex items-center gap-1.5">
                        <LoaderCircle className="animate-spin" size={13} strokeWidth={2.5} /> Checking…
                      </span>
                    ) : (
                      "Check key"
                    )}
                  </button>
                </div>
                {keyCheckMessage && (
                  <span
                    className={`max-w-[240px] text-right text-[0.74rem] leading-snug ${
                      keyCheck === "error" ? "text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    {keyCheckMessage}
                  </span>
                )}
              </div>
            </Row>
          </>
        )}

        {/* ── Data ───────────────────────────────────────────────────── */}
        <Row
          icon={<HardDrive size={16} strokeWidth={2} />}
          title="Cloud sync"
          hint="Connect, disconnect, or check which Google account this device syncs through."
        >
          <button
            onClick={() => {
              onClose();
              onOpenCloudMenu();
            }}
            className={quietButton}
          >
            Manage connection
          </button>
        </Row>

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
          <a href="/landing" className={quietButton}>
            About Horizon
          </a>
        </Row>

        {/* ── Danger zone ────────────────────────────────────────────── */}
        <div className="mt-2 flex flex-col gap-3 rounded-[var(--radius-inner)] border border-red-500/30 bg-red-500/[0.05] px-4 py-3">
          <div className="flex gap-2.5">
            <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-red-400" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.9rem] font-semibold text-foreground">Delete local data</span>
              <span className="text-[0.78rem] leading-snug text-muted-foreground">
                Clears every track, note and credential from this browser. Anything already synced
                stays in your Drive; this device just forgets it.
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
