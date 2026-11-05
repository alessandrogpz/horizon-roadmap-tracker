// The four tabs: the app's actual shape.
//
// Grouped by what you are trying to do rather than by which data structure a
// screen happens to edit:
//
//   My Space  the whole track as panels you arrange yourself — the home
//   Today     the day's checklist
//   Plan      the phases, and through them the roadmap, the week, what to ship
//   Progress  the streak, and the history the server computes
//
// My Space is first and is what opens: it is the screen that answers "where
// does this track stand" without being asked anything, and everything else is
// a way of drilling into part of it. Being first also does the back gesture a
// favour — `backBehavior: "firstRoute"` means the system back from any other
// tab returns here rather than leaving the app.
//
// "Library" used to be the third, and was cut: a tab whose whole job was to
// hold the reading list had no reason to be one tap from everywhere, and the
// materials panel says more in less space. The full list is still there, from
// that panel and from the menu.
//
// Each one lands on real content instead of a menu — Plan opens on the phases
// themselves — with a row of chips to its siblings. The alternative, which
// this replaced, was one screen with ten links stacked under the day's work.
//
// The header is shared and rendered once here, so the track name and the sync
// state are on screen wherever you are.

import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ColorValue } from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { usePalette } from "../../theme/ThemeProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TYPE } from "../../theme";
import { MAX_CONTENT, useLayout } from "../../layout";

export default function TabsLayout() {
  const palette = usePalette();
  // The bar has to clear the gesture area, or the labels sit under it and
  // get clipped. Measured rather than assumed: it is 0 on a phone with
  // buttons and about 34 on one without.
  const insets = useSafeAreaInsets();
  const { width } = useLayout();

  return (
    <Tabs
      backBehavior="firstRoute"
      screenOptions={{
        header: () => <AppHeader />,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.subtleForeground,
        tabBarStyle: {
          backgroundColor: palette.background,
          borderTopColor: palette.cardBorder,
          // Tall enough for an icon and a label. Left to itself the bar
          // squeezes the label box to a few pixels and clips the text, which
          // is what happens when the icon takes the space first.
          height: 76 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom + 12,
          // Gathers the items under the content rather than leaving them in
          // the far corners of a tablet's bar. Zero on a phone.
          paddingHorizontal: Math.max(0, (width - MAX_CONTENT) / 2),
        },
        tabBarLabelStyle: { ...TYPE.micro, fontWeight: "600", marginTop: 2 },
        // On a tablet the four tabs would otherwise sit in the far corners of
        // an 834-point bar, a thumb's journey apart and nowhere near the
        // content they belong to. Capping the item width gathers them in the
        // middle, which is what iPad's own tab bars do; on a phone the cap is
        // wider than a quarter of the screen, so nothing changes.
        tabBarItemStyle: { maxWidth: MAX_CONTENT / 4 },
        // The bar is a fixed height, so its labels cannot grow with the
        // OS font scale without clipping — which is the bug this screen
        // already had once, just triggered by my numbers instead of
        // someone's accessibility settings.
        tabBarAllowFontScaling: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: palette.background },
      }}
    >
      {/* Outline when idle, filled when active — the convention every phone
          user already reads without being told. */}
      <Tabs.Screen
        name="index"
        options={{ title: "My Space", tabBarIcon: icon("grid", "grid-outline") }}
      />
      <Tabs.Screen
        name="today"
        options={{ title: "Today", tabBarIcon: icon("checkmark-circle", "checkmark-circle-outline") }}
      />
      <Tabs.Screen name="plan" options={{ title: "Plan", tabBarIcon: icon("map", "map-outline") }} />
      <Tabs.Screen
        name="progress"
        options={{ title: "Progress", tabBarIcon: icon("flame", "flame-outline") }}
      />
    </Tabs>
  );
}

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function icon(active: IoniconName, idle: IoniconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? active : idle} size={22} color={color as string} />
  );
}
