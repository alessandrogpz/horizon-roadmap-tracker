# Horizon for Android

The phone app, built with Expo (React Native). The plan, the framework decision and the schedule are
in [`../MOBILE_PLAN.md`](../MOBILE_PLAN.md).

It is a separate npm package on purpose: its own dependencies, its own TypeScript configuration, its
own bundler. The web app's `tsconfig.json` and ESLint config both exclude this folder, so neither
toolchain trips over the other.

```bash
cd mobile && npm install
npm start            # then scan the QR code with Expo Go on a phone
npm run android      # a connected device or emulator
npm run web          # react-native-web, for a quick look without a phone
```

## What is shared with the website

Everything in `../lib` that knows nothing about React or the browser: types, dates, completion rules,
streak calculation, selectors, the merge engine and the schema migrations — about 1,500 lines,
imported here as `@shared/*` and reused unchanged. `metro.config.js` watches the repository root so
the bundler may read it, and pins `node_modules` to this folder so only one copy of React ends up in
the bundle.

What is *not* shared: anything that draws (no DOM, no CSS) and anything that stores
(`src/storage/db.ts`).

## Storage

| File | Platform | Why |
|---|---|---|
| `src/storage/db.ts` | Android, iOS | SQLite through `expo-sqlite`: structured, survives restarts, no size ceiling worth worrying about |
| `src/storage/db.web.ts` | Web | `localStorage`, picked automatically by the bundler on the `.web.ts` extension. Enough to develop against; the real web Horizon is the Next.js app, which uses IndexedDB |

Every edit is written as it happens. Android kills background processes without warning, so there is
no safe "save on close" moment.

## Two variants, two apps

The development build and the real app have different package names, so both can sit on the phone at
once instead of replacing each other:

| Profile | Name on the phone | Package | Scheme |
|---|---|---|---|
| `development` | Horizon (dev) | `com.horizonroadmap.app.dev` | `horizondev://` |
| `preview`, `production` | Horizon | `com.horizonroadmap.app` | `horizon://` |

`app.config.ts` chooses between them from `APP_VARIANT`, which `eas.json` sets on the development
profile. Everything else stays in `app.json`.

**One thing this costs.** Google ties an OAuth client to a package name, so signing in from the
development variant needs a *second* Android OAuth client in Google Cloud — same SHA-1 fingerprint,
package `com.horizonroadmap.app.dev`. Without it, sign-in in a development build fails with a
developer error while the real app keeps working. That is Android's app identity doing its job: the
two are genuinely different apps, and Google is right not to take one's word for the other's identity.
