# Preparing the orals

Three exams, on the same day, each one-to-one and 15 to 30 minutes with your laptop open. One file
each, so you can prepare them separately:

| Exam | Prepare with | Shape of it |
|---|---|---|
| **Cyber Security** | [`exams/security.md`](exams/security.md) | A 5-minute talk on the security methods applied, then questions |
| **SE_06 NoSQL Databases** | [`exams/nosql.md`](exams/nosql.md), then [`exams/nosql-level3.md`](exams/nosql-level3.md) | An overview and a demo, then questions. The second file is the Level 3 drill: every objective turned into something to rehearse, with a 25-question cold call |
| **Mobile App Development** | [`exams/mobile.md`](exams/mobile.md) | The app running on the phone, then questions |

Set-up for the day, shared by all three: [`exams/day-before.md`](exams/day-before.md).

The concepts behind every step, with the likely questions attached, are in
[`LEARNING_LOG.md`](LEARNING_LOG.md). [`README.md`](README.md) says what every other document is, if
you need to find one mid-answer.

**One project, three exams.** Each examiner cares about a different face of the same work, and it is
worth naming the overlaps when they come up — they show the thing was built, not assembled for a
grade:

- The strict schema that refused a legacy field is a *NoSQL* validation story, a *security*
  input-handling story, and a *mobile* version-skew story (learning log 13).
- Per-user query scoping is *security*; the compound indexes that make it cheap are *NoSQL*.
- The framework-free `lib/` folder is an *architecture* answer in the mobile exam, and the reason the
  merge rules can be trusted on three platforms at once.
