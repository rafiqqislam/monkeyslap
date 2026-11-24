import { FIRST_SLAP_MINUTES, type Settings } from "./settings";
import { usageFor, type UsageLog } from "./usage";

export interface LimitStatus {
  domain: string;
  usedMs: number;
  /** The limit in force right now (1 min before the first slap ever). */
  limitMs: number;
  /** The daily limit the user set for this site. */
  dailyLimitMs: number;
  remainingMs: number;
  over: boolean;
  slapsToday: number;
  /** True until this person has been slapped for the first time. */
  firstSlap: boolean;
}

export interface LimitContext {
  /** Whether this person has ever been slapped (test slaps don't count). */
  hasBeenSlapped: boolean;
}

/** The limit in force, in minutes: the first slap comes sooner so new users see it. */
export function effectiveMinutes(dailyMinutes: number, ctx: LimitContext): number {
  return ctx.hasBeenSlapped ? dailyMinutes : Math.min(dailyMinutes, FIRST_SLAP_MINUTES);
}

/** How the user is doing against their limit for `domain` today, or null if it has none. */
export function limitStatus(
  settings: Settings,
  log: UsageLog,
  domain: string,
  now: number,
  ctx: LimitContext,
): LimitStatus | null {
  const limit = settings.limits.find((l) => l.domain === domain && l.enabled);
  if (!limit) return null;
  const today = usageFor(log, domain, now);
  const limitMs = effectiveMinutes(limit.dailyMinutes, ctx) * 60_000;
  const remainingMs = Math.max(0, limitMs - today.ms);
  return {
    domain,
    usedMs: today.ms,
    limitMs,
    dailyLimitMs: limit.dailyMinutes * 60_000,
    remainingMs,
    over: remainingMs === 0,
    slapsToday: today.slaps,
    firstSlap: !ctx.hasBeenSlapped,
  };
}
