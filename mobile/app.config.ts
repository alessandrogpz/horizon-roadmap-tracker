import type { ConfigContext, ExpoConfig } from "expo/config";

// Two apps on one phone.
//
// A development build and the real app share a package name by default, so
// installing one replaces the other — which means giving up hot reload every
// time you want to check the standalone build, and reinstalling to get it back.
// Giving the development variant its own package name lets both live on the
// phone at once, side by side in the launcher.
//
// Everything else stays in app.json. This file only changes the handful of
// values that must differ, chosen by APP_VARIANT, which eas.json sets per build
// profile (and which is unset locally, so `npm start` serves the production
// identity to whichever build is installed).

const VARIANT = process.env.APP_VARIANT ?? "production";
const IS_DEV = VARIANT === "development";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),

  // Distinguishable in the launcher, and in the app switcher.
  name: IS_DEV ? "Horizon (dev)" : "Horizon",

  // A separate scheme too: two apps claiming `horizon://` would make Android
  // ask which one should open every link.
  scheme: IS_DEV ? "horizondev" : "horizon",

  android: {
    ...config.android,
    // The identity Android uses to decide "same app or different app". This is
    // the line that lets both be installed.
    package: IS_DEV ? "com.horizonroadmap.app.dev" : "com.horizonroadmap.app",
  },
});
