// Settings: the few things worth changing from a phone, and the honest exits.
//
// Deliberately short. The website has the full set, and most of it is desk
// work done once. What belongs here is what you might need *while holding the
// phone*: the account, what this device is holding, and how to get rid of it.
//
// Backups are here for a reason that is specific to phones. A laptop's copy
// can be reached from the machine itself; a phone's cannot — if the phone is
// lost, reset, or the app is uninstalled, whatever was never synced is simply
// gone. Being able to write the file out from the device that holds it, and
// read one back onto a replacement, is the difference between an account and
// an only copy.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import Constants from "expo-constants";
import { visibleTracks } from "@shared/selectors";
import { DISCORD_INVITE, hasCommunity } from "@shared/community";
import { buildDemoTracks, DEMO_TRACK_NAMES, isDemoTrack } from "@shared/demoTracks";
import { getSettings, updateSettings, type AppSettings } from "@shared/settings";
import {
  CancelledError,
  exportBackup,
  InvalidBackupError,
  readBackupToRestore,
  restoreBackup,
  summarizeBackup,
  type BackupBundle,
  type BackupSummary,
} from "../backup/backupFile";
import { SERVER_URL } from "../config";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { useTheme } from "../theme/ThemeProvider";
import Ionicons from "@expo/vector-icons/Ionicons";
import { describeHour, HourWheel } from "../components/HourWheel";
import { Refreshable } from "../components/Refreshable";
import { Tappable } from "../components/Tappable";

