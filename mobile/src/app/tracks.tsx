// Switching between tracks. One goal per track is the idea the whole product
// rests on, so this is the second screen rather than a setting.
//
// The list can also be put in an order, with the same gesture the panels on My
// Space use and for the same reason: holding a card picks it up, every card
// folds down to its own header so the whole list fits under one thumb, the held
// one comes to the finger and the rest step aside as it passes. Letting go
// drops it where it is — and *does not* open it, which is the one difference
// from the panels. Holding something to move it and finding you have navigated
// away is the worst outcome this screen has.
//
// The order is kept on the track (`meta.order`) rather than on the device, so
// it syncs. That is the opposite of the panel order, which is per-device
// because the phone has one column and the website has two — but "which of my
// tracks comes first" is the same question everywhere.

import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  type AnimatedRef,
  type SharedValue,
  measure,
  runOnJS,
  useAnimatedRef,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { orderedTracks } from "@shared/selectors";
import { seedTrackFromTemplate, TEMPLATE_LIST } from "@shared/templates";
import { hiddenPanelsFor, trackKind, type TrackKind } from "@shared/trackKinds";
import { PANELS } from "../panels/layout";
import { trackTotalDays, updateTrackIdentity } from "@shared/trackActions";
import { dateForDay, dayForDate, formatDateYMD, isDateStr, todayYMD } from "@shared/dates";
import { restScheduleOf, trackStreak } from "@shared/restDays";
import type { TrackState } from "@shared/types";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { useMasterMode } from "../master/MasterMode";
import { RADIUS, SPACING, TYPE, withAlpha, type Palette } from "../theme";
import { usePalette, useInk } from "../theme/ThemeProvider";
import { SwipeRow } from "../components/SwipeRow";
import { settle, tap } from "../feedback/haptics";
import { ConfirmSheet, type Confirmation } from "../components/ConfirmSheet";
import { DatePicker, describeDate } from "../components/DatePicker";
import { getSettings } from "@shared/settings";
import { streakCalendar } from "@shared/stats";
import { firstFreeColor, TRACK_COLORS } from "@shared/trackColors";
import { TrackHeatmap } from "../components/TrackHeatmap";
import { Refreshable } from "../components/Refreshable";
import { Tappable } from "../components/Tappable";

/** A card folded down to its header: a dot, a name, a line about its streak. */
const ROW = 62;
/** The gap `styles.content` puts between cards, needed as a number because the
 *  drag has to do arithmetic with it. */
const GAP = SPACING.md;
const SLOT = ROW + GAP;
/** Stands in for a card's open height until it has been measured: tall enough
 *  to constrain nothing. */
const UNMEASURED = 10000;

