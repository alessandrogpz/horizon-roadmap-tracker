// Steps from Health Connect: the whole day, not just the part spent in the app.
//
// The on-device sensor can only tell Horizon what happened while Horizon was
// open — Android's `TYPE_STEP_COUNTER` is cumulative since boot, but
// `expo-sensors` subtracts its own baseline before handing the value over and
// its `getStepCountAsync` refuses outright on Android. So a day's real total
// was never available to ask for.
//
// Health Connect is the platform's answer to that: a store that whatever is
// actually counting steps — the phone's own health app, a watch, a fitness
// band — writes into, and that other apps read with the user's permission. It
// gives history rather than a live feed, which is the right shape here: the
// question is "how many steps today", not "has one just happened".
//
// Everything is loaded lazily and every entry point degrades. Health Connect
// is part of Android 14 and later; on Android 13 it is a separate app that may
// not be installed, and on a build without the native module the import throws.
// None of those are errors worth showing — they mean "no history available",
// and the live sensor still works.

/** What the phone can offer, which the UI has to say out loud rather than
 *  silently showing zero. */
export type HealthStatus =
  /** Health Connect is there and Horizon may read steps from it. */
  | "ready"
  /** There, but the user has not granted the permission (or has revoked it). */
  | "needs-permission"
  /** Installed but not set up, or an older Android where it is a separate app. */
  | "not-installed"
  /** This build has no Health Connect module at all. */
  | "unsupported";

const READ_STEPS = { accessType: "read", recordType: "Steps" } as const;

/** Loaded on demand. A static import would run the module's native lookup at
 *  startup, which on a build without it takes the whole app down. */
function healthConnect() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-health-connect") as typeof import("react-native-health-connect");
  } catch {
    return null;
  }
}

export async function healthStatus(): Promise<HealthStatus> {
  const hc = healthConnect();
  if (!hc) return "unsupported";

  try {
    // 3 is SDK_AVAILABLE; anything else means it is absent or needs an update.
    const status = await hc.getSdkStatus();
    if (status !== 3) return "not-installed";
    if (!(await hc.initialize())) return "not-installed";

    const granted = await hc.getGrantedPermissions();
    const canRead = granted.some(
      (permission) =>
        "recordType" in permission &&
        permission.recordType === "Steps" &&
        permission.accessType === "read"
    );
    return canRead ? "ready" : "needs-permission";
  } catch {
    return "unsupported";
  }
}

/** Opens Health Connect's own permission sheet. The decision is made there,
 *  in the system UI, not in Horizon — which is the point of the thing. */
export async function requestHealthPermission(): Promise<HealthStatus> {
  const hc = healthConnect();
  if (!hc) return "unsupported";
  try {
    await hc.initialize();
    await hc.requestPermission([READ_STEPS]);
    return await healthStatus();
  } catch {
    return await healthStatus();
  }
}

/**
 * Daily step totals between two dates, inclusive, keyed "YYYY-MM-DD".
 *
 * Grouped by Health Connect rather than by us: `aggregateGroupByPeriod` with a
 * DAYS period lets the platform decide where a day starts, which matters
 * because its notion of local midnight already accounts for the time zone the
 * steps were recorded in. Summing raw records here would get that wrong for
 * anyone who has travelled.
 *
 * Days with nothing recorded are simply absent from the result; the caller
 * treats missing as zero rather than as unknown.
 */
export async function dailySteps(from: string, to: string): Promise<Record<string, number>> {
  const hc = healthConnect();
  if (!hc) return {};

  try {
    await hc.initialize();
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T23:59:59`);

    const groups = await hc.aggregateGroupByPeriod({
      recordType: "Steps",
      timeRangeFilter: {
        operator: "between",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
      timeRangeSlicer: { period: "DAYS", length: 1 },
    });

    const out: Record<string, number> = {};
    for (const group of groups) {
      // `startTime` comes back as a local ISO string for the slice; the date
      // part of it is the day the steps belong to.
      const day = String(group.startTime).slice(0, 10);
      const count = (group.result as { COUNT_TOTAL?: number }).COUNT_TOTAL ?? 0;
      if (day) out[day] = (out[day] ?? 0) + count;
    }
    return out;
  } catch {
    // A revoked permission, a Health Connect update in progress, a device with
    // no provider: all "no history", none worth an error.
    return {};
  }
}

/** What to say about each state, in one place so the panel and the screen do
 *  not describe the same situation two different ways. */
export function describeHealth(status: HealthStatus): string {
  switch (status) {
    case "ready":
      return "Whole-day totals, from Health Connect.";
    case "needs-permission":
      return "Health Connect can give whole-day totals. Tap to allow it.";
    case "not-installed":
      return "Health Connect isn't set up on this phone, so only steps taken while Horizon is open are counted.";
    default:
      return "This build counts steps only while Horizon is open.";
  }
}
