// Switching between tracks. One goal per track is the idea the whole product
// rests on, so this is the second screen rather than a setting.

import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { visibleTracks } from "@shared/selectors";
import { seedTrackFromTemplate, TEMPLATE_LIST } from "@shared/templates";
import { hiddenPanelsFor, trackKind, type TrackKind } from "@shared/trackKinds";
import { PANELS } from "../panels/layout";
import { trackTotalDays, updateTrackIdentity } from "@shared/trackActions";
import { dateForDay, dayForDate, formatDateYMD, todayYMD } from "@shared/dates";
import { currentStreakLength } from "@shared/streak";
import type { TrackState } from "@shared/types";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { SwipeRow } from "../components/SwipeRow";
import { ConfirmSheet, type Confirmation } from "../components/ConfirmSheet";
import { Refreshable } from "../components/Refreshable";

/** The colours a track can be. A fixed set rather than a picker: the picker
 *  is a native module, and these stay legible in both themes. */
const TRACK_COLOURS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#64748b"];

export default function TracksScreen() {
  const { workspace, today, switchTrack, addTrack, editTrackById, restoreWorkspace } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const tracks = workspace ? visibleTracks(workspace) : [];
  const [creating, setCreating] = useState(false);
  const [newStart, setNewStart] = useState(todayYMD);
  const [newEnd, setNewEnd] = useState("");
  const [name, setName] = useState("");
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);

  /**
   * Deleting a track.
   *
   * Confirmed, and *not* also undoable. Asking and then offering to take it
   * back is two decisions for one intent — the sheet has already had the
   * conversation. Elsewhere in the app it is the other way round: no question,
   * but an undo. One or the other, chosen by whether the action is a
   * considered tap or a flick.
   *
   * Implemented as `meta.archived`, and that is not a euphemism for the sake
   * of it: the sync merge reconciles two devices by comparing records, so a
   * track removed by *absence* on this phone would simply be handed back by
   * the next sync from the account's copy. A flag is a change both sides can
   * agree on. Nothing in the app shows an archived track, so "delete" is what
   * it does from here; a true erase needs a tombstone the server understands.
   */
  const remove = useCallback(
    (id: string) => {
      const remaining = tracks.filter((other) => other.meta.id !== id);
      editTrackById(id, (current) => ({ ...current, meta: { ...current.meta, archived: true } }));
      if (workspace?.activeTrackId === id && remaining[0]) switchTrack(remaining[0].meta.id);
      setSettingsFor(null);
    },
    [editTrackById, switchTrack, tracks, workspace]
  );

  const create = useCallback(
    (templateId: string) => {
      const template = TEMPLATE_LIST.find((entry) => entry.id === templateId);
      if (!template) return;
      // The template answers the questions the website asks in its wizard:
      // a phone is the wrong place for a five-step form, and the defaults are
      // what most people accept there anyway. Everything is editable after.
      // A blank or unreadable end date means "however long the template runs",
      // which is what happened before this field existed.
      const start = /^\d{4}-\d{2}-\d{2}$/.test(newStart) ? newStart : todayYMD();
      const asked = /^\d{4}-\d{2}-\d{2}$/.test(newEnd) ? dayForDate(start, newEnd) : 0;
      const days = asked > 0 ? asked : template.defaultDurationDays;

      const seeded = seedTrackFromTemplate(template, {
        name: name.trim() || template.label,
        color: template.defaultColor,
        startDate: start,
        phases: template.buildPhases(days),
        weekSchedule: template.defaultWeekSchedule,
        focusTypes: template.defaultFocusTypes,
      });

      // The kind only decides what the track *opens* with. Every panel stays
      // available to every track from Arrange — a fitness track that later
      // wants a roadmap is two taps away, and hiding things by kind would
      // produce the unanswerable "where did it go?".
      addTrack({
        ...seeded,
        hiddenPanels: hiddenPanelsFor(
          template.id as TrackKind,
          PANELS.map((panel) => panel.id)
        ),
      });
      setName("");
      setNewStart(todayYMD());
      setNewEnd("");
      setCreating(false);
      router.back();
    },
    [addTrack, name, newEnd, newStart]
  );

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      {tracks.map((track) => {
        const active = track.meta.id === workspace?.activeTrackId;
        const streak = currentStreakLength(track.streakHistory ?? [], today);
        const canDelete = tracks.length > 1;
        return (
          <SwipeRow
            key={track.meta.id}
            right={
              canDelete
                ? {
                    label: "Delete",
                    icon: "trash-outline",
                    colour: "#ef4444",
                    // A swipe is a flick, not a considered tap, and a track
                    // carries everything on it — so this one asks first, and
                    // deliberately offers no undo afterwards. One decision per
                    // intent: asking and then offering to take it back is two.
                    onAct: () =>
                      setConfirming({
                        title: `Delete ${track.meta.name}?`,
                        body: "Its phases, materials, notes and history go with it, on this phone and in your account.",
                        verb: "Delete",
                        onConfirm: () => remove(track.meta.id),
                      }),
                  }
                : undefined
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityHint={canDelete ? "Swipe right to delete" : undefined}
              style={[styles.card, active && { borderColor: palette.accent }]}
              onPress={() => {
                switchTrack(track.meta.id);
                router.back();
              }}
              onLongPress={() => {
                setSettingsFor(track.meta.id);
              }}
              delayLongPress={350}
            >
              <View style={[styles.dot, { backgroundColor: track.meta.color || palette.accent }]} />
              <View style={styles.text}>
                <Text style={styles.name}>{track.meta.name}</Text>
                <Text style={styles.muted}>
                  {streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} in a row` : "no streak yet"}
                  {active ? " · open" : ""}
                </Text>
              </View>
            </Pressable>
          </SwipeRow>
        );
      })}

      {tracks.length === 0 && <Text style={styles.muted}>No tracks yet.</Text>}

      {settingsFor && (
        <TrackSettings
          key={settingsFor}
          track={workspace?.tracks[settingsFor] ?? null}
          canArchive={tracks.length > 1}
          onSave={(fields) => {
            editTrackById(settingsFor, (track) => updateTrackIdentity(track, fields));
            setSettingsFor(null);
          }}
          onArchive={() =>
            setConfirming({
              title: `Delete ${workspace?.tracks[settingsFor]?.meta.name ?? "this track"}?`,
              body: "Its phases, materials, notes and history go with it, on this phone and in your account.",
              verb: "Delete",
              onConfirm: () => remove(settingsFor),
            })
          }
          onCancel={() => setSettingsFor(null)}
          styles={styles}
          palette={palette}
        />
      )}

      {creating ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>New track</Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="What is this track called?"
            placeholderTextColor={palette.subtleForeground}
            style={styles.input}
            autoFocus
            accessibilityLabel="Track name"
          />
          <Text style={styles.fieldLabel}>Starts</Text>
          <TextInput
            value={newStart}
            onChangeText={setNewStart}
            placeholder={todayYMD()}
            placeholderTextColor={palette.subtleForeground}
            keyboardType="numbers-and-punctuation"
            style={styles.input}
            accessibilityLabel="Start date, as year-month-day"
          />

          <Text style={styles.fieldLabel}>Should be done by</Text>
          {/* The template used to decide this silently, so a track arrived with
              a horizon nobody had chosen and a phase timeline scaled to it. */}
          <TextInput
            value={newEnd}
            onChangeText={setNewEnd}
            placeholder="Leave blank for the template's own length"
            placeholderTextColor={palette.subtleForeground}
            keyboardType="numbers-and-punctuation"
            style={styles.input}
            accessibilityLabel="End date, as year-month-day"
          />

          <Text style={styles.fieldLabel}>What it is about</Text>
          <Text style={styles.muted}>
            This only decides which panels the track opens with. Every panel stays available to every
            track from Arrange, so nothing is locked away by choosing here.
          </Text>
          {TEMPLATE_LIST.map((template) => (
            <Pressable key={template.id} accessibilityRole="button" style={styles.templateRow} onPress={() => create(template.id)}>
              <View style={[styles.dot, { backgroundColor: template.defaultColor }]} />
              <View style={styles.text}>
                <Text style={styles.name}>{template.label}</Text>
                <Text style={styles.muted}>{template.description}</Text>
              </View>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" style={styles.panelButton} onPress={() => setCreating(false)}>
            <Text style={styles.panelLabel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" style={styles.panelButton} onPress={() => setCreating(true)}>
          <Text style={styles.panelLabel}>New track…</Text>
        </Pressable>
      )}
      <ConfirmSheet confirmation={confirming} onClose={() => setConfirming(null)} />
    </Refreshable>
  );
}

/**
 * A track's own settings: what it is called, its colour, when it started and
 * how long it runs.
 *
 * Held as a draft and saved on a tap, rather than written on every keystroke
 * like most of this app. The reason is the length: `updateTrackIdentity`
 * rescales every phase's deadline proportionally when the total changes, so
 * typing "120" over "90" one digit at a time would rescale the whole roadmap
 * three times on its way to a number the user had not finished typing.
 */
function TrackSettings({
  track,
  canArchive,
  onSave,
  onArchive,
  onCancel,
  styles,
  palette,
}: {
  track: TrackState | null;
  canArchive: boolean;
  onSave: (fields: { name: string; color: string; startDate: string; totalDays: number }) => void;
  onArchive: () => void;
  onCancel: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [name, setName] = useState(track?.meta.name ?? "");
  const [color, setColor] = useState(track?.meta.color || TRACK_COLOURS[0]);
  const [startDate, setStartDate] = useState(track?.startDate ?? todayYMD());
  const [endDate, setEndDate] = useState(() =>
    track ? formatDateYMD(dateForDay(track.startDate ?? todayYMD(), trackTotalDays(track))) : todayYMD()
  );

  if (!track) return null;

  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const validEnd = /^\d{4}-\d{2}-\d{2}$/.test(endDate);
  // The stored length is a count of days from the start, which is what lets a
  // whole track be re-dated without rewriting every phase.
  const days = validStart && validEnd ? dayForDate(startDate, endDate) : 0;
  const canSave = name.trim().length > 0 && validStart && validEnd && days > 0;

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Track settings</Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Track name"
        placeholderTextColor={palette.subtleForeground}
        style={styles.input}
        autoFocus
        accessibilityLabel="Track name"
      />

      <Text style={styles.fieldLabel}>Colour</Text>
      <View style={styles.swatches}>
        {TRACK_COLOURS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${option}`}
            accessibilityState={{ selected: color === option }}
            onPress={() => setColor(option)}
            style={[
              styles.swatch,
              { backgroundColor: option },
              color === option && { borderColor: palette.foreground, borderWidth: 2 },
            ]}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Started on</Text>
      <TextInput
        value={startDate}
        onChangeText={setStartDate}
        placeholder={todayYMD()}
        placeholderTextColor={palette.subtleForeground}
        keyboardType="numbers-and-punctuation"
        style={styles.input}
        accessibilityLabel="Start date, as year-month-day"
      />

      <Text style={styles.fieldLabel}>Ends on</Text>
      {/* A date, not a day count. Nobody knows their track is 92 days long;
          they know it should be done by Christmas. The count is still what
          gets stored — it is what lets a track be re-dated wholesale — so this
          converts on the way in and out. */}
      <TextInput
        value={endDate}
        onChangeText={setEndDate}
        placeholder={todayYMD()}
        placeholderTextColor={palette.subtleForeground}
        keyboardType="numbers-and-punctuation"
        style={styles.input}
        accessibilityLabel="End date, as year-month-day"
      />
      <Text style={styles.footnote}>
        {days > 0 ? `${days} day${days === 1 ? "" : "s"}. ` : ""}Moving it shifts every phase deadline
        in proportion, so the shape of the roadmap survives being made longer or shorter.
      </Text>

      <View style={styles.panelRow}>
        <Pressable
          accessibilityRole="button"
          style={styles.panelButton}
          disabled={!canSave}
          onPress={() =>
            onSave({ name: name.trim(), color, startDate, totalDays: days })
          }
        >
          <Text style={[styles.panelLabel, !canSave && { color: palette.subtleForeground }]}>Save</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.panelButton} onPress={onCancel}>
          <Text style={styles.panelLabel}>Cancel</Text>
        </Pressable>
      </View>

      <View style={styles.panelRow}>
        <Pressable
          accessibilityRole="button"
          style={styles.panelButton}
          disabled={!canArchive}
          onPress={onArchive}
        >
          <Text style={[styles.panelLabel, !canArchive && { color: palette.subtleForeground }]}>
            {!canArchive ? "Can't delete your only track" : "Delete this track"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    text: { flex: 1, gap: 2 },
    name: { color: palette.foreground, fontSize: 16, fontWeight: "600" },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
    panel: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    panelTitle: { color: palette.foreground, fontSize: 15, fontWeight: "600" },
    panelRow: { flexDirection: "row", gap: SPACING.sm },
    panelButton: {
      flex: 1,
      alignItems: "center",
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    panelLabel: { color: palette.foreground, fontSize: 14, fontWeight: "600" },
    fieldLabel: { color: palette.subtleForeground, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: SPACING.sm },
    swatches: { flexDirection: "row", gap: SPACING.sm },
    swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: "rgba(0,0,0,0.2)" },
    footnote: { color: palette.subtleForeground, fontSize: 11, lineHeight: 16 },
    input: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
      color: palette.foreground,
      fontSize: 15,
    },
    templateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
  });
}
