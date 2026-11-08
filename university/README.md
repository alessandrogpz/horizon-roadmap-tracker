# University — assessment material

Everything that exists **only** for the three module assessments. Documentation that describes the
software itself stays in the repository, in [`../docs/`](../docs/README.md), because an examiner
browsing the repo should find it there.

Three exams, same day, each 1:1 and 15–30 minutes with the laptop open.

| Module | Folder | Claiming | Shape of the exam |
|---|---|---|---|
| **SE_06 NoSQL Databases** | [SE_06_NoSQL_databases/](SE_06_NoSQL_databases/) | **Level 3** | Overview and demo, then questions |
| **SE_09 Cyber Security** | [SE_09_Cybersecurity/](SE_09_Cybersecurity/) | **Level 3** | 5-minute talk on the methods applied, then questions |
| **SE_47 Mobile App Development** | [SE_47_Mobile_development/](SE_47_Mobile_development/) | **Level 2** | The app running on the phone, then questions |

Each folder holds the same three things: a **README** (hand-ins, level mapping, submission
checklist), an **exam.md** (the drill — how to practise, what to show, the commands, the questions),
and a **self-assessment.md** scaffold.

| Also here | What it is |
|---|---|
| [exam-day.md](exam-day.md) | The shared checklist for the day before |
| [LEARNING_LOG.md](LEARNING_LOG.md) | 18 entries, one per step: what changed, why, the concepts, and how to see it work |
| [MODULES_PLAN.md](MODULES_PLAN.md) | The plan SE_06 and SE_09 were built to, with the decisions and why |

## One project, three exams

Each examiner cares about a different face of the same work. Naming the overlaps is worth doing —
it shows the thing was built, not assembled for a grade.

- The strict schema that refused real data in production is a **NoSQL** validation story, a
  **security** input-handling story, and a **mobile** version-skew story.
- Per-user query scoping is **security**; the compound indexes that make it cheap are **NoSQL**.
- The framework-free `lib/` folder is the **mobile** architecture answer, and the reason the merge
  rules can be trusted on three platforms at once.

## Before you hand anything in

1. **Read access for `peterruppel`** (or `peter.ruppel@code.berlin`) on the repository. One project only.
2. **[MODULES_PLAN.md](MODULES_PLAN.md) and the threat model's §9/§10 name open security issues** on
   the assumption the repo stays private, and say so. Fine for a coordinator with granted access;
   **not** fine if the repo is ever made public.
3. **The reflection essays are yours.** SE_47's instructions forbid LLM use for them explicitly;
   assume the same for the others. The scaffolds are facts and questions, not drafts.
