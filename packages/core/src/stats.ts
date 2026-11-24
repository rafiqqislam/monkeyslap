import { dateKey, startOfDay, type DateKey } from "./dates";
import type { UsageLog } from "./usage";

export interface SiteDay {
  domain: string;
  ms: number;
  slaps: number;
}

export interface DaySummary {
  day: DateKey;
  ms: number;
  slaps: number;
  /** Sites used that day, most time first. */
  sites: SiteDay[];
}

/** The last `count` days up to and including today, oldest first. Days with no use are zeros. */
export function lastDays(log: UsageLog, now: number, count: number): DaySummary[] {
  const out: DaySummary[] = [];
  const today = new Date(startOfDay(now));
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = dateKey(d.getTime());
    const sites = Object.entries(log[day] ?? {})
      .map(([domain, u]) => ({ domain, ms: u.ms, slaps: u.slaps }))
      .filter((s) => s.ms > 0 || s.slaps > 0)
      .sort((a, b) => b.ms - a.ms || a.domain.localeCompare(b.domain));
    out.push({
      day,
      ms: sites.reduce((n, s) => n + s.ms, 0),
      slaps: sites.reduce((n, s) => n + s.slaps, 0),
      sites,
    });
  }
  return out;
}

/** Totals per site across several days, most time first. */
export function siteTotals(days: readonly DaySummary[]): SiteDay[] {
  const byDomain = new Map<string, SiteDay>();
  for (const d of days) {
    for (const s of d.sites) {
      const t = byDomain.get(s.domain) ?? { domain: s.domain, ms: 0, slaps: 0 };
      t.ms += s.ms;
      t.slaps += s.slaps;
      byDomain.set(s.domain, t);
    }
  }
  return [...byDomain.values()].sort((a, b) => b.ms - a.ms || a.domain.localeCompare(b.domain));
}
