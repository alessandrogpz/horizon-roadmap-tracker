// Switching between tracks. One goal per track is the idea the whole product
// rests on, so this is the second screen rather than a setting.

import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { visibleTracks } from "@shared/selectors";
import { seedTrackFromTemplate, TEMPLATE_LIST } from "@shared/templates";
import { hiddenPanelsFor, trackKind, type TrackKind } from "@shared/trackKinds";
import { PANELS } from "../panels/layout";
import { trackTotalDays, updateTrackIdentity } from "@shared/trackActions";
import { dateForDay, dayForDate, formatDateYMD, isDateStr, todayYMD } from "@shared/dates";
import { currentStreakLength } from "@shared/streak";
import type { TrackState } from "@shared/types";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, TYPE, withAlpha, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { SwipeRow } from "../components/SwipeRow";
import { ConfirmSheet, type Confirmation } from "../components/ConfirmSheet";
import { DatePicker, describeDate } from "../components/DatePicker";
import { getSettings } from "@shared/settings";
import { streakCalendar } from "@shared/stats";
import { TrackHeatmap } from "../components/TrackHeatmap";
import { Refreshable } from "../components/Refreshable";

/** The colours a track can be. A fixed set rather than a picker: the picker
 *  is a native module, and these stay legible in both themes. */
const TRACK_COLOURS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#64748b"];

