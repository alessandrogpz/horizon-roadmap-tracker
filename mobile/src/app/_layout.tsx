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

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useWorkspace, WorkspaceProvider } from "../workspace/WorkspaceProvider";
import { MasterModeProvider } from "../master/MasterMode";
import { SyncProvider } from "../sync/SyncProvider";
import { TimerProvider } from "../timer/TimerProvider";
import { UndoProvider } from "../components/UndoBar";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";
import { TYPE } from "../theme";

/** Tells the theme which track is open, so the accent follows it. */
function TrackAccent() {
  const { track } = useWorkspace();
  const { setAccent } = useTheme();
  const colour = track?.meta.color;

  useEffect(() => {
    setAccent(colour || null);
  }, [colour, setAccent]);

  return null;
}

export default function RootLayout() {
  return (
    // Gesture handler needs a root of its own for `GestureDetector` to receive
    // touches at all — without it the panel drag in My Space is inert on
    // Android, silently and with no error.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <WorkspaceProvider>
            {/* Paints the app in the open track's colour. Inside the
                workspace because that is where the track is; above the
                screens because all of them use it. */}
            <TrackAccent />
            {/* One track or all of them. A mode rather than a screen: the
                four tabs are the same tabs either way. Above the screens
                because every one of them asks. */}
            <MasterModeProvider>
            {/* Inside the workspace: a sync writes the merged workspace
                straight back into it. */}
            <SyncProvider>
              {/* Above the screens so leaving the timer screen does not stop
                  the timer. */}
              <TimerProvider>
                {/* Outermost of the three so the bar floats above every
                    screen, and innermost of the data providers so an undo can
                    put a workspace back. */}
                <UndoProvider>
                  <Screens />
                </UndoProvider>
              </TimerProvider>
            </SyncProvider>
            </MasterModeProvider>
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
          headerTitleStyle: { ...TYPE.heading, fontWeight: "600" },
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
        <Stack.Screen name="timer" options={{ title: "Timer" }} />
        <Stack.Screen name="steps" options={{ title: "Steps" }} />
        <Stack.Screen name="gym" options={{ title: "Workout" }} />

        <Stack.Screen name="tracks" options={{ title: "Your tracks", presentation: "modal" }} />
        <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
        <Stack.Screen name="account" options={{ title: "Account", presentation: "modal" }} />
      </Stack>
    </>
  );
}
