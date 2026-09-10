// Mongoose models for accounts. Collections: `users`, `sessions`.
// (Tracks, completions and notes arrive with sync, MODULES_PLAN.md step 4e.)

import { mongoose } from "./db";

const { Schema } = mongoose;

/** One document per Google account. `googleSub` is Google's permanent id for
 *  the account; email addresses can change hands, so they never identify a
 *  user. Nothing here comes from the request body, only from a verified token. */
const userSchema = new Schema(
  {
    googleSub: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, default: "" },
    createdAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    /** The track last open on any of this user's devices, for a new device
     *  that has no preference of its own yet. One-to-one with the user, so
     *  it's embedded here rather than kept in a collection of its own. */
    activeTrackId: { type: String },
  },
  { versionKey: false, strict: "throw" }
);

/** One document per signed-in browser. The `_id` is the SHA-256 of the cookie's
 *  token, never the token itself: a leaked collection holds nothing a browser
 *  could send back. MongoDB deletes each document once `expiresAt` passes (a
 *  TTL index; its background task runs about once a minute, which is why
 *  lookups also check the date). */
const sessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false, strict: "throw" }
);

/** One document per note: material notes, and each track's Notepad and To-do
 *  List. Written through this model (so Mongoose casts and checks every
 *  value) inside the sync transaction. The collection itself, with its
 *  $jsonSchema validator and indexes, is created by sync/collections.ts, so
 *  Mongoose's own automatic creation is off. */
const noteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    noteId: { type: String, required: true },
    kind: { type: String, required: true, enum: ["material", "notepad", "todo"] },
    trackId: { type: String },
    content: { type: String, required: true, default: "" },
    /** The device's own timestamp (ms), compared with other devices' for
     *  last-write-wins. Never the server's clock. */
    updatedAt: { type: Number, required: true },
  },
  { versionKey: false, strict: "throw", autoCreate: false, autoIndex: false, collection: "notes" }
);

export type UserRecord = mongoose.InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

// Reuse compiled models across Next's dev-mode module reloads.
export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
export const Session = mongoose.models.Session ?? mongoose.model("Session", sessionSchema);
export const Note = mongoose.models.Note ?? mongoose.model("Note", noteSchema);
