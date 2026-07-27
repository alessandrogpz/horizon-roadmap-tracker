// JSON Schema for the generated roadmap.
//
// This is the model's output target — deliberately NOT TrackState. TrackState
// is ~30 fields, most of them sync and history bookkeeping that drives the
// Drive last-write-wins merge in lib/merge.ts. A model has no business
// inventing any of it. See AI_ROADMAP_PLAN.md D3.
//
// Absent by design: every id, every `completed` flag, `materials`, `portfolio`
// and `startDate`. Ids are assigned by the validator (D9), startDate comes from
// HorizonStep, `completed` is always false at seed time, and materials are out
// of scope for v1 because small models fabricate plausible books with dead URLs
// (D8).

import { DAY_NAMES, RHYTHM_TYPES } from "./prompts";
// Single source of truth, shared with the materials UI: generating a value the
// dropdowns don't offer produces a material the user can't edit back into a
// valid state.
import { MATERIAL_CATEGORIES, MATERIAL_TYPES } from "../materialOptions";

const detailItems = {
  type: "array",
  items: {
    type: "object",
    properties: {
      item: { type: "string" },
      desc: { type: "string" },
    },
    required: ["item", "desc"],
  },
} as const;

export const ROADMAP_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short track name, max ~40 chars" },
    color: { type: "string", description: "#rrggbb" },
    phases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          recommendedByDay: { type: "integer" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: { title: { type: "string" } },
              required: ["title"],
            },
          },
          detailedInfo: {
            type: "object",
            properties: {
              focus: detailItems,
              deliverable: detailItems,
              math: detailItems,
              // Optional on PhaseDetailedInfo and previously unreachable — it
              // was missing from this schema, so generation could never fill it.
              algoDS: detailItems,
            },
            required: ["focus", "deliverable", "math"],
          },
        },
        required: ["title", "description", "recommendedByDay", "tasks", "detailedInfo"],
      },
    },
    // D13: seven enum keys, not seven freehand day objects. The model cannot
    // name a day, invent a type vocabulary, or pick a colour — all three were
    // failure modes in screening, at every model size.
    weekSchedule: {
      type: "array",
      items: { type: "string", enum: Object.keys(RHYTHM_TYPES) },
      description: "Exactly 7 entries, Monday through Sunday",
    },

    // Study materials. `link` is deliberately absent from this schema and is
    // always forced to "" by the validator: models fabricate plausible book
    // titles with dead URLs, and a curriculum citing a book that doesn't exist
    // destroys trust faster than any other failure (D8). Titles are allowed —
    // and surfaced as unverified — but never addresses.
    materials: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          // Safe to generate in a way a URL is not: a wrong author is visible
          // to anyone who knows the field and costs nothing to correct, whereas
          // a wrong address is clickable and silently sends you somewhere else.
          author: { type: "string", description: "Author, publisher or channel. Omit if unsure." },
          category: { type: "string", enum: [...MATERIAL_CATEGORIES] },
          type: { type: "string", enum: [...MATERIAL_TYPES] },
          totalPages: { type: "integer", description: "0 unless it is a book" },
        },
        required: ["title", "category", "type"],
      },
    },

    // Concrete things the person will have built. Distinct from
    // detailedInfo.deliverable, which describes a phase's outcome in prose;
    // these become tracked portfolio entries.
    portfolio: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      },
    },

    // Recurring weekly study cycles. `id` and `startWeek` are absent by
    // design — both are assigned by the validator. `startWeek` in particular
    // anchors which item is "current" and drives the daily reset, so a model
    // guessing at it would desynchronise the whole rotation.
    rotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
              },
              required: ["title"],
            },
          },
          daysOfWeek: {
            type: "array",
            items: { type: "string", enum: DAY_NAMES as unknown as string[] },
          },
          target: {
            type: "string",
            enum: ["revision", "focus"],
            description: "revision for review-style items, focus for main work",
          },
        },
        required: ["label", "items", "daysOfWeek", "target"],
      },
    },
  },
  required: ["name", "color", "phases", "weekSchedule"],
} as const;

export const MAX_MATERIALS = 10;
export const MAX_PORTFOLIO = 6;
export const MAX_ROTATIONS = 3;
export const MAX_ROTATION_ITEMS = 12;

/** What the model is asked to produce, before validation and repair. */
export interface RawRoadmap {
  name?: unknown;
  color?: unknown;
  phases?: unknown;
  weekSchedule?: unknown;
}
