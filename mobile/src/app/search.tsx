// Search, run by the database rather than the phone.
//
// The text index lives on the server, so this screen is a thin client over
// /api/search — the same endpoint the website's Search & insights uses, scoped
// to the signed-in account by a compound index that starts with the user id.
// Searching a phone's whole history locally would mean shipping every track and
// note into memory to scan them; asking a database that already has an index
// for it is both faster and the reason the index exists.
//
// It needs an account, and says so rather than silently returning nothing.

import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { SearchResult } from "@shared/apiTypes";
import { authorized } from "../auth/session";
import { searchLocally, type LocalHit } from "../search/localSearch";
import { loadNotes } from "../storage/db";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { Refreshable } from "../components/Refreshable";

export default function SearchScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [state, setState] = useState<"idle" | "searching" | "signed-out" | "offline" | "failed">("idle");
  // What the phone can answer by itself, shown immediately and replaced by the
  // server's better answer only if one arrives.
  const [local, setLocal] = useState<LocalHit[]>([]);
  const { workspace } = useWorkspace();

  const run = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setState("searching");
    setLocal(searchLocally(workspace, await loadNotes(), q));
    try {
      const response = await authorized(`/api/search?q=${encodeURIComponent(q)}`);
      if (response.status === 401) return setState("signed-out");
      if (!response.ok) return setState("failed");
      setResult((await response.json()) as SearchResult);
      setState("idle");
    } catch {
      setState("offline");
    }
  }, [query, workspace]);

  const nothing = result && result.tracks.length === 0 && result.notes.length === 0;

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void run()}
          placeholder="Search tracks, materials and notes"
          placeholderTextColor={palette.subtleForeground}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.input}
          accessibilityLabel="Search"
        />
        <Pressable accessibilityRole="button" onPress={() => void run()} style={styles.button}>
          <Text style={styles.buttonLabel}>Go</Text>
        </Pressable>
      </View>

      {state === "searching" && <ActivityIndicator color={palette.accent} style={{ marginTop: SPACING.lg }} />}
      {state === "signed-out" && (
        <Text style={styles.muted}>
          Showing what is on this phone. Signing in searches every track on the account, including
          archived ones.
        </Text>
      )}
      {state === "offline" && (
        <Text style={styles.muted}>
          No connection — showing what is on this phone. The account&apos;s full history needs the
          server.
        </Text>
      )}
      {state === "failed" && (
        <Text style={styles.muted}>The server search didn&apos;t work; this phone&apos;s results are below.</Text>
      )}
      {nothing && local.length === 0 && state === "idle" && (
        <Text style={styles.muted}>Nothing matched.</Text>
      )}

      {/* On-device results, shown whenever the server has not answered with
          something better. */}
      {state !== "idle" && local.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>On this phone</Text>
          {local.map((hit, index) => (
            <Text key={`${hit.kind}-${index}`} style={styles.line}>
              · {hit.title}
              {hit.context ? ` — ${hit.context}` : ""}
            </Text>
          ))}
        </View>
      )}

      {result?.tracks.map((hit) => (
        <View key={hit.trackId} style={styles.card}>
          <Text style={styles.cardTitle}>{hit.name}</Text>
          {hit.materials.slice(0, 4).map((m) => (
            <Text key={m.id} style={styles.line}>
              · {m.title}
              {m.author ? ` — ${m.author}` : ""}
            </Text>
          ))}
          {hit.phases.slice(0, 3).map((p) => (
            <Text key={p.id} style={styles.line}>
              · Phase {p.id}: {p.title}
            </Text>
          ))}
        </View>
      ))}

      {result?.notes.map((hit) => (
        <View key={hit.noteId} style={styles.card}>
          <Text style={styles.cardTitle}>{hit.about}</Text>
          <Text style={styles.kind}>{hit.kind === "material" ? "material note" : hit.kind === "todo" ? "to-do" : "notepad"}</Text>
          <Text style={styles.line}>{hit.snippet}</Text>
        </View>
      ))}
    </Refreshable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    searchRow: { flexDirection: "row", gap: SPACING.sm },
    input: {
      flex: 1,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      color: palette.foreground,
      ...TYPE.subhead,
    },
    button: {
      justifyContent: "center",
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.control,
      backgroundColor: palette.accent,
    },
    buttonLabel: { color: "#04121c", ...TYPE.subhead, fontWeight: "700" },
    card: {
      gap: 3,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    cardTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    kind: { color: palette.subtleForeground, ...TYPE.eyebrow, letterSpacing: 0.8 },
    line: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
  });
}
