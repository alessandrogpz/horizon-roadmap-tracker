import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WorkspaceProvider } from "../workspace/WorkspaceProvider";
import { DARK, LIGHT } from "../theme";

// The root of the app. Everything below it can assume the workspace has been
// read from SQLite, and that the palette matches the website's.

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = scheme === "light" ? LIGHT : DARK;

  return (
    <SafeAreaProvider>
      <WorkspaceProvider>
        <StatusBar style={scheme === "light" ? "dark" : "light"} />
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
          <Stack.Screen name="account" options={{ title: "Account", presentation: "modal" }} />
        </Stack>
      </WorkspaceProvider>
    </SafeAreaProvider>
  );
}
