// A user's history, computed by MongoDB aggregation pipelines over the
// `completions` buckets: activity per weekday, per week and per month,
// totals per track, and each track's longest streak.
//
// Every pipeline starts with $match on userId, the first key of the
// {userId, trackId, date} index, so each one reads only this user's days.
//
// "Active" follows the app's own streak rule (lib/streak.ts): a day with at
// least one accomplishment. "Ticks" counts the tick boxes ticked that day.

import type { mongo } from "mongoose";
import { mongoose } from "../db";
import { COMPLETIONS, TRACKS } from "../collections";

type ObjectId = mongoose.Types.ObjectId;

/** Per-day figures every pipeline builds on. */
const perDay = (userId: ObjectId): mongo.Document[] => [
  { $match: { userId } },
  {
    $project: {
      trackId: 1,
      date: 1,
      day: { $dateFromString: { dateString: "$date", format: "%Y-%m-%d" } },
      accomplished: { $size: { $filter: { input: "$accomplishments", cond: "$$this.done" } } },
      ticks: {
        $add: [
          { $size: { $filter: { input: "$tasks", cond: "$$this.done" } } },
          { $size: { $filter: { input: "$revisions", cond: "$$this.done" } } },
        ],
      },
    },
  },
];

const isActive = { $cond: [{ $gt: ["$accomplished", 0] }, 1, 0] };

/** The same figures per calendar date, across all tracks: a date that's
 *  active on two tracks is still one active day. */
const perDate = (userId: ObjectId): mongo.Document[] => [
  ...perDay(userId),
  { $group: { _id: "$date", date: { $first: "$date" }, day: { $first: "$day" }, accomplished: { $sum: "$accomplished" }, ticks: { $sum: "$ticks" } } },
];

/** The pipelines, exported so scripts/explain.ts can measure them. */
export const pipelines = {
  totals: (userId: ObjectId) => [
    ...perDate(userId),
    {
      $group: {
        _id: null,
        activeDays: { $sum: isActive },
        accomplishments: { $sum: "$accomplished" },
        ticks: { $sum: "$ticks" },
        firstDay: { $min: "$date" },
        lastDay: { $max: "$date" },
      },
    },
  ],

  byWeekday: (userId: ObjectId) => [
    ...perDate(userId),
    { $group: { _id: { $isoDayOfWeek: "$day" }, activeDays: { $sum: isActive }, accomplishments: { $sum: "$accomplished" }, ticks: { $sum: "$ticks" } } },
    { $sort: { _id: 1 } },
  ],

  byWeek: (userId: ObjectId) => [
    ...perDate(userId),
    { $group: { _id: { $dateToString: { date: "$day", format: "%G-W%V" } }, activeDays: { $sum: isActive }, accomplishments: { $sum: "$accomplished" }, ticks: { $sum: "$ticks" } } },
    { $sort: { _id: -1 } },
    { $limit: 12 },
    { $sort: { _id: 1 } },
  ],

  byMonth: (userId: ObjectId) => [
    ...perDate(userId),
    { $group: { _id: { $substrBytes: ["$date", 0, 7] }, activeDays: { $sum: isActive }, accomplishments: { $sum: "$accomplished" }, ticks: { $sum: "$ticks" } } },
    { $sort: { _id: -1 } },
    { $limit: 12 },
    { $sort: { _id: 1 } },
  ],

  /** Totals per track, joined to the track's name. The $lookup is scoped by
   *  userId as well as trackId: track ids are only unique per user, so
   *  joining on trackId alone could pull in another user's track. */
  byTrack: (userId: ObjectId) => [
    ...perDay(userId),
    {
      $group: {
        _id: "$trackId",
        activeDays: { $sum: isActive },
        accomplishments: { $sum: "$accomplished" },
        ticks: { $sum: "$ticks" },
        firstDay: { $min: "$date" },
        lastDay: { $max: "$date" },
      },
    },
    {
      $lookup: {
        from: TRACKS,
        let: { trackId: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$userId", userId] }, { $eq: ["$trackId", "$$trackId"] }] } } },
          { $project: { _id: 0, name: "$meta.name", archived: "$meta.archived" } },
        ],
        as: "track",
      },
    },
    { $set: { name: { $ifNull: [{ $first: "$track.name" }, "(deleted track)"] }, archived: { $first: "$track.archived" } } },
    { $unset: "track" },
    { $sort: { activeDays: -1 } },
  ],

  /**
   * Each track's longest run of consecutive active days: a "gaps and islands"
   * query. Number each active day within its track in date order
   * ($setWindowFields + $documentNumber). On a run of consecutive days, the
   * day's number (days since 1970) minus that rank stays constant; a gap
   * changes it. So grouping by (track, that difference) gives one group per
   * run, and the biggest group is the longest streak.
   */
  longestStreaks: (userId: ObjectId) => [
    ...perDay(userId),
    { $match: { accomplished: { $gt: 0 } } },
    { $setWindowFields: { partitionBy: "$trackId", sortBy: { day: 1 }, output: { rank: { $documentNumber: {} } } } },
    { $set: { island: { $subtract: [{ $divide: [{ $toLong: "$day" }, 86_400_000] }, "$rank"] } } },
    { $group: { _id: { trackId: "$trackId", island: "$island" }, length: { $sum: 1 }, from: { $min: "$date" }, to: { $max: "$date" } } },
    { $sort: { length: -1, to: -1 } },
    { $group: { _id: "$_id.trackId", length: { $first: "$length" }, from: { $first: "$from" }, to: { $first: "$to" } } },
    { $sort: { length: -1 } },
  ],
};

