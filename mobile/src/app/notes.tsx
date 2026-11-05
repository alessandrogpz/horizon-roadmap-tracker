// Notepad and to-do: the quick-capture half of the app, and the part with the
// clearest reason to exist on a phone — a thought arriving on a train is the
// case this serves.
//
// Both are notes in the same store as material notes, identified by
// `notepad_<trackId>` and `todo_<trackId>` (the shared `quickNotes` module
// decides that, and the same ids appear on the website). The to-do list is a
// markdown checklist underneath, parsed and written back by the same functions
// the web uses — so a list edited here opens correctly there, and vice versa.
//
// Every keystroke is written to SQLite after a short pause, because Android can
// end this process without warning and a lost thought is the one thing this
// screen must never do.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  addTodo,
  clearDoneTodos,
  notepadNoteId,
  parseTodos,
  removeTodo,
  renameTodo,
  serializeTodos,
  todoNoteId,
  toggleTodo,
  type TodoItem,
} from "@shared/quickNotes";
import { loadNotes, saveNote } from "../storage/db";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { Refreshable } from "../components/Refreshable";
import { Tappable } from "../components/Tappable";

const SAVE_AFTER_MS = 600;

export default function NotesScreen() {
  const { track } = useWorkspace();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const trackId = track?.meta.id ?? "";
  const [notepad, setNotepad] = useState("");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [draft, setDraft] = useState("");
  // Which item is being reworded, and what it says so far. Hold a to-do to
  // open it — the same gesture the Today screen's checklists use.
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!trackId) return;
    let cancelled = false;
    loadNotes().then((notes) => {
      if (cancelled) return;
      setNotepad(notes.find((n) => n.id === notepadNoteId(trackId))?.content ?? "");
      setTodos(parseTodos(notes.find((n) => n.id === todoNoteId(trackId))?.content ?? ""));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  /** The device's own clock decides which copy of a note wins a merge, so it is
   *  stamped here rather than on the server (see lib/server/sync/store.ts). */
  const store = useCallback((id: string, content: string) => {
    void saveNote({ id, content, updatedAt: Date.now() });
  }, []);

  const onNotepadChange = useCallback(
    (text: string) => {
      setNotepad(text);
      if (timer.current) clearTimeout(timer.current);
      // A save per keystroke would write hundreds of times a minute; a pause
      // of half a second is imperceptible and survives the app being killed,
      // which is the only deadline that matters here.
      timer.current = setTimeout(() => store(notepadNoteId(trackId), text), SAVE_AFTER_MS);
    },
    [store, trackId]
  );

  const commitTodos = useCallback(
    (next: TodoItem[]) => {
      setTodos(next);
      store(todoNoteId(trackId), serializeTodos(next));
    },
    [store, trackId]
  );

  // A half-typed note in the box when the screen closes should still be saved.
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
      <Refreshable contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>To-do</Text>

        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => {
              if (!draft.trim()) return;
              commitTodos(addTodo(todos, draft));
              setDraft("");
            }}
            placeholder="Something to do…"
            placeholderTextColor={palette.subtleForeground}
            returnKeyType="done"
            style={styles.input}
            accessibilityLabel="New to-do"
          />
        </View>

        {todos.map((item, index) =>
          editing?.index === index ? (
            <View key={`${index}-${item.text}`} style={styles.todoRow}>
              <TextInput
                value={editing.text}
                onChangeText={(text) => setEditing({ index, text })}
                onSubmitEditing={() => {
                  commitTodos(renameTodo(todos, index, editing.text));
                  setEditing(null);
                }}
                autoFocus
                returnKeyType="done"
                style={[styles.input, { flex: 1 }]}
                accessibilityLabel={`Rename ${item.text}`}
              />
              <Tappable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  commitTodos(renameTodo(todos, index, editing.text));
                  setEditing(null);
                }}
              >
                <Text style={styles.saveEdit}>Save</Text>
              </Tappable>
            </View>
          ) : (
          <View key={`${index}-${item.text}`} style={styles.todoRow}>
            <Tappable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
              accessibilityLabel={item.text}
              accessibilityHint="Hold to reword"
              onPress={() => commitTodos(toggleTodo(todos, index))}
              onLongPress={() => setEditing({ index, text: item.text })}
              style={styles.todoTap}
            >
              <View style={[styles.checkbox, item.done && { backgroundColor: palette.success, borderColor: palette.success }]}>
                {item.done && <Text style={styles.tick}>✓</Text>}
              </View>
              <Text style={[styles.todoText, item.done && styles.todoDone]}>{item.text}</Text>
            </Tappable>
            <Tappable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.text}`}
              hitSlop={8}
              onPress={() => commitTodos(removeTodo(todos, index))}
            >
              <Text style={styles.remove}>×</Text>
            </Tappable>
          </View>
          )
        )}

        {loaded && todos.length === 0 && <Text style={styles.muted}>Nothing on the list.</Text>}

        {todos.some((item) => item.done) && (
          <Tappable
            accessibilityRole="button"
            onPress={() => commitTodos(clearDoneTodos(todos))}
            style={styles.clearButton}
          >
            <Text style={styles.clearLabel}>
              Clear the {todos.filter((item) => item.done).length} done
            </Text>
          </Tappable>
        )}

        <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Notepad</Text>
        <TextInput
          value={notepad}
          onChangeText={onNotepadChange}
          placeholder="Jot it down here, sort it out later."
          placeholderTextColor={palette.subtleForeground}
          multiline
          textAlignVertical="top"
          style={styles.notepad}
          accessibilityLabel="Notepad"
        />
        <Text style={styles.footnote}>Saved as you type, and synced with the rest when you sync.</Text>
      </Refreshable>
    </KeyboardAvoidingView>
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
    },
    addRow: { flexDirection: "row", gap: SPACING.sm },
    input: {
      flex: 1,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      color: palette.foreground,
      ...TYPE.subhead,
    },
    todoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    todoTap: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.md },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: palette.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    tick: { color: "#fff", ...TYPE.caption, fontWeight: "800" },
    todoText: { flex: 1, color: palette.foreground, ...TYPE.subhead},
    todoDone: { color: palette.mutedForeground, textDecorationLine: "line-through" },
    remove: { color: palette.subtleForeground, ...TYPE.figure, paddingHorizontal: SPACING.sm },
    saveEdit: { color: palette.accent, ...TYPE.subhead, paddingHorizontal: SPACING.sm },
    notepad: {
      minHeight: 200,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      color: palette.foreground,
      ...TYPE.subhead,
      lineHeight: 21,
    },
    muted: { color: palette.mutedForeground, ...TYPE.label},
    clearButton: { alignSelf: "flex-start", paddingVertical: SPACING.sm },
    clearLabel: { color: palette.mutedForeground, ...TYPE.label, fontWeight: "600" },
    footnote: { color: palette.subtleForeground, ...TYPE.micro},
  });
}
