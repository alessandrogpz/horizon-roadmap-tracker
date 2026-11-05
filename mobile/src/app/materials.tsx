// Materials: the books, courses and papers a track is made of, and how far
// through each one you are.
//
// This is the screen that earns the app a place on a phone. The books are
// physically next to you when you read them, so moving a bookmark forward or
// marking one finished happens there, not at a desk — and the streak follows,
// because finishing a material is a completion like any other (`setMaterialStatus`
// in the shared core decides that, not this screen).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Material } from "@shared/types";
import { categoriesFor, MATERIAL_STATUSES, MATERIAL_TYPES } from "@shared/materialOptions";
import { addMaterial, removeMaterial, setMaterialArchived, setMaterialStatus, updateMaterial } from "@shared/trackActions";
import { loadNotes, saveNote } from "../storage/db";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { SwipeRow } from "../components/SwipeRow";
import { useUndo } from "../components/UndoBar";
import { EditHeader, useEditMode } from "../components/EditToggle";
import { EmptyState } from "../components/EmptyState";
import { Refreshable } from "../components/Refreshable";
import { SubNav } from "../components/SubNav";
import { Tappable } from "../components/Tappable";

export default function MaterialsScreen() {
  const { workspace, track, today, editTrack, restoreWorkspace } = useWorkspace();
  const palette = usePalette();
  const { editing, setEditing } = useEditMode();
  const { offer } = useUndo();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [open, setOpen] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const all = track?.materials ?? [];
  const materials = all.filter((m) => !m.archived);
  // Archived material is history, not today's reading list, so the group
  // starts folded — the same call the website makes.
  const archived = all.filter((m) => m.archived);

  const setStatus = useCallback(
    (id: string, status: string) => editTrack((t) => setMaterialStatus(t, id, status, today)),
    [editTrack, today]
  );

  const setPage = useCallback(
    (id: string, currentPage: number) => editTrack((t) => updateMaterial(t, id, { currentPage })),
    [editTrack]
  );

  const setTotal = useCallback(
    (id: string, totalPages: number) => editTrack((t) => updateMaterial(t, id, { totalPages })),
    [editTrack]
  );

  const remove = useCallback((id: string) => editTrack((t) => removeMaterial(t, id)), [editTrack]);

  const setArchived = useCallback(
    (id: string, value: boolean) => editTrack((t) => setMaterialArchived(t, id, value)),
    [editTrack]
  );

  const add = useCallback(
    (fields: { title: string; category: string; type: string }) => {
      editTrack((t) =>
        addMaterial(t, {
          ...fields,
          // The rest of a material is filled in as it is used, not asked for up
          // front: a phone is where you add "that book someone just mentioned",
          // and a form demanding page counts is how that does not get added.
          status: "Not Started",
          currentPage: 0,
          totalPages: 0,
          currentSubject: "",
          link: "",
        })
      );
    },
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
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <EditHeader
        // The bar above already says "Materials". This says how many —
        // a heading that repeats the one above it costs a row and tells
        // you nothing you did not know a moment ago.
        title={materials.length === 1 ? "1 material" : `${materials.length} materials`}
        editing={editing}
        onChange={setEditing}
        hint="Add something, archive what is finished, or correct a page count. Marking progress works either way."
      />

      {materials.map((material) => (
        <SwipeRow
          key={material.id}
          left={{
            label: "Archive",
            icon: "archive-outline",
            colour: "#f59e0b",
            onAct: () => setArchived(material.id, true),
          }}
          right={{
            label: "Remove",
            icon: "trash-outline",
            colour: "#ef4444",
            onAct: () => {
              const previous = workspace;
              remove(material.id);
              if (previous) offer("Material removed", () => restoreWorkspace(previous));
            },
          }}
        >
        <MaterialCard
          material={material}
          expanded={open === material.id}
          editing={editing}
          onToggle={() => setOpen(open === material.id ? null : material.id)}
          onStatus={(status) => setStatus(material.id, status)}
          onPage={(page) => setPage(material.id, page)}
          onTotal={(totalPages) => setTotal(material.id, totalPages)}
          onArchive={() => setArchived(material.id, true)}
          onRemove={() => remove(material.id)}
          styles={styles}
          palette={palette}
        />
        </SwipeRow>
      ))}

      {materials.length === 0 && !editing && (
        <EmptyState
          title="Nothing on the list yet"
          hint="Books, courses, papers — whatever this track is built out of."
          action="Add a material"
          onAct={() => setEditing(true)}
        />
      )}

      {archived.length > 0 && (
        <View style={styles.card}>
          <Tappable
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchived }}
            onPress={() => setShowArchived(!showArchived)}
          >
            <Text style={styles.title}>
              Archived ({archived.length}) {showArchived ? "▾" : "▸"}
            </Text>
          </Tappable>

          {showArchived &&
            archived.map((material) => (
              <View key={material.id} style={styles.archivedRow}>
                <Text style={styles.muted}>
                  {material.title}
                  {material.status === "Completed" ? " · finished" : ""}
                </Text>
                <Tappable
                  accessibilityRole="button"
                  accessibilityLabel={`Bring back ${material.title}`}
                  onPress={() => setArchived(material.id, false)}
                >
                  <Text style={styles.linkLabel}>Bring back</Text>
                </Tappable>
              </View>
            ))}
        </View>
      )}

      {editing && (
      <AddMaterial
        categories={categoriesFor(track.materials ?? [])}
        onAdd={add}
        styles={styles}
        palette={palette}
      />
      )}
      <View style={styles.moreRow}>
        <Text style={styles.moreTitle}>More on this track</Text>
      </View>
      <SubNav
        links={[
          { href: "/notes", label: "Notes & to-dos", icon: "document-text-outline" },
          { href: "/search", label: "Search", icon: "search-outline" },
        ]}
      />

    </Refreshable>
  );
}

