// Receiving a link from another app: `horizon://track/<id>`.
//
// The counterpart to the share sheet. Another app — a browser, a message, a
// calendar entry — hands Android this link, Android matches it to the scheme
// this app declared in app.json, and Horizon opens on that track.
//
// Nothing is trusted from it beyond an id, and even that is only used if it
// names a track this device already has. A link is outside input: it can be
// crafted by anyone who can get the user to tap it, so it may choose between
// things that already exist and nothing more. If it doesn't match, the app
// opens on Today rather than showing an error, because a stale link is a dull
// problem and shouldn't look like a broken app.

import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useWorkspace } from "../../workspace/WorkspaceProvider";

export default function TrackLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workspace, switchTrack } = useWorkspace();

  useEffect(() => {
    if (id && workspace?.tracks[id]) switchTrack(id);
  }, [id, workspace, switchTrack]);

  return <Redirect href="/" />;
}
