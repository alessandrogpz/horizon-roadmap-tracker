import { describe, it, expect } from "vitest";
import { TrackSchema } from "../server/sync/schema";

describe("sync schema carries banked phase days", () => {
  const track = {
    meta: { id: "t1", name: "T", color: "#fff", templateId: "custom", createdAt: Date.now() },
    currentPhase: 1,
    startDate: "2026-01-01",
    currentPhaseStartDate: "2026-02-19",
    phaseDaysSpent: { "1": 49, "2": 9 },
    phases: [],
  };

  it("accepts the field and keeps its contents", () => {
    const parsed = TrackSchema.safeParse(track);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.phaseDaysSpent).toEqual({ "1": 49, "2": 9 });
  });

  it("drops a field it has never heard of rather than refusing the track", () => {
    // What a phone one release ahead of the server looks like. Refusing this
    // is refusing the whole sync — every track and every note with it.
    const fromTheFuture = { ...track, somethingAddedLater: { anything: true } };
    const parsed = TrackSchema.safeParse(fromTheFuture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("somethingAddedLater" in parsed.data).toBe(false);
      // And everything it does know still arrives.
      expect(parsed.data.phaseDaysSpent).toEqual({ "1": 49, "2": 9 });
      expect(parsed.data.currentPhase).toBe(1);
    }
  });
});
