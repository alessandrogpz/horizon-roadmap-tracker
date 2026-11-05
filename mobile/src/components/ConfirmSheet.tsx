// "Are you sure?", for the few places that deserve one.
//
// Most destructive actions in this app do not get a dialog, because a
// confirmation in front of everything teaches people to dismiss
// confirmations — that is what the undo bar is for. This is for the ones undo
// cannot cover: the swipe gestures, where the action is a flick rather than a
// considered tap, and deleting a track, which takes everything on it.
//
// One screenful of consequence, named in the title, with the destructive
// button on the right where the eye lands last.

import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { Tappable } from "./Tappable";

export interface Confirmation {
  title: string;
  /** What actually happens, in a sentence. Not "this cannot be undone" unless
   *  it genuinely cannot. */
  body: string;
  /** The word on the button, which should be the verb — "Delete", not "OK". */
  verb: string;
  onConfirm: () => void;
}

export function ConfirmSheet({
  confirmation,
  onClose,
}: {
  confirmation: Confirmation | null;
  onClose: () => void;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <Modal visible={!!confirmation} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cancel" />
        {confirmation && (
          <View style={styles.sheet}>
            <View style={styles.head}>
              <View style={styles.icon}>
                <Ionicons name="alert-circle-outline" size={20} color={palette.danger} />
              </View>
              <Text style={styles.title}>{confirmation.title}</Text>
            </View>
            <Text style={styles.body}>{confirmation.body}</Text>

            <View style={styles.actions}>
              <Tappable accessibilityRole="button" onPress={onClose} style={styles.button}>
                <Text style={styles.buttonLabel}>Cancel</Text>
              </Tappable>
              <Tappable
                accessibilityRole="button"
                onPress={() => {
                  confirmation.onConfirm();
                  onClose();
                }}
                style={[styles.button, styles.danger]}
              >
                <Text style={styles.dangerLabel}>{confirmation.verb}</Text>
              </Tappable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      gap: SPACING.md,
      padding: SPACING.lg,
      paddingBottom: SPACING.xl,
      backgroundColor: palette.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderTopWidth: 1,
      borderColor: palette.cardBorder,
    },
    head: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(248, 113, 113, 0.12)",
    },
    title: { flex: 1, color: palette.foreground, ...TYPE.heading, fontWeight: "700" },
    body: { color: palette.mutedForeground, ...TYPE.body, lineHeight: 20 },
    actions: { flexDirection: "row", gap: SPACING.sm },
    button: {
      flex: 1,
      alignItems: "center",
      minHeight: 48,
      justifyContent: "center",
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    buttonLabel: { color: palette.mutedForeground, ...TYPE.subhead, fontWeight: "600" },
    danger: { backgroundColor: palette.danger, borderColor: palette.danger },
    dangerLabel: { color: "#fff", ...TYPE.subhead, fontWeight: "700" },
  });
}
