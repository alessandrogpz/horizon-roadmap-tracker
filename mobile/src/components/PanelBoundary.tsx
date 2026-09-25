// One broken panel should cost you one panel.
//
// My Space renders eight or nine panels from the same track. Without a
// boundary, a single one throwing — an unexpected shape in old data, a field
// that turned out to be optional after all — takes React's whole tree with it,
// and the home screen of the app goes white. The website has had
// `PanelErrorBoundary` for exactly this reason; the phone did not.
//
// A class component because that is still the only way to catch a render
// error in React. It deliberately does not try to recover by itself: a panel
// that throws once on this data will throw again, so it offers a retry and
// otherwise stays out of the way.

import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TYPE } from "../theme";

interface Props {
  /** Named so the message can say which panel, rather than "something". */
  label: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class PanelBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Kept to the console rather than shown: the person reading this screen
    // cannot act on a stack trace, and `adb logcat` is where it is useful.
    if (__DEV__) console.warn("[panel] failed to render", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <View style={styles.card}>
        <Text style={styles.title}>{this.props.label} couldn&apos;t be shown</Text>
        <Text style={styles.body}>
          The rest of this screen is fine. If it keeps happening, the panel can be removed from
          Arrange.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ failed: false })}
          style={styles.retry}
          hitSlop={8}
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

// Palette-free on purpose: a boundary that needs a context to render is a
// boundary that can fail for the same reason as the thing it is catching.
const styles = StyleSheet.create({
  card: {
    gap: 6,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.35)",
    backgroundColor: "rgba(248, 113, 113, 0.06)",
  },
  title: { color: "#f87171", ...TYPE.body, fontWeight: "700" },
  body: { color: "#9ca3af", ...TYPE.caption, lineHeight: 17 },
  retry: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, minHeight: 44, justifyContent: "center" },
  retryLabel: { color: "#f87171", ...TYPE.label, fontWeight: "600" },
});
