import { describe, it, expect } from "vitest";
import { buildDemoTracks, DEMO_TRACK_NAMES, isDemoTrack } from "../demoTracks";
import { TRACK_COLORS } from "../trackColors";
import { currentStreakLength } from "../streak";

const TODAY = "2026-09-26";

describe("demo tracks", () => {
  it("builds one track per name, each in a colour of its own", () => {
    const tracks = buildDemoTracks(TODAY);
    expect(tracks.map((track) => track.meta.name)).toEqual([...DEMO_TRACK_NAMES]);
    const colours = tracks.map((track) => track.meta.color);
    expect(new Set(colours).size).toBe(colours.length);
    colours.forEach((colour) => expect(TRACK_COLORS).toContain(colour));
  });

  it("is the same data every time, so a track is the same track tomorrow", () => {
    const first = buildDemoTracks(TODAY);
    const second = buildDemoTracks(TODAY);
    first.forEach((track, index) => {
      expect(track.completedItemsHistory).toEqual(second[index].completedItemsHistory);
    });
  });

  it("gives each track a year or more of days, none of them in the future", () => {
    buildDemoTracks(TODAY).forEach((track) => {
      const dates = Object.keys(track.completedItemsHistory).sort();
      expect(dates.length).toBeGreaterThan(60);
      expect(dates[0] >= track.startDate).toBe(true);
      expect(dates[dates.length - 1] <= TODAY).toBe(true);
    });
  });

  it("leaves every track on a live streak, so there is something to show", () => {
    buildDemoTracks(TODAY).forEach((track) => {
      expect(currentStreakLength(track.streakHistory, TODAY)).toBeGreaterThanOrEqual(3);
    });
  });

  it("spreads days across the whole shade scale rather than one step of it", () => {
    buildDemoTracks(TODAY).forEach((track) => {
      const counts = new Set(Object.values(track.completedItemsHistory).map((items) => items.length));
      expect(counts.size).toBeGreaterThan(1);
      counts.forEach((count) => {
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(4);
      });
    });
  });

  it("recognises its own tracks and nobody else's", () => {
    const [demo] = buildDemoTracks(TODAY);
    expect(isDemoTrack(demo)).toBe(true);
    expect(isDemoTrack({ meta: { ...demo.meta, name: "Learn Guitar" } })).toBe(false);
  });
});
