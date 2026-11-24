import { dateKey, startOfDay, type DateKey } from "./dates";
import type { UsageLog } from "./usage";

/** One row of the daily_usage table, without the user and device ids. */
export interface UsageRow {
  day: DateKey;
  domain: string;
  ms: number;
  slaps: number;
}

/** Flattens the usage log into rows, optionally only for days on or after `sinceDay`. */
export function usageRows(log: UsageLog, sinceDay?: DateKey): UsageRow[] {
  const rows: UsageRow[] = [];
  for (const [day, sites] of Object.entries(log)) {
    if (sinceDay && day < sinceDay) continue;
    for (const [domain, u] of Object.entries(sites)) {
      rows.push({ day, domain, ms: Math.round(u.ms), slaps: u.slaps });
    }
  }
  return rows.sort((a, b) => (a.day === b.day ? a.domain.localeCompare(b.domain) : a.day < b.day ? -1 : 1));
}

/** The day `days` days before `now`, for "sync the last few days". */
export function daysAgo(now: number, days: number): DateKey {
  const d = new Date(startOfDay(now));
  d.setDate(d.getDate() - days);
  return dateKey(d.getTime());
}

/**
 * Which copy of the settings to keep when a device syncs: the one changed most
 * recently. Ties keep the local copy.
 */
export function pickSettingsSource(localUpdatedAt: number, remoteUpdatedAt: number | null): "local" | "remote" {
  return remoteUpdatedAt !== null && remoteUpdatedAt > localUpdatedAt ? "remote" : "local";
}
