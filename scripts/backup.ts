// Backs up one database with mongodump (threat D4: the Atlas free tier has
// no backups of its own).
//
//   npm run db:backup                         the local development database
//   npm run db:backup -- --uri-env ATLAS_URI  any database whose connection
//                                             string is in that env variable
//   npm run db:backup -- --encrypt-to ops/backup-key.pub   encrypted (below)
//
// Encryption is asymmetric, which is the point: the public key encrypts, and
// only the private key — which never leaves the owner's machine — decrypts. So
// the scheduled backup in .github/workflows/backup.yml can make a backup of
// real accounts without GitHub, or anyone who can read that repository, being
// able to read it. The dump is piped straight into gpg, so the unencrypted
// archive never touches a disk. Restoring: docs/security/RUNBOOK.md §4.
//
// Writes backups/<database>-<time>.archive.gz: one compressed archive of every
// collection, its documents, indexes and validators. The folder is
// git-ignored and the file readable only by you; a backup holds personal data.
// Keeps the newest 14 per database.
//
// mongodump runs from the same mongo image as the database, so nothing extra
// needs installing. The connection string reaches it through an environment
// variable, not the command line, where other processes could read it.
//
// Restore (docs/security/RUNBOOK.md has the details): give mongorestore a
// connection string *without* a database name (it would take that as the
// target, and restore nothing), and choose the database with --nsInclude or
// --nsFrom/--nsTo:
//   docker run --rm -i --network host -e URI mongo:8.3 \
//     sh -c 'mongorestore --uri="$URI" --archive --gzip --drop --nsInclude="horizon.*"' < backups/<file>
// Tested: a 24 MB backup of the generated dataset restored 587,578 documents,
// every count, index and validator matching.

import { spawn } from "node:child_process";
import { chmodSync, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { arg, loadEnvLocal } from "./env";

const KEEP = 14;

async function main() {
  loadEnvLocal();
  const variable = arg("uri-env", "MONGODB_URI");
  const uri = process.env[variable];
  if (!uri) throw new Error(`${variable} isn't set.`);
  const database = uri.match(/\/([A-Za-z0-9_-]+)\?/)?.[1] ?? "database";

  const recipient = arg("encrypt-to", "");
  if (recipient && !existsSync(recipient)) throw new Error(`No public key at ${recipient}. Making an unencrypted backup instead would be worse; see docs/security/RUNBOOK.md §8.`);

  mkdirSync("backups", { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = `backups/${database}-${stamp}.archive.gz${recipient ? ".gpg" : ""}`;
  const out = createWriteStream(file, { mode: 0o600 });

  console.log(`Backing up ${database} to ${file}${recipient ? ` (encrypted to ${recipient})` : ""}…`);
  await new Promise<void>((resolve, reject) => {
    const dump = spawn(
      "docker",
      ["run", "--rm", "--network", "host", "-e", "URI", "mongo:8.3", "sh", "-c", 'mongodump --uri="$URI" --archive --gzip --quiet'],
      { env: { ...process.env, URI: uri }, stdio: ["ignore", "pipe", "inherit"] }
    );
    dump.on("error", reject);

    if (!recipient) {
      dump.stdout.pipe(out);
      dump.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`mongodump exited with ${code}`))));
      return;
    }

    // Straight from the dump into gpg: no plaintext copy anywhere on the way.
    const gpg = spawn(
      "gpg",
      ["--batch", "--yes", "--trust-model", "always", "--recipient-file", recipient, "--encrypt", "--output", "-"],
      { stdio: ["pipe", "pipe", "inherit"] }
    );
    dump.stdout.pipe(gpg.stdin);
    gpg.stdout.pipe(out);
    gpg.on("error", reject);
    let dumped = false;
    dump.on("close", (code) => (code === 0 ? (dumped = true) : reject(new Error(`mongodump exited with ${code}`))));
    gpg.on("close", (code) => {
      if (code !== 0) return reject(new Error(`gpg exited with ${code}`));
      if (!dumped) return reject(new Error("gpg finished but mongodump didn't"));
      resolve();
    });
  });
  await new Promise((resolve) => out.close(resolve));
  chmodSync(file, 0o600);
  console.log(`Done: ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB.`);

  const mine = readdirSync("backups").filter((f) => f.startsWith(`${database}-`)).sort();
  for (const old of mine.slice(0, Math.max(0, mine.length - KEEP))) {
    unlinkSync(`backups/${old}`);
    console.log(`Removed the old backup ${old}.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
