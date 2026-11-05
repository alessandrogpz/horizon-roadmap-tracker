import { describe, expect, it } from "vitest";
import { contrastRatio, darken, flatten, lighten, onColor, readableOn } from "../colors";
import { TRACK_COLORS } from "../trackColors";
import { trackAccentVariables, trackInkVariables } from "../trackAccent";

// The surfaces the real themes land on; kept here so a change to either theme
// that breaks the guarantee shows up as a failing test rather than on screen.
const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#17171b";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#3f7ac4", "#3f7ac4")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#0ea5e9", "#17171b")).toBeCloseTo(contrastRatio("#17171b", "#0ea5e9"), 10);
  });

  // The guard that matters: a colour this file cannot parse must never come
  // back looking like it passed.
  it("reports no contrast for an unparseable colour", () => {
    expect(contrastRatio("var(--accent)", "#ffffff")).toBe(1);
    expect(contrastRatio("#ffffff", "rgba(0,0,0,0.5)")).toBe(1);
  });
});

describe("darken / lighten", () => {
  it("moves toward black and toward white", () => {
    expect(darken("#808080", 1)).toBe("#000000");
    expect(lighten("#808080", 1)).toBe("#ffffff");
    expect(darken("#3f7ac4", 0)).toBe("#3f7ac4");
  });

  it("leaves a colour it cannot read alone", () => {
    expect(darken("var(--accent)", 0.5)).toBe("var(--accent)");
  });
});

describe("flatten", () => {
  it("resolves a translucent colour against its backdrop", () => {
    expect(flatten("#000000", 0.5, "#ffffff")).toBe("#808080");
    expect(flatten("#ff0000", 0, "#ffffff")).toBe("#ffffff");
    expect(flatten("#ff0000", 1, "#ffffff")).toBe("#ff0000");
  });
});

describe("readableOn", () => {
  it("leaves a colour that already passes untouched", () => {
    // Sky on the dark card reads 6.45 before anything is done to it.
    expect(readableOn("#0ea5e9", DARK_SURFACE)).toBe("#0ea5e9");
  });

  it("keeps the hue when it darkens for a light surface", () => {
    // Darkening scales every channel by the same factor, so the ratios between
    // them — which is what the hue is — survive exactly. This is the whole
    // reason a track stays recognisable after being made readable.
    const moved = readableOn("#22c55e", LIGHT_SURFACE);
    expect(moved).not.toBe("#22c55e");
    expect(hueOf(moved)).toBeCloseTo(hueOf("#22c55e"), 0);
  });

  it("respects a target above the default", () => {
    const strict = readableOn("#22c55e", LIGHT_SURFACE, 7);
    expect(contrastRatio(strict, LIGHT_SURFACE)).toBeGreaterThanOrEqual(7);
  });

  it("returns the colour unchanged when it cannot be parsed", () => {
    expect(readableOn("var(--accent)", LIGHT_SURFACE)).toBe("var(--accent)");
  });
});

// The guarantee the whole accent system rests on. Every colour a track can
// wear has to be legible in both themes — the six were picked on a dark screen
// and five of them failed even 3:1 on white before this existed.
describe("every track colour is readable in both themes", () => {
  it.each([...TRACK_COLORS])("%s", (color) => {
    const vars = trackAccentVariables(color);
    expect(contrastRatio(vars["--track-accent-light"], LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(vars["--track-accent-dark"], DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);

    const ink = trackInkVariables(color);
    expect(contrastRatio(ink["--ink-light"], LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink["--ink-dark"], DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it("writes a value for every variable the page removes again", () => {
    // TrackAccent clears exactly the keys this returns, so a variable added to
    // one theme and not the other would be left behind on a track switch.
    const keys = Object.keys(trackAccentVariables("#22c55e"));
    const light = keys.filter((k) => k.endsWith("-light")).map((k) => k.replace("-light", ""));
    const dark = keys.filter((k) => k.endsWith("-dark")).map((k) => k.replace("-dark", ""));
    expect(light).toEqual(dark);
    expect(light.length).toBeGreaterThan(0);
  });
});

/** Hue in degrees, for asserting that a colour is still itself. */
function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return 0;
  const raw = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((raw * 60) + 360) % 360;
}

describe("onColor", () => {
  it("picks a mark that can be read on every track colour", () => {
    for (const fill of TRACK_COLORS) {
      const mark = onColor(fill);
      expect(contrastRatio(mark, fill)).toBeGreaterThanOrEqual(4.4);
    }
  });

  it("picks white on a dark fill and black on a light one", () => {
    expect(onColor("#0a0a0c")).toBe("#ffffff");
    expect(onColor("#fbfbfc")).toBe("#000000");
  });

  it("beats a fixed white, which fails on five of the six track colours", () => {
    const failsWhite = TRACK_COLORS.filter((c) => contrastRatio("#ffffff", c) < 4.5);
    expect(failsWhite.length).toBe(5);
    for (const fill of failsWhite) expect(contrastRatio(onColor(fill), fill)).toBeGreaterThanOrEqual(4.4);
  });
});
