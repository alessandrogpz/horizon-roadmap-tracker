// The track's full roadmap: the long-form plan behind the phases.
//
// Reading it on a phone is genuinely useful — it is the document you want when
// deciding what to do next, and it is often long. The reading and editing of
// it is ../components/MarkdownDocument, shared with a rotation's own plan,
// because they are the same kind of document and deserve the same treatment.

import { MarkdownDocument } from "../components/MarkdownDocument";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { NoTrack } from "../components/NoTrack";

export default function RoadmapScreen() {
  const { track, editTrack } = useWorkspace();
  if (!track) return <NoTrack />;

  return (
    <MarkdownDocument
      value={track.roadmapContent ?? ""}
      onChange={(roadmapContent) => editTrack((t) => ({ ...t, roadmapContent }))}
      emptyText="This track has no roadmap written yet."
      label="Roadmap"
    />
  );
}
