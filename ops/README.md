# Operations keys

This folder holds the **public** half of the key the scheduled backup encrypts to
(`.github/workflows/backup.yml`). A public key is not a secret: it can only lock, and
committing it is what lets a workflow run make a backup nobody but the owner can read.

`backup-key.pub` is generated once, by the owner, and its private half never leaves their
machine. The steps are in [`../docs/security/RUNBOOK.md`](../docs/security/RUNBOOK.md) §8.

Nothing secret belongs here. If a private key ever lands in this folder, treat it as leaked:
generate a new pair, replace the public key, and take a fresh backup with it.
