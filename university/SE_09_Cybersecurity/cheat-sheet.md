# Security fundamentals — the answers that aren't in the repo

Questions 1–6 of [exam.md](exam.md). Everything else is answered by the project itself.
Keep this to one read-through; it is a reminder, not a textbook.

## 1. The goals

| Goal | Means | In Horizon |
|---|---|---|
| **Confidentiality** | only the intended party can read it | TLS, per-user query scoping, hashed session tokens, encrypted backups |
| **Integrity** | it has not been changed | TLS, `$jsonSchema` + zod, `writeConcern: majority`, signed packages |
| **Availability** | it answers when needed | 3-member replica set, offline-first clients, rate limits, `/api/health` |
| **Authenticity** | it is really from who it claims | Google's RS256 ID token, TLS certificates |
| **Non-repudiation** | they cannot deny doing it | the audit log of every sync that changed something |
| **Authorization** | they are allowed to do it | session → `userId` on every query; least-privilege DB users |

## 2. Encryption

- **Symmetric** — one shared key, fast, for bulk data. **AES-256-GCM**, **ChaCha20-Poly1305**. Both are
  *AEAD*: they encrypt and authenticate in one pass, so tampering is detected.
- **Asymmetric** — a key pair; the public half encrypts or verifies, the private half decrypts or signs.
  Slow, so it is used on small things. **RSA-2048/4096**, **ECDSA / Ed25519** (signing),
  **ECDH / X25519** (key agreement).
- **In practice you use both:** asymmetric to prove identity and agree on a secret, symmetric for
  everything after. TLS, and the project's GPG-encrypted backup, both work this way.
- **Hashing is not encryption** — one-way, no key. SHA-256 for integrity and for the session token;
  **Argon2 / bcrypt / scrypt** for passwords, because they are deliberately slow. *Horizon stores no
  passwords at all* — Google does. That is itself a security decision worth saying.

## 3. Digital signatures

Hash the message, encrypt the hash with the **private** key. Anyone with the public key verifies it.
Gives authenticity + integrity + non-repudiation. Three in this project:

1. **Google's ID token** — RS256, verified against Google's published JWKS (`lib/server/auth/googleIdToken.ts`).
2. **TLS certificates** — signed by a CA the browser already trusts.
3. **npm packages** — `npm audit signatures` checks registry signatures and provenance, in CI.

## 4–5. TLS 1.3, and how many keys

Three kinds, and the examiner is usually fishing for exactly this:

1. **The server's long-term key pair.** Public half is in the certificate; the private half *signs* the
   handshake, proving the server is who the certificate says. The certificate is signed by a CA.
2. **One ephemeral key pair per side (ECDHE).** Both sides combine them into a shared secret nobody
   watching can compute. They are thrown away afterwards — so recorded traffic stays unreadable even if
   the server's long-term key later leaks. That is **forward secrecy**, and it comes from the
   *ephemeral* pair, not the certificate.
3. **Symmetric keys derived from that secret** — separate ones per direction, used with AES-GCM or
   ChaCha20-Poly1305 for all application data.

So: asymmetric to authenticate and agree, symmetric for speed. TLS 1.3 also does it in **one round
trip** and dropped the older ciphers and static-RSA key exchange that had no forward secrecy.

**HSTS** (`Strict-Transport-Security`) tells the browser to refuse plain HTTP for this host for the
next *n* seconds — two years here. It closes the first-request downgrade window that a redirect leaves
open.

## 6. Securing a machine at layer 3 (IP)

- **Host firewall** — default-deny inbound, allow only what is needed. `ufw` is active on the dev
  machine; it matters because `npm run dev:lan` binds to every interface.
- **Bind to the loopback** where possible. The local MongoDB listens on `127.0.0.1` only.
- **Network-level allow lists** — Atlas's IP access list is the managed equivalent. Horizon accepts
  any IP there, deliberately and with a reason (free tier, changing Vercel egress IPs).
- **Segmentation / private networking** — a VPC or peering so the database has no public address at
  all. Paid-tier only, and the honest answer to "what would you do with more budget".
- Above that: IPsec for confidentiality at layer 3, and rate limiting / anycast for floods.

## Mapping, if they ask "which layer?"

| Layer | Threat | Answer in Horizon |
|---|---|---|
| Physical | stolen laptop, unencrypted disk | full-disk encryption, screen lock (I10) |
| Network | who can reach what; floods | loopback binding, firewall, Atlas list, rate limits |
| Transport | read or changed in transit | TLS 1.3 + HSTS |
| Application | sign-in, sessions, authz, injection, XSS, CSRF | the bulk of MEASURES.md |
| Dev & ops | dependencies, secrets, deploys, backups | CI, gitleaks, Semgrep, Dependabot, encrypted backup |
