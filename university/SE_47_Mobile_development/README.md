# SE_47 — Mobile App Development

Assessment material for SE_47, based on Horizon's phone app (`mobile/`).
**Target level: 2.**

## What is here

| File | What it is | Written by |
|---|---|---|
| `framework-analysis.md` | The official Framework Analysis Template, filled in | Drafted with LLM support — explicitly permitted for this artifact |
| `self-assessment.md` | Structure + factual anchors + prompts for the reflection essay | **Scaffold only.** The essay must be in your own words — see below |

## The one rule that shapes this folder

The module's assessment instructions treat the two documents differently:

- **Hand-ins** (code base, video, Framework Analysis): *"These artifacts may be
  created with support from Large Language Models."*
- **Self-Reflection**: *"Please do not use Large Language Models when writing
  your reflection essays, it should be in your own words, even if English is
  not your native language."*

So `framework-analysis.md` is complete and ready to review. `self-assessment.md`
is deliberately not an essay — it is the skeleton plus the facts you would
otherwise have to dig out of the git log, with the reflection left to you.

## Submission checklist

- [ ] **Code base** — repository link, with a README explaining the structure
      and how to start the system. The repo is private, so grant the module
      coordinator access using their `@code.berlin` account before submitting.
- [ ] **Video / screencast** of the app running. If it goes on Google Drive,
      share it with the coordinator directly — a Learning Platform account is
      not sufficient.
- [ ] **Framework Analysis** — `framework-analysis.md`. Review it line by line;
      do not submit a claim you cannot defend out loud.
- [ ] **Self-assessment essay** — write from `self-assessment.md`, in your own
      words.
- [ ] Submit via **Fuxam**.

## Before you submit — two things to check yourself

1. **Every claim in the Framework Analysis is one you can explain in an oral
   exam.** It is written from this repository, so it is accurate, but accurate
   is not the same as understood. The sections most likely to be probed are
   Lifecycle Management, Sensors, and the runtime-version part of Rollout,
   because those are where the project has genuinely unusual detail.
2. **Repository contents.** `MODULES_PLAN.md` at the repo root names security
   issues on the assumption the repo stays private, and says so. That is fine
   for a coordinator with granted access; it is not fine if you make the repo
   public for the submission.

## Source material

The app itself is `mobile/` in this repository. The pieces the analysis points
at most often:

- `mobile/src/steps/usePedometer.ts` — the sensor, and every concern around it
- `mobile/src/timer/TimerProvider.tsx` — the clearest lifecycle case
- `mobile/src/storage/db.ts` — SQLite schema and why the workspace is one row
- `mobile/app.json` — permissions, plugins, scheme, `runtimeVersion` policy
- `mobile/eas.json` — the build profiles and update channels
- `CHANGELOG.md` — every mobile release with its reasoning
- `MOBILE_PLAN.md` — the architecture decisions as they were made
