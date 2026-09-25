// Reading is the default; editing is a decision.
//
// The app opens on a plan, not on a form. Most of the time someone opens
// Horizon they are checking where things stand — and a screen whose every
// field is a live text box invites exactly the accident it looks like it wants:
// a thumb lands on a phase title while scrolling and the keyboard comes up over
// the thing being read. Worse, on a touch screen there is no hover, so an
// editable field and a label look identical until one of them moves.
//
// So every screen that can change the plan starts read-only and says so with a
// pencil. Tap it and the fields, the add boxes and the destructive controls
// appear together; tap Done and they all go away again. One switch per screen
// rather than per field, because "am I editing?" is a mode a person holds in
// their head, not a property of a text box.
//
// The flag is passed down as a prop rather than through a context. A context
// was written first and never used: every screen that needs the flag already
// renders the components that read it, so threading it was one line and a
// provider was a layer to look through.
//
// The exceptions are deliberate and both are *doing* rather than *planning*:
// ticking something off on Today, and the timer. Those are the actions the app
// exists for and putting them behind a mode would be absurd.

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";

/**
 * The switch itself, plus the state behind it.
 *
 * Returned rather than rendered so a screen can put the control where its own
 * layout wants it — in a section header, next to a title — while the state
 * lives in one place.
 */
export function useEditMode(): { editing: boolean; setEditing: (value: boolean) => void } {
  const [editing, setEditing] = useState(false);
  return { editing, setEditing };
}

export function EditButton({
  editing,
  onChange,
  /** What is being edited, for anyone using a screen reader. */
  what,
}: {
  editing: boolean;
  onChange: (value: boolean) => void;
  what: string;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: editing }}
      accessibilityLabel={editing ? `Finish editing ${what}` : `Edit ${what}`}
      onPress={() => onChange(!editing)}
      style={[styles.button, editing && { borderColor: palette.accent, backgroundColor: `${palette.accent}1a` }]}
      hitSlop={6}
    >
      <Ionicons
        name={editing ? "checkmark" : "pencil"}
        size={13}
        color={editing ? palette.accent : palette.mutedForeground}
      />
      <Text style={[styles.label, editing && { color: palette.accent }]}>{editing ? "Done" : "Edit"}</Text>
    </Pressable>
  );
}

/** A screen's title row with the switch on the right. Most screens want
 *  exactly this and nothing more. */
export function EditHeader({
  title,
  editing,
  onChange,
  hint,
}: {
  title: string;
  editing: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        {editing && hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <EditButton editing={editing} onChange={onChange} what={title.toLowerCase()} />
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    header: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.md },
    headerText: { flex: 1, gap: 2 },
    title: { color: palette.foreground, ...TYPE.subhead, fontWeight: "700" },
    hint: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 16 },
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    label: { color: palette.mutedForeground, ...TYPE.caption, fontWeight: "600" },
  });
}
