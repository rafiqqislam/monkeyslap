import type { Settings } from "./settings";
import { usageFor, type UsageLog } from "./usage";

export interface LimitStatus {
  domain: string;
  usedMs: number;
  limitMs: number;
  remainingMs: number;
  over: boolean;
  slapsToday: number;
}

/** How the user is doing against their limit for `domain` today, or null if it has none. */
export function limitStatus(
  settings: Settings,
  log: UsageLog,
  domain: string,
  now: number,
): LimitStatus | null {
  const limit = settings.limits.find((l) => l.domain === domain && l.enabled);
  if (!limit) return null;
  const today = usageFor(log, domain, now);
  const limitMs = limit.dailyMinutes * 60_000;
  const remainingMs = Math.max(0, limitMs - today.ms);
  return {
    domain,
    usedMs: today.ms,
    limitMs,
    remainingMs,
    over: remainingMs === 0,
    slapsToday: today.slaps,
  };
}