export default function SettingsScreen() {
  const { workspace, today, addTrack, switchTrack, editTrackById, replaceWorkspace, resetLocal } = useWorkspace();
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [confirming, setConfirming] = useState(false);
  const [pickingHour, setPickingHour] = useState(false);
  const [busy, setBusy] = useState(false);

  // A destructive confirmation that stays armed forever is a trap: come back
  // to the screen ten minutes later and the next tap deletes everything.
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 8000);
    return () => clearTimeout(timer);
  }, [confirming]);

  /**
   * Three tracks with a year of history, and a way to take them away again.
   *
   * Everything that shows more than one track at once is impossible to look at
   * on a real account's first month, and ticking several hundred days by hand
   * to see it is not a reasonable ask. They are ordinary tracks — recognised
   * by name, not by a flag — so nothing else in the app has to know they are
   * different, and deleting them is the same archive every other track gets.
   */
  const demoTracks = useMemo(
    () => (workspace ? visibleTracks(workspace).filter(isDemoTrack) : []),
    [workspace]
  );

  const addDemoTracks = useCallback(() => {
    const wasOpen = workspace?.activeTrackId;
    buildDemoTracks(today).forEach((track) => addTrack(track));
    // `addTrack` opens what it adds, which is right when a person made the
    // track and wrong when three arrived at once from a settings screen.
    if (wasOpen) switchTrack(wasOpen);
  }, [addTrack, switchTrack, today, workspace]);

  const removeDemoTracks = useCallback(() => {
    const keep = workspace ? visibleTracks(workspace).find((track) => !isDemoTrack(track)) : undefined;
    // Off the track being deleted first: archiving the open one leaves the app
    // standing on a track nothing will show it.
    if (keep && demoTracks.some((track) => track.meta.id === workspace?.activeTrackId)) {
      switchTrack(keep.meta.id);
    }
    demoTracks.forEach((track) =>
      editTrackById(track.meta.id, (current) => ({ ...current, meta: { ...current.meta, archived: true } }))
    );
  }, [demoTracks, editTrackById, switchTrack, workspace]);

  const wipe = useCallback(async () => {
    setBusy(true);
    await resetLocal();
    setBusy(false);
    setConfirming(false);
  }, [resetLocal]);

  // One state for the whole backup section rather than a flag each: the steps
  // are strictly sequential — pick, confirm, restore — and separate booleans
  // would allow combinations that cannot happen, like "restoring" while also
  // "waiting for confirmation".
  const [backup, setBackup] = useState<BackupState>({ kind: "idle" });

  const runExport = useCallback(async () => {
    setBackup({ kind: "working", what: "Choose where to save it…" });
    try {
      setBackup({ kind: "wrote", name: await exportBackup() });
    } catch (error) {
      setBackup(error instanceof CancelledError ? { kind: "idle" } : failure(error));
    }
  }, []);

  const pickToRestore = useCallback(async () => {
    setBackup({ kind: "working", what: "Choose the backup file…" });
    try {
      const bundle = await readBackupToRestore();
      setBackup({ kind: "confirm", bundle, summary: summarizeBackup(bundle) });
    } catch (error) {
      setBackup(error instanceof CancelledError ? { kind: "idle" } : failure(error));
    }
  }, []);

  const runRestore = useCallback(
    async (bundle: BackupBundle) => {
      setBackup({ kind: "working", what: "Restoring…" });
      try {
        // The provider has to be told, not just storage: what is on screen is
        // what the next edit is written from, so leaving it stale would save
        // the old workspace straight back over the restored one.
        replaceWorkspace(await restoreBackup(bundle));
        setBackup({ kind: "restored" });
      } catch (error) {
        setBackup(failure(error));
      }
    },
    [replaceWorkspace]
  );

  // Settings are read synchronously and change rarely; keeping a copy in state
  // is enough to re-render the controls after a write.
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const change = useCallback((patch: Partial<AppSettings>) => setSettings(updateSettings(patch)), []);

  const tracks = workspace ? visibleTracks(workspace).length : 0;
  const version = Constants.expoConfig?.version ?? "";

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <Link href="/account" asChild>
        <Tappable style={styles.row} accessibilityRole="button">
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Account</Text>
            <Text style={styles.muted}>Sign in, sync, or sign out</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={palette.subtleForeground} />
        </Tappable>
      </Link>

      <View style={[styles.row, styles.rowStack]}>
        <Text style={styles.rowTitle}>Your week and day</Text>
        <Text style={styles.muted}>
          When a week begins on the consistency grid, and when a day rolls over. Monday and midnight
          unless you say otherwise.
        </Text>

        <Text style={styles.fieldLabel}>Weeks start on</Text>
        <View style={styles.choices}>
          {(["mon", "sun"] as const).map((day) => (
            <Tappable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected: settings.weekStartsOn === day }}
              onPress={() => change({ weekStartsOn: day })}
              style={[styles.choice, settings.weekStartsOn === day && { borderColor: palette.accent }]}
            >
              <Text style={[styles.choiceLabel, settings.weekStartsOn === day && { color: palette.foreground }]}>
                {day === "mon" ? "Monday" : "Sunday"}
              </Text>
            </Tappable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>My day starts at</Text>
        {/* One button, not twenty-four. The hour is picked on a wheel, which is
            the platform's idiom for one value out of an ordered range. */}
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={`My day starts at ${describeHour(settings.dayRolloverHour)}. Tap to change.`}
          onPress={() => setPickingHour(true)}
          style={styles.picker}
        >
          <Text style={styles.pickerValue}>{describeHour(settings.dayRolloverHour)}</Text>
          <Ionicons name="chevron-forward" size={16} color={palette.subtleForeground} />
        </Tappable>
      </View>

      <View style={[styles.row, styles.rowStack]}>
        <Text style={styles.rowTitle}>This device</Text>
        <Text style={styles.muted}>
          Horizon {version} · {tracks} track{tracks === 1 ? "" : "s"} stored here
        </Text>
      </View>

      <Tappable style={styles.row} accessibilityRole="link" onPress={() => void Linking.openURL(`${SERVER_URL}/privacy`)}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Privacy</Text>
          <Text style={styles.muted}>What is stored, where it lives, how to delete it</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.subtleForeground} />
      </Tappable>

      <Tappable style={styles.row} accessibilityRole="link" onPress={() => void Linking.openURL(`${SERVER_URL}/security`)}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Security</Text>
          <Text style={styles.muted}>How your data is protected</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.subtleForeground} />
      </Tappable>

      {/* Reachable from inside the app rather than only from the website:
          somebody who wants to report something is already in here. */}
      {hasCommunity() && (
        <Tappable style={styles.row} accessibilityRole="link" onPress={() => void Linking.openURL(DISCORD_INVITE)}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Community</Text>
            <Text style={styles.muted}>
              A Discord: ask something, say what is broken, or show the track you are running
            </Text>
          </View>
          <Ionicons name="open-outline" size={16} color={palette.subtleForeground} />
        </Tappable>
      )}

      <View style={[styles.row, styles.rowStack]}>
        <Text style={styles.rowTitle}>Backup</Text>
        <Text style={styles.muted}>
          One file with every track, phase, tick and note this phone holds — the same file the
          website writes, so either one can read the other&apos;s. Step counts are left out: they are
          this phone&apos;s hardware talking, and mean nothing on another device.
        </Text>

        <View style={styles.choices}>
          <Tappable
            accessibilityRole="button"
            disabled={backup.kind === "working"}
            onPress={() => void runExport()}
            style={styles.choice}
          >
            <Text style={styles.choiceLabel}>Save a backup…</Text>
          </Tappable>
          <Tappable
            accessibilityRole="button"
            disabled={backup.kind === "working"}
            onPress={() => void pickToRestore()}
            style={styles.choice}
          >
            <Text style={styles.choiceLabel}>Restore from a file…</Text>
          </Tappable>
        </View>

        {backup.kind === "working" && <Text style={styles.muted}>{backup.what}</Text>}
        {backup.kind === "wrote" && <Text style={styles.good}>Saved as {backup.name}.</Text>}
        {backup.kind === "restored" && <Text style={styles.good}>Restored. Everything here is the backup&apos;s now.</Text>}
        {backup.kind === "error" && <Text style={styles.bad}>{backup.message}</Text>}

        {backup.kind === "confirm" && (
          <View style={styles.confirm}>
            {/* Restoring replaces everything, so what is in the file gets said
                out loud first — a backup from the wrong week looks exactly like
                the right one until it has already overwritten today. */}
            <Text style={styles.muted}>
              That file holds {backup.summary.trackCount} track
              {backup.summary.trackCount === 1 ? "" : "s"} ({backup.summary.trackNames.join(", ")}),{" "}
              {backup.summary.noteCount} note{backup.summary.noteCount === 1 ? "" : "s"} and{" "}
              {backup.summary.activeDays} recorded day{backup.summary.activeDays === 1 ? "" : "s"}
              {backup.summary.exportedAt ? `, saved ${backup.summary.exportedAt.slice(0, 10)}` : ""}.
            </Text>
            <Text style={styles.muted}>
              Restoring replaces what is on this phone with it. Nothing is merged.
            </Text>
            <View style={styles.choices}>
              <Tappable
                accessibilityRole="button"
                onPress={() => void runRestore(backup.bundle)}
                style={[styles.choice, { borderColor: palette.accent }]}
              >
                <Text style={[styles.choiceLabel, { color: palette.foreground }]}>Replace everything</Text>
              </Tappable>
              <Tappable accessibilityRole="button" onPress={() => setBackup({ kind: "idle" })} style={styles.choice}>
                <Text style={styles.choiceLabel}>Cancel</Text>
              </Tappable>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.row, styles.rowStack]}>
        <Text style={styles.rowTitle}>Demo tracks</Text>
        <Text style={styles.muted}>
          {DEMO_TRACK_NAMES.join(", ")} — three tracks in three colours, each with a year or more of
          days already ticked. They are there to give the screens that show several tracks at once
          something to show, and to be something to break in without touching a real track. Ordinary
          tracks otherwise: open them, edit them, delete them.
        </Text>
        <View style={styles.choices}>
          <Tappable
            accessibilityRole="button"
            disabled={demoTracks.length > 0}
            onPress={addDemoTracks}
            style={styles.choice}
          >
            <Text style={[styles.choiceLabel, demoTracks.length > 0 && { color: palette.subtleForeground }]}>
              Add them
            </Text>
          </Tappable>
          <Tappable
            accessibilityRole="button"
            disabled={demoTracks.length === 0}
            onPress={removeDemoTracks}
            style={styles.choice}
          >
            <Text style={[styles.choiceLabel, demoTracks.length === 0 && { color: palette.subtleForeground }]}>
              Remove them
            </Text>
          </Tappable>
        </View>
        {demoTracks.length > 0 && (
          <Text style={styles.good}>
            {demoTracks.length} demo track{demoTracks.length === 1 ? "" : "s"} on this phone.
          </Text>
        )}
      </View>

      <View style={styles.danger}>
        <Text style={styles.dangerTitle}>Delete local data</Text>
        <Text style={styles.muted}>
          Clears every track, note and step count from this phone. Anything already synced stays in your
          account — signing in brings it back. It does not delete the account itself; that is on the
          Account screen.
        </Text>
        <Tappable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => (confirming ? void wipe() : setConfirming(true))}
          style={[styles.dangerButton, confirming && { borderColor: palette.danger }]}
        >
          <Text style={[styles.dangerLabel, confirming && { color: palette.danger }]}>
            {busy ? "Clearing…" : confirming ? "Tap again to delete everything on this phone" : "Delete local data…"}
          </Text>
        </Tappable>
      </View>
      <HourWheel
        open={pickingHour}
        value={settings.dayRolloverHour}
        onPick={(hour) => change({ dayRolloverHour: hour })}
        onClose={() => setPickingHour(false)}
      />
    </Refreshable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    rowText: { flex: 1, gap: 2 },
    // Rows that only state something keep their lines stacked; rows that
    // go somewhere put the text beside the mark that says so.
    rowStack: { flexDirection: "column", alignItems: "stretch", gap: 2 },
    rowTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    choices: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.sm },
    choice: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    choiceLabel: { color: palette.mutedForeground, ...TYPE.label, fontWeight: "600" },
    fieldLabel: {
      color: palette.subtleForeground,
      ...TYPE.marker,
      fontWeight: "700",
      letterSpacing: 1,
      marginTop: SPACING.md,
    },
    picker: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    pickerValue: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    good: { color: palette.success, ...TYPE.label, lineHeight: 18, marginTop: SPACING.sm },
    bad: { color: palette.danger, ...TYPE.label, lineHeight: 18, marginTop: SPACING.sm },
    confirm: {
      gap: SPACING.sm,
      marginTop: SPACING.sm,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: palette.cardBorder,
    },
    danger: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: "rgba(248, 113, 113, 0.3)",
      backgroundColor: "rgba(248, 113, 113, 0.05)",
    },
    dangerTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    dangerButton: {
      alignItems: "center",
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    dangerLabel: { color: palette.mutedForeground, ...TYPE.body, fontWeight: "600" },
  });
}

/** The backup section's one state. `confirm` carries the parsed bundle so the
 *  restore does not have to re-open the file the user already chose. */
type BackupState =
  | { kind: "idle" }
  | { kind: "working"; what: string }
  | { kind: "wrote"; name: string }
  | { kind: "confirm"; bundle: BackupBundle; summary: BackupSummary }
  | { kind: "restored" }
  | { kind: "error"; message: string };

/** A bad file is the user's problem to fix and says exactly what is wrong;
 *  anything else is the app's problem and should not be dressed up as advice. */
function failure(error: unknown): BackupState {
  if (error instanceof InvalidBackupError) return { kind: "error", message: error.message };
  return { kind: "error", message: "That didn't work. Try again in a moment." };
}
