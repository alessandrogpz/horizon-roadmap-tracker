// Undo, instead of "are you sure?".
//
// Removing a phase used to happen on the first tap and take its tasks, its
// description and its four detail sections with it. The obvious fix is a
// confirmation, and the obvious fix is wrong: a dialog in front of every
// destructive action teaches people to tap through dialogs, so by the time one
// actually matters it has already been dismissed by reflex.
//
// So the action happens immediately — which is what the person asked for —
// and a bar offers to put it back for a few seconds. It costs nothing when you
// meant it, and it is the only thing that helps when you did not.
//
// The undo is a whole previous workspace rather than an inverse operation.
// Reversing a removal exactly would mean knowing where in the list it sat and
// what else the same edit touched; keeping the previous state is both simpler
// and actually correct.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { warn } from "../feedback/haptics";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { Tappable } from "./Tappable";

const SHOWN_FOR_MS = 6000;

interface Offer {
  /** "Phase removed", "Material removed" — what just happened, in three words. */
  what: string;
  undo: () => void;
}

interface UndoValue {
  /** Call straight after doing the thing. */
  offer: (what: string, undo: () => void) => void;
}

const UndoContext = createContext<UndoValue | null>(null);

/** Screens call `offer` after a destructive edit. Safe to use anywhere under
 *  the provider; a screen that forgets simply gets the old behaviour. */
export function useUndo(): UndoValue {
  return useContext(UndoContext) ?? { offer: () => undefined };
}

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [offerState, setOffer] = useState<Offer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const offer = useCallback((what: string, undo: () => void) => {
    warn();
    setOffer({ what, undo });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOffer(null), SHOWN_FOR_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const value = useMemo<UndoValue>(() => ({ offer }), [offer]);

  return (
    <UndoContext.Provider value={value}>
      {children}
      {offerState && (
        <Bar
          offer={offerState}
          onDone={() => {
            if (timer.current) clearTimeout(timer.current);
            setOffer(null);
          }}
        />
      )}
    </UndoContext.Provider>
  );
}

function Bar({ offer, onDone }: { offer: Offer; onDone: () => void }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();

  return (
    // Above the tab bar, not over it: covering navigation to tell someone
    // something went away is its own small hostility.
    <View style={[styles.bar, { bottom: insets.bottom + 84 }]} pointerEvents="box-none">
      <View style={styles.inner}>
        <Ionicons name="trash-outline" size={15} color={palette.mutedForeground} />
        <Text style={styles.label} numberOfLines={1}>
          {offer.what}
        </Text>
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={`Undo: ${offer.what}`}
          onPress={() => {
            offer.undo();
            onDone();
          }}
          style={styles.action}
          hitSlop={10}
        >
          <Text style={styles.actionLabel}>Undo</Text>
        </Tappable>
      </View>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    bar: { position: "absolute", left: SPACING.lg, right: SPACING.lg, alignItems: "stretch" },
    inner: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      paddingLeft: SPACING.md,
      paddingRight: SPACING.xs,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    label: { flex: 1, color: palette.foreground, ...TYPE.label, fontWeight: "600" },
    action: { minHeight: 44, justifyContent: "center", paddingHorizontal: SPACING.md },
    actionLabel: { color: palette.accent, ...TYPE.body, fontWeight: "700" },
  });
}
