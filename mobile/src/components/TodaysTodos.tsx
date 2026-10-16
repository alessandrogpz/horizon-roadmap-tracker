// The track's to-do list, reachable from Today.
//
// The two checklists above it are the *plan* — what this weekday is for, every
// week. A to-do is the opposite: the loose end that came up today and has no
// place in a repeating schedule. Those are different things and keeping them in
// separate lists is deliberate, but wanting the second from the first screen is
// entirely reasonable: they are both "what am I doing today".
//
// Collapsed unless asked for, and it remembers being opened, because whether
// someone works this way at all is a preference and not a per-visit question.
// It is the same note the Notes screen edits and the same note the website
// edits — keyed by the track, through `@shared/quickNotes`.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  addTodo,
  parseTodos,
  renameTodo,
  serializeTodos,
  todoNoteId,
  toggleTodo,
  type TodoItem,
} from "@shared/quickNotes";
import { loadNotes, saveNote } from "../storage/db";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

export function TodaysTodos({
  trackId,
  editing,
  open,
  onOpenChange,
}: {
  trackId: string;
  /** Adding is behind the screen's edit switch; ticking is not, the same rule
   *  the checklists above follow. */
  editing: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [draft, setDraft] = useState("");
  // Rewording sits behind the screen's edit switch, like adding does; ticking
  // stays in front of it. Named for the action, because `editing` is already
  // the switch itself.
  const [reword, setReword] = useState<{ index: number; text: string } | null>(null);
  const noteId = todoNoteId(trackId);

  useEffect(() => {
    let cancelled = false;
    loadNotes().then((notes) => {
      if (cancelled) return;
      setTodos(parseTodos(notes.find((note) => note.id === noteId)?.content ?? ""));
    });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const commit = useCallback(
    (next: TodoItem[]) => {
      setTodos(next);
      void saveNote({ id: noteId, content: serializeTodos(next), updatedAt: Date.now() });
    },
    [noteId]
  );

  const left = todos.filter((item) => !item.done).length;

  return (
    <View style={styles.block}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => onOpenChange(!open)}
        style={styles.head}
      >
        <Ionicons name="checkbox-outline" size={14} color={palette.subtleForeground} />
        <Text style={styles.title}>
          To-do{todos.length > 0 ? ` · ${left} left` : ""}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={15} color={palette.subtleForeground} />
      </Pressable>

      {open && (
        <>
          {todos.map((item, index) =>
            reword?.index === index ? (
              <View key={`${index}-${item.text}`} style={styles.row}>
                <TextInput
                  value={reword.text}
                  onChangeText={(text) => setReword({ index, text })}
                  onSubmitEditing={() => {
                    commit(renameTodo(todos, index, reword.text));
                    setReword(null);
                  }}
                  autoFocus
                  returnKeyType="done"
                  style={[styles.input, { flex: 1, marginTop: 0 }]}
                  accessibilityLabel={`Rename ${item.text}`}
                />
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    commit(renameTodo(todos, index, reword.text));
                    setReword(null);
                  }}
                >
                  <Text style={styles.saveEdit}>Save</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                key={`${index}-${item.text}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done }}
                accessibilityLabel={item.text}
                accessibilityHint={editing ? "Hold to reword" : undefined}
                onPress={() => commit(toggleTodo(todos, index))}
                onLongPress={editing ? () => setReword({ index, text: item.text }) : undefined}
                style={styles.row}
              >
                <View style={[styles.box, item.done && { backgroundColor: palette.success, borderColor: palette.success }]}>
                  {item.done && <Text style={styles.tick}>✓</Text>}
                </View>
                <Text style={[styles.text, item.done && styles.done]}>{item.text}</Text>
              </Pressable>
            )
          )}

          {todos.length === 0 && <Text style={styles.muted}>Nothing on the list.</Text>}

          {editing && (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => {
                const text = draft.trim();
                if (!text) return;
                commit(addTodo(todos, text));
                setDraft("");
              }}
              placeholder="Add a loose end…"
              placeholderTextColor={palette.subtleForeground}
              returnKeyType="done"
              style={styles.input}
              accessibilityLabel="New to-do"
            />
          )}
        </>
      )}
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    block: { gap: SPACING.sm, marginTop: SPACING.md },
    head: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xs },
    title: {
      flex: 1,
      color: palette.subtleForeground,
      ...TYPE.eyebrow,
      fontWeight: "700",
      letterSpacing: 1.2,
    },
    row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: SPACING.xs },
    box: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: palette.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    tick: { color: "#fff", ...TYPE.caption, fontWeight: "800" },
    text: { flex: 1, color: palette.foreground, ...TYPE.body},
    done: { color: palette.mutedForeground, textDecorationLine: "line-through" },
    saveEdit: { color: palette.accent, ...TYPE.subhead, paddingHorizontal: SPACING.sm },
    input: {
      marginTop: SPACING.xs,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: palette.cardBorder,
      color: palette.foreground,
      ...TYPE.body,
    },
    muted: { color: palette.mutedForeground, ...TYPE.label},
  });
}
