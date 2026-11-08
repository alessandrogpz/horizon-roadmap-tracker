# SE Self-Assessment: Reflection on the Learning Process

> **Do not write this with an LLM.** SE_47's instructions say so explicitly, and CODE's assessment
> instructions are shared across modules — assume the same here unless SE_09's wording says otherwise.
>
> So this is a scaffold: the structure, the **facts** dug out of the repository and git history, and
> **questions** for you. Delete every `>` block as you write.

**Name:** Alessandro Perez · **CODE Email:** alessandro.perez@code.berlin
**Semester:** Fall 2026 · **Module:** SE_09 (Cyber Security) · **Project:** Horizon

---

## 1. What did you set out to learn and to build?

> **Facts.** The security work runs 2026-09-10 (`0.14.4`, the local-routes CSRF fix) to 2026-09-22
> (`0.22.0`, detection and response). The threat model (`0.17.1`) was written **before** the server
> existed — the sign-in and sync code did not exist yet, and its threats became the checklist for
> building them.
>
> - Did you set out to learn security, or did adding a server force it on you? The history suggests
>   the second; it is a good answer.
> - Horizon was offline-only before this. What did putting a server behind it actually put at risk?

## 2. What topics did you learn about which you previously knew nothing about?

> **Candidates. Pick what was genuinely new.**
> - **Threat modelling as a method** — DFD, trust boundaries, STRIDE per element, likelihood × impact,
>   and *accepting* a risk on purpose rather than pretending it is gone.
> - **CSRF** — and that you had it: any website could make your laptop open a local file (`0.14.4`).
>   You reproduced it from a real attack page before fixing it.
> - **OIDC vs OAuth 2.0** — one answers *who*, the other grants *access*. Dropping Drive sync (`0.32.0`)
>   left only the first, which is why no sensitive scope remains.
> - **Session design** — why store a hash and not the token; what `__Host-` and `SameSite` buy you.
> - **NoSQL operator injection**, and why user input must never become a field name.
> - **Securing the pipeline** — gitleaks over the whole history, Semgrep, package signatures, pinning
>   actions by SHA, a ruleset on `main` that binds you too.
> - **Detection without surveillance** — counters per kind per hour, no address, no account, TTL'd.
>
> - Which of these did you not know *existed*?
> - Where did a security constraint change the design rather than the code? Storing accomplishments as
>   arrays rather than a title-keyed map is one.
> - What do you still not know?

## 3. Which learning resources, and how did you use them?

> Only you know. Prompts: OWASP Top 10 / ASVS / cheat sheets? The STRIDE material? MDN on cookies and
> CSP? RFCs (6749 OAuth, OIDC Core, 8446 TLS 1.3)? Something that was not documentation?
> Did you attend the Learning Unit? Say so either way. Be specific about *how* — read once, or returned
> to when stuck.

## 4. In which ways did you use LLMs?

> **Facts you can be accurate from.** A large amount of this code was written with LLM assistance. It
> was also used adversarially — generating forged, unsigned and algorithm-confused tokens to test the
> verifier against. And it was wrong in ways you caught: the strict sync schema that refused your own
> real data on release day is the clearest.
>
> - Where was the line between using it and learning from it?
> - What did you have to understand *first* to tell a good suggestion from a bad one? A security
>   control that looks right and is wrong is the dangerous case — name one.
> - Could you re-derive the auth and session decisions unassisted? The oral will test that.

## 5. Where do you stand against the module description?

> **You are claiming Level 3.** The mapping with links is in [README.md](README.md). Argue from it in
> your own words — and only where you believe it.
>
> - One sentence for why Level 3 rather than Level 2. The strongest version is about *maintaining*:
>   three real incidents found and fixed, not three controls installed.
> - Where is your knowledge thinnest? Name it before an examiner does. Candidates: you have never
>   responded to a real attack, only to your own bugs; the accepted risks are accepted partly because
>   the free tier gives no alternative; you have not done a penetration test.
> - What would you secure next with one more week?

**GitHub link:** <add the repository URL>