export default function TracksScreen() {
  const { workspace, today, switchTrack, addTrack, editTrackById, reorderTracks, restoreWorkspace } = useWorkspace();
  const { master, setMaster } = useMasterMode();
  const weekStartsOn = getSettings().weekStartsOn;
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const tracks = workspace ? orderedTracks(workspace) : [];
  /** The first colour nobody has taken. Two tracks in the same colour is
   *  allowed — six colours and no cap on tracks means it has to be — but it
   *  should not be what happens by default, because telling them apart in the
   *  list is the whole point of having colours. */
  const suggestedColour = useMemo(() => firstFreeColor(tracks.map((track) => track.meta.color)), [tracks]);
  const [creating, setCreating] = useState(false);
  const [newStart, setNewStart] = useState(todayYMD);
  const [newEnd, setNewEnd] = useState("");
  const [name, setName] = useState("");
  // Chosen before the template is, because the template row is also the
  // button that creates the track — there is no step after it to ask in.
  const [newColour, setNewColour] = useState<string | null>(null);
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  // Which date field is being chosen, if any. One picker serves them all
  // rather than a modal per field.
  const [picking, setPicking] = useState<"new-start" | "new-end" | null>(null);

  /**
   * Deleting a track.
   *
   * Confirmed, and *not* also undoable. Asking and then offering to take it
   * back is two decisions for one intent — the sheet has already had the
   * conversation. Elsewhere in the app it is the other way round: no question,
   * but an undo. One or the other, chosen by whether the action is a
   * considered tap or a flick.
   *
   * Implemented as `meta.archived`, and that is not a euphemism for the sake
   * of it: the sync merge reconciles two devices by comparing records, so a
   * track removed by *absence* on this phone would simply be handed back by
   * the next sync from the account's copy. A flag is a change both sides can
   * agree on. Nothing in the app shows an archived track, so "delete" is what
   * it does from here; a true erase needs a tombstone the server understands.
   */
  const remove = useCallback(
    (id: string) => {
      const remaining = tracks.filter((other) => other.meta.id !== id);
      editTrackById(id, (current) => ({ ...current, meta: { ...current.meta, archived: true } }));
      if (workspace?.activeTrackId === id && remaining[0]) switchTrack(remaining[0].meta.id);
      setSettingsFor(null);
    },
    [editTrackById, switchTrack, tracks, workspace]
  );

  /**
   * The drag, in the same four shared values the panels use.
   *
   * `collapse` is how far through the fold everything is — 0 is the ordinary
   * list, 1 is every card reduced to its header. `columnShift` is how far the
   * whole folded list has to move so the held card's slot lands exactly where
   * the card already is, under the finger: moving the list rather than the
   * card is what keeps the two agreeing, because the card stays put and the
   * gap opens around it.
   */
  const collapse = useSharedValue(0);
  const held = useSharedValue(-1);
  const target = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const columnShift = useSharedValue(0);
  const lockedHeight = useSharedValue(0);
  /** Where every card sits, by id. Position and stepping-aside are both shared
   *  values written in the same tick, so React's index never decides where a
   *  card is — which is what stopped two of them landing on the same line for
   *  a frame after a drop. */
  const slots = useSharedValue<Record<string, number>>({});
  const listRef = useAnimatedRef<View>();
  const [dragging, setDragging] = useState(false);

  const ids = tracks.map((track) => track.meta.id);
  const idKey = ids.join("|");
  useEffect(() => {
    slots.value = Object.fromEntries(idKey.split("|").map((id, index) => [id, index]));
  }, [idKey, slots]);

  const move = useCallback(
    (from: number, to: number) => {
      const next = [...ids];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
      // The slots move with the order, not after it.
      slots.value = Object.fromEntries(next.map((id, i) => [id, i]));
      reorderTracks(next);
    },
    [ids, reorderTracks, slots]
  );

  const beginDrag = useCallback(() => {
    setDragging(true);
    tap();
  }, []);

  const endDrag = useCallback(
    (from: number, to: number) => {
      if (to !== from && to >= 0) {
        move(from, to);
        settle();
      }
      held.value = -1;
      target.value = -1;
      dragY.value = 0;
      // The shift deliberately stays where it is: the list's offset is
      // `columnShift * collapse`, so letting collapse fall to zero unwinds it
      // along the path it came in on and the card just dropped holds its
      // place while the others open outward from it.
      collapse.value = withTiming(0, { duration: 260 });
      setDragging(false);
    },
    [collapse, dragY, held, move, target]
  );

  /** The list's own height while a card is held, and everything that is not a
   *  card getting out of the way. Both copied from My Space, and both for the
   *  same reasons: a list that gets shorter mid-drag drags the scroll position
   *  with it, and a paragraph of explanation in the middle of a fold is just
   *  something to read by accident. */
  const column = useAnimatedStyle(() => ({
    minHeight: collapse.value > 0 ? lockedHeight.value : 0,
    transform: [{ translateY: columnShift.value * collapse.value }],
  }));
  const chrome = useAnimatedStyle(() => ({ opacity: 1 - collapse.value }));

  const chosenColour = newColour ?? suggestedColour;

  const create = useCallback(
    (templateId: string) => {
      const template = TEMPLATE_LIST.find((entry) => entry.id === templateId);
      if (!template) return;
      // The template answers the questions the website asks in its wizard:
      // a phone is the wrong place for a five-step form, and the defaults are
      // what most people accept there anyway. Everything is editable after.
      // A blank or unreadable end date means "however long the template runs",
      // which is what happened before this field existed.
      const start = isDateStr(newStart) ? newStart : todayYMD();
      const asked = isDateStr(newEnd) ? dayForDate(start, newEnd) : 0;
      const days = asked > 0 ? asked : template.defaultDurationDays;

      const seeded = seedTrackFromTemplate(template, {
        name: name.trim() || template.label,
        // The colour is the track's own from here on: its accent everywhere
        // inside it, and the ink its year of days is drawn in.
        color: chosenColour,
        startDate: start,
        phases: template.buildPhases(days),
        weekSchedule: template.defaultWeekSchedule,
        focusTypes: template.defaultFocusTypes,
      });

      // The kind only decides what the track *opens* with. Every panel stays
      // available to every track from Arrange — a fitness track that later
      // wants a roadmap is two taps away, and hiding things by kind would
      // produce the unanswerable "where did it go?".
      addTrack({
        ...seeded,
        hiddenPanels: hiddenPanelsFor(
          template.id as TrackKind,
          PANELS.map((panel) => panel.id)
        ),
      });
      setName("");
      setNewColour(null);
      setNewStart(todayYMD());
      setNewEnd("");
      setCreating(false);
      router.back();
    },
    [addTrack, chosenColour, name, newEnd, newStart]
  );

  return (
    // Scrolling is off while a card is in the hand: the page moving under a
    // drag that is itself vertical would be two answers to one gesture.
    <Refreshable style={styles.screen} contentContainerStyle={styles.content} scrollEnabled={!dragging}>
      {/* The way to the view that spans all of them, above the list rather
          than inside it: it is not a track, and a card in the row would make
          it look like one you could hold and move. Only with more than one —
          one track's all-tracks view is a worse copy of that track. */}
      {tracks.length > 1 && (
        <Animated.View style={chrome} pointerEvents={dragging ? "none" : "auto"}>
          <Tappable
            accessibilityRole="button"
            accessibilityLabel="All tracks. A read-only view of every track at once."
            onPress={() => {
              setMaster(true);
              router.navigate("/");
            }}
            style={styles.allTracks}
          >
            <Ionicons name={master ? "layers" : "layers-outline"} size={18} color={palette.accent} />
            <View style={styles.text}>
              <Text style={styles.name}>All tracks</Text>
              <Text style={styles.muted}>Every tab, every track at once · read only</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={palette.subtleForeground} />
          </Tappable>
        </Animated.View>
      )}

      <Animated.View ref={listRef} style={[styles.stack, column]}>
        {tracks.map((track, index) => (
          <DraggableTrack
            key={track.meta.id}
            track={track}
            index={index}
            count={tracks.length}
            active={track.meta.id === workspace?.activeTrackId}
            canDelete={tracks.length > 1}
            canReorder={tracks.length > 1}
            dragging={dragging}
            today={today}
            weekStartsOn={weekStartsOn}
            collapse={collapse}
            held={held}
            target={target}
            dragY={dragY}
            columnShift={columnShift}
            lockedHeight={lockedHeight}
            listRef={listRef}
            onBegin={beginDrag}
            onEndDrag={endDrag}
            onOpen={() => {
              // Choosing a track is also how you leave the all-tracks mode —
              // it is one list, and choosing from it should land you where
              // you chose rather than beside it. True of the track already
              // open, which is why this is not guarded on a change.
              setMaster(false);
              switchTrack(track.meta.id);
              router.back();
            }}
            onSettings={() => setSettingsFor(track.meta.id)}
            onDelete={() =>
              setConfirming({
                title: `Delete ${track.meta.name}?`,
                body: "Its phases, materials, notes and history go with it, on this phone and in your account.",
                verb: "Delete",
                onConfirm: () => remove(track.meta.id),
              })
            }
            styles={styles}
            palette={palette}
          />
        ))}
      </Animated.View>

      {tracks.length === 0 && <Text style={styles.muted}>No tracks yet.</Text>}

      {/* Everything that is not a track card gets out of the way while one is
          held. The list folds around the thumb, and a form or a paragraph of
          explanation sitting in the middle of it is something to press by
          accident. */}
      <Animated.View style={chrome} pointerEvents={dragging ? "none" : "auto"}>
      {tracks.length > 1 && (
        <Text style={styles.footnote}>
          Hold a track to move it up or down the list. Swipe one left for its settings, right to
          delete it.
        </Text>
      )}

      {settingsFor && (
        <TrackSettings
          key={settingsFor}
          track={workspace?.tracks[settingsFor] ?? null}
          canArchive={tracks.length > 1}
          onSave={(fields) => {
            editTrackById(settingsFor, (track) => updateTrackIdentity(track, fields));
            setSettingsFor(null);
          }}
          onArchive={() =>
            setConfirming({
              title: `Delete ${workspace?.tracks[settingsFor]?.meta.name ?? "this track"}?`,
              body: "Its phases, materials, notes and history go with it, on this phone and in your account.",
              verb: "Delete",
              onConfirm: () => remove(settingsFor),
            })
          }
          onCancel={() => setSettingsFor(null)}
          styles={styles}
          palette={palette}
        />
      )}

      {creating ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>New track</Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="What is this track called?"
            placeholderTextColor={palette.subtleForeground}
            style={styles.input}
            autoFocus
            accessibilityLabel="Track name"
          />
          <Text style={styles.fieldLabel}>Colour</Text>
          {/* Not decoration. This is the accent the whole track wears from
              here on — its buttons, its rings, its year of days — so it is
              asked for at the same moment as the name. */}
          <Swatches value={chosenColour} onPick={setNewColour} styles={styles} palette={palette} />

          <Text style={styles.fieldLabel}>Starts</Text>
          <DateField
            value={newStart}
            onPress={() => setPicking("new-start")}
            styles={styles}
            palette={palette}
          />

          <Text style={styles.fieldLabel}>Should be done by</Text>
          {/* The template used to decide this silently, so a track arrived with
              a horizon nobody had chosen and a phase timeline scaled to it. */}
          <DateField
            value={newEnd}
            empty="However long the template runs"
            onPress={() => setPicking("new-end")}
            styles={styles}
            palette={palette}
          />

          <Text style={styles.fieldLabel}>What it is about</Text>
          <Text style={styles.muted}>
            This only decides which panels the track opens with. Every panel stays available to every
            track from Arrange, so nothing is locked away by choosing here.
          </Text>
          {TEMPLATE_LIST.map((template) => (
            <Tappable key={template.id} accessibilityRole="button" style={styles.templateRow} onPress={() => create(template.id)}>
              {/* The chosen colour, not the template's — these rows are the
                  create button, and they should show what is about to be
                  made rather than what the template would have picked. */}
              <View style={[styles.dot, { backgroundColor: chosenColour }]} />
              <View style={styles.text}>
                <Text style={styles.name}>{template.label}</Text>
                <Text style={styles.muted}>{template.description}</Text>
              </View>
            </Tappable>
          ))}
          <Tappable accessibilityRole="button" style={styles.panelButton} onPress={() => setCreating(false)}>
            <Text style={styles.panelLabel}>Cancel</Text>
          </Tappable>
        </View>
      ) : (
        <Tappable accessibilityRole="button" style={styles.panelButton} onPress={() => setCreating(true)}>
          <Text style={styles.panelLabel}>New track…</Text>
        </Tappable>
      )}
      </Animated.View>

      <DatePicker
        open={picking !== null}
        title={picking === "new-end" ? "Should be done by" : "Starts on"}
        value={picking === "new-end" ? newEnd : newStart}
        earliest={picking === "new-end" ? newStart : undefined}
        onPick={(date) => (picking === "new-end" ? setNewEnd(date) : setNewStart(date))}
        onClose={() => setPicking(null)}
      />

      <ConfirmSheet confirmation={confirming} onClose={() => setConfirming(null)} />
    </Refreshable>
  );
}

