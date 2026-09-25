// Account: sign in, sync, sign out. The phone's version of the website's
// Settings → Account, and it talks to the same API.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { currentAccount, deleteAccount, signIn, signOut, storedToken, type Account } from "../auth/session";
import { describeLastSync, useSync } from "../sync/SyncProvider";
import { RADIUS, SPACING, TYPE, type Palette } from "../theme";
import { usePalette } from "../theme/ThemeProvider";
import { Refreshable } from "../components/Refreshable";

export default function AccountScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { state: syncState, message: syncMessage, lastSyncedAt, sync, refreshAccount } = useSync();

  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState<"signing-in" | "syncing" | "signing-out" | "deleting" | null>(null);
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
      // The provider decides whether anything can sync, and it decided
      // "signed-out" before this happened.
      await refreshAccount();
      void sync();
      setMessage("Signed in — bringing your tracks over.");
    } catch (error) {
      const cancelled = (error as { cancelled?: boolean }).cancelled;
      setMessage(cancelled ? "" : error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(null);
    }
  }, []);

  // Sync itself lives in SyncProvider, so the header chip, a pull-to-refresh
  // anywhere and this button are all the same operation with the same status
  // — rather than this screen having a private idea of whether it worked.
  const doSync = useCallback(async () => {
    await sync();
  }, [sync]);

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // An armed delete that never disarms is a trap on a screen people revisit.
  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 8000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  const doDelete = useCallback(async () => {
    setBusy("deleting");
    try {
      await deleteAccount();
      setAccount(null);
      await refreshAccount();
      setMessage("Account deleted. Everything it held on the server is gone; this phone kept its own copy.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That didn't work.");
    } finally {
      setBusy(null);
      setConfirmingDelete(false);
    }
  }, []);

  const doSignOut = useCallback(async () => {
    setBusy("signing-out");
    await signOut();
    setAccount(null);
    await refreshAccount();
    setMessage("Signed out. Everything on this phone stays here.");
    setBusy(null);
  }, [refreshAccount]);

  if (checking) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  return (
    <Refreshable style={styles.screen} contentContainerStyle={styles.content}>
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
          <Button label="Sync now" busy={syncState === "syncing"} onPress={doSync} styles={styles} primary />
          <Text style={styles.muted}>
            {syncMessage || `Last synced ${describeLastSync(lastSyncedAt)}.`}
          </Text>
          <Button label="Sign out" busy={busy === "signing-out"} onPress={doSignOut} styles={styles} />
        </>
      ) : (
        <Button label="Sign in with Google" busy={busy === "signing-in"} onPress={doSignIn} styles={styles} primary />
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {account && (
        <View style={styles.danger}>
          <Text style={styles.title}>Delete account</Text>
          <Text style={styles.muted}>
            Removes the account and everything it holds on the server — tracks, progress, notes and
            sessions — in one operation that either finishes completely or changes nothing. This phone
            keeps its own copy and carries on working offline.
          </Text>
          <Button
            label={confirmingDelete ? "Tap again to delete the account" : "Delete account…"}
            busy={busy === "deleting"}
            onPress={() => (confirmingDelete ? void doDelete() : setConfirmingDelete(true))}
            styles={styles}
          />
        </View>
      )}
    </Refreshable>
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
    title: { color: palette.foreground, ...TYPE.heading, fontWeight: "600" },
    muted: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18 },
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
    buttonLabel: { color: palette.foreground, ...TYPE.subhead, fontWeight: "600" },
    buttonLabelPrimary: { color: "#04121c" },
    message: { color: palette.mutedForeground, ...TYPE.label, lineHeight: 18, paddingHorizontal: SPACING.xs },
    danger: {
      gap: SPACING.sm,
      marginTop: SPACING.lg,
      padding: SPACING.lg,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: "rgba(248, 113, 113, 0.3)",
      backgroundColor: "rgba(248, 113, 113, 0.05)",
    },
  });
}
