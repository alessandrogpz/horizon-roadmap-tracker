// The track's full roadmap: the long-form plan behind the phases.
//
// Reading it on a phone is genuinely useful — it is the document you want when
// deciding what to do next, and it is often long. Writing it here is not, and
// the screen says so: editing is behind a deliberate switch rather than the
// default, because a stray tap in a 4,000-word document on a touch keyboard is
// how plans get mangled.
//
// Reading mode renders the markdown; editing mode shows the source, because
// that is what you are editing. The renderer is pure JavaScript (markdown-it
// underneath), which matters more than it sounds: a native dependency here
// would have meant a new build in everyone's hands, while this one reached the
// phone as an over-the-air update like any other change.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Markdown from "react-native-markdown-display";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

const SAVE_AFTER_MS = 800;

export default function RoadmapScreen() {
  const { track, editTrack } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(track?.roadmapContent ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Someone else's edit arriving by sync shouldn't be overwritten by a stale
  // draft sitting in a box nobody is typing in.
  useEffect(() => {
    if (!editing) setDraft(track?.roadmapContent ?? "");
  }, [editing, track?.roadmapContent]);

  const onChange = useCallback(
    (text: string) => {
      setDraft(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => editTrack((t) => ({ ...t, roadmapContent: text })), SAVE_AFTER_MS);
    },
    [editTrack]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.bar}>
        <Text style={styles.muted}>{editing ? "Saving as you type" : "Reading"}</Text>
        <Pressable accessibilityRole="button" onPress={() => setEditing(!editing)} style={styles.button}>
          <Text style={styles.buttonLabel}>{editing ? "Done" : "Edit"}</Text>
        </Pressable>
      </View>

      {editing ? (
        <TextInput
          value={draft}
          onChangeText={onChange}
          multiline
          textAlignVertical="top"
          style={styles.editor}
          accessibilityLabel="Roadmap"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {track.roadmapContent?.trim() ? (
            <Markdown style={markdownStyles(palette)}>{track.roadmapContent}</Markdown>
          ) : (
            <Text style={styles.reading}>This track has no roadmap written yet.</Text>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    centered: { alignItems: "center", justifyContent: "center" },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: palette.cardBorder,
    },
    button: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    buttonLabel: { color: palette.foreground, fontSize: 13, fontWeight: "600" },
    content: { padding: SPACING.lg },
    reading: { color: palette.foreground, fontSize: 14, lineHeight: 22 },
    editor: {
      flex: 1,
      padding: SPACING.lg,
      color: palette.foreground,
      fontSize: 14,
      lineHeight: 21,
    },
    muted: { color: palette.mutedForeground, fontSize: 13 },
  });
}

/** The renderer's own stylesheet, mapped onto the app's palette so the document
 *  reads like the rest of the app rather than like a web page from 2005. */
function markdownStyles(palette: Palette) {
  return {
    body: { color: palette.foreground, fontSize: 15, lineHeight: 23 },
    heading1: { color: palette.foreground, fontSize: 24, fontWeight: "700" as const, marginTop: SPACING.lg, marginBottom: SPACING.sm },
    heading2: { color: palette.foreground, fontSize: 19, fontWeight: "700" as const, marginTop: SPACING.lg, marginBottom: SPACING.xs },
    heading3: { color: palette.foreground, fontSize: 16, fontWeight: "600" as const, marginTop: SPACING.md },
    paragraph: { marginTop: 0, marginBottom: SPACING.md },
    strong: { fontWeight: "700" as const },
    em: { fontStyle: "italic" as const },
    link: { color: palette.accent },
    bullet_list: { marginBottom: SPACING.md },
    ordered_list: { marginBottom: SPACING.md },
    list_item: { marginBottom: 4 },
    code_inline: {
      color: palette.accent,
      backgroundColor: palette.surfaceMuted,
      borderWidth: 0,
      paddingHorizontal: 4,
      borderRadius: 4,
      fontSize: 13,
    },
    fence: {
      color: palette.foreground,
      backgroundColor: palette.surfaceMuted,
      borderColor: palette.cardBorder,
      borderRadius: RADIUS.control,
      padding: SPACING.md,
      fontSize: 13,
    },
    code_block: {
      color: palette.foreground,
      backgroundColor: palette.surfaceMuted,
      borderColor: palette.cardBorder,
      borderRadius: RADIUS.control,
      padding: SPACING.md,
      fontSize: 13,
    },
    blockquote: {
      backgroundColor: palette.surfaceMuted,
      borderLeftColor: palette.accent,
      borderLeftWidth: 3,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      marginBottom: SPACING.md,
    },
    hr: { backgroundColor: palette.cardBorder, height: 1, marginVertical: SPACING.lg },
    table: { borderColor: palette.cardBorder, borderRadius: RADIUS.control, marginBottom: SPACING.md },
    thead: { backgroundColor: palette.surfaceMuted },
    th: { color: palette.foreground, padding: SPACING.sm, fontWeight: "600" as const },
    td: { color: palette.mutedForeground, padding: SPACING.sm },
    tr: { borderColor: palette.cardBorder },
  };
}
