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
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  addPortfolioProject,
  removePortfolioProject,
  togglePortfolioProject,
  updatePortfolioProject,
} from "@shared/trackActions";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { useUndo } from "../components/UndoBar";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { SwipeRow } from "../components/SwipeRow";
import { EditHeader, useEditMode } from "../components/EditToggle";
import { EmptyState } from "../components/EmptyState";
import { Refreshable } from "../components/Refreshable";
import { Tappable } from "../components/Tappable";
import { LIMITS } from "@shared/limits";
import { ACTION } from "../theme";
import { NoTrack } from "../components/NoTrack";

export default function PortfolioScreen() {
  const { workspace, track, today, editTrack, restoreWorkspace } = useWorkspace();
  const palette = usePalette();
  const { editing, setEditing } = useEditMode();
  const { offer } = useUndo();
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
    return <NoTrack title="No track yet" hint="Deliverables are the things a track has to produce. Make a track and you can start listing them." />;
  }

  const projects = track.portfolio ?? [];

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <EditHeader
        title={projects.length === 1 ? "1 deliverable" : `${projects.length} deliverables`}
        editing={editing}
        onChange={setEditing}
        hint="Rename one, add its repository, or take it off the list. Ticking one off works either way."
      />

      {projects.map((project) => (
        <SwipeRow
          key={project.id}
          right={{
            label: "Remove",
            icon: "trash-outline",
            colour: ACTION.danger,
            onAct: () => {
              const previous = workspace;
              editTrack((t) => removePortfolioProject(t, project.id));
              if (previous) offer("Deliverable removed", () => restoreWorkspace(previous));
            },
          }}
        >
        <View style={styles.card}>
          <Tappable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!project.completed }}
            accessibilityLabel={project.title}
            onPress={() => toggle(project.id)}
            style={styles.row}
          >
            <View style={[styles.checkbox, project.completed && { backgroundColor: palette.success, borderColor: palette.success }]}>
              {project.completed && <Text style={styles.tick}>✓</Text>}
            </View>
            {editing ? (
              <TextInput
                maxLength={LIMITS.title}
                value={project.title}
                onChangeText={(title) => editTrack((t) => updatePortfolioProject(t, project.id, { title }))}
                style={[styles.title, project.completed && styles.done]}
                accessibilityLabel={`Name of ${project.title}`}
              />
            ) : (
              <Text style={[styles.title, project.completed && styles.done]}>{project.title}</Text>
            )}
          </Tappable>

          {editing && (
          <TextInput
            maxLength={LIMITS.url}
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
          )}

          <View style={styles.actions}>
            {project.repoUrl ? (
              <Tappable accessibilityRole="link" style={styles.smallButton} onPress={() => void Linking.openURL(project.repoUrl!)}>
                <Text style={styles.smallLabel}>Open repository</Text>
              </Tappable>
            ) : null}
            {editing && (
              <Tappable
                accessibilityRole="button"
                style={styles.smallButton}
                onPress={() => {
                  const previous = workspace;
                  editTrack((t) => removePortfolioProject(t, project.id));
                  if (previous) offer("Deliverable removed", () => restoreWorkspace(previous));
                }}
              >
                <Text style={styles.smallLabel}>Remove</Text>
              </Tappable>
            )}
          </View>
        </View>
        </SwipeRow>
      ))}

      {projects.length === 0 && !editing && (
        <EmptyState
          title="Nothing to deliver yet"
          hint="The things this track is meant to produce, each with somewhere to point at the work."
          action="Add a deliverable"
          onAct={() => setEditing(true)}
        />
      )}

      {editing && (
      <TextInput
        maxLength={LIMITS.title}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        placeholder="Something this track has to produce…"
        placeholderTextColor={palette.subtleForeground}
        returnKeyType="done"
        style={styles.input}
        accessibilityLabel="New deliverable"
      />
      )}

      <Text style={styles.footnote}>
        Git statistics stay on the website: they read a repository on the computer running the app, and
        a phone has no checkout to read.
      </Text>
    </Refreshable>
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
    // The page's own background, which is near-black on one theme and
    // near-white on the other, so it is always the colour furthest from the
    // fill under it. This was a fixed `#fff`, which reads 2.54 on the dark
    // theme's success green — under even the 3:1 graphics floor — and 5.48 on
    // the light theme's deeper one. No single fixed colour clears both;
    // following the theme gives 7.80 and 5.30.
    tick: { color: palette.background, ...TYPE.label, fontWeight: "800" },
    title: { flex: 1, color: palette.foreground, ...TYPE.subhead, paddingVertical: 2 },
    repoInput: {
      color: palette.mutedForeground,
      ...TYPE.caption,
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
    smallLabel: { color: palette.mutedForeground, ...TYPE.caption, fontWeight: "600" },
    input: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      color: palette.foreground,
      ...TYPE.subhead,
    },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    footnote: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 16 },
  });
}
