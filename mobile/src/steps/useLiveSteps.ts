// Today's step count, whole-day accurate *and* moving while you watch it.
//
// The two sources answer different questions and neither is enough alone:
//
//   Health Connect  the whole day, including steps taken with Horizon closed
//                   and anything a watch recorded — but read once, so it is a
//                   snapshot that ages the moment it arrives
//   the sensor      nothing about the past, but every step since the app
//                   subscribed, live
//
// Taking the larger of the two looked reasonable and was wrong: Health
// Connect's total dwarfs a freshly-subscribed sensor, so the number pinned
// itself to the snapshot and never moved again. Walking with the app open
// changed nothing on screen, which is exactly the thing a step counter is for.
//
// So the snapshot is a *baseline*, not a candidate: remember what the sensor
// read when Health Connect was asked, and add every step since. The result
// starts at the true day total and climbs in real time.

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { dailySteps, healthStatus } from "./healthConnect";
import { usePedometer } from "./usePedometer";

export interface LiveSteps {
  /** What to show. */
  count: number;
  /** Whether the whole day is covered, or only time spent in the app. */
  wholeDay: boolean;
  status: ReturnType<typeof usePedometer>["status"];
  detail: string;
  request: () => Promise<void>;
}

export function useLiveSteps(today: string, enabled = true): LiveSteps {
  const sensor = usePedometer(today, enabled);

  const [baseline, setBaseline] = useState<number | null>(null);
  /** The sensor's reading at the moment the baseline was taken. */
  const sensorAtBaseline = useRef(0);
  const sensorNow = useRef(0);
  sensorNow.current = sensor.today;

  const readHealth = useCallback(async () => {
    if (!enabled) return;
    if ((await healthStatus()) !== "ready") return;
    const days = await dailySteps(today, today);
    // Pair the two readings as closely as possible: anything counted between
    // them would otherwise be counted twice or not at all.
    sensorAtBaseline.current = sensorNow.current;
    setBaseline(days[today] ?? 0);
  }, [enabled, today]);

  useEffect(() => {
    void readHealth();
  }, [readHealth]);

  // Coming back from the background is exactly when the snapshot is most
  // stale — the steps taken while away are in Health Connect and not in the
  // sensor's since-subscription count.
  useEffect(() => {
    if (!enabled) return;
    const onChange = (state: AppStateStatus) => {
      if (state === "active") void readHealth();
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [enabled, readHealth]);

  const count =
    baseline === null
      ? sensor.today
      : baseline + Math.max(0, sensor.today - sensorAtBaseline.current);

  return {
    count,
    wholeDay: baseline !== null,
    status: sensor.status,
    detail: sensor.detail,
    request: sensor.request,
  };
}
