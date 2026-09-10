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

export type UserRecord = mongoose.InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

// Reuse compiled models across Next's dev-mode module reloads.
export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
export const Session = mongoose.models.Session ?? mongoose.model("Session", sessionSchema);
