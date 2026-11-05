// My Space, across every track: where all of it stands.
//
// The same job the single-track version does — answer "where does this stand"
// without being asked anything — with every track folded in. The numbers
// first, then the lists, in the order they are most often wanted.
//
// Nothing here edits. Tapping a phase, a deliverable's track or a roadmap
// opens the track it belongs to, which is the only way any of it changes.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatDayMonthYear } from "@shared/dates";
import { parseTodos, todoNoteId, type TodoItem } from "@shared/quickNotes";
import {
  masterDeliverables,
  masterMaterials,
  masterPhases,
  masterProgress,
  masterRoadmaps,
  masterStreak,
} from "@shared/masterTrack";
import { loadNotes } from "../storage/db";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Refreshable } from "../components/Refreshable";
import { Ring } from "../components/Ring";
import { usePalette } from "../theme/ThemeProvider";
import { NothingSelected, ReadOnlyBand, TrackChip, TrackPicker } from "./MasterChrome";
import { makeMasterStyles } from "./styles";
import { useMasterSources } from "./useMasterSources";
import { Tappable } from "../components/Tappable";

export function MasterSpace() {
  const palette = usePalette();
  const styles = useMemo(() => makeMasterStyles(palette), [palette]);
  const { tracks, sources, today } = useMasterSources();
  const { switchTrack } = useWorkspace();

  const streak = useMemo(() => masterStreak(sources, today), [sources, today]);
  const progress = useMemo(() => masterProgress(sources), [sources]);
  const phases = useMemo(() => masterPhases(sources).filter((p) => p.state !== "done"), [sources]);
  const deliverables = useMemo(() => masterDeliverables(sources), [sources]);
  const materials = useMemo(() => masterMaterials(sources), [sources]);
  const roadmaps = useMemo(() => masterRoadmaps(sources), [sources]);

  const open = useCallback(
    (trackId: string) => {
      switchTrack(trackId);
      router.navigate("/");
    },
    [switchTrack]
  );

  /** Everything still on your plate. The one thing here that has to be
   *  fetched: a to-do list is a note rather than a field on the track. */
  const [todos, setTodos] = useState<{ name: string; colour: string; items: TodoItem[] }[]>([]);
  const sourceIds = sources.map((track) => track.meta.id).join("|");
  useEffect(() => {
    let cancelled = false;
    void loadNotes().then((notes) => {
      if (cancelled) return;
      const byId = new Map(notes.map((note) => [note.id, note.content]));
      setTodos(
        sources
          .map((track) => ({
            name: track.meta.name,
            colour: track.meta.color || palette.accent,
            items: parseTodos(byId.get(todoNoteId(track.meta.id)) ?? "").filter((item) => !item.done),
          }))
          .filter((entry) => entry.items.length > 0)
      );
    });
    return () => {
      cancelled = true;
    };
    // `sources` is rebuilt every render; its ids are what decide what to read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceIds, palette.accent]);

  const pace =
    progress.paceDelta >= 1
      ? `${Math.round(progress.paceDelta)}% ahead`
      : progress.paceDelta <= -1
        ? `${Math.round(-progress.paceDelta)}% behind`
        : "level with the plan";

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
      <ReadOnlyBand>
        Read only. Everything here comes from your tracks — open one to change it.
      </ReadOnlyBand>
      <TrackPicker tracks={tracks} />

      {sources.length === 0 ? (
        <NothingSelected />
      ) : (
        <>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Streak</Text>
              <Text style={styles.tileValue}>{streak.current}</Text>
              <Text style={styles.muted}>day{streak.current === 1 ? "" : "s"} running</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Across all of it</Text>
              <View style={styles.tileRow}>
                <Ring pct={progress.timePct} size={34} stroke={4} tint={palette.accent} />
                <View style={styles.tileRowText}>
                  <Text style={styles.tileValue}>{progress.count}</Text>
                  <Text style={styles.muted}>
                    track{progress.count === 1 ? "" : "s"} · {progress.totalDays} days
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Active days</Text>
              <Text style={styles.tileValue}>{streak.activeDays}</Text>
              <Text style={styles.muted}>{streak.activeLast30} in the last 30</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Work done</Text>
              {/* Weighted by how long each goal is: a ninety-day track at half
                  way and a three-year one at half way are not the same amount
                  of work, and a plain mean would say they were. */}
              <Text style={styles.tileValue}>{Math.round(progress.workPct)}%</Text>
              <Text style={styles.muted}>{pace}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>What is running, and what is next</Text>
          {phases.length === 0 && <Text style={styles.muted}>No phases ahead on the selected tracks.</Text>}
          {phases.map((window) => (
            <Tappable
              key={`${window.track.id}-${window.phase.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${window.track.name}: ${window.phase.title}. Opens the track.`}
              onPress={() => open(window.track.id)}
              style={[styles.row, { borderLeftColor: window.track.color, borderLeftWidth: 3 }]}
            >
              <View style={styles.rowText}>
                <View style={styles.rowHead}>
                  <TrackChip name={window.track.name} colour={window.track.color} />
                  {window.state === "current" && <Text style={[styles.now, { color: palette.accent }]}>NOW</Text>}
                </View>
                <Text style={styles.rowTitle}>{window.phase.title}</Text>
                <Text style={styles.footnote}>
                  {formatDayMonthYear(window.startDate)}
                  {window.endDate ? ` → ${formatDayMonthYear(window.endDate)}` : " → no deadline"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={palette.subtleForeground} />
            </Tappable>
          ))}

          <Text style={styles.sectionTitle}>
            Deliverables
            {deliverables.length > 0
              ? ` · ${deliverables.filter((d) => d.item.completed).length}/${deliverables.length}`
              : ""}
          </Text>
          {deliverables.length === 0 && <Text style={styles.muted}>Nothing to deliver on the selected tracks.</Text>}
          {deliverables.map(({ track, item }) => (
            <View key={`${track.id}-${item.id}`} style={styles.row}>
              <View
                style={[
                  styles.box,
                  item.completed
                    ? { backgroundColor: track.color, borderColor: track.color }
                    : { borderColor: palette.cardBorder },
                ]}
              />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, item.completed && styles.struck]} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              <TrackChip name={track.name} colour={track.color} />
            </View>
          ))}

          <Text style={styles.sectionTitle}>Materials{materials.length > 0 ? ` · ${materials.length}` : ""}</Text>
          {materials.length === 0 && <Text style={styles.muted}>No materials on the selected tracks.</Text>}
          {materials.map(({ track, item }) => (
            <View key={`${track.id}-${item.id}`} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {Boolean(item.status) && <Text style={styles.footnote}>{item.status}</Text>}
              </View>
              <TrackChip name={track.name} colour={track.color} />
            </View>
          ))}

          <Text style={styles.sectionTitle}>
            To-do{todos.length > 0 ? ` · ${todos.reduce((n, entry) => n + entry.items.length, 0)}` : ""}
          </Text>
          {todos.length === 0 && <Text style={styles.muted}>Nothing left on the selected tracks.</Text>}
          {todos.flatMap((entry) =>
            entry.items.map((item, index) => (
              <View key={`${entry.name}-${index}`} style={styles.row}>
                <View style={[styles.box, { borderColor: palette.cardBorder }]} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.text}
                  </Text>
                </View>
                <TrackChip name={entry.name} colour={entry.colour} />
              </View>
            ))
          )}

          {roadmaps.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Roadmaps · {roadmaps.length}</Text>
              {roadmaps.map(({ track }) => (
                <Tappable
                  key={track.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${track.name}'s roadmap. Opens the track.`}
                  onPress={() => open(track.id)}
                  style={[styles.row, { borderLeftColor: track.color, borderLeftWidth: 3 }]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{track.name}</Text>
                    <Text style={styles.footnote}>Opens the track, where it can be read and edited</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={palette.subtleForeground} />
                </Tappable>
              ))}
            </>
          )}
        </>
      )}
    </Refreshable>
  );
}
