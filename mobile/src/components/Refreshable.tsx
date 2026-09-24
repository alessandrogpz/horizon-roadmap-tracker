// A scrolling screen that syncs when you pull it down.
//
// Pull-to-refresh is the gesture people already try on a phone, and it works
// on every screen here rather than on a chosen few — the point of a convention
// is that you do not have to remember where it applies.
//
// It wraps ScrollView rather than replacing it so every screen keeps its own
// content and styling; all it adds is the control and the handler.

import { useCallback, useState, type ComponentProps } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useSync } from "../sync/SyncProvider";
import { usePalette } from "../theme/ThemeProvider";

export function Refreshable({ children, ...props }: ComponentProps<typeof ScrollView>) {
  const palette = usePalette();
  const { sync } = useSync();
  const [pulling, setPulling] = useState(false);

  // The spinner belongs to the gesture, not to the sync: it has to stop when
  // the request settles, however it settles, or it spins forever offline.
  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await sync();
    } finally {
      setPulling(false);
    }
  }, [sync]);

  return (
    <ScrollView
      {...props}
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={() => void onRefresh()}
          tintColor={palette.accent}
          colors={[palette.accent]}
          progressBackgroundColor={palette.card}
        />
      }
    >
      {children}
    </ScrollView>
  );
}
