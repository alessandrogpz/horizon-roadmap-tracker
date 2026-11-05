// What a screen says before there is anything to show it.
//
// This used to be three words centred in an empty screen — "No track open."
// — with no illustration, no explanation and nothing to press. On the home
// tab that is the first thing a new person sees, and it fails the only job a
// zero state has: get to the first useful thing. The app already knew how to
// do this properly two tabs away, where `today.tsx` names what is missing,
// says what happens when you act, and offers one filled button.
//
// So this is `EmptyState` now, with the way in attached. Eight screens had
// written the three-word version out inline rather than using this component;
// they all come through here instead, so the answer is the same wherever you
// land first.

import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SPACING, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { EmptyState } from "./EmptyState";

export function NoTrack({
  /** What this particular screen would have shown. Used to say what is
   *  missing in the screen's own terms — "No track open" tells you the state
   *  and not what you lost by it. */
  title = "No track yet",
  hint = "A track is one goal with a start, a horizon and the phases in between. Make one and this screen fills in.",
}: {
  title?: string;
  hint?: string;
}) {
  const router = useRouter();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    // `EmptyState` is a card meant to sit in a list; this is a whole screen
    // with nothing else on it, so the card is centred in it rather than
    // stranded at the top.
    <View style={styles.screen}>
      <EmptyState
        title={title}
        hint={hint}
        action="Create a track"
        icon="add"
        onAct={() => router.push("/tracks")}
      />
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      justifyContent: "center",
      padding: SPACING.lg,
      backgroundColor: palette.background,
    },
  });
}
