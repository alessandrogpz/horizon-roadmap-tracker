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
