// Materials: the books, courses and papers a track is made of, and how far
// through each one you are.
//
// This is the screen that earns the app a place on a phone. The books are
// physically next to you when you read them, so moving a bookmark forward or
// marking one finished happens there, not at a desk — and the streak follows,
// because finishing a material is a completion like any other (`setMaterialStatus`
// in the shared core decides that, not this screen).

import { useCallback, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from "react-native";
import type { Material } from "@shared/types";
import { MATERIAL_STATUSES } from "@shared/materialOptions";
import { setMaterialStatus, updateMaterial } from "@shared/trackActions";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { DARK, LIGHT, RADIUS, SPACING, type Palette } from "../theme";

export default function MaterialsScreen() {
  const { track, today, editTrack } = useWorkspace();
  const palette = useColorScheme() === "light" ? LIGHT : DARK;
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [open, setOpen] = useState<string | null>(null);

  const materials = (track?.materials ?? []).filter((m) => !m.archived);

  const setStatus = useCallback(
    (id: string, status: string) => editTrack((t) => setMaterialStatus(t, id, status, today)),
    [editTrack, today]
  );

  const setPage = useCallback(
    (id: string, currentPage: number) => editTrack((t) => updateMaterial(t, id, { currentPage })),
    [editTrack]
  );

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>No track open.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {materials.map((material) => (
        <MaterialCard
          key={material.id}
          material={material}
          expanded={open === material.id}
          onToggle={() => setOpen(open === material.id ? null : material.id)}
          onStatus={(status) => setStatus(material.id, status)}
          onPage={(page) => setPage(material.id, page)}
          styles={styles}
          palette={palette}
        />
      ))}

      {materials.length === 0 && (
        <Text style={styles.muted}>
          No materials on this track yet. Add them in Horizon on the web, and they appear here.
        </Text>
      )}
    </ScrollView>
  );
}

function MaterialCard({
  material,
  expanded,
  onToggle,
  onStatus,
  onPage,
  styles,
  palette,
}: {
  material: Material;
  expanded: boolean;
  onToggle: () => void;
  onStatus: (status: string) => void;
  onPage: (page: number) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [draftPage, setDraftPage] = useState(String(material.currentPage ?? 0));

  const total = material.totalPages ?? 0;
  const current = material.currentPage ?? 0;
  const fraction = total > 0 ? Math.min(1, current / total) : 0;
  const statusColour =
    material.status === "Completed" ? palette.success : material.status === "In Progress" ? palette.accent : palette.subtleForeground;

  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} accessibilityRole="button" style={styles.cardHead}>
        <View style={styles.cardText}>
          <Text style={styles.title}>{material.title}</Text>
          <Text style={styles.muted}>
            {[material.author, material.status].filter(Boolean).join(" · ")}
            {total > 0 ? ` · ${current}/${total}` : ""}
          </Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: statusColour }]} />
      </Pressable>

      {total > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${fraction * 100}%`, backgroundColor: statusColour }]} />
        </View>
      )}

      {expanded && (
        <View style={styles.details}>
          <View style={styles.statusRow}>
            {MATERIAL_STATUSES.map((status) => (
              <Pressable
                key={status}
                accessibilityRole="button"
                accessibilityState={{ selected: material.status === status }}
                onPress={() => onStatus(status)}
                style={[styles.statusButton, material.status === status && { borderColor: palette.accent }]}
              >
                <Text style={[styles.statusLabel, material.status === status && { color: palette.foreground }]}>{status}</Text>
              </Pressable>
            ))}
          </View>

          {total > 0 && (
            <View style={styles.pageRow}>
              <Text style={styles.muted}>Page</Text>
              <TextInput
                value={draftPage}
                onChangeText={setDraftPage}
                onEndEditing={() => {
                  // Clamped rather than rejected: a typo shouldn't cost the
                  // bookmark, and a page past the end usually means the total
                  // was wrong, not the reader.
                  const parsed = Number.parseInt(draftPage, 10);
                  const page = Number.isFinite(parsed) ? Math.max(0, Math.min(total, parsed)) : current;
                  setDraftPage(String(page));
                  if (page !== current) onPage(page);
                }}
                keyboardType="number-pad"
                returnKeyType="done"
                style={styles.pageInput}
                accessibilityLabel={`Current page of ${material.title}`}
              />
              <Text style={styles.muted}>of {total}</Text>
            </View>
          )}

          {material.link ? (
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(material.link!)} style={styles.linkButton}>
              <Text style={styles.linkLabel}>Open link</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    centered: { alignItems: "center", justifyContent: "center" },
    card: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    cardText: { flex: 1, gap: 2 },
    title: { color: palette.foreground, fontSize: 15, fontWeight: "600" },
    muted: { color: palette.mutedForeground, fontSize: 13 },
    statusDot: { width: 9, height: 9, borderRadius: 5 },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: palette.surfaceMuted, overflow: "hidden" },
    progressFill: { height: 4, borderRadius: 2 },
    details: { gap: SPACING.md, paddingTop: SPACING.xs },
    statusRow: { flexDirection: "row", gap: SPACING.sm },
    statusButton: {
      flex: 1,
      alignItems: "center",
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    statusLabel: { color: palette.mutedForeground, fontSize: 12, fontWeight: "600" },
    pageRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    pageInput: {
      minWidth: 72,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
      color: palette.foreground,
      fontSize: 15,
      textAlign: "center",
    },
    linkButton: {
      alignItems: "center",
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    linkLabel: { color: palette.accent, fontSize: 14, fontWeight: "600" },
  });
}
