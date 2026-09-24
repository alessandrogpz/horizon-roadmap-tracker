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
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { Phase, PhaseDetailItem, PhaseDetailedInfo } from "@shared/types";
import { updatePhase } from "@shared/trackActions";
import { PHASE_DETAIL_SECTIONS, phaseDetailItems, setPhaseDetail } from "@shared/phaseDetails";
import { dateForDay, dayForDate, formatDateYMD, formatDayMonthYear, todayYMD } from "@shared/dates";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { RADIUS, SPACING, type Palette } from "../../theme";
import { usePalette } from "../../theme/ThemeProvider";

export default function PhaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { track, editTrack } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const phase = track?.phases.find((p) => String(p.id) === String(id)) ?? null;
  const [newTask, setNewTask] = useState("");
  const [newItem, setNewItem] = useState<Partial<Record<string, string>>>({});

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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          value={phase.title}
          onChangeText={(title) => change((p) => ({ ...p, title }))}
          style={styles.titleInput}
          accessibilityLabel="Phase title"
        />

        <Deadline phase={phase} startDate={track.startDate} change={change} styles={styles} palette={palette} />

        <Text style={styles.sectionTitle}>What this phase is about</Text>
        <TextInput
          value={phase.description}
          onChangeText={(description) => change((p) => ({ ...p, description }))}
          multiline
          textAlignVertical="top"
          placeholder="A sentence or two…"
          placeholderTextColor={palette.subtleForeground}
          style={[styles.input, styles.paragraph]}
          accessibilityLabel="Phase description"
        />

        <Text style={styles.sectionTitle}>
          Tasks{phase.tasks.length > 0 ? ` · ${done} of ${phase.tasks.length}` : ""}
        </Text>
        {phase.tasks.map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <Pressable
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
            </Pressable>
            <TextInput
              value={task.title}
              onChangeText={(title) =>
                change((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === task.id ? { ...t, title } : t)) }))
              }
              style={[styles.taskTitle, task.completed && styles.doneTask]}
              accessibilityLabel={`Title of ${task.title}`}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${task.title}`}
              onPress={() => change((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== task.id) }))}
            >
              <Text style={styles.remove}>×</Text>
            </Pressable>
          </View>
        ))}
        <TextInput
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

        {PHASE_DETAIL_SECTIONS.map(({ key, label }) => {
          const items = phaseDetailItems(phase.detailedInfo[key]);
          const set = (next: PhaseDetailItem[]) => change((p) => setPhaseDetail(p, key, next));
          return (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionTitle}>{label}</Text>
              {items.map((item, index) => (
                <View key={index} style={styles.detailCard}>
                  <View style={styles.detailHead}>
                    <TextInput
                      value={item.item}
                      onChangeText={(text) => set(items.map((it, i) => (i === index ? { ...it, item: text } : it)))}
                      style={styles.detailItem}
                      accessibilityLabel={`${label} item ${index + 1}`}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.item || `${label} item ${index + 1}`}`}
                      onPress={() => set(items.filter((_, i) => i !== index))}
                    >
                      <Text style={styles.remove}>×</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={item.desc}
                    onChangeText={(text) => set(items.map((it, i) => (i === index ? { ...it, desc: text } : it)))}
                    multiline
                    textAlignVertical="top"
                    placeholder="What it means…"
                    placeholderTextColor={palette.subtleForeground}
                    style={styles.detailDesc}
                    accessibilityLabel={`Description of ${item.item || `${label} item ${index + 1}`}`}
                  />
                </View>
              ))}
              <TextInput
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
            </View>
          );
        })}

        <Text style={styles.footnote}>
          Everything on this screen saves as you type, and syncs with the rest of the track.
        </Text>
      </ScrollView>
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
function Deadline({
  phase,
  startDate,
  change,
  styles,
  palette,
}: {
  phase: Phase;
  startDate: string;
  change: (next: (phase: Phase) => Phase) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const stored =
    phase.recommendedByDay !== undefined ? formatDateYMD(dateForDay(startDate, phase.recommendedByDay)) : "";
  const [draft, setDraft] = useState(stored);
  const [editing, setEditing] = useState(false);

  const commit = useCallback(() => {
    setEditing(false);
    const text = draft.trim();
    if (!text) {
      // Clearing the field removes the threshold entirely, which is how a
      // phase opts out of the deadline banner.
      change((p) => {
        const cleared = { ...p };
        delete cleared.recommendedByDay;
        return cleared;
      });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return setDraft(stored);
    const day = dayForDate(startDate, text);
    // Not a date, or before the track begins: leave what was stored alone
    // rather than clamping, which would silently move the deadline somewhere
    // nobody asked for. The website refuses the same way.
    if (!Number.isFinite(day) || day < 1) return setDraft(stored);
    change((p) => ({ ...p, recommendedByDay: day }));
  }, [change, draft, startDate, stored]);

  if (!editing) {
    return (
      <Pressable accessibilityRole="button" onPress={() => { setDraft(stored); setEditing(true); }}>
        <Text style={styles.muted}>
          {phase.recommendedByDay !== undefined
            ? `Due ${formatDayMonthYear(dateForDay(startDate, phase.recommendedByDay))} · day ${phase.recommendedByDay} — tap to change`
            : "No deadline — tap to set one"}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.editRow}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commit}
        onBlur={commit}
        autoFocus
        placeholder={todayYMD()}
        placeholderTextColor={palette.subtleForeground}
        keyboardType="numbers-and-punctuation"
        returnKeyType="done"
        style={[styles.input, { flex: 1 }]}
        accessibilityLabel="Phase deadline, as year-month-day"
      />
      <Text style={styles.footnote}>Empty clears it</Text>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xl },
    centered: { alignItems: "center", justifyContent: "center" },
    titleInput: { color: palette.foreground, fontSize: 20, fontWeight: "700", paddingVertical: SPACING.xs },
    sectionTitle: {
      color: palette.subtleForeground,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
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
      fontSize: 14,
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
    tick: { color: "#fff", fontSize: 13, fontWeight: "800" },
    taskTitle: { flex: 1, color: palette.foreground, fontSize: 15, paddingVertical: SPACING.xs },
    doneTask: { color: palette.mutedForeground, textDecorationLine: "line-through" },
    remove: { color: palette.subtleForeground, fontSize: 20, paddingHorizontal: SPACING.sm },
    detailCard: {
      gap: 2,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    detailHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    detailItem: { flex: 1, color: palette.foreground, fontSize: 15, fontWeight: "600" },
    detailDesc: { color: palette.mutedForeground, fontSize: 13, lineHeight: 19, paddingLeft: SPACING.sm },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
    footnote: { color: palette.subtleForeground, fontSize: 11, lineHeight: 16, marginTop: SPACING.sm },
  });
}
