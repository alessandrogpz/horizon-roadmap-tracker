/**
 * Where to find the people using this, and the person making it.
 *
 * One constant rather than a link typed into the landing page, because it is
 * also wanted in the app, in the docs and — the day the server moves — in a
 * single edit. An environment variable overrides it, so a preview deploy can
 * point at a test server without a commit.
 *
 * `NEXT_PUBLIC_` is deliberate: this is a public invite link printed on a
 * public page, and there is nothing in it to keep.
 */
export const DISCORD_INVITE = (
  // Two names because the two bundlers inline two different prefixes: Next
  // only replaces `NEXT_PUBLIC_*`, Expo only `EXPO_PUBLIC_*`. Whichever is
  // not the current build's reads as undefined, which is why both can sit
  // here in one shared file.
  process.env.NEXT_PUBLIC_DISCORD_INVITE ??
  process.env.EXPO_PUBLIC_DISCORD_INVITE ??
  "https://discord.gg/f8tJFhmzH2"
).trim();

/** Whether there is somewhere to send people. An empty override turns the
 *  community section off rather than printing a link to nowhere. */
export const hasCommunity = (): boolean => DISCORD_INVITE.trim().length > 0;
