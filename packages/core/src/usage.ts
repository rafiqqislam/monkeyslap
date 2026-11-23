import { dateKey, startOfNextDay, startOfDay, type DateKey } from "./dates";

/**
 * One row per site per day. This is the shape that will later be synced to the
 * server (see docs/ARCHITECTURE.md): small, and enough for streaks and dashboards.
 */
export interface DayUsage {
  ms: number;
  slaps: number;
}

export type UsageLog = Record<DateKey, Record<string, DayUsage>>;

const EMPTY: DayUsage = { ms: 0, slaps: 0 };

function bump(log: UsageLog, day: DateKey, domain: string, delta: Partial<DayUsage>): UsageLog {
  const dayRows = log[day] ?? {};
  const row = dayRows[domain] ?? EMPTY;
  return {
    ...log,
    [day]: {
      ...dayRows,
      [domain]: { ms: row.ms + (delta.ms ?? 0), slaps: row.slaps + (delta.slaps ?? 0) },
    },
  };
}

/** Adds time spent on `domain` between two instants, splitting it at local midnight. */
export function addTime(log: UsageLog, domain: string, startMs: number, endMs: number): UsageLog {
  let next = log;
  let cursor = startMs;
  while (cursor < endMs) {
    const boundary = Math.min(endMs, startOfNextDay(cursor));
    next = bump(next, dateKey(cursor), domain, { ms: boundary - cursor });
    cursor = boundary;
  }
  return next;
}

export function addSlap(log: UsageLog, domain: string, atMs: number): UsageLog {
  return bump(log, dateKey(atMs), domain, { slaps: 1 });
}

export function usageFor(log: UsageLog, domain: string, atMs: number): DayUsage {
  return log[dateKey(atMs)]?.[domain] ?? EMPTY;
}

/** Drops days older than `keepDays` so local storage stays small. */
export function pruneUsage(log: UsageLog, nowMs: number, keepDays = 90): UsageLog {
  const cutoff = dateKey(startOfDay(nowMs) - keepDays * 86_400_000);
  const next: UsageLog = {};
  for (const [day, rows] of Object.entries(log)) {
    if (day >= cutoff) next[day] = rows;
  }
  return next;
}
