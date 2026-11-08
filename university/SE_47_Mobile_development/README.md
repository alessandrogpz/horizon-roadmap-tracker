# SE_47 — Mobile App Development

Based on Horizon's phone app (`mobile/`). **Claim Level 2.**

| File | What it is | Written by |
|---|---|---|
| [exam.md](exam.md) | The drill: how to practise, the demo, the commands, 18 questions with short answers | — |
| [framework-analysis.md](framework-analysis.md) | The official Framework Analysis Template, filled in | Drafted with LLM support — **explicitly permitted for this artifact** |
| [self-assessment.md](self-assessment.md) | Scaffold for the reflection essay | **Your own words** — see below |
| [MOBILE_PLAN.md](MOBILE_PLAN.md) | The plan and the decisions as they were made | — |

## The rule that shapes this folder

The module's instructions treat the two documents differently:

- **Hand-ins** (code base, video, Framework Analysis): *"These artifacts may be created with support
  from Large Language Models."*
- **Self-Reflection**: *"Please do not use Large Language Models when writing your reflection essays,
  it should be in your own words, even if English is not your native language."*

So `framework-analysis.md` is complete and ready to review; `self-assessment.md` is deliberately not
an essay.

## Submission checklist

- [ ] **Code base** — repository link, read access for the coordinator's `@code.berlin` account
- [ ] **Video / screencast** of the app running. On Google Drive, share it with the coordinator
      directly — a Learning Platform account is not sufficient
- [ ] **Framework Analysis** — review it line by line. Do not submit a claim you cannot defend out loud
- [ ] **Self-assessment essay**, in your own words
- [ ] Work through [exam.md](exam.md)'s three passes
- [ ] [`../exam-day.md`](../exam-day.md) the day before
- [ ] Submit via **Fuxam**

## Two things to check yourself

1. **Every Framework Analysis claim is one you can explain out loud.** It is written from this
   repository, so it is accurate — accurate is not the same as understood. The sections most likely
   to be probed: Lifecycle Management, Sensors, and the `runtimeVersion` part of Rollout.
2. **What the repo exposes.** [`../MODULES_PLAN.md`](../MODULES_PLAN.md) names open security issues on
   the assumption it stays private. Fine for a coordinator; not fine public.

## Where the app's own detail lives

`mobile/src/steps/usePedometer.ts` (the sensor and every concern around it) ·
`mobile/src/timer/TimerProvider.tsx` (the clearest lifecycle case) ·
`mobile/src/storage/db.ts` (SQLite, and why the workspace is one row) ·
`mobile/app.json` (permissions, plugins, scheme, `runtimeVersion` policy) ·
`mobile/eas.json` (build profiles and update channels) ·
[`../LEARNING_LOG.md`](../LEARNING_LOG.md) entries 15–18
