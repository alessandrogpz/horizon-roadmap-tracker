// The four tabs: the app's actual shape.
//
// Grouped by what you are trying to do rather than by which data structure a
// screen happens to edit:
//
//   Today     the day's checklist
//   Plan      the phases, and through them the roadmap, the week, what to ship
//   My Space  the whole track as panels you arrange yourself
//   Progress  the streak, the history the server computes, the timer
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

export default function TabsLayout() {
  const palette = usePalette();
  // The bar has to clear the gesture area, or the labels sit under it and
  // get clipped. Measured rather than assumed: it is 0 on a phone with
  // buttons and about 34 on one without.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
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
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: palette.background },
      }}
    >
      {/* Outline when idle, filled when active — the convention every phone
          user already reads without being told. */}
      <Tabs.Screen
        name="index"
        options={{ title: "Today", tabBarIcon: icon("checkmark-circle", "checkmark-circle-outline") }}
      />
      <Tabs.Screen name="plan" options={{ title: "Plan", tabBarIcon: icon("map", "map-outline") }} />
      <Tabs.Screen
        name="space"
        options={{ title: "My Space", tabBarIcon: icon("grid", "grid-outline") }}
      />
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
