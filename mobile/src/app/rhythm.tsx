// The week's rhythm, and the rotations that fill it.
//
// Two things the website lets you edit, brought over because they change what
// Today shows and are therefore worth changing from anywhere:
//
// - The rhythm says what each weekday is *for* — study, rest, whatever focus
//   types the track defines. Tapping a day cycles it through them.
// - A rotation is a cycle: a list of topics, a set of days, and a starting
//   week. Which item appears today is computed from the week number, never
//   stored, which is why editing the list here changes what appears without
//   touching any stored day. Rotations can be created, configured and removed
//   from here too — the days they run on, which list they feed, and the week
//   they start counting from.
//
// Everything is applied through the shared `trackActions`, so a rhythm changed
// on the phone and one changed on the laptop are the same edit to the merge.

import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Link } from "expo-router";
import type { RotationDef } from "@shared/types";
import { setWeeklyRhythm } from "@shared/trackActions";
import {
  addFocusType,
  recolorFocusType,
  removeFocusType,
  renameFocusType,
  setRestDay,
  type FocusPool,
} from "@shared/focusTypes";
import { isRestType } from "@shared/restDays";
import { DAYS_SHORT } from "@shared/dates";
import { NEW_ITEM_KIND } from "@shared/dayItems";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { useUndo } from "../components/UndoBar";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { EditHeader, useEditMode } from "../components/EditToggle";
import { Refreshable } from "../components/Refreshable";
import { RhythmCalendar } from "../components/RhythmCalendar";
import { Tappable } from "../components/Tappable";

const WEEK = DAYS_SHORT.slice(1).concat(DAYS_SHORT[0]); // Mon..Sun

/** A fixed set of colours rather than a colour picker. The picker is a
 *  native module, and a native module means a new build on every phone for
 *  one field; these also stay legible against both themes, which an
 *  arbitrary hex chosen on a bright screen does not. */
const SWATCHES = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#64748b"];

