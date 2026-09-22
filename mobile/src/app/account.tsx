// Account: sign in, sync, sign out. The phone's version of the website's
// Settings → Account, and it talks to the same API.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { currentAccount, signIn, signOut, storedToken, type Account } from "../auth/session";
import { syncWithServer } from "../sync/syncWithServer";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { DARK, LIGHT, RADIUS, SPACING, type Palette } from "../theme";

export default function AccountScreen() {
  const palette = useColorScheme() === "light" ? LIGHT : DARK;
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { replaceWorkspace } = useWorkspace();

  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState<"signing-in" | "syncing" | "signing-out" | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      // A stored token means "signed in" even when the server can't be reached;
      // being offline is not being signed out.
      const known = await storedToken();
      setAccount(known ? await currentAccount() : null);
      setChecking(false);
    })();
  }, []);

  const doSignIn = useCallback(async () => {
    setBusy("signing-in");
    setMessage("");
    try {
      setAccount(await signIn());
      setMessage("Signed in. Sync to bring your tracks over.");
    } catch (error) {
      const cancelled = (error as { cancelled?: boolean }).cancelled;
      setMessage(cancelled ? "" : error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(null);
    }
  }, []);

  const doSync = useCallback(async () => {
    setBusy("syncing");
    const outcome = await syncWithServer();
    if (outcome.workspace) replaceWorkspace(outcome.workspace);
    setMessage(outcome.message);
    setBusy(null);
  }, [replaceWorkspace]);

  const doSignOut = useCallback(async () => {
    setBusy("signing-out");
    await signOut();
    setAccount(null);
    setMessage("Signed out. Everything on this phone stays here.");
    setBusy(null);
  }, []);

  if (checking) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{account ? account.name || account.email : "Not signed in"}</Text>
        <Text style={styles.muted}>
          {account
            ? account.email
            : "Horizon works without an account: everything stays on this phone. Sign in to see the same tracks here and on your laptop."}
        </Text>
      </View>

      {account ? (
        <>
          <Button label="Sync now" busy={busy === "syncing"} onPress={doSync} styles={styles} primary />
          <Button label="Sign out" busy={busy === "signing-out"} onPress={doSignOut} styles={styles} />
        </>
      ) : (
        <Button label="Sign in with Google" busy={busy === "signing-in"} onPress={doSignIn} styles={styles} primary />
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

function Button({
  label,
  onPress,
  busy,
  primary,
  styles,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  primary?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={[styles.button, primary && styles.buttonPrimary, busy && styles.buttonBusy]}
    >
      <Text style={[styles.buttonLabel, primary && styles.buttonLabelPrimary]}>{busy ? "Working…" : label}</Text>
    </Pressable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    centered: { alignItems: "center", justifyContent: "center" },
    card: {
      gap: SPACING.xs,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    title: { color: palette.foreground, fontSize: 17, fontWeight: "600" },
    muted: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18 },
    button: {
      alignItems: "center",
      paddingVertical: SPACING.md + 2,
      borderRadius: RADIUS.control,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.surfaceMuted,
    },
    buttonPrimary: { backgroundColor: palette.accent, borderColor: palette.accent },
    buttonBusy: { opacity: 0.6 },
    buttonLabel: { color: palette.foreground, fontSize: 15, fontWeight: "600" },
    buttonLabelPrimary: { color: "#04121c" },
    message: { color: palette.mutedForeground, fontSize: 13, lineHeight: 18, paddingHorizontal: SPACING.xs },
  });
}
