// Sets up the local replica set. Run by the `init` service in compose.yaml on
// every `docker compose up`, connected to mongo1 without logging in. Safe to
// repeat: each step checks before it acts.
//
// 1. Initiate replica set rs0, unless it already exists.
// 2. Wait for the members to elect a primary.
// 3. Create `root`, unless it exists. Until a database has its first user,
//    MongoDB's "localhost exception" lets a client on localhost do exactly that
//    and nothing else; creating the user closes the exception for good.
// 4. Log in as root, and create or update `horizon_app`: readWrite on the
//    `horizon` database and nothing more. The app can't manage users, touch
//    other databases, or drop its own. That's least privilege: a bug or an
//    injection in the app can only reach the app's own data.
//
// Passwords come from .env.docker (see scripts/dev-env.mjs) and are never
// printed.

const RS = "rs0";
const MEMBERS = ["localhost:27017", "localhost:27018", "localhost:27019"];
const ROOT_USER = "root";
const APP_USER = "horizon_app";
const APP_DB = "horizon";

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing from .env.docker. Run \`npm run db:up\`, which generates it.`);
  }
  return value;
};
const rootPassword = requireEnv("MONGO_ROOT_PASSWORD");
const appPassword = requireEnv("MONGO_APP_PASSWORD");

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

// 4. Updating on every run keeps the stored password in step with the file.
const appRoles = [{ role: "readWrite", db: APP_DB }];
if (admin.getUser(APP_USER)) {
  admin.updateUser(APP_USER, { pwd: appPassword, roles: appRoles });
  print(`Updated user ${APP_USER}.`);
} else {
  admin.createUser({ user: APP_USER, pwd: appPassword, roles: appRoles });
  print(`Created user ${APP_USER} (readWrite on ${APP_DB}).`);
}

print(`Local MongoDB is ready: replica set ${RS}, primary ${primary}.`);
