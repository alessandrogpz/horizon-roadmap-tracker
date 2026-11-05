// One phase, in full: what it is for, what it has to produce, and what is left
// to do inside it.
//
// The list on ../phases.tsx is the shape of the plan — where today falls, what
// is done, what is next. This is the inside of one of them, and it is a
// separate screen rather than a bigger card because everything here is long:
// four sections of items with their own descriptions, a paragraph, and a task
// list. On the website all of it is a modal; a phone has no room for a modal
// over a modal, so it is a route, which also means the back gesture does what
// it should and a phase can be linked to.
//
// Everything is applied through `updatePhase` from the shared core, so a phase
// edited here and one edited on the laptop are the same edit to the merge.

import { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { Phase, PhaseDetailItem, PhaseDetailedInfo } from "@shared/types";
import { updatePhase } from "@shared/trackActions";
import { PHASE_DETAIL_SECTIONS, phaseDetailItems, setPhaseDetail } from "@shared/phaseDetails";
import { dateForDay, dayForDate, formatDateYMD, formatDayMonthYear, parseYMD } from "@shared/dates";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { RADIUS, SPACING, TYPE, type Palette } from "../../theme";
import { usePalette } from "../../theme/ThemeProvider";
import { DatePicker } from "../../components/DatePicker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { EditButton, useEditMode } from "../../components/EditToggle";
import { Refreshable } from "../../components/Refreshable";
import { Tappable } from "../../components/Tappable";
import { LIMITS } from "@shared/limits";

export default function PhaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { track, editTrack } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const phase = track?.phases.find((p) => String(p.id) === String(id)) ?? null;
  const [newTask, setNewTask] = useState("");
  const [newItem, setNewItem] = useState<Partial<Record<string, string>>>({});
  const { editing, setEditing } = useEditMode();
  // Sections opened in this sitting but still empty: they have to stay on
  // screen long enough to type into.
  const [openSections, setOpenSections] = useState<string[]>([]);

  /** Every edit on this screen is "replace this phase with a changed copy", so
   *  there is one way through rather than a mutation per field. */
  const change = useCallback(
    (next: (phase: Phase) => Phase) => {
      if (!phase) return;
      editTrack((t) => updatePhase(t, next(phase)));
    },
    [editTrack, phase]
  );

  if (!track || !phase) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>That phase isn&apos;t on the open track.</Text>
      </View>
    );
  }

  const done = phase.tasks.filter((t) => t.completed).length;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Refreshable contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          {editing ? (
            <TextInput
              maxLength={LIMITS.name}
              value={phase.title}
              onChangeText={(title) => change((p) => ({ ...p, title }))}
              style={[styles.titleInput, { flex: 1 }]}
              accessibilityLabel="Phase title"
            />
          ) : (
            <Text style={[styles.titleInput, { flex: 1 }]}>{phase.title}</Text>
          )}
          <EditButton editing={editing} onChange={setEditing} what="this phase" />
        </View>

        <Deadline phase={phase} startDate={track.startDate} change={change} canEdit={editing} styles={styles} palette={palette} />

        <Text style={styles.sectionTitle}>What this phase is about</Text>
        {editing ? (
          <TextInput
            maxLength={LIMITS.description}
            value={phase.description}
            onChangeText={(description) => change((p) => ({ ...p, description }))}
            multiline
            textAlignVertical="top"
            placeholder="A sentence or two…"
            placeholderTextColor={palette.subtleForeground}
            style={[styles.input, styles.paragraph]}
            accessibilityLabel="Phase description"
          />
        ) : (
          <Text style={styles.reading}>{phase.description || "Nothing written about this phase yet."}</Text>
        )}

        <Text style={styles.sectionTitle}>
          Tasks{phase.tasks.length > 0 ? ` · ${done} of ${phase.tasks.length}` : ""}
        </Text>
        {phase.tasks.map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <Tappable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: task.completed }}
              accessibilityLabel={task.title}
              onPress={() =>
                change((p) => ({
                  ...p,
                  tasks: p.tasks.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)),
                }))
              }
              style={[styles.checkbox, task.completed && { backgroundColor: palette.success, borderColor: palette.success }]}
            >
              {task.completed && <Text style={styles.tick}>✓</Text>}
            </Tappable>
            {editing ? (
              <TextInput
                maxLength={LIMITS.title}
                value={task.title}
                onChangeText={(title) =>
                  change((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === task.id ? { ...t, title } : t)) }))
                }
                style={[styles.taskTitle, task.completed && styles.doneTask]}
                accessibilityLabel={`Title of ${task.title}`}
              />
            ) : (
              <Text style={[styles.taskTitle, task.completed && styles.doneTask]}>{task.title}</Text>
            )}
            {editing && (
              <Tappable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${task.title}`}
                onPress={() => change((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== task.id) }))}
              >
                <Text style={styles.remove}>×</Text>
              </Tappable>
            )}
          </View>
        ))}
        {editing && (
        <TextInput
          maxLength={LIMITS.title}
          value={newTask}
          onChangeText={setNewTask}
          onSubmitEditing={() => {
            const title = newTask.trim();
            if (!title) return;
            // The id only has to be unique inside this phase, and two taps a
            // millisecond apart is not a thing a thumb can do.
            change((p) => ({ ...p, tasks: [...p.tasks, { id: `t_${Date.now()}`, title, completed: false }] }));
            setNewTask("");
          }}
          placeholder="Add a task…"
          placeholderTextColor={palette.subtleForeground}
          returnKeyType="done"
          style={styles.input}
          accessibilityLabel="New task"
        />
        )}

        {/* Only sections that actually hold something. The four keys date from
            when Horizon was one computer-science curriculum, so a phase on a
            fitness track was being headed "Maths" and "Algorithms" with
            nothing under either. An empty section is offered below instead of
            being rendered as a heading over a void. */}
        {PHASE_DETAIL_SECTIONS.filter(
          ({ key }) => phaseDetailItems(phase.detailedInfo[key]).length > 0 || openSections.includes(key)
        ).map(({ key, label }) => {
          const items = phaseDetailItems(phase.detailedInfo[key]);
          const set = (next: PhaseDetailItem[]) => change((p) => setPhaseDetail(p, key, next));
          return (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionTitle}>{label}</Text>
              {items.map((item, index) => (
                <View key={index} style={styles.detailCard}>
                  <View style={styles.detailHead}>
                    {editing ? (
                      <TextInput
                        maxLength={LIMITS.title}
                        value={item.item}
                        onChangeText={(text) => set(items.map((it, i) => (i === index ? { ...it, item: text } : it)))}
                        style={styles.detailItem}
                        accessibilityLabel={`${label} item ${index + 1}`}
                      />
                    ) : (
                      <Text style={styles.detailItem}>{item.item}</Text>
                    )}
                    {editing && (
                      <Tappable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item.item || `${label} item ${index + 1}`}`}
                        onPress={() => set(items.filter((_, i) => i !== index))}
                      >
                        <Text style={styles.remove}>×</Text>
                      </Tappable>
                    )}
                  </View>
                  {editing ? (
                    <TextInput
                      maxLength={LIMITS.description}
                      value={item.desc}
                      onChangeText={(text) => set(items.map((it, i) => (i === index ? { ...it, desc: text } : it)))}
                      multiline
                      textAlignVertical="top"
                      placeholder="What it means…"
                      placeholderTextColor={palette.subtleForeground}
                      style={styles.detailDesc}
                      accessibilityLabel={`Description of ${item.item || `${label} item ${index + 1}`}`}
                    />
                  ) : item.desc ? (
                    <Text style={styles.detailDesc}>{item.desc}</Text>
                  ) : null}
                </View>
              ))}
              {editing && (
              <TextInput
                maxLength={LIMITS.title}
                value={newItem[key] ?? ""}
                onChangeText={(text) => setNewItem((prev) => ({ ...prev, [key]: text }))}
                onSubmitEditing={() => {
                  const text = (newItem[key] ?? "").trim();
                  if (!text) return;
                  set([...items, { item: text, desc: "" }]);
                  setNewItem((prev) => ({ ...prev, [key]: "" }));
                }}
                placeholder={`Add to ${label.toLowerCase()}…`}
                placeholderTextColor={palette.subtleForeground}
                returnKeyType="done"
                style={styles.input}
                accessibilityLabel={`Add to ${label}`}
              />
              )}
            </View>
          );
        })}

        {editing && (
          <View style={styles.addSections}>
            {PHASE_DETAIL_SECTIONS.filter(
              ({ key }) =>
                phaseDetailItems(phase.detailedInfo[key]).length === 0 && !openSections.includes(key)
            ).map(({ key, label }) => (
              <Tappable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`Add a ${label} section`}
                onPress={() => setOpenSections((current) => [...current, key])}
                style={styles.addSectionChip}
              >
                <Text style={styles.addSectionLabel}>+ {label}</Text>
              </Tappable>
            ))}
          </View>
        )}

        <Text style={styles.footnote}>
          {editing
            ? "Saves as you type, and syncs with the rest of the track."
            : "Tap Edit to change any of this."}
        </Text>
      </Refreshable>
    </KeyboardAvoidingView>
  );
}

