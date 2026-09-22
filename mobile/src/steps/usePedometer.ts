// The step counter: the one thing this app can do that the website cannot.
//
// What the platform actually offers, which shapes everything below:
//
// - Android has no way to ask "how many steps today?". `getStepCountAsync` is
//   iOS only. Android gives `watchStepCount`, which reports steps *since you
//   subscribed*, and only while the app is in the foreground.
// - So a running total has to be kept by the app: each batch of new steps is
//   added to today's stored count and written to SQLite immediately, because
//   the process can be killed at any moment and nothing is delivered while it
//   is away.
// - The consequence is honest and worth saying out loud rather than hiding:
//   steps taken while the app is closed are not counted. Closing that gap needs
//   Health Connect on Android — a second permission system and a development
//   build — which is the natural next step, not a hidden flaw.
//
// The other concerns that come with a sensor, all handled here: the hardware
// may not exist (isAvailableAsync), the permission may be refused and the app
// has to stay useful, the subscription must be removed when the screen goes
// away or it keeps the sensor awake and drains the battery, and the day can
// roll over while the app is open.

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Pedometer } from "expo-sensors";
import { loadStepCount, saveStepCount } from "../storage/db";

export type StepStatus =
  | "checking"
  /** No step counter in this device, or no platform support (web). */
  | "unavailable"
  /** Available, but the user hasn't been asked yet or said no. */
  | "denied"
  | "counting";

export interface StepState {
  status: StepStatus;
  /** Today's total as this app has observed it, restored across restarts. */
  today: number;
  /** Asks for permission, once, in response to a tap — never on first paint. */
  request: () => Promise<void>;
}

export function usePedometer(date: string): StepState {
  const [status, setStatus] = useState<StepStatus>("checking");
  const [today, setToday] = useState(0);

  // The stored total, kept in a ref so the sensor callback doesn't need to be
  // re-subscribed every time the number changes.
  const total = useRef(0);
  const dateRef = useRef(date);
  dateRef.current = date;

  // Whatever was counted before the app was last closed.
  useEffect(() => {
    let cancelled = false;
    loadStepCount(date).then((stored) => {
      if (cancelled) return;
      total.current = stored;
      setToday(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const available = await Pedometer.isAvailableAsync().catch(() => false);
      if (cancelled) return;
      if (!available) return setStatus("unavailable");

      const permission = await Pedometer.getPermissionsAsync().catch(() => null);
      if (cancelled) return;
      setStatus(permission?.granted ? "counting" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const request = useCallback(async () => {
    const permission = await Pedometer.requestPermissionsAsync().catch(() => null);
    setStatus(permission?.granted ? "counting" : "denied");
  }, []);

  // Subscribe only while counting, and let go on the way out: an open sensor
  // subscription is a battery cost the user did not ask for.
  useEffect(() => {
    if (status !== "counting") return;

    let last = 0;
    const subscription = Pedometer.watchStepCount((result) => {
      // `steps` counts from the moment of subscription, so only the difference
      // since the previous callback is new.
      const added = Math.max(0, result.steps - last);
      last = result.steps;
      if (!added) return;

      total.current += added;
      setToday(total.current);
      void saveStepCount(dateRef.current, total.current);
    });

    return () => subscription.remove();
  }, [status]);

  // Coming back from the background: the day may have rolled over, and the
  // subscription was not delivering while away.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== "active") return;
      loadStepCount(dateRef.current).then((stored) => {
        total.current = stored;
        setToday(stored);
      });
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);

  return { status, today, request };
}
