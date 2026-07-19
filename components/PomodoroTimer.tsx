"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export default function PomodoroTimer() {
  const [minutes, setMinutes] = useState(25);
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  // Absolute end time drives the countdown, so the timer stays accurate even
  // when the tab is throttled or the phone screen sleeps.
  const endTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateDuration = (newMins: number) => {
    const cappedMins = Math.max(1, Math.min(180, newMins));
    const diff = cappedMins - minutes;
    setMinutes(cappedMins);
    setSecondsRemaining((prev) => Math.max(0, prev + diff * 60));
  };

  const notifyFinished = useCallback(() => {
    // Short beep via WebAudio (no asset needed)
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 1.2);
    } catch {
      // Audio not available — ignore
    }

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Focus session complete", { body: "Time for a break." });
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsActive(false);
          notifyFinished();
        }
      }, 250);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, notifyFinished]);

  const handleStart = () => {
    endTimeRef.current = Date.now() + secondsRemaining * 1000;
    setIsActive(true);
    // Ask once for permission so the finish notification can fire
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  };

  const handlePause = () => {
    setIsActive(false);
  };

  const handleReset = () => {
    setIsActive(false);
    setSecondsRemaining(minutes * 60);
  };

  const adjustMinutes = (amount: number) => {
    updateDuration(minutes + amount);
  };

  const formatTime = () => {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const progressPercent = ((minutes * 60 - secondsRemaining) / (minutes * 60)) * 100;

  const stepBtnClass = (active: boolean) =>
    `bg-white/[0.03] border border-white/10 rounded px-2 py-1 text-[0.8rem] font-mono ${active ? "text-zinc-600 cursor-not-allowed" : "text-white cursor-pointer"}`;

  return (
    <div className="glass-panel p-6 flex flex-col gap-4">
      <h2 className="section-title">Focus Timer</h2>

      <div className="flex flex-col items-center gap-4 py-2">
        {/* Clock Display */}
        <div className={`text-[3.5rem] font-bold font-mono tracking-[0.05em] leading-none transition-all duration-300 ${isActive ? "text-accent [text-shadow:0_0_15px_#0ea5e933]" : "text-white"}`}>
          {formatTime()}
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-white/5 rounded-sm overflow-hidden mt-2">
          <div
            className="h-full bg-accent shadow-[0_0_8px_var(--accent)] transition-[width] duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Duration Configuration */}
        <div className="flex items-center justify-between w-full gap-4 mt-3">
          <span className="text-[0.85rem] text-zinc-400">Duration:</span>
          <div className="flex items-center gap-1.5">
            <button disabled={isActive} onClick={() => adjustMinutes(-5)} className={stepBtnClass(isActive)}>
              -5m
            </button>
            <input
              type="number"
              min="1"
              max="180"
              disabled={isActive}
              value={minutes}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                updateDuration(val);
              }}
              className="w-[55px] bg-black/25 border border-card-border rounded-md px-2 py-1 text-zinc-200 font-mono text-[0.85rem] text-center outline-none"
            />
            <span className="text-[0.85rem] text-zinc-500 font-mono">min</span>
            <button disabled={isActive} onClick={() => adjustMinutes(5)} className={stepBtnClass(isActive)}>
              +5m
            </button>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-3 w-full mt-4">
          {!isActive ? (
            <button onClick={handleStart} className="btn flex-1 p-2 text-[0.85rem]">
              Start
            </button>
          ) : (
            <button onClick={handlePause} className="btn flex-1 p-2 text-[0.85rem] !border-warning !text-white">
              Pause
            </button>
          )}
          <button onClick={handleReset} className="btn flex-1 p-2 text-[0.85rem] !border-white/15">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
