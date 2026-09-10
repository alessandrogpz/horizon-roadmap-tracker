import { describe, it, expect } from "vitest";
import { TEMPLATE_LIST, blankTrack, seedTrackFromTemplate } from "../templates";

describe("templates", () => {
  TEMPLATE_LIST.forEach((template) => {
    describe(`template: ${template.id}`, () => {
      it("seeds a structurally valid, fully mutable TrackState", () => {
        const phases = template.buildPhases(template.defaultDurationDays);
        const track = seedTrackFromTemplate(template, {
          name: "My Track",
          color: template.defaultColor,
          startDate: "2026-07-20",
          phases,
          weekSchedule: template.defaultWeekSchedule,
          focusTypes: template.defaultFocusTypes,
        });

        // Required AppState fields are all present and non-empty where expected.
        expect(track.phases.length).toBeGreaterThan(0);
        expect(track.weekSchedule && track.weekSchedule.length).toBe(7);
        expect(Object.keys(track.focusTypes || {}).length).toBeGreaterThan(0);
        expect(track.dailyTasks).toBeTruthy();
        expect(track.dailyRevisionItems).toBeTruthy();

        // Live immediately: no placeholder/unsynced state for a newly seeded track.
        expect(track.isSynced).toBe(true);

        // Provenance only.
        expect(track.meta.templateId).toBe(template.id);
        expect(track.meta.name).toBe("My Track");

        // Nothing is frozen/readonly — spot-check mutability.
        const mutated = { ...track, phases: [...track.phases] };
        mutated.phases[0] = { ...mutated.phases[0], title: "Renamed" };
        expect(mutated.phases[0].title).toBe("Renamed");
        expect(() => { (track as { meta: { name: string } }).meta.name = "Changed"; }).not.toThrow();
      });

      it("assigns a track id that is never the reserved legacy migration id", () => {
        const phases = template.buildPhases(template.defaultDurationDays);
        const track = seedTrackFromTemplate(template, {
          name: "Another Track",
          color: template.defaultColor,
          startDate: "2026-07-20",
          phases,
          weekSchedule: template.defaultWeekSchedule,
          focusTypes: template.defaultFocusTypes,
        });
        expect(track.meta.id).not.toBe("track_legacy_engine_graphics");
      });

      it("produces materials/portfolio ids prefixed by the new track id", () => {
        const phases = template.buildPhases(template.defaultDurationDays);
        const track = seedTrackFromTemplate(template, {
          name: "Yet Another",
          color: template.defaultColor,
          startDate: "2026-07-20",
          phases,
          weekSchedule: template.defaultWeekSchedule,
          focusTypes: template.defaultFocusTypes,
        });
        track.materials.forEach((m) => expect(m.id.startsWith(`m_${track.meta.id}_`)).toBe(true));
        track.portfolio.forEach((p) => expect(p.id.startsWith(`p_${track.meta.id}_`)).toBe(true));
      });
    });
  });

  it("two tracks seeded from the same template get different ids", () => {
    const template = TEMPLATE_LIST[0];
    const phases = template.buildPhases(template.defaultDurationDays);
    const answers = {
      name: "Dup",
      color: template.defaultColor,
      startDate: "2026-07-20",
      phases,
      weekSchedule: template.defaultWeekSchedule,
      focusTypes: template.defaultFocusTypes,
    };
    const a = seedTrackFromTemplate(template, answers);
    const b = seedTrackFromTemplate(template, answers);
    expect(a.meta.id).not.toBe(b.meta.id);
  });

  it("blankTrack builds a usable Custom skeleton under the given name and start date", () => {
    const track = blankTrack("New Track", "2026-09-10");
    expect(track.meta).toMatchObject({ name: "New Track", templateId: "custom" });
    expect(track.startDate).toBe("2026-09-10");
    expect(track.phases.length).toBe(4);
    expect(track.weekSchedule?.length).toBe(7);
    expect(track.isSynced).toBe(true);
    expect(track.materials).toEqual([]);
  });
});
