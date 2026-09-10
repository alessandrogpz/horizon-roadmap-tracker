// Sets up the local replica set. Run by the `init` service in compose.yaml on
// every `docker compose up`, connected to mongo1 without logging in. Safe to
// repeat: each step checks before it acts.
//
// 1. Initiate replica set rs0, unless it already exists.
// 2. Wait for the members to elect a primary.
// 3. Create `root`, unless it exists. Until a database has its first user,
//    MongoDB's "localhost exception" lets a client on localhost do exactly that
//    and nothing else; creating the user closes the exception for good.
// 4. Log in as root, and create or update the app's users, each with readWrite
//    on one database and nothing more. `horizon_app` can't manage users, touch
//    other databases, or drop its own. That's least privilege: a bug or an
//    injection in the app can only reach the app's own data. `horizon_test`
//    is the same for `npm run test:db`, which gets a database of its own so
//    tests can wipe collections without touching development data, and
//    `horizon_perf` for the generated dataset (`npm run db:seed`).
//
// Passwords come from .env.docker (see scripts/dev-env.mjs) and are never
// printed.

const RS = "rs0";
const MEMBERS = ["localhost:27017", "localhost:27018", "localhost:27019"];
const ROOT_USER = "root";
const APP_USERS = [
  { user: "horizon_app", db: "horizon", passwordVar: "MONGO_APP_PASSWORD" },
  { user: "horizon_test", db: "horizon_test", passwordVar: "MONGO_TEST_PASSWORD" },
  // For the generated dataset and its measurements (npm run db:seed, db:explain).
  { user: "horizon_perf", db: "horizon_perf", passwordVar: "MONGO_PERF_PASSWORD" },
];

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing from .env.docker. Run \`npm run db:up\`, which generates it.`);
  }
  return value;
};
const rootPassword = requireEnv("MONGO_ROOT_PASSWORD");
const appUsers = APP_USERS.map((spec) => ({ ...spec, password: requireEnv(spec.passwordVar) }));

// 1. `hello` needs no login, and names the set once it exists.
if (!db.hello().setName) {
  rs.initiate({ _id: RS, members: MEMBERS.map((host, i) => ({ _id: i, host })) });
  print(`Initiated replica set ${RS}: ${MEMBERS.join(", ")}.`);
}

// 2.
let primary;
for (let i = 0; i < 60 && !(primary = db.hello().primary); i++) sleep(1000);
if (!primary) throw new Error("The replica set elected no primary within 60 seconds.");

// 3. Straight to the primary, still over localhost, so the exception applies.
const admin = new Mongo(`mongodb://${primary}/?directConnection=true`).getDB("admin");

const loggedIn = () => {
  try {
    return admin.auth(ROOT_USER, rootPassword).ok === 1;
  } catch {
    return false; // no users yet, or a different password
  }
};

if (!loggedIn()) {
  try {
    admin.createUser({ user: ROOT_USER, pwd: rootPassword, roles: ["root"] });
    print(`Created user ${ROOT_USER}.`);
  } catch (error) {
    if (error.codeName === "Unauthorized") {
      throw new Error(
        "Users already exist, but MONGO_ROOT_PASSWORD in .env.docker isn't root's password. " +
          "Put the old one back, or start over with `npm run db:reset` (deletes all local data)."
      );
    }
    throw error;
  }
  if (!loggedIn()) throw new Error(`Created ${ROOT_USER}, but couldn't log in as it.`);
}

// 4. Updating on every run keeps the stored passwords in step with the file.
for (const { user, db: dbName, password } of appUsers) {
  const roles = [{ role: "readWrite", db: dbName }];
  if (admin.getUser(user)) {
    admin.updateUser(user, { pwd: password, roles });
    print(`Updated user ${user}.`);
  } else {
    admin.createUser({ user, pwd: password, roles });
    print(`Created user ${user} (readWrite on ${dbName}).`);
  }
}

print(`Local MongoDB is ready: replica set ${RS}, primary ${primary}.`);
