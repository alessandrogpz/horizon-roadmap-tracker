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

  return (
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2 className="section-title">Focus Timer</h2>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "0.5rem 0" }}>
        {/* Clock Display */}
        <div style={{
          fontSize: "3.5rem",
          fontWeight: 700,
          fontFamily: "monospace",
          color: isActive ? "var(--accent)" : "#fff",
          textShadow: isActive ? "0 0 15px var(--accent)33" : "none",
          transition: "all 0.3s ease",
          letterSpacing: "0.05em",
          lineHeight: 1
        }}>
          {formatTime()}
        </div>

        {/* Progress Bar */}
        <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: "2px", overflow: "hidden", marginTop: "0.5rem" }}>
          <div style={{
            width: `${progressPercent}%`,
            height: "100%",
            backgroundColor: "var(--accent)",
            boxShadow: "0 0 8px var(--accent)",
            transition: "width 1s linear"
          }} />
        </div>

        {/* Duration Configuration */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "1rem", marginTop: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#a1a1aa" }}>Duration:</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <button
              disabled={isActive}
              onClick={() => adjustMinutes(-5)}
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: isActive ? "#52525b" : "#fff",
                borderRadius: "4px",
                padding: "0.2rem 0.5rem",
                cursor: isActive ? "not-allowed" : "pointer",
                fontSize: "0.8rem",
                fontFamily: "monospace"
              }}
            >
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
              style={{
                width: "55px",
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--card-border)",
                borderRadius: "6px",
                padding: "0.25rem 0.5rem",
                color: "#e4e4e7",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                textAlign: "center",
                outline: "none"
              }}
            />
            <span style={{ fontSize: "0.85rem", color: "#71717a", fontFamily: "monospace" }}>min</span>
            <button
              disabled={isActive}
              onClick={() => adjustMinutes(5)}
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: isActive ? "#52525b" : "#fff",
                borderRadius: "4px",
                padding: "0.2rem 0.5rem",
                cursor: isActive ? "not-allowed" : "pointer",
                fontSize: "0.8rem",
                fontFamily: "monospace"
              }}
            >
              +5m
            </button>
          </div>
        </div>

        {/* Control Buttons */}
        <div style={{ display: "flex", gap: "0.75rem", width: "100%", marginTop: "1rem" }}>
          {!isActive ? (
            <button
              onClick={handleStart}
              className="btn"
              style={{ flex: 1, padding: "0.5rem", fontSize: "0.85rem" }}
            >
              Start
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="btn"
              style={{
                flex: 1,
                padding: "0.5rem",
                fontSize: "0.85rem",
                borderColor: "#f59e0b",
                color: "#fff"
              }}
            >
              Pause
            </button>
          )}
          <button
            onClick={handleReset}
            className="btn"
            style={{
              flex: 1,
              padding: "0.5rem",
              fontSize: "0.85rem",
              borderColor: "rgba(255, 255, 255, 0.15)"
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