export default function RhythmScreen() {
  const { workspace, track, editTrack, restoreWorkspace } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [newItem, setNewItem] = useState<Record<string, string>>({});
  const [newType, setNewType] = useState("");
  const { editing, setEditing } = useEditMode();
  const { offer } = useUndo();

  /** Every focus-type edit is the same shape: take the pool, change it with a
   *  shared rule, write both halves back. The rules keep the week consistent —
   *  a rename rewrites the days showing the old name, a delete re-points its
   *  days at what is left. */
  const changePool = useCallback(
    (change: (pool: FocusPool) => FocusPool) => {
      editTrack((t) => {
        const next = change({ focusTypes: t.focusTypes ?? {}, weekSchedule: t.weekSchedule ?? [] });
        return setWeeklyRhythm(t, next.weekSchedule, next.focusTypes);
      });
    },
    [editTrack]
  );

  const focusTypes = useMemo(() => Object.entries(track?.focusTypes ?? {}), [track]);

  /** Cycles a day through the track's focus types, wrapping round. With no
   *  focus types defined there is nothing to cycle through, so it does nothing
   *  rather than inventing one. */
  const cycleDay = useCallback(
    (dayName: string) => {
      if (!track || focusTypes.length === 0) return;
      const schedule = track.weekSchedule ?? [];
      const day = schedule.find((d) => d.name === dayName);
      const index = focusTypes.findIndex(([key]) => key === day?.type);
      const [nextKey, nextType] = focusTypes[(index + 1) % focusTypes.length];

      const next = WEEK.map((name) => {
        const existing = schedule.find((d) => d.name === name);
        if (name !== dayName) return existing ?? { name, type: focusTypes[0][0], label: focusTypes[0][1].label };
        return { name, type: nextKey, label: nextType.label };
      });
      editTrack((t) => setWeeklyRhythm(t, next, t.focusTypes ?? {}));
    },
    [editTrack, focusTypes, track]
  );

  const editRotation = useCallback(
    (id: string, change: (rotation: RotationDef) => RotationDef) => {
      editTrack((t) => ({ ...t, rotations: (t.rotations ?? []).map((r) => (r.id === id ? change(r) : r)) }));
    },
    [editTrack]
  );

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  const schedule = track.weekSchedule ?? [];
  const rotations = track.rotations ?? [];

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <EditHeader
        title="The week"
        editing={editing}
        onChange={setEditing}
        hint="Tap a day to cycle what it is for. Rotations and the kinds of day can be changed too."
      />

      {/* Two views of one thing. Reading, you want dates: which week is
          this, what is on Thursday, what did the week after look like.
          Editing, you want the pattern: what a *Thursday* is for is not a
          property of any single Thursday, so setting it on a dated row
          would be quietly lying about what the tap changes. */}
      {editing ? (
        <View style={styles.week}>
          {WEEK.map((name) => {
            const day = schedule.find((d) => d.name === name);
            const colour = day ? track.focusTypes?.[day.type]?.color : undefined;
            return (
              <Tappable
                key={name}
                accessibilityRole="button"
                disabled={!editing}
                onPress={() => cycleDay(name)}
                style={styles.day}
              >
                <Text style={styles.dayName}>{name}</Text>
                <View style={[styles.dayDot, { backgroundColor: colour || palette.surfaceMuted }]} />
                <Text style={styles.dayLabel} numberOfLines={1}>
                  {day?.label ?? "—"}
                </Text>
                {/* If this kind of day has a gym plan, say how much of one — the
                    rhythm names the day and the plan fills it, and seeing both
                    here is the point of them being one idea. */}

              </Tappable>
            );
          })}
        </View>
      ) : (
        <RhythmCalendar track={track} />
      )}

      {editing && <Text style={styles.sectionTitle}>What a day can be for</Text>}
      {editing && (
        <Text style={styles.muted}>
          The pool the days above cycle through. Renaming one renames it everywhere it is used;
          deleting one moves its days to whatever is left, because a day pointing at a type that is
          gone is worse than a day of the wrong kind.
        </Text>
      )}

      {editing && (
      <View style={styles.card}>
        {focusTypes.map(([key, type]) => (
          <View key={key} style={styles.itemRow}>
            <TextInput
              value={type.label}
              onChangeText={(label) => changePool((pool) => renameFocusType(pool, key, label))}
              style={[styles.input, { flex: 1 }]}
              accessibilityLabel={`Name of ${type.label}`}
            />
            <View style={styles.swatches}>
              {SWATCHES.map((colour) => (
                <Tappable
                  key={colour}
                  accessibilityRole="button"
                  accessibilityLabel={`Colour ${type.label} ${colour}`}
                  accessibilityState={{ selected: type.color === colour }}
                  onPress={() => changePool((pool) => recolorFocusType(pool, key, colour))}
                  style={[
                    styles.swatch,
                    { backgroundColor: colour },
                    type.color === colour && { borderColor: palette.foreground, borderWidth: 2 },
                  ]}
                />
              ))}
            </View>
            {/* A day off, rather than a day missed. These bridge the streak
                instead of breaking it, and the grid marks them with a dot. */}
            <Tappable
              accessibilityRole="button"
              accessibilityState={{ selected: isRestType(key, type) }}
              accessibilityLabel={
                isRestType(key, type)
                  ? `${type.label} is a day off`
                  : `Make ${type.label} a day off`
              }
              hitSlop={8}
              onPress={() => changePool((pool) => setRestDay(pool, key, !isRestType(key, type)))}
              style={[styles.restToggle, isRestType(key, type) && { borderColor: palette.accent }]}
            >
              <Ionicons
                name="moon-outline"
                size={13}
                color={isRestType(key, type) ? palette.accent : palette.subtleForeground}
              />
            </Tappable>

            <Tappable
              accessibilityRole="button"
              accessibilityLabel={
                focusTypes.length <= 1
                  ? `Can't remove ${type.label} — a week needs at least one kind of day`
                  : `Remove ${type.label}`
              }
              accessibilityState={{ disabled: focusTypes.length <= 1 }}
              hitSlop={8}
              disabled={focusTypes.length <= 1}
              onPress={() => changePool((pool) => removeFocusType(pool, key))}
            >
              <Text style={[styles.remove, focusTypes.length <= 1 && { color: palette.subtleForeground }]}>×</Text>
            </Tappable>
          </View>
        ))}

        <TextInput
          value={newType}
          onChangeText={setNewType}
          onSubmitEditing={() => {
            const label = newType.trim();
            if (!label) return;
            changePool((pool) => addFocusType(pool, label, SWATCHES[focusTypes.length % SWATCHES.length]));
            setNewType("");
          }}
          placeholder="Add a kind of day…"
          placeholderTextColor={palette.subtleForeground}
          returnKeyType="done"
          style={styles.input}
          accessibilityLabel="New focus type"
        />
      </View>
      )}

      <Text style={styles.sectionTitle}>Rotations</Text>
      <Text style={styles.muted}>
        A cycle of topics: one appears on its days each week, then the next. Which one is showing is
        worked out from the week number, so adding or removing items changes what comes up without
        touching anything already logged.
      </Text>

      {rotations.map((rotation) => (
        <View key={rotation.id} style={styles.card}>
          <View style={styles.itemRow}>
            {editing ? (
              <TextInput
                value={rotation.label}
                onChangeText={(label) => editRotation(rotation.id, (r) => ({ ...r, label }))}
                style={[styles.input, { flex: 1 }]}
                accessibilityLabel={`Name of ${rotation.label}`}
              />
            ) : (
              <Text style={styles.cardTitle}>
                {rotation.label} ·{" "}
                {rotation.daysOfWeek.length ? rotation.daysOfWeek.join(", ") : "no days yet"}
                {/* Which phase it belongs to, where a list of rotations would
                    otherwise look like a list of things all running at once. */}
                {rotation.phase === undefined ? "" : ` · phase ${rotation.phase}`}
              </Text>
            )}
            {editing && (
              <Tappable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${rotation.label}`}
                onPress={() => {
                  const previous = workspace;
                  editTrack((t) => ({ ...t, rotations: (t.rotations ?? []).filter((r) => r.id !== rotation.id) }));
                  if (previous) offer("Rotation removed", () => restoreWorkspace(previous));
                }}
              >
                <Text style={styles.remove}>×</Text>
              </Tappable>
            )}
          </View>

          {editing && (
            <>
          {/* Which phase this belongs to. A cycle and a curriculum are
              different shapes: ten topics on a twenty-four week track wrap
              and repeat, so phase three brings back what phase one already
              covered. Scoped, a short rotation per phase works through them
              once and is finished by the end. */}
          <Text style={styles.fieldLabel}>Runs during</Text>
          <View style={styles.choices}>
            <Tappable
              accessibilityRole="button"
              accessibilityState={{ selected: rotation.phase === undefined }}
              onPress={() =>
                editRotation(rotation.id, (r) => {
                  // Deleted rather than set to undefined: an absent key means
                  // every phase, and a stored undefined becomes null on the
                  // way through the database.
                  const { phase: _drop, ...rest } = r;
                  void _drop;
                  return rest;
                })
              }
              style={[styles.choice, rotation.phase === undefined && { borderColor: palette.accent }]}
            >
              <Text style={[styles.choiceLabel, rotation.phase === undefined && { color: palette.foreground }]}>
                Every phase
              </Text>
            </Tappable>
            {(track?.phases ?? []).map((p) => {
              const on = rotation.phase === p.id;
              return (
                <Tappable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={p.title}
                  onPress={() => editRotation(rotation.id, (r) => ({ ...r, phase: p.id }))}
                  style={[styles.choice, on && { borderColor: palette.accent }]}
                >
                  <Text style={[styles.choiceLabel, on && { color: palette.foreground }]} numberOfLines={1}>
                    {p.title}
                  </Text>
                </Tappable>
              );
            })}
          </View>
          <Text style={styles.muted}>
            {rotation.phase === undefined
              ? "Shows on its days whatever phase you are on."
              : "Hidden until the track reaches that phase, and gone once it moves past."}
          </Text>

          <Text style={styles.fieldLabel}>On these days</Text>
          <View style={styles.choices}>
            {WEEK.map((day) => {
              const on = rotation.daysOfWeek.includes(day);
              return (
                <Tappable
                  key={day}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${day}${on ? ", on" : ", off"}`}
                  onPress={() =>
                    editRotation(rotation.id, (r) => ({
                      ...r,
                      daysOfWeek: on ? r.daysOfWeek.filter((d) => d !== day) : [...r.daysOfWeek, day],
                    }))
                  }
                  style={[styles.choice, on && { borderColor: palette.accent }]}
                >
                  <Text style={[styles.choiceLabel, on && { color: palette.foreground }]}>{day}</Text>
                </Tappable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Counting from week</Text>
          <TextInput
            value={String(rotation.startWeek)}
            onChangeText={(text) => {
              const week = Number(text);
              // Which topic shows is (week - startWeek) into the cycle, so a
              // blank or nonsense value would put the whole rotation out of
              // step rather than simply failing.
              if (Number.isFinite(week) && week >= 1) {
                editRotation(rotation.id, (r) => ({ ...r, startWeek: Math.round(week) }));
              }
            }}
            keyboardType="number-pad"
            style={styles.input}
            accessibilityLabel={`Starting week of ${rotation.label}`}
          />

            </>
          )}

          <Link href={{ pathname: "/rotation/[id]", params: { id: rotation.id } }} asChild>
            <Tappable accessibilityRole="button" style={styles.planButton}>
              <Text style={styles.planLabel}>
                {rotation.explanation?.trim() ? "The plan behind this" : "Write the plan behind this"}
              </Text>
            </Tappable>
          </Link>

          <Text style={styles.fieldLabel}>Topics, in order</Text>

          {rotation.items.map((item, index) => (
            <View key={`${index}-${item.title}`} style={styles.itemRow}>
              <Text style={styles.item}>{item.title}</Text>
              {editing && (
                <Tappable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.title}`}
                  onPress={() => editRotation(rotation.id, (r) => ({ ...r, items: r.items.filter((_, i) => i !== index) }))}
                >
                  <Text style={styles.remove}>×</Text>
                </Tappable>
              )}
            </View>
          ))}

          {editing && (
          <TextInput
            value={newItem[rotation.id] ?? ""}
            onChangeText={(text) => setNewItem((prev) => ({ ...prev, [rotation.id]: text }))}
            onSubmitEditing={() => {
              const title = (newItem[rotation.id] ?? "").trim();
              if (!title) return;
              editRotation(rotation.id, (r) => ({ ...r, items: [...r.items, { title }] }));
              setNewItem((prev) => ({ ...prev, [rotation.id]: "" }));
            }}
            placeholder="Add a topic…"
            placeholderTextColor={palette.subtleForeground}
            returnKeyType="done"
            style={styles.input}
            accessibilityLabel={`Add a topic to ${rotation.label}`}
          />
          )}
        </View>
      ))}

      {rotations.length === 0 && (
        <Text style={styles.muted}>
          No rotations on this track yet. One is a cycle of topics that takes turns week by week.
        </Text>
      )}

      {editing && (
      <Tappable
        accessibilityRole="button"
        style={styles.addButton}
        onPress={() =>
          editTrack((t) => ({
            ...t,
            rotations: [
              ...(t.rotations ?? []),
              {
                // Starts empty and off no days: a rotation that began feeding
                // items into the week the moment it was created would change
                // today's plan before it had been given any topics.
                id: `rot_${Date.now()}`,
                label: "New rotation",
                items: [],
                daysOfWeek: [],
                // Nothing picks this any more: a day shows one list. New
                // rotations take the list that can hold a description.
                target: NEW_ITEM_KIND,
                startWeek: 1,
              },
            ],
          }))
        }
      >
        <Text style={styles.addLabel}>Add a rotation</Text>
      </Tappable>
      )}
    </Refreshable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.sm },
    centered: { alignItems: "center", justifyContent: "center" },
    sectionTitle: {
      color: palette.subtleForeground,
      ...TYPE.marker,
      fontWeight: "700",
      letterSpacing: 1.2,
      marginTop: SPACING.sm,
    },
    week: { flexDirection: "row", gap: SPACING.xs, marginVertical: SPACING.sm },
    day: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    dayName: { color: palette.foreground, ...TYPE.micro, fontWeight: "700" },
    dayDot: { width: 8, height: 8, borderRadius: 4 },
    dayLabel: { color: palette.subtleForeground, ...TYPE.micro},
    card: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    cardTitle: { color: palette.foreground, ...TYPE.body, fontWeight: "600" },
    fieldLabel: { color: palette.subtleForeground, ...TYPE.marker, fontWeight: "700", letterSpacing: 1, marginTop: SPACING.sm },
    choices: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
    choice: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    choiceLabel: { color: palette.mutedForeground, ...TYPE.caption, fontWeight: "600" },
    addButton: {
      alignItems: "center",
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: palette.cardBorder,
      marginTop: SPACING.sm,
    },
    addLabel: { color: palette.foreground, ...TYPE.body, fontWeight: "600" },
    planButton: {
      alignItems: "center",
      paddingVertical: SPACING.sm,
      marginTop: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    planLabel: { color: palette.foreground, ...TYPE.label, fontWeight: "600" },
    itemRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    item: { flex: 1, color: palette.mutedForeground, ...TYPE.body},
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
    restToggle: {
      width: 26,
      height: 26,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    swatches: { flexDirection: "row", gap: 4 },
    swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: "rgba(0,0,0,0.2)" },
    input: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
      color: palette.foreground,
      ...TYPE.body,
    },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
  });
}
