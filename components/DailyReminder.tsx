"use client";

import { useEffect, useRef } from "react";
import { todayYMD } from "@/lib/dates";
import { useAppSettings } from "@/lib/useAppSettings";

/**
 * The daily nudge. Renders nothing; it watches the clock while the app is open
 * and fires one notification a day if the reminder time has passed with
 * nothing recorded yet.
 *
 * Deliberately not a scheduled push: that needs a server holding a push
 * subscription, which this app doesn't have (and having one would mean your
 * goals leaving your device). So the honest contract, stated in Settings too,
 * is "while Horizon is open" — which for an installed PWA that gets opened
 * daily is most of when it matters. It checks on mount, whenever the tab is
 * brought back to the foreground, and every five minutes in between.
 */

const LAST_FIRED_KEY = "horizon-reminder-last";

export default function DailyReminder({ activeDates }: { activeDates: string[] }) {
  const settings = useAppSettings();
  // Held in a ref so the interval below doesn't need re-creating each time the
  // history changes (which is every checkbox tick).
  const activeRef = useRef(activeDates);
  useEffect(() => {
    activeRef.current = activeDates;
  }, [activeDates]);

  const { enabled, time } = settings.reminder;

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const check = () => {
      const today = todayYMD();
      try {
        if (window.localStorage.getItem(LAST_FIRED_KEY) === today) return;
      } catch {
        return; // No storage means no way to avoid nagging on every check.
      }
      if (activeRef.current.includes(today)) return;

      const [hours, minutes] = time.split(":").map(Number);
      const due = new Date();
      due.setHours(hours, minutes, 0, 0);
      if (Date.now() < due.getTime()) return;

      try {
        new Notification("Nothing logged today", {
          body: "Open Horizon and tick off what you've done — the streak is waiting.",
          icon: "/icon-192.png",
          tag: "horizon-daily-reminder",
        });
        window.localStorage.setItem(LAST_FIRED_KEY, today);
      } catch {
        // Notification construction can throw on some mobile browsers that
        // only allow them from a service worker; nothing to do but skip.
      }
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, time]);

  return null;
}
