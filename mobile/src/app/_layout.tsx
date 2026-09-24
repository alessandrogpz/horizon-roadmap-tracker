import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WorkspaceProvider } from "../workspace/WorkspaceProvider";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";

// The root of the app. Everything below it can assume the workspace has been
// read from SQLite, and that the palette matches the website's.

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <WorkspaceProvider>
          <Screens />
        </WorkspaceProvider>
      </SafeAreaProvider>
    </ThemeProvider>
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
          <Stack.Screen name="index" options={{ title: "Today" }} />
          <Stack.Screen name="tracks" options={{ title: "Your tracks", presentation: "modal" }} />
          <Stack.Screen name="materials" options={{ title: "Materials" }} />
          <Stack.Screen name="streak" options={{ title: "Consistency" }} />
          <Stack.Screen name="phases" options={{ title: "Phases" }} />
          <Stack.Screen name="phase/[id]" options={{ title: "Phase" }} />
          <Stack.Screen name="notes" options={{ title: "Notes" }} />
          <Stack.Screen name="search" options={{ title: "Search" }} />
          <Stack.Screen name="timer" options={{ title: "Focus" }} />
          <Stack.Screen name="insights" options={{ title: "History" }} />
          <Stack.Screen name="rhythm" options={{ title: "Week & rotations" }} />
          <Stack.Screen name="roadmap" options={{ title: "Roadmap" }} />
          <Stack.Screen name="rotation/[id]" options={{ title: "The plan" }} />
          <Stack.Screen name="portfolio" options={{ title: "Deliverables" }} />
          <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
          <Stack.Screen name="account" options={{ title: "Account", presentation: "modal" }} />
      </Stack>
    </>
  );
}
