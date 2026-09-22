# Security

## Reporting a vulnerability

Please report security issues privately to <alessandroperez.developer@gmail.com> rather than in a public issue.
Include what you found, how to reproduce it, and what it lets an attacker do. Reports are acknowledged
within a week.

## How Horizon is secured

- [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md): what could go wrong, how likely and how
  bad each threat is, and what's done about it.
- [docs/security/MEASURES.md](docs/security/MEASURES.md): every implemented measure, where it lives, and
  how it's verified.
- [docs/security/RUNBOOK.md](docs/security/RUNBOOK.md): what to do when something goes wrong.

Every push runs type checks, lint, the unit and database test suites, a dependency audit with signature
verification, a secret scan of the whole history, and static analysis (`.github/workflows/ci.yml`).
