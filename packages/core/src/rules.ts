import type { LimitStatus } from "./limits";

/**
 * Every on-screen experience (slap now; bark, vocab quiz, mini-game later) has an id.
 * Core only decides WHICH one runs and how hard; the platform decides how to show it.
 */
export type InteractionId = "slap";

export interface Decision {
  interaction: InteractionId;
  /** 1 = first slap of the day, up to 3 = the user keeps ignoring it. */
  intensity: 1 | 2 | 3;
  /** Which slap of the day this is, starting at 1. */
  slapNumber: number;
}

export function decide(status: LimitStatus | null): Decision | null {
  if (!status?.over) return null;
  const slapNumber = status.slapsToday + 1;
  const intensity = Math.min(3, slapNumber) as 1 | 2 | 3;
  return { interaction: "slap", intensity, slapNumber };
}
