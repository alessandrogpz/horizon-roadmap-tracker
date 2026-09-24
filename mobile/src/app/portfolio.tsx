// Portfolio: the things a track has to actually produce.
//
// Ticking one off counts as an accomplishment, which feeds the streak — the
// shared `togglePortfolioProject` decides that, against today's date, exactly
// as the website does.
//
// What is deliberately absent is the git statistics the web shows beside each
// item. Those read a repository on the machine running the app, through a
// localhost-only route; a phone has no checkout to read. The repository link is
// still here, because opening it is what you would do from a phone anyway.

import { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  addPortfolioProject,
  removePortfolioProject,
  togglePortfolioProject,
  updatePortfolioProject,
} from "@shared/trackActions";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export default function PortfolioScreen() {
  const { track, today, editTrack } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [draft, setDraft] = useState("");

  const toggle = useCallback(
    (projectId: string) => editTrack((t) => togglePortfolioProject(t, projectId, today)),
    [editTrack, today]
  );

  const add = useCallback(() => {
    const title = draft.trim();
    if (!title) return;
    editTrack((t) => addPortfolioProject(t, { title, completed: false }));
    setDraft("");
  }, [draft, editTrack]);

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  const projects = track.portfolio ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {projects.map((project) => (
        <View key={project.id} style={styles.card}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!project.completed }}
            accessibilityLabel={project.title}
            onPress={() => toggle(project.id)}
            style={styles.row}
          >
            <View style={[styles.checkbox, project.completed && { backgroundColor: palette.success, borderColor: palette.success }]}>
              {project.completed && <Text style={styles.tick}>✓</Text>}
            </View>
            <TextInput
              value={project.title}
              onChangeText={(title) => editTrack((t) => updatePortfolioProject(t, project.id, { title }))}
              style={[styles.title, project.completed && styles.done]}
              accessibilityLabel={`Name of ${project.title}`}
            />
          </Pressable>

          <TextInput
            value={project.repoUrl ?? ""}
            onChangeText={(repoUrl) =>
              // Empty means "no repository", not an empty string — the field is
              // optional and a blank one should not be stored.
              editTrack((t) => updatePortfolioProject(t, project.id, { repoUrl: repoUrl.trim() || undefined }))
            }
            placeholder="Repository link, if it has one…"
            placeholderTextColor={palette.subtleForeground}
            autoCapitalize="none"
            keyboardType="url"
            style={styles.repoInput}
            accessibilityLabel={`Repository link for ${project.title}`}
          />

          <View style={styles.actions}>
            {project.repoUrl ? (
              <Pressable accessibilityRole="link" style={styles.smallButton} onPress={() => void Linking.openURL(project.repoUrl!)}>
                <Text style={styles.smallLabel}>Open repository</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              style={styles.smallButton}
              onPress={() => editTrack((t) => removePortfolioProject(t, project.id))}
            >
              <Text style={styles.smallLabel}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {projects.length === 0 && <Text style={styles.muted}>Nothing to deliver on this track yet.</Text>}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        placeholder="Something this track has to produce…"
        placeholderTextColor={palette.subtleForeground}
        returnKeyType="done"
        style={styles.input}
        accessibilityLabel="New deliverable"
      />

      <Text style={styles.footnote}>
        Git statistics stay on the website: they read a repository on the computer running the app, and
        a phone has no checkout to read.
      </Text>
    </ScrollView>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    centered: { alignItems: "center", justifyContent: "center" },
    card: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    row: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
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
    title: { flex: 1, color: palette.foreground, fontSize: 15, paddingVertical: 2 },
    repoInput: {
      color: palette.mutedForeground,
      fontSize: 12,
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    done: { color: palette.mutedForeground, textDecorationLine: "line-through" },
    actions: { flexDirection: "row", gap: SPACING.sm },
    smallButton: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    smallLabel: { color: palette.mutedForeground, fontSize: 12, fontWeight: "600" },
    input: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      color: palette.foreground,
      fontSize: 15,
    },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
    footnote: { color: palette.subtleForeground, fontSize: 11, lineHeight: 16 },
  });
}
