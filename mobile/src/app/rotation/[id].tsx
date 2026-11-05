// The plan behind a rotation.
//
// A rotation is a cycle of topics, and the list of topics does not explain
// itself — why these, in this order, on these days. That reasoning is a
// markdown document stored on the rotation (`explanation`), and it is the same
// kind of thing as a track's roadmap, so it uses the same reader and editor.
//
// A route rather than a field in the Week screen's card: the Week screen is a
// list of short settings, and a page of prose in the middle of it would bury
// the settings on either side.

import { useLocalSearchParams } from "expo-router";
import { MarkdownDocument } from "../../components/MarkdownDocument";
import { EmptyState } from "../../components/EmptyState";
import { useWorkspace } from "../../workspace/WorkspaceProvider";

export default function RotationPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { track, editTrack } = useWorkspace();

  const rotation = track?.rotations?.find((r) => r.id === id) ?? null;
  // Not a "no track" state — the track is open, this rotation is not on it —
  // so it does not get "Create a track" as its way out.
  if (!rotation) {
    return (
      <EmptyState
        title="That rotation isn't on this track"
        hint="It may have been removed, or it belongs to a track that is not the open one."
      />
    );
  }

  return (
    <MarkdownDocument
      value={rotation.explanation ?? ""}
      onChange={(explanation) =>
        editTrack((t) => ({
          ...t,
          rotations: (t.rotations ?? []).map((r) =>
            // Empty means "no plan", not "a plan that is the empty string" —
            // the field is optional and a blank one should not be stored.
            r.id === id ? { ...r, explanation: explanation.trim() ? explanation : undefined } : r
          ),
        }))
      }
      emptyText="Nothing written about this rotation yet. This is the place for why these topics, in this order."
      label={`The plan behind ${rotation.label}`}
    />
  );
}
