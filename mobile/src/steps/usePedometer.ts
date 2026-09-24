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
  /** What the platform last said, shown on screen when a request goes nowhere.
   *  A permission that is refused without a dialog — Expo Go not declaring it,
   *  or Android remembering a previous "don't ask again" — is indistinguishable
   *  from a broken button unless the app says so. */
  detail: string;
}

/**
 * @param enabled Whether this track wants a step count at all. False keeps the
 *   hook inert: no availability check, no permission prompt, and above all no
 *   subscription to the sensor, which is the part that costs battery. A track
 *   that has never asked for step counting should never cause Android to ask
 *   for the activity permission either.
 */
export function usePedometer(date: string, enabled = true): StepState {
  const [status, setStatus] = useState<StepStatus>("checking");
  const [today, setToday] = useState(0);
  const [detail, setDetail] = useState("");

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
    if (!enabled) return setStatus("unavailable");
    let cancelled = false;
    (async () => {
      const available = await Pedometer.isAvailableAsync().catch(() => false);
      if (cancelled) return;
      if (!available) return setStatus("unavailable");

      const permission = await Pedometer.getPermissionsAsync().catch((error: unknown) => {
        setDetail(`checking the permission failed: ${error instanceof Error ? error.message : "unknown error"}`);
        return null;
      });
      if (cancelled) return;
      if (permission && !permission.granted) {
        setDetail(`not granted yet (${permission.status}${permission.canAskAgain ? "" : ", and Android won't ask again"})`);
      }
      setStatus(permission?.granted ? "counting" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const request = useCallback(async () => {
    setDetail("asking…");
    const permission = await Pedometer.requestPermissionsAsync().catch((error: unknown) => {
      setDetail(`the request failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return null;
    });
    if (!permission) return setStatus("denied");

    setStatus(permission.granted ? "counting" : "denied");
    setDetail(
      permission.granted
        ? ""
        : permission.canAskAgain
          ? `refused (${permission.status})`
          : `refused, and Android won't ask again (${permission.status}) — turn on Physical activity in Android's app settings`
    );
  }, []);

  // Subscribe only while counting, and let go on the way out: an open sensor
  // subscription is a battery cost the user did not ask for.
  useEffect(() => {
    if (status !== "counting") return;

    let last = 0;
    const subscription = Pedometer.watchStepCount((result) => {
      // Android's step counter batches: events can arrive several steps late,
      // or in bursts. This line is how that behaviour was observed rather than
      // guessed at, and it costs nothing in a release build, where the bundler
      // strips __DEV__ blocks.
      if (__DEV__) console.log(`[steps] sensor says ${result.steps}, last seen ${last}`);

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

  // Coming back from the background: the day may have rolled over, the
  // subscription was not delivering while away, and — the case that matters
  // here — the user may have just granted the permission in Android's settings.
  // Once Android has recorded "don't ask again", an app can never prompt again;
  // noticing the change on resume is the only way back without making the user
  // hunt for a button.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== "active") return;
      loadStepCount(dateRef.current).then((stored) => {
        total.current = stored;
        setToday(stored);
      });
      Pedometer.getPermissionsAsync()
        .then((permission) => {
          if (!permission.granted) return;
          setStatus("counting");
          setDetail("");
        })
        .catch(() => undefined);
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);

  return { status, today, request, detail };
}
