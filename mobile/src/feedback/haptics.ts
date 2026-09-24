// The small physical answer to a tap.
//
// A touch screen gives nothing back on its own, so an app has to say "yes, I
// felt that" some other way. Colour changing under a thumb is the usual
// answer and the thumb is covering it. A few milliseconds of vibration is not
// decoration: it is the confirmation, and it is why a native app feels
// different from a web page doing the same thing.
//
// Used sparingly and deliberately — ticking something off, snapping a wheel,
// dropping a dragged panel, and anything destructive. Not on ordinary
// navigation, which would turn the phone into a buzzing brick.
//
// Every call is fire-and-forget and swallows its own failure: a device without
// a motor, or with system haptics turned off, should change nothing else.

import * as Haptics from "expo-haptics";

/** A tick, a toggle, a snap — the everyday confirmation. */
export function tap(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Something landed: a panel dropped into place, a wheel settled. */
export function settle(): void {
  void Haptics.selectionAsync().catch(() => undefined);
}

/** Something was removed, or a confirmation is now armed. Heavier on purpose:
 *  the feel should not be the same as ticking a box. */
export function warn(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

/** Something finished — a sync, a restore. */
export function done(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