interface Bucket {
  _id: string | number;
  activeDays: number;
  accomplishments: number;
  ticks: number;
}

export interface Stats {
  totals: { activeDays: number; accomplishments: number; ticks: number; firstDay: string | null; lastDay: string | null };
  /** Mon..Sun: the share of that weekday, since the first recorded day, that was active. */
  byWeekday: { weekday: number; activeDays: number; rate: number; accomplishments: number; ticks: number }[];
  byWeek: { week: string; activeDays: number; accomplishments: number; ticks: number }[];
  byMonth: { month: string; activeDays: number; accomplishments: number; ticks: number }[];
  byTrack: {
    trackId: string;
    name: string;
    archived: boolean;
    activeDays: number;
    accomplishments: number;
    ticks: number;
    firstDay: string;
    lastDay: string;
    longestStreak: { length: number; from: string; to: string } | null;
  }[];
}

/** How many times each ISO weekday (1 = Mon) occurs from `from` to `to`, inclusive. */
function weekdayCounts(from: string, to: string): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const start = Date.parse(`${from}T00:00:00Z`);
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - start) / 86_400_000) + 1;
  for (let i = 0; i < days; i++) counts[(new Date(start + i * 86_400_000).getUTCDay() + 6) % 7] += 1;
  return counts;
}

export async function userStats(userId: ObjectId): Promise<Stats> {
  const completions = mongoose.connection.db!.collection(COMPLETIONS);
  const run = <T extends mongo.Document>(pipeline: mongo.Document[]) => completions.aggregate<T>(pipeline).toArray();

  const [[totals], weekdays, weeks, months, tracks, streaks] = [
    await run<Bucket & { firstDay: string; lastDay: string }>(pipelines.totals(userId)),
    await run<Bucket>(pipelines.byWeekday(userId)),
    await run<Bucket>(pipelines.byWeek(userId)),
    await run<Bucket>(pipelines.byMonth(userId)),
    await run<Bucket & { firstDay: string; lastDay: string; name: string; archived?: boolean }>(pipelines.byTrack(userId)),
    await run<{ _id: string; length: number; from: string; to: string }>(pipelines.longestStreaks(userId)),
  ];

  const firstDay = totals?.firstDay ?? null;
  const lastDay = totals?.lastDay ?? null;
  const occurrences = firstDay && lastDay ? weekdayCounts(firstDay, lastDay) : [0, 0, 0, 0, 0, 0, 0];
  const streakByTrack = new Map(streaks.map((s) => [s._id, { length: s.length, from: s.from, to: s.to }]));

  return {
    totals: {
      activeDays: totals?.activeDays ?? 0,
      accomplishments: totals?.accomplishments ?? 0,
      ticks: totals?.ticks ?? 0,
      firstDay,
      lastDay,
    },
    byWeekday: [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const found = weekdays.find((w) => w._id === weekday);
      const activeDays = found?.activeDays ?? 0;
      return {
        weekday,
        activeDays,
        rate: occurrences[weekday - 1] ? activeDays / occurrences[weekday - 1] : 0,
        accomplishments: found?.accomplishments ?? 0,
        ticks: found?.ticks ?? 0,
      };
    }),
    byWeek: weeks.map((w) => ({ week: String(w._id), activeDays: w.activeDays, accomplishments: w.accomplishments, ticks: w.ticks })),
    byMonth: months.map((m) => ({ month: String(m._id), activeDays: m.activeDays, accomplishments: m.accomplishments, ticks: m.ticks })),
    byTrack: tracks.map((t) => ({
      trackId: String(t._id),
      name: t.name,
      archived: !!t.archived,
      activeDays: t.activeDays,
      accomplishments: t.accomplishments,
      ticks: t.ticks,
      firstDay: t.firstDay,
      lastDay: t.lastDay,
      longestStreak: streakByTrack.get(String(t._id)) ?? null,
    })),
  };
}