/** A material's notes are an ordinary note, keyed by the material's own id —
 *  the same id the website uses, so a note written on the sofa opens on the
 *  laptop. Saved after a pause rather than per keystroke, and immediately,
 *  because the process can end at any moment. */
function useMaterialNote(materialId: string, enabled: boolean) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || loaded) return;
    let cancelled = false;
    loadNotes().then((notes) => {
      if (cancelled) return;
      setContent(notes.find((n) => n.id === materialId)?.content ?? "");
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, loaded, materialId]);

  const onChange = useCallback(
    (text: string) => {
      setContent(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveNote({ id: materialId, content: text, updatedAt: Date.now() }), 600);
    },
    [materialId]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { content, onChange };
}

function MaterialCard({
  material,
  expanded,
  editing,
  onToggle,
  onStatus,
  onPage,
  onTotal,
  onArchive,
  onRemove,
  styles,
  palette,
}: {
  material: Material;
  expanded: boolean;
  /** The screen's edit mode. Ticking progress is always allowed; changing what
   *  a material *is* — its page count, whether it is archived, whether it
   *  exists — is not. */
  editing: boolean;
  onToggle: () => void;
  onStatus: (status: string) => void;
  onPage: (page: number) => void;
  onTotal: (total: number) => void;
  onArchive: () => void;
  onRemove: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [draftPage, setDraftPage] = useState(String(material.currentPage ?? 0));
  const [draftTotal, setDraftTotal] = useState(String(material.totalPages ?? 0));
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const note = useMaterialNote(material.id, expanded);

  const total = material.totalPages ?? 0;
  const current = material.currentPage ?? 0;
  const fraction = total > 0 ? Math.min(1, current / total) : 0;
  const statusColour =
    material.status === "Completed" ? palette.success : material.status === "In Progress" ? palette.accent : palette.subtleForeground;

  return (
    <View style={styles.card}>
      <Tappable onPress={onToggle} accessibilityRole="button" style={styles.cardHead}>
        <View style={styles.cardText}>
          <Text style={styles.title}>{material.title}</Text>
          <Text style={styles.muted}>
            {[material.author, material.status].filter(Boolean).join(" · ")}
            {total > 0 ? ` · ${current}/${total}` : ""}
          </Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: statusColour }]} />
      </Tappable>

      {total > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${fraction * 100}%`, backgroundColor: statusColour }]} />
        </View>
      )}

      {expanded && (
        <View style={styles.details}>
          <View style={styles.statusRow}>
            {MATERIAL_STATUSES.map((status) => (
              <Tappable
                key={status}
                accessibilityRole="button"
                accessibilityState={{ selected: material.status === status }}
                onPress={() => onStatus(status)}
                style={[styles.statusButton, styles.evenly, material.status === status && { borderColor: palette.accent }]}
              >
                <Text style={[styles.statusLabel, material.status === status && { color: palette.foreground }]}>{status}</Text>
              </Tappable>
            ))}
          </View>

          {editing && (
          <View style={styles.pageRow}>
            <Text style={styles.muted}>Pages in total</Text>
            <TextInput
              value={draftTotal}
              onChangeText={setDraftTotal}
              onEndEditing={() => {
                // Without a total there is nothing to be a fraction of, so the
                // progress bar and the page field only appear once one is set.
                const parsed = Number.parseInt(draftTotal, 10);
                const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : total;
                setDraftTotal(String(next));
                if (next !== total) onTotal(next);
              }}
              keyboardType="number-pad"
              returnKeyType="done"
              style={styles.pageInput}
              accessibilityLabel={`Total pages of ${material.title}`}
            />
            <Text style={styles.muted}>{total > 0 ? "" : "— leave 0 if it has none"}</Text>
          </View>
          )}

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

          <TextInput
            value={note.content}
            onChangeText={note.onChange}
            placeholder="Notes on this material…"
            placeholderTextColor={palette.subtleForeground}
            multiline
            textAlignVertical="top"
            style={styles.note}
            accessibilityLabel={`Notes on ${material.title}`}
          />

          {editing && (
            <>
              <Tappable accessibilityRole="button" onPress={onArchive} style={styles.linkButton}>
                <Text style={styles.linkLabel}>Archive it</Text>
              </Tappable>
              <Text style={styles.footnote}>
                Archiving keeps the progress, the notes and the history, and takes it off the list.
                Removing does not.
              </Text>

              <Tappable
                accessibilityRole="button"
                onPress={() => (confirmingRemove ? onRemove() : setConfirmingRemove(true))}
                style={styles.linkButton}
              >
                <Text style={[styles.linkLabel, confirmingRemove && { color: palette.danger }]}>
                  {confirmingRemove ? "Tap again to remove it" : "Remove this material"}
                </Text>
              </Tappable>
            </>
          )}

          {material.link ? (
            <Tappable accessibilityRole="link" onPress={() => void Linking.openURL(material.link!)} style={styles.linkButton}>
              <Text style={styles.linkLabel}>Open link</Text>
            </Tappable>
          ) : null}
        </View>
      )}
    </View>
  );
}

/**
 * Adding a material from the phone.
 *
 * Three fields, not the website's ten. A phone is where "that book someone
 * just mentioned" gets written down, and a form asking for page counts, links
 * and a subject before it will accept anything is how that does not get
 * written down. Everything else is filled in later, on the card, by which
 * point the material is at least in the list.
 */
function AddMaterial({
  categories,
  onAdd,
  styles,
  palette,
}: {
  categories: string[];
  onAdd: (fields: { title: string; category: string; type: string }) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Other");
  const [type, setType] = useState<string>(MATERIAL_TYPES[0]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Add a material</Text>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={palette.subtleForeground}
        style={styles.pageInput}
        accessibilityLabel="Material title"
      />

      <Text style={styles.muted}>What kind</Text>
      <View style={styles.statusRow}>
        {MATERIAL_TYPES.map((option) => (
          <Tappable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: type === option }}
            onPress={() => setType(option)}
            style={[styles.statusButton, type === option && { borderColor: palette.accent }]}
          >
            <Text style={[styles.statusLabel, type === option && { color: palette.foreground }]}>{option}</Text>
          </Tappable>
        ))}
      </View>

      <Text style={styles.muted}>Filed under</Text>
      <View style={styles.statusRow}>
        {categories.map((option) => (
          <Tappable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: category === option }}
            onPress={() => setCategory(option)}
            style={[styles.statusButton, category === option && { borderColor: palette.accent }]}
          >
            <Text style={[styles.statusLabel, category === option && { color: palette.foreground }]}>{option}</Text>
          </Tappable>
        ))}
      </View>

      <Tappable
        accessibilityRole="button"
        disabled={!title.trim()}
        onPress={() => {
          onAdd({ title: title.trim(), category, type });
          setTitle("");
        }}
        style={styles.linkButton}
      >
        <Text style={[styles.linkLabel, !title.trim() && { color: palette.subtleForeground }]}>Add it</Text>
      </Tappable>
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
    title: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    muted: { color: palette.mutedForeground, ...TYPE.label},
    moreRow: { marginTop: SPACING.xl },
    moreTitle: {
      color: palette.subtleForeground,
      ...TYPE.marker,
      fontWeight: "700",
      letterSpacing: 1.2,
    },
    footnote: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 16 },
    archivedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md, paddingTop: SPACING.sm },
    statusDot: { width: 9, height: 9, borderRadius: 5 },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: palette.surfaceMuted, overflow: "hidden" },
    progressFill: { height: 4, borderRadius: 2 },
    details: { gap: SPACING.md, paddingTop: SPACING.xs },
    statusRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
    // A chip sized by its own label. Not `flex: 1`: that is right for the
    // three status buttons, which should divide a row evenly, and wrong for
    // twelve category names, which squeeze to nothing and overlap instead of
    // wrapping onto a second line.
    statusButton: {
      flexShrink: 0,
      alignItems: "center",
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    evenly: { flex: 1 },
    statusLabel: { color: palette.mutedForeground, ...TYPE.caption, fontWeight: "600" },
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
      ...TYPE.subhead,
      textAlign: "center",
    },
    note: {
      minHeight: 120,
      padding: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
      color: palette.foreground,
      ...TYPE.body,
      lineHeight: 20,
    },
    linkButton: {
      alignItems: "center",
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    linkLabel: { color: palette.accent, ...TYPE.body, fontWeight: "600" },
  });
}
