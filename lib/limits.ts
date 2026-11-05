// How long a thing a person types is allowed to be.
//
// There was no answer to that question anywhere in the product. One `maxLength`
// existed, on the insights search box; the other inputs — across both apps —
// took whatever arrived. A track name is rendered in the top bar, in the
// switcher, on every roadmap row and in the phone app's header, and nothing
// between the keyboard and those places said "that is too long".
//
// It showed. A 196-character name with no spaces in it made the dashboard
// 1,662 pixels wide inside a 320-pixel window: the page scrolled sideways,
// the whole way, on every screen. Wrapping is fixed separately in globals.css
// — layout should survive any string — but wrapping is the second line of
// defence. This is the first: the string never gets that long.
//
// The numbers are generous on purpose. They are not a design constraint
// dressed up as validation; they are the point past which the text has
// stopped being a name and the field is being used for something else. A
// title that needs 200 characters is a description, and descriptions have
// their own field with its own ceiling.
//
// Shared, so the web app and the phone app cannot drift into disagreeing
// about what the same record may hold — the web app writes it, the phone
// reads it, and a value one accepts and the other truncates would be a sync
// conflict with no resolution.

export const LIMITS = {
  /** A track, a phase, a focus type, a day's label: something you say aloud. */
  name: 80,
  /** A task, a deliverable, a material, a to-do: a line, not a paragraph. */
  title: 200,
  /** The sentence under a title. */
  description: 1000,
  /** A URL. Browsers and servers vary; 2048 is the figure everything agrees on. */
  url: 2048,
  /** A free-text search box. */
  search: 100,
  /** Roadmaps and note documents — long-form by design, capped only so a
   *  paste accident cannot put a megabyte through the sync. */
  document: 200_000,
} as const;

export type LimitKey = keyof typeof LIMITS;