/**
 * One track in the list, and the gesture that picks it up.
 *
 * A pan that only activates after the finger has been still for a moment,
 * which is what lets it share the card with everything else: a tap opens the
 * track, a sideways swipe reveals its settings or its delete, a drag scrolls
 * the page, and only a hold reaches this. Because it is a pan rather than a
 * long-press followed by a separate drag, the finger never has to lift —
 * picking up and moving are one continuous gesture, which is the difference
 * between reordering and entering a reordering mode.
 *
 * Two measurements make the fold work. `open` is what the card is when it is
 * open, taken from a plain inner view that keeps its natural size whatever the
 * animated wrapper is doing to it. `columnShift` is how far the list has to
 * move so that the held card's folded slot lands where the finger already is.
 * Without it the card collapses upward out of the hand.
 */
function DraggableTrack({
  track,
  index,
  count,
  active,
  canDelete,
  canReorder,
  dragging,
  today,
  weekStartsOn,
  collapse,
  held,
  target,
  dragY,
  columnShift,
  lockedHeight,
  listRef,
  onBegin,
  onEndDrag,
  onOpen,
  onSettings,
  onDelete,
  styles,
  palette,
}: {
  track: TrackState;
  index: number;
  count: number;
  active: boolean;
  canDelete: boolean;
  canReorder: boolean;
  dragging: boolean;
  today: string;
  weekStartsOn: "sun" | "mon";
  collapse: SharedValue<number>;
  held: SharedValue<number>;
  target: SharedValue<number>;
  dragY: SharedValue<number>;
  columnShift: SharedValue<number>;
  lockedHeight: SharedValue<number>;
  listRef: AnimatedRef<View>;
  onBegin: () => void;
  onEndDrag: (from: number, to: number) => void;
  onOpen: () => void;
  onSettings: () => void;
  onDelete: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [open, setOpen] = useState<number | null>(null);
  /** This card's own step out of the way, animated so the list parts rather
   *  than snaps. */
  const shift = useSharedValue(0);
  /** Set by onEnd so onFinalize can tell a finished drag from a cancelled one
   *  — a call arriving mid-drag must not leave the list folded. */
  const ended = useSharedValue(false);
  const streak = trackStreak(track, today);
  const colour = track.meta.color || palette.accent;
  const ink = useInk();

  useAnimatedReaction(
    () => ({ h: held.value, t: target.value }),
    ({ h, t }) => {
      if (h < 0 || h === index || t < 0) {
        shift.value = 0;
        return;
      }
      const step = index > h && index <= t ? -SLOT : index < h && index >= t ? SLOT : 0;
      shift.value = withTiming(step, { duration: 160 });
    },
    [index]
  );

  /**
   * Opening the track, as a gesture rather than a plain press.
   *
   * A tap has to prove it is one: `maxDistance` is the whole point, because a
   * finger that travelled the length of the screen scrolling and then lifted
   * over a card is not pressing it, however much the up-and-down of it looks
   * like a press to something that only counts touches.
   */
  const openTap = Gesture.Tap()
    .maxDistance(10)
    .maxDuration(400)
    .onEnd((_event, success) => {
      if (success) runOnJS(onOpen)();
    });

  const drag = Gesture.Pan()
    .enabled(canReorder)
    .activateAfterLongPress(300)
    .onStart((event) => {
      held.value = index;
      target.value = index;
      ended.value = false;

      // Where this card's folded slot would land if the list folded in place,
      // against where the finger actually is. The difference is what the list
      // has to move so the two coincide. Measured rather than added up: the
      // arithmetic version had to reproduce Yoga's layout exactly, and when it
      // was off, the card left the finger at the fold.
      const box = measure(listRef);
      columnShift.value = box ? event.absoluteY - ROW / 2 - (box.pageY + index * SLOT) : 0;
      lockedHeight.value = box ? box.height : 0;

      collapse.value = withTiming(1, { duration: 240 });
      runOnJS(onBegin)();
    })
    .onUpdate((event) => {
      dragY.value = event.translationY;
      // Slots travelled, not where the card has ended up. It sits under the
      // finger, so it starts off the grid by however far down it was grabbed;
      // measuring its position against the slots would make "up one" a
      // different distance every time.
      const next = Math.max(0, Math.min(count - 1, index + Math.round(dragY.value / SLOT)));
      if (next !== target.value) {
        target.value = next;
        runOnJS(tap)();
      }
    })
    .onEnd(() => {
      ended.value = true;
      const to = target.value;
      // Settle into the slot before the order actually changes, so the card is
      // already where it is going when the list catches up.
      const landing = (to - index) * SLOT;
      if (Math.abs(landing - dragY.value) < 1) {
        dragY.value = landing;
        runOnJS(onEndDrag)(index, to);
        return;
      }
      dragY.value = withTiming(landing, { duration: 170 }, (finished) => {
        if (finished) runOnJS(onEndDrag)(index, to);
      });
    })
    .onFinalize(() => {
      if (held.value === index && !ended.value) runOnJS(onEndDrag)(index, index);
    });

  const animated = useAnimatedStyle(() => {
    // `maxHeight`, not `height`, so an unmeasured card is simply
    // unconstrained rather than wrong.
    const full = open ?? UNMEASURED;
    const mine = held.value === index;
    return {
      maxHeight: full + (ROW - full) * collapse.value,
      transform: [
        { translateY: mine ? dragY.value : shift.value },
        // Just enough lift to read as picked up rather than as a layout bug.
        { scale: mine ? 1 + 0.03 * collapse.value : 1 },
      ],
      zIndex: mine ? 20 : 1,
    };
  }, [open, index]);

  const body = useAnimatedStyle(() => ({ opacity: 1 - collapse.value }));
  const ring = useAnimatedStyle(() => ({ opacity: held.value === index ? collapse.value : 0 }));

  const card = (
    <SwipeRow
      left={{ label: "Settings", icon: "options-outline", colour: "#64748b", onAct: onSettings }}
      right={
        canDelete
          ? {
              label: "Delete",
              icon: "trash-outline",
              colour: "#ef4444",
              // A swipe is a flick, not a considered tap, and a track carries
              // everything on it — so this one asks first, and deliberately
              // offers no undo afterwards. One decision per intent: asking and
              // then offering to take it back is two.
              onAct: onDelete,
            }
          : undefined
      }
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${track.meta.name}, ${streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} in a row` : "no streak yet"}${active ? ", open" : ""}`}
        accessibilityHint={
          canReorder
            ? "Hold to move it up or down the list. Swipe left for settings, right to delete."
            : "Swipe left for settings."
        }
        style={[styles.card, { borderColor: active ? colour : palette.cardBorder }]}
      >
        {/* The track's colour, laid over the card rather than replacing
            its background: an rgba background would composite against
            the page and take the card's lift with it. Faint — the row
            has a heatmap in the same colour and the tint is only there
            so the card is recognisably that track's before you read
            anything on it. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: RADIUS.card, backgroundColor: withAlpha(colour, active ? 0.12 : 0.05) },
          ]}
        />
        <View style={styles.head}>
          <View style={[styles.dot, { backgroundColor: colour }]} />
          <View style={styles.text}>
            <Text style={styles.name}>{track.meta.name}</Text>
            <Text style={styles.muted}>
              {streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} in a row` : "no streak yet"}
              {active ? " · open" : ""}
            </Text>
          </View>
          {streak > 0 && (
            <View style={[styles.streak, { backgroundColor: withAlpha(colour, 0.16) }]}>
              <Ionicons name="flame" size={12} color={ink(colour)} />
              <Text style={[styles.streakCount, { color: ink(colour) }]}>{streak}</Text>
            </View>
          )}
        </View>

        {/* A year of this track, in this track's colour. What the list
            is for is seeing which ones you are actually keeping up. */}
        <Animated.View style={body}>
          <TrackHeatmap
            days={streakCalendar(track, today, weekStartsOn)}
            colour={colour}
            start={track.startDate}
            today={today}
            rest={restScheduleOf(track)}
          />
        </Animated.View>
      </View>
    </SwipeRow>
  );

  const remember = (height: number) => {
    if (open !== null && Math.abs(open - height) < 1) return;
    setOpen(height);
  };

  return (
    // Holding wins over tapping: once the drag has claimed the touch, letting
    // go of it is a drop, not a press. This is the one place the gesture
    // deliberately does *not* fall through to opening the track — holding
    // something to move it and finding you have navigated away is the worst
    // outcome this screen has.
    <GestureDetector gesture={Gesture.Exclusive(drag, openTap)}>
      <Animated.View style={[styles.slot, animated]}>
        {/* Inside the clipped wrapper but unconstrained by it, so it keeps
            reporting what the card *would* be if it were open. */}
        <View
          onLayout={(event) => remember(event.nativeEvent.layout.height)}
          pointerEvents={dragging ? "none" : "auto"}
        >
          {card}
        </View>
        <Animated.View style={[styles.ring, ring, { borderColor: colour }]} pointerEvents="none" />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * A track's own settings: what it is called, its colour, when it started and
 * how long it runs.
 *
 * Held as a draft and saved on a tap, rather than written on every keystroke
 * like most of this app. The reason is the length: `updateTrackIdentity`
 * rescales every phase's deadline proportionally when the total changes, so
 * typing "120" over "90" one digit at a time would rescale the whole roadmap
 * three times on its way to a number the user had not finished typing.
 */
function TrackSettings({
  track,
  canArchive,
  onSave,
  onArchive,
  onCancel,
  styles,
  palette,
}: {
  track: TrackState | null;
  canArchive: boolean;
  onSave: (fields: { name: string; color: string; startDate: string; totalDays: number }) => void;
  onArchive: () => void;
  onCancel: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const [name, setName] = useState(track?.meta.name ?? "");
  const [color, setColor] = useState(track?.meta.color || TRACK_COLORS[0]);
  const [startDate, setStartDate] = useState(track?.startDate ?? todayYMD());
  const [picking, setPicking] = useState<"start" | "end" | null>(null);
  const [endDate, setEndDate] = useState(() =>
    track ? formatDateYMD(dateForDay(track.startDate ?? todayYMD(), trackTotalDays(track))) : todayYMD()
  );

  if (!track) return null;

  const validStart = isDateStr(startDate);
  const validEnd = isDateStr(endDate);
  // The stored length is a count of days from the start, which is what lets a
  // whole track be re-dated without rewriting every phase.
  const days = validStart && validEnd ? dayForDate(startDate, endDate) : 0;
  const canSave = name.trim().length > 0 && validStart && validEnd && days > 0;

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Track settings</Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Track name"
        placeholderTextColor={palette.subtleForeground}
        style={styles.input}
        autoFocus
        accessibilityLabel="Track name"
      />

      <Text style={styles.fieldLabel}>Colour</Text>
      <Swatches value={color} onPick={setColor} styles={styles} palette={palette} />

      <Text style={styles.fieldLabel}>Started on</Text>
      <DateField value={startDate} onPress={() => setPicking("start")} styles={styles} palette={palette} />

      <Text style={styles.fieldLabel}>Ends on</Text>
      {/* A date, not a day count. Nobody knows their track is 92 days long;
          they know it should be done by Christmas. The count is still what
          gets stored — it is what lets a track be re-dated wholesale — so this
          converts on the way in and out. */}
      <DateField
        value={endDate}
        onPress={() => setPicking("end")}
        styles={styles}
        palette={palette}
      />
      <Text style={styles.footnote}>
        {days > 0 ? `${days} day${days === 1 ? "" : "s"}. ` : ""}Moving it shifts every phase deadline
        in proportion, so the shape of the roadmap survives being made longer or shorter.
      </Text>

      <DatePicker
        open={picking !== null}
        title={picking === "end" ? "Ends on" : "Started on"}
        value={picking === "end" ? endDate : startDate}
        earliest={picking === "end" ? startDate : undefined}
        onPick={(date) => (picking === "end" ? setEndDate(date) : setStartDate(date))}
        onClose={() => setPicking(null)}
      />

      <View style={styles.panelRow}>
        <Tappable
          accessibilityRole="button"
          style={styles.panelButton}
          disabled={!canSave}
          onPress={() =>
            onSave({ name: name.trim(), color, startDate, totalDays: days })
          }
        >
          <Text style={[styles.panelLabel, !canSave && { color: palette.subtleForeground }]}>Save</Text>
        </Tappable>
        <Tappable accessibilityRole="button" style={styles.panelButton} onPress={onCancel}>
          <Text style={styles.panelLabel}>Cancel</Text>
        </Tappable>
      </View>

      <View style={styles.panelRow}>
        <Tappable
          accessibilityRole="button"
          style={styles.panelButton}
          disabled={!canArchive}
          onPress={onArchive}
        >
          <Text style={[styles.panelLabel, !canArchive && { color: palette.subtleForeground }]}>
            {!canArchive ? "Can't delete your only track" : "Delete this track"}
          </Text>
        </Tappable>
      </View>
    </View>
  );
}

/** The six colours a track can wear, and which one it is wearing. Shared by
 *  the create panel and the settings panel so that changing a track's colour
 *  later is the same gesture as choosing it in the first place. */
function Swatches({
  value,
  onPick,
  styles,
  palette,
}: {
  value: string;
  onPick: (colour: string) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  return (
    <View style={styles.swatches}>
      {TRACK_COLORS.map((option) => (
        <Tappable
          key={option}
          accessibilityRole="button"
          accessibilityLabel={`Colour ${option}`}
          accessibilityState={{ selected: value === option }}
          onPress={() => onPick(option)}
          style={[styles.swatch, { backgroundColor: option }]}
        >
          {/* The tick, rather than a ring around the outside. A ring on a
              circle of colour reads as a seventh colour at a glance; a mark
              inside it reads as a choice. */}
          {value === option && <Ionicons name="checkmark" size={16} color="#ffffff" />}
        </Tappable>
      ))}
    </View>
  );
}

/** A date, shown as a date and opened as a picker. Never a text box: every
 *  date here feeds arithmetic — a phase deadline is a day count from the start
 *  — so an unparseable one is not a cosmetic problem, and the only thing the
 *  code could do with a half-typed one was ignore it. */
function DateField({
  value,
  empty,
  onPress,
  styles,
  palette,
}: {
  value: string;
  empty?: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Palette;
}) {
  const set = isDateStr(value);
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={`${describeDate(value, empty ?? "Not set")}. Tap to change.`}
      onPress={onPress}
      style={styles.dateField}
    >
      <Text style={[styles.dateValue, !set && { color: palette.subtleForeground }]}>
        {describeDate(value, empty ?? "Choose a date")}
      </Text>
      <Ionicons name="calendar-outline" size={16} color={palette.subtleForeground} />
    </Tappable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    card: {
      // A name and a year of days, stacked. It was a single row when it held
      // only the name.
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    allTracks: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    /** The cards, as one block the fold can move as a unit. */
    stack: { gap: GAP },
    slot: { overflow: "hidden", borderRadius: RADIUS.card },
    ring: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: RADIUS.card,
      borderWidth: 2,
    },
    head: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
    streak: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: RADIUS.control,
    },
    streakCount: { ...TYPE.micro, fontWeight: "700" },
    dot: { width: 10, height: 10, borderRadius: 5 },
    text: { flex: 1, gap: 2 },
    name: { color: palette.foreground, ...TYPE.heading, fontWeight: "600" },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
    panel: {
      gap: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    panelTitle: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    panelRow: { flexDirection: "row", gap: SPACING.sm },
    panelButton: {
      flex: 1,
      alignItems: "center",
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    panelLabel: { color: palette.foreground, ...TYPE.body, fontWeight: "600" },
    fieldLabel: { color: palette.subtleForeground, ...TYPE.marker, fontWeight: "700", letterSpacing: 1, marginTop: SPACING.sm },
    dateField: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 48,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    dateValue: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    swatches: { flexDirection: "row", gap: SPACING.sm },
    swatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.2)",
    },
    footnote: { color: palette.subtleForeground, ...TYPE.micro, lineHeight: 16 },
    input: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
      color: palette.foreground,
      ...TYPE.subhead,
    },
    templateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
  });
}
