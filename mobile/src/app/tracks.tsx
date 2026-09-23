// Switching between tracks. One goal per track is the idea the whole product
// rests on, so this is the second screen rather than a setting.

import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { visibleTracks } from "@shared/selectors";
import { seedTrackFromTemplate, TEMPLATE_LIST } from "@shared/templates";
import { updateTrackIdentity } from "@shared/trackActions";
import { todayYMD } from "@shared/dates";
import { currentStreakLength } from "@shared/streak";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export default function TracksScreen() {
  const { workspace, today, switchTrack, addTrack, editTrackById } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const tracks = workspace ? visibleTracks(workspace) : [];
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const create = useCallback(
    (templateId: string) => {
      const template = TEMPLATE_LIST.find((entry) => entry.id === templateId);
      if (!template) return;
      // The template answers the questions the website asks in its wizard:
      // a phone is the wrong place for a five-step form, and the defaults are
      // what most people accept there anyway. Everything is editable after.
      addTrack(
        seedTrackFromTemplate(template, {
          name: name.trim() || template.label,
          color: template.defaultColor,
          startDate: todayYMD(),
          phases: template.buildPhases(template.defaultDurationDays),
          weekSchedule: template.defaultWeekSchedule,
          focusTypes: template.defaultFocusTypes,
        })
      );
      setName("");
      setCreating(false);
      router.back();
    },
    [addTrack, name]
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {tracks.map((track) => {
        const active = track.meta.id === workspace?.activeTrackId;
        const streak = currentStreakLength(track.streakHistory ?? [], today);
        return (
          <Pressable
            key={track.meta.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.card, active && { borderColor: palette.accent }]}
            onPress={() => {
              switchTrack(track.meta.id);
              router.back();
            }}
            onLongPress={() => {
              setRenaming(track.meta.id);
              setNewName(track.meta.name);
            }}
            delayLongPress={350}
          >
            <View style={[styles.dot, { backgroundColor: track.meta.color || palette.accent }]} />
            <View style={styles.text}>
              <Text style={styles.name}>{track.meta.name}</Text>
              <Text style={styles.muted}>
                {streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} in a row` : "no streak yet"}
                {active ? " · open" : ""} · hold to rename
              </Text>
            </View>
          </Pressable>
        );
      })}

      {tracks.length === 0 && <Text style={styles.muted}>No tracks yet.</Text>}

      {renaming && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Rename</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Track name"
            placeholderTextColor={palette.subtleForeground}
            style={styles.input}
            autoFocus
            accessibilityLabel="New track name"
          />
          <View style={styles.panelRow}>
            <Pressable
              accessibilityRole="button"
              style={styles.panelButton}
              onPress={() => {
                const target = workspace?.tracks[renaming];
                if (target && newName.trim()) {
                  editTrackById(renaming, (track) =>
                    updateTrackIdentity(track, {
                      name: newName.trim(),
                      color: track.meta.color,
                      startDate: track.startDate ?? todayYMD(),
                      totalDays: track.phases.reduce((max, p) => Math.max(max, p.recommendedByDay ?? 0), 0) || 90,
                    })
                  );
                }
                setRenaming(null);
              }}
            >
              <Text style={styles.panelLabel}>Save</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.panelButton} onPress={() => setRenaming(null)}>
              <Text style={styles.panelLabel}>Cancel</Text>
            </Pressable>
          </View>
          <View style={styles.panelRow}>
            <Pressable
              accessibilityRole="button"
              style={styles.panelButton}
              disabled={tracks.length <= 1}
              onPress={() => {
                // Archiving, not deleting: the record stays, with a flag, so the
                // change merges like any other edit instead of a deletion having
                // to be represented as an absence (see visibleTracks).
                const id = renaming;
                if (!id || tracks.length <= 1) return;
                const remaining = tracks.filter((t) => t.meta.id !== id);
                editTrackById(id, (track) => ({ ...track, meta: { ...track.meta, archived: true } }));
                if (workspace?.activeTrackId === id && remaining[0]) switchTrack(remaining[0].meta.id);
                setRenaming(null);
              }}
            >
              <Text style={[styles.panelLabel, tracks.length <= 1 && { color: palette.subtleForeground }]}>
                {tracks.length <= 1 ? "Can't archive your only track" : "Archive this track"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {creating ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>New track</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="What are you working towards?"
            placeholderTextColor={palette.subtleForeground}
            style={styles.input}
            accessibilityLabel="Track name"
          />
          <Text style={styles.muted}>Start from:</Text>
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
    </ScrollView>
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
