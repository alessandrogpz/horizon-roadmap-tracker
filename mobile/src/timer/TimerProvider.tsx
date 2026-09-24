// The timer, held above the screens so it survives leaving the screen.
//
// It used to live in the timer screen's own state, which meant navigating away
// unmounted it and lost the countdown — fine for a timer you sit and watch,
// useless for one you start and then go and do the thing. Holding it here
// means it keeps running while you read a phase, tick something off, or check
// a material, and the header can say so from anywhere.
//
// The countdown itself is still derived from the clock rather than counted.
// JavaScript timers do not run while the app is in the background, and on a
// locked phone nothing ticks at all — so what is stored is the moment it
// should finish, and the remaining time is worked out from `Date.now()` on
// every tick and again whenever the app comes back. Twenty minutes in a pocket
// shows the right number instead of twenty minutes of lost countdown.
//
// It does not notify, buzz or make a sound when it ends. That needs a
// notification permission and a new build, and is deliberately left for later.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

export const TIMER_MINUTES = { focus: 25, rest: 5 } as const;
export type TimerMode = keyof typeof TIMER_MINUTES;

interface TimerValue {
  mode: TimerMode;
  /** Milliseconds left. Derived from the clock, never counted down. */
  remaining: number;
  running: boolean;
  /** Reached zero, and not yet reset — the state the header flags. */
  finished: boolean;
  /** Paused with time left on it. */
  paused: boolean;
  start: (mode: TimerMode) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

const TimerContext = createContext<TimerValue | null>(null);

export function useTimer(): TimerValue {
  const value = useContext(TimerContext);
  if (!value) throw new Error("useTimer must be used inside TimerProvider");
  return value;
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(TIMER_MINUTES.focus * 60_000);
  const pausedAt = useRef<number | null>(null);

  const recompute = useCallback(() => {
    if (endsAt === null) return;
    setRemaining(Math.max(0, endsAt - Date.now()));
  }, [endsAt]);

  // One tick a second while it runs. Nothing depends on the tick being
  // accurate — it only refreshes a number the clock already decided.
  useEffect(() => {
    if (endsAt === null) return;
    recompute();
    const interval = setInterval(recompute, 1000);
    return () => clearInterval(interval);
  }, [endsAt, recompute]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === "active") recompute();
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [recompute]);

  const start = useCallback((which: TimerMode) => {
    setMode(which);
    pausedAt.current = null;
    setEndsAt(Date.now() + TIMER_MINUTES[which] * 60_000);
    setRemaining(TIMER_MINUTES[which] * 60_000);
  }, []);

  const pause = useCallback(() => {
    if (endsAt === null) return;
    pausedAt.current = Math.max(0, endsAt - Date.now());
    setEndsAt(null);
    setRemaining(pausedAt.current);
  }, [endsAt]);

  const resume = useCallback(() => {
    const left = pausedAt.current ?? TIMER_MINUTES[mode] * 60_000;
    pausedAt.current = null;
    setEndsAt(Date.now() + left);
  }, [mode]);

  const reset = useCallback(() => {
    pausedAt.current = null;
    setEndsAt(null);
    setRemaining(TIMER_MINUTES[mode] * 60_000);
  }, [mode]);

  const running = endsAt !== null;
  const value = useMemo<TimerValue>(
    () => ({
      mode,
      remaining,
      running,
      finished: running && remaining === 0,
      paused: !running && pausedAt.current !== null,
      start,
      pause,
      resume,
      reset,
    }),
    [mode, remaining, running, start, pause, resume, reset]
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

/** `m:ss`, the only format a countdown needs. */
export function formatRemaining(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
