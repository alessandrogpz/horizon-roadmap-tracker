"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { TrackState } from "@/lib/types";
import { dayForDate, todayYMD } from "@/lib/dates";
import { hiddenPanelsFor } from "@/lib/trackKinds";
import { MODULES } from "@/lib/modules";
import { seedTrackFromTemplate, TEMPLATE_LIST } from "@/lib/templates";
import { firstFreeColor } from "@/lib/trackColors";
import ColorSwatches from "@/components/shared/ColorSwatches";
import { useDismiss } from "@/components/useDismiss";
import { LIMITS } from "@/lib/limits";

/**
 * Making a track: what it is called, what colour it wears, when it runs, and
 * which template it opens with.
 *
 * Creating one used to be a single click that dropped a track called "New
 * Track" into the workspace with the template's own colour and a ninety-day
 * horizon nobody had chosen, and left you to find the settings modal
 * afterwards. The colour in particular has to be asked for here, because from
 * this point it is the accent the whole track wears.
 */
export default function NewTrackModal({
  takenColors,
  onCreate,
  onClose,
}: {
  takenColors: (string | undefined)[];
  onCreate: (track: TrackState) => void;
  onClose: () => void;
}) {
  // Lets the panel and its backdrop play their exit before whoever owns
  // this modal takes it off the page.
  const { closing, dismiss } = useDismiss(onClose);
  const [name, setName] = useState("");
  // Pre-picked to the first colour nobody has taken. Two tracks in the same
  // colour is allowed — six colours and no cap on tracks means it has to be —
  // but it should not be what happens by itself.
  const [color, setColor] = useState(() => firstFreeColor(takenColors));
  const [startDate, setStartDate] = useState(todayYMD());
  const [endDate, setEndDate] = useState("");

  const create = (templateId: string) => {
    const template = TEMPLATE_LIST.find((entry) => entry.id === templateId);
    if (!template) return;
    // A blank end date means "however long the template runs", which is what
    // happened before this field existed.
    const asked = endDate ? dayForDate(startDate, endDate) : 0;
    const days = asked > 0 ? asked : template.defaultDurationDays;

    const seeded = seedTrackFromTemplate(template, {
      name: name.trim() || template.label,
      color,
      startDate,
      phases: template.buildPhases(days),
      weekSchedule: template.defaultWeekSchedule,
      focusTypes: template.defaultFocusTypes,
    });

    // The kind only decides what the track *opens* with. Every module stays
    // available to every track from the Modules menu.
    onCreate({
      ...seeded,
      hiddenPanels: hiddenPanelsFor(
        template.id as Parameters<typeof hiddenPanelsFor>[0],
        MODULES.map((module) => module.id)
      ),
    });
    dismiss();
  };

  return (
    <div onClick={dismiss} className={`modal-overlay ${closing ? "overlay-out" : "overlay-in"} fixed inset-0 z-[1000] flex items-center justify-center p-4`}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${closing ? "modal-out" : "modal-in"} glass-panel panel-roomy max-h-[90vh] max-w-[460px] w-full flex flex-col gap-5 overflow-y-auto p-8 border border-accent-muted relative rounded-lg`}
      >
        <button
          onClick={dismiss}
          className="absolute top-6 right-6 flex items-center bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2} />
        </button>

        <div>
          <span className="type-caption bg-accent/10 text-accent px-2 py-0.5 rounded font-semibold uppercase font-mono tracking-[0.05em]">
            New track
          </span>
          <h2 className="type-title font-bold text-foreground mt-2">One goal, one track</h2>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="type-label text-muted-foreground">Name</label>
          <input
            type="text"
            maxLength={LIMITS.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What is this track called?"
            autoFocus
            className="bg-input-bg border border-card-border rounded-md text-foreground type-subhead outline-none px-3 py-2 font-[inherit]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="type-label text-muted-foreground">Colour</label>
          <ColorSwatches value={color} onPick={setColor} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="type-label text-muted-foreground">Starts</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-input-bg border border-card-border rounded-md text-foreground type-subhead outline-none px-3 py-2 font-[inherit] w-full"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            {/* The template used to decide this silently, so a track arrived
                with a horizon nobody had chosen and a phase timeline scaled
                to it. */}
            <label className="type-label text-muted-foreground">Should be done by</label>
            <input
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-input-bg border border-card-border rounded-md text-foreground type-subhead outline-none px-3 py-2 font-[inherit] w-full"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="type-label text-muted-foreground">What it is about</label>
          <p className="type-label text-subtle-foreground -mt-1">
            This only decides which modules the track opens with. Every module stays available to
            every track, so nothing is locked away by choosing here.
          </p>
          {TEMPLATE_LIST.map((template) => (
            <button
              key={template.id}
              onClick={() => create(template.id)}
              className="flex items-start gap-3 rounded-md border border-card-border bg-transparent px-3 py-2.5 text-left cursor-pointer transition-colors hover:bg-surface-hover"
            >
              {/* The chosen colour, not the template's — these rows are the
                  create button, and they should show what is about to be
                  made. */}
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="flex flex-col gap-0.5">
                <span className="type-body font-semibold text-foreground">{template.label}</span>
                <span className="type-label text-muted-foreground">{template.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