export default function TracksScreen() {
  const { workspace, today, switchTrack, addTrack, editTrackById, restoreWorkspace } = useWorkspace();
  const weekStartsOn = getSettings().weekStartsOn;
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const tracks = workspace ? visibleTracks(workspace) : [];
  /** The first colour nobody has taken. Two tracks in the same colour is
   *  allowed — six colours and no cap on tracks means it has to be — but it
   *  should not be what happens by default, because telling them apart in the
   *  list is the whole point of having colours. */
  const suggestedColour = useMemo(() => {
    const taken = new Set(tracks.map((track) => track.meta.color));
    return TRACK_COLOURS.find((colour) => !taken.has(colour)) ?? TRACK_COLOURS[0];
  }, [tracks]);
  const [creating, setCreating] = useState(false);
  const [newStart, setNewStart] = useState(todayYMD);
  const [newEnd, setNewEnd] = useState("");
  const [name, setName] = useState("");
  // Chosen before the template is, because the template row is also the
  // button that creates the track — there is no step after it to ask in.
  const [newColour, setNewColour] = useState<string | null>(null);
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  // Which date field is being chosen, if any. One picker serves them all
  // rather than a modal per field.
  const [picking, setPicking] = useState<"new-start" | "new-end" | null>(null);

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

  const chosenColour = newColour ?? suggestedColour;

  const create = useCallback(
    (templateId: string) => {
      const template = TEMPLATE_LIST.find((entry) => entry.id === templateId);
      if (!template) return;
      // The template answers the questions the website asks in its wizard:
      // a phone is the wrong place for a five-step form, and the defaults are
      // what most people accept there anyway. Everything is editable after.
      // A blank or unreadable end date means "however long the template runs",
      // which is what happened before this field existed.
      const start = isDateStr(newStart) ? newStart : todayYMD();
      const asked = isDateStr(newEnd) ? dayForDate(start, newEnd) : 0;
      const days = asked > 0 ? asked : template.defaultDurationDays;

      const seeded = seedTrackFromTemplate(template, {
        name: name.trim() || template.label,
        // The colour is the track's own from here on: its accent everywhere
        // inside it, and the ink its year of days is drawn in.
        color: chosenColour,
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
      setNewColour(null);
      setNewStart(todayYMD());
      setNewEnd("");
      setCreating(false);
      router.back();
    },
    [addTrack, chosenColour, name, newEnd, newStart]
  );

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      {tracks.map((track) => {
        const active = track.meta.id === workspace?.activeTrackId;
        const streak = currentStreakLength(track.streakHistory ?? [], today);
        const colour = track.meta.color || palette.accent;
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
              style={[styles.card, { borderColor: active ? colour : palette.cardBorder }]}
              onPress={() => {
                switchTrack(track.meta.id);
                router.back();
              }}
              onLongPress={() => {
                setSettingsFor(track.meta.id);
              }}
              delayLongPress={350}
            >
              {/* The track's colour, laid over the card rather than replacing
                  its background: an rgba background would composite against
                  the page and take the card's lift with it. Faint — the row
                  has a heatmap in the same colour and the tint is only there
                  so the card is recognisably that track's before you read
                  anything on it. */}
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: RADIUS.card, backgroundColor: withAlpha(colour, active ? 0.12 : 0.05) },
                ]}
              />
              <View style={styles.head}>
                <View style={[styles.dot, { backgroundColor: colour }]} />
                <View style={styles.text}>
                  <Text style={styles.name}>{track.meta.name}</Text>
                  <Text style={styles.muted}>
                    {streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} in a row` : "no streak yet"}
                    {active ? " · open" : ""}
                  </Text>
                </View>
                {streak > 0 && (
                  <View style={[styles.streak, { backgroundColor: withAlpha(colour, 0.16) }]}>
                    <Ionicons name="flame" size={12} color={colour} />
                    <Text style={[styles.streakCount, { color: colour }]}>{streak}</Text>
                  </View>
                )}
              </View>

              {/* A year of this track, in this track's colour. What the list
                  is for is seeing which ones you are actually keeping up. */}
              <TrackHeatmap days={streakCalendar(track, today, weekStartsOn)} colour={colour} />
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
          <Text style={styles.fieldLabel}>Colour</Text>
          {/* Not decoration. This is the accent the whole track wears from
              here on — its buttons, its rings, its year of days — so it is
              asked for at the same moment as the name. */}
          <Swatches value={chosenColour} onPick={setNewColour} styles={styles} palette={palette} />

          <Text style={styles.fieldLabel}>Starts</Text>
          <DateField
            value={newStart}
            onPress={() => setPicking("new-start")}
            styles={styles}
            palette={palette}
          />

          <Text style={styles.fieldLabel}>Should be done by</Text>
          {/* The template used to decide this silently, so a track arrived with
              a horizon nobody had chosen and a phase timeline scaled to it. */}
          <DateField
            value={newEnd}
            empty="However long the template runs"
            onPress={() => setPicking("new-end")}
            styles={styles}
            palette={palette}
          />

          <Text style={styles.fieldLabel}>What it is about</Text>
          <Text style={styles.muted}>
            This only decides which panels the track opens with. Every panel stays available to every
            track from Arrange, so nothing is locked away by choosing here.
          </Text>
          {TEMPLATE_LIST.map((template) => (
            <Pressable key={template.id} accessibilityRole="button" style={styles.templateRow} onPress={() => create(template.id)}>
              {/* The chosen colour, not the template's — these rows are the
                  create button, and they should show what is about to be
                  made rather than what the template would have picked. */}
              <View style={[styles.dot, { backgroundColor: chosenColour }]} />
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
      <DatePicker
        open={picking !== null}
        title={picking === "new-end" ? "Should be done by" : "Starts on"}
        value={picking === "new-end" ? newEnd : newStart}
        earliest={picking === "new-end" ? newStart : undefined}
        onPick={(date) => (picking === "new-end" ? setNewEnd(date) : setNewStart(date))}
        onClose={() => setPicking(null)}
      />

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
  const [picking, setPicking] = useState<"start" | "end" | null>(null);
  const [endDate, setEndDate] = useState(() =>
    track ? formatDateYMD(dateForDay(track.startDate ?? todayYMD(), trackTotalDays(track))) : todayYMD()
  );

  if (!track) return null;

  const validStart = isDateStr(startDate);
  const validEnd = isDateStr(endDate);
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
      <Swatches value={color} onPick={setColor} styles={styles} palette={palette} />

      <Text style={styles.fieldLabel}>Started on</Text>
      <DateField value={startDate} onPress={() => setPicking("start")} styles={styles} palette={palette} />

      <Text style={styles.fieldLabel}>Ends on</Text>
      {/* A date, not a day count. Nobody knows their track is 92 days long;
          they know it should be done by Christmas. The count is still what
          gets stored — it is what lets a track be re-dated wholesale — so this
          converts on the way in and out. */}
      <DateField
        value={endDate}
        onPress={() => setPicking("end")}
        styles={styles}
        palette={palette}
      />
      <Text style={styles.footnote}>
        {days > 0 ? `${days} day${days === 1 ? "" : "s"}. ` : ""}Moving it shifts every phase deadline
        in proportion, so the shape of the roadmap survives being made longer or shorter.
      </Text>

      <DatePicker
        open={picking !== null}
        title={picking === "end" ? "Ends on" : "Started on"}
        value={picking === "end" ? endDate : startDate}
        earliest={picking === "end" ? startDate : undefined}
        onPick={(date) => (picking === "end" ? setEndDate(date) : setStartDate(date))}
        onClose={() => setPicking(null)}
      />

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

/** The six colours a track can wear, and which one it is wearing. Shared by
 *  the create panel and the settings panel so that changing a track's colour
 *  later is the same gesture as choosing it in the first place. */
function Swatches({
  value,
  onPick,
  styles,
  palette,
}: {
  value: string;
  onPick: (colour: string) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  return (
    <View style={styles.swatches}>
      {TRACK_COLOURS.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityLabel={`Colour ${option}`}
          accessibilityState={{ selected: value === option }}
          onPress={() => onPick(option)}
          style={[styles.swatch, { backgroundColor: option }]}
        >
          {/* The tick, rather than a ring around the outside. A ring on a
              circle of colour reads as a seventh colour at a glance; a mark
              inside it reads as a choice. */}
          {value === option && <Ionicons name="checkmark" size={16} color="#ffffff" />}
        </Pressable>
      ))}
    </View>
  );
}

/** A date, shown as a date and opened as a picker. Never a text box: every
 *  date here feeds arithmetic — a phase deadline is a day count from the start
 *  — so an unparseable one is not a cosmetic problem, and the only thing the
 *  code could do with a half-typed one was ignore it. */
function DateField({
  value,
  empty,
  onPress,
  styles,
  palette,
}: {
  value: string;
  empty?: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const set = isDateStr(value);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${describeDate(value, empty ?? "Not set")}. Tap to change.`}
      onPress={onPress}
      style={styles.dateField}
    >
      <Text style={[styles.dateValue, !set && { color: palette.subtleForeground }]}>
        {describeDate(value, empty ?? "Choose a date")}
      </Text>
      <Ionicons name="calendar-outline" size={16} color={palette.subtleForeground} />
    </Pressable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    card: {
      // A name and a year of days, stacked. It was a single row when it held
      // only the name.
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    head: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    streak: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: RADIUS.control,
    },
    streakCount: { ...TYPE.micro, fontWeight: "700" },
    dot: { width: 10, height: 10, borderRadius: 5 },
    text: { flex: 1, gap: 2 },
    name: { color: palette.foreground, ...TYPE.heading, fontWeight: "600" },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    panel: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    panelTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
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
    panelLabel: { color: palette.foreground, ...TYPE.body, fontWeight: "600" },
    fieldLabel: { color: palette.subtleForeground, ...TYPE.eyebrow, fontWeight: "700", letterSpacing: 1, marginTop: SPACING.sm },
    dateField: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 48,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    dateValue: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    swatches: { flexDirection: "row", gap: SPACING.sm },
    swatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.2)",
    },
    footnote: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 16 },
    input: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
      color: palette.foreground,
      ...TYPE.subhead,
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
