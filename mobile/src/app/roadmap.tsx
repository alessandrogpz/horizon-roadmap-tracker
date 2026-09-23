// The track's full roadmap: the long-form plan behind the phases.
//
// Reading it on a phone is genuinely useful — it is the document you want when
// deciding what to do next, and it is often long. Writing it here is not, and
// the screen says so: editing is behind a deliberate switch rather than the
// default, because a stray tap in a 4,000-word document on a touch keyboard is
// how plans get mangled.
//
// The markdown is shown as-is rather than rendered. A renderer means a parser
// and a component library for what is, on this screen, a page of prose — and
// prose reads perfectly well with its headings and dashes intact.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
          <Text style={styles.reading}>{track.roadmapContent?.trim() || "This track has no roadmap written yet."}</Text>
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
