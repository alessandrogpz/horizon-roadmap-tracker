# Development Workflow

Internal notes for working on this repo. Not shown to end users — see `README.md` for that.

## Branches

| Branch        | Purpose                                   | Vercel deploy         |
|----------------|--------------------------------------------|------------------------|
| `main`         | Production. Always deployable.             | Production URL         |
| `development`  | Preview / staging for in-progress features. | Preview URL (separate origin, isolated IndexedDB) |

There is no other long-lived branch. (The `overhaul` branch used for the multi-tenant rework — multi-track data model, onboarding wizard, drag-and-drop panels — was merged into `main` on 2026-07-20 and deleted. `development` is its replacement for all future preview work.)

Short-lived feature branches can branch off `development` and merge back into it if useful, but for solo day-to-day work it's fine to commit directly to `development`.

## Workflow

1. Do work on `development`, commit, push to `origin/development` — this deploys to the Vercel preview URL.
2. Verify the preview build (manually exercise the feature; for touch/mobile-only behavior, test on an actual phone since browser automation tooling is mouse-only and can't simulate real touch/long-press gestures).
3. When ready to ship, merge `development` into `main` and push. Before merging:
   - Confirm a clean fast-forward is possible: `git merge-base --is-ancestor origin/main origin/development`
   - Re-run the full check on `main` after merging, before pushing:
     ```bash
     rm -rf .next   # stale cache can reference deleted routes and produce false errors
     npx tsc --noEmit
     npm run lint
     npm run test
     npm run build
     ```
4. Push `main` only after all of the above pass clean.

Never force-push either branch. Never skip the pre-push checks on `main` — it's production.

## Testing against real data

The Dexie (IndexedDB) database and Google Drive `database.json` used for daily personal use are real, live data — never test against them directly. When verifying changes in a browser:

- Use an isolated port (e.g. `next start -p 3003`, `3001`, `3002`) rather than the port-3000 dev server used for daily use — a different port is a different origin, so it gets a fresh IndexedDB with no risk to real data.
- Stop the isolated test server when done (`pkill -f "next start -p <port>"` or equivalent).

## Sync/merge correctness

`lib/api.ts`'s `applyTrackBookkeeping` decides whether a track edit bumps `configVersion` (which drives "higher side wins" conflict resolution during Drive sync). Fields with a dedicated smart-merge in `lib/merge.ts` (`materials`, `portfolio`) are safe by construction. Fields without one (`phases`, `weekSchedule`, etc.) rely entirely on `CONFIG_COMPARE_FIELDS` correctly detecting in-place edits, not just additions/removals — if you add a new structural field to `TrackState`, add it to `CONFIG_COMPARE_FIELDS` and add a regression test in `lib/__tests__/api.test.ts` following the existing pattern (create a track, edit a field in place, assert `configVersion` bumps).
