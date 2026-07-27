"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AIError, describeAIError } from "./types";

/**
 * Shared run/cancel/error state for a single AI call.
 *
 * The cancellation here is real, not cosmetic: the AbortSignal reaches fetch(),
 * so the request is actually dropped rather than merely hidden. That matters
 * because generation costs the user money on their own key — during model
 * screening, killing the *client* left the server generating for another 90
 * seconds, and a cancel button that only hides a spinner would repeat that
 * mistake.
 */
export function useGeneration<T>() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** Whether trying again could plausibly succeed. A rate limit or a truncated
   *  response is worth another attempt; a rejected key never is, and offering
   *  a retry there just wastes the user's time and quota. */
  const [canRetry, setCanRetry] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** The last task, so "Try again" doesn't need the call site to re-supply it. */
  const lastRunRef = useRef<{
    task: (signal: AbortSignal) => Promise<T>;
    onDone: (value: T) => void;
  } | null>(null);
  // Generation outlives a step change in the wizard; without this a resolved
  // request would set state on an unmounted component.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const run = useCallback(
    async (task: (signal: AbortSignal) => Promise<T>, onDone: (value: T) => void) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      lastRunRef.current = { task, onDone };

      setBusy(true);
      setError("");
      setCanRetry(false);
      try {
        const value = await task(controller.signal);
        if (!mountedRef.current || controller.signal.aborted) return;
        onDone(value);
      } catch (err) {
        if (!mountedRef.current) return;
        // A cancellation is a choice, not a failure — don't shout about it.
        const aborted =
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError");
        if (!aborted) {
          setError(describeAIError(err));
          setCanRetry(err instanceof AIError && err.retryable);
        }
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
  }, []);

  /** Re-runs the last attempt unchanged. No-op when nothing has been run yet. */
  const retry = useCallback(() => {
    const last = lastRunRef.current;
    if (last) void run(last.task, last.onDone);
  }, [run]);

  return { busy, error, canRetry, setError, run, cancel, retry };
}