/**
 * The phase's deadline.
 *
 * Stored as `recommendedByDay` — a count of days from the track's start, not a
 * date — because moving a track's start should move its phases with it. That
 * is the right thing to store and the wrong thing to show, so this reads and
 * writes a calendar date and does the conversion, exactly as the website does.
 *
 * A typed date rather than a date picker: the picker is a native module, and a
 * native module is a new build on every phone for one field.
 */
/**
 * The phase's deadline.
 *
 * Stored as `recommendedByDay` — a count of days from the track's start, not a
 * date — because moving a track's start should move its phases with it. That
 * is the right thing to store and the wrong thing to show, so this reads and
 * writes a calendar date and does the conversion, exactly as the website does.
 *
 * Picked, never typed. The count is arithmetic on whatever comes out of here,
 * so a half-typed date was not a cosmetic problem — and the old field silently
 * reverted anything it could not parse, which is the worst of both.
 */
function Deadline({
  phase,
  startDate,
  change,
  canEdit,
  styles,
  palette,
}: {
  phase: Phase;
  startDate: string;
  change: (next: (phase: Phase) => Phase) => void;
  /** The screen's edit mode. */
  canEdit: boolean;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [picking, setPicking] = useState(false);
  const due =
    phase.recommendedByDay !== undefined
      ? formatDateYMD(dateForDay(startDate, phase.recommendedByDay))
      : "";

  return (
    <>
      <View style={styles.deadlineRow}>
        <Tappable
          accessibilityRole="button"
          disabled={!canEdit}
          onPress={() => setPicking(true)}
          style={styles.deadlineButton}
        >
          <Ionicons name="calendar-outline" size={14} color={palette.subtleForeground} />
          <Text style={styles.muted}>
            {due
              ? `Due ${formatDayMonthYear(parseYMD(due))} · day ${phase.recommendedByDay}`
              : canEdit
                ? "No deadline — tap to set one"
                : "No deadline"}
          </Text>
        </Tappable>

        {canEdit && due ? (
          <Tappable
            accessibilityRole="button"
            accessibilityLabel="Clear the deadline"
            hitSlop={10}
            onPress={() =>
              change((p) => {
                const cleared = { ...p };
                delete cleared.recommendedByDay;
                return cleared;
              })
            }
          >
            <Ionicons name="close" size={16} color={palette.subtleForeground} />
          </Tappable>
        ) : null}
      </View>

      <DatePicker
        open={picking}
        title="Phase ends on"
        value={due}
        // A phase cannot end before the track begins, so those days are not
        // offered rather than refused after the fact.
        earliest={startDate}
        onPick={(date) => {
          const day = dayForDate(startDate, date);
          if (Number.isFinite(day) && day >= 1) change((p) => ({ ...p, recommendedByDay: day }));
        }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xl },
    centered: { alignItems: "center", justifyContent: "center" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    titleInput: { color: palette.foreground, ...TYPE.title, fontWeight: "700", paddingVertical: SPACING.xs },
    reading: { color: palette.mutedForeground, ...TYPE.body, lineHeight: 20 },
    deadlineRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    deadlineButton: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 40 },
    sectionTitle: {
      color: palette.subtleForeground,
      ...TYPE.marker,
      fontWeight: "700",
      letterSpacing: 1.2,
      marginTop: SPACING.lg,
    },
    section: { gap: SPACING.sm },
    input: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      color: palette.foreground,
      ...TYPE.body,
    },
    paragraph: { minHeight: 76, lineHeight: 20 },
    editRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    taskRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: palette.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    // The page's own background, which is near-black on one theme and
    // near-white on the other, so it is always the colour furthest from the
    // fill under it. This was a fixed `#fff`, which reads 2.54 on the dark
    // theme's success green — under even the 3:1 graphics floor — and 5.48 on
    // the light theme's deeper one. No single fixed colour clears both;
    // following the theme gives 7.80 and 5.30.
    tick: { color: palette.background, ...TYPE.label, fontWeight: "800" },
    taskTitle: { flex: 1, color: palette.foreground, ...TYPE.subhead, paddingVertical: SPACING.xs },
    doneTask: { color: palette.mutedForeground, textDecorationLine: "line-through" },
    remove: {
      color: palette.subtleForeground,
      ...TYPE.title,
      // Android asks for 48dp; a bare glyph was nowhere near it, which is
      // most of why these felt fiddly to hit.
      minWidth: 44,
      minHeight: 44,
      lineHeight: 44,
      textAlign: "center",
    },
    detailCard: {
      gap: 2,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    detailHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    detailItem: { flex: 1, color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    detailDesc: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 19, paddingLeft: SPACING.sm },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    addSections: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginTop: SPACING.md },
    addSectionChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: palette.cardBorder,
    },
    addSectionLabel: { color: palette.mutedForeground, ...TYPE.caption, fontWeight: "600" },
    footnote: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 16, marginTop: SPACING.sm },
  });
}
