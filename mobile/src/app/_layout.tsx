// The root of the app. Everything below it can assume the workspace has been
// read from SQLite, the palette matches the website's, and sync has a status
// anything can read.
//
// Two layers of navigation, deliberately:
//
//   (tabs)   the four places you spend time, with a shared header and a tab
//            bar that never goes away
//   the rest screens pushed on top of a tab — a phase, a rotation's plan, the
//            timer — which cover the tab bar and come back with the back
//            gesture, and the three modals that are done *to* the app rather
//            than in it
//
// The pushed screens keep their own titles because they are destinations, not
// tabs: "Deliverables" at the top of a screen you arrived at from Plan is more
// use than the track name repeated a fourth time.

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { WorkspaceProvider } from "../workspace/WorkspaceProvider";
import { SyncProvider } from "../sync/SyncProvider";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";

export default function RootLayout() {
  return (
    // Gesture handler needs a root of its own for `GestureDetector` to receive
    // touches at all — without it the panel drag in My Space is inert on
    // Android, silently and with no error.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <WorkspaceProvider>
            {/* Inside the workspace: a sync writes the merged workspace
                straight back into it. */}
            <SyncProvider>
              <Screens />
            </SyncProvider>
          </WorkspaceProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function Screens() {
  const { palette, resolved } = useTheme();

  return (
    <>
      <StatusBar style={resolved === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.foreground,
          headerTitleStyle: { fontSize: 17, fontWeight: "600" },
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen name="roadmap" options={{ title: "Roadmap" }} />
        <Stack.Screen name="rhythm" options={{ title: "Week & rotations" }} />
        <Stack.Screen name="portfolio" options={{ title: "Deliverables" }} />
        <Stack.Screen name="phase/[id]" options={{ title: "Phase" }} />
        <Stack.Screen name="rotation/[id]" options={{ title: "The plan" }} />
        <Stack.Screen name="materials" options={{ title: "Materials" }} />
        <Stack.Screen name="notes" options={{ title: "Notes" }} />
        <Stack.Screen name="search" options={{ title: "Search" }} />
        <Stack.Screen name="insights" options={{ title: "History" }} />
        <Stack.Screen name="timer" options={{ title: "Focus" }} />

        <Stack.Screen name="tracks" options={{ title: "Your tracks", presentation: "modal" }} />
        <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
        <Stack.Screen name="account" options={{ title: "Account", presentation: "modal" }} />
      </Stack>
    </>
  );
}
