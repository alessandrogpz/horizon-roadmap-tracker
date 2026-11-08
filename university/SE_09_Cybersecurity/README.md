# SE_09 — Cyber Security

Assessment material for SE_09, based on Horizon. Empty for now — drop material
in as you gather it.

## Where the relevant work already lives

- `SECURITY.md` (repo root) — the threat model and what is done about it.
- `MODULES_PLAN.md` (repo root) — written for this module and SE_06 together;
  note its warning that it names unfixed threats on the assumption the repo
  stays private.
- `lib/server/` — authentication, sessions, rate limiting.
- `mobile/src/auth/session.ts` — credential storage on the phone
  (expo-secure-store, Keystore-backed).
- `CHANGELOG.md` — the security-related releases, including the dependency
  advisory work (0.107.1) and its conclusion in 0.117.0.
