/** The stretch of time the user is currently spending on a limited site. */
export interface ActiveSession {
  domain: string;
  tabId: number;
  startedAt: number;
  /** Last time we confirmed the user was still there (a heartbeat or a tab event). */
  lastSeenAt: number;
}

/** How often the tracker checks in while a session is open. */
export const HEARTBEAT_MS = 30_000;

/**
 * If nothing has checked in for this long, the computer was probably asleep or the
 * browser was suspended, so we stop counting at the last check-in instead of now.
 */
export const MAX_GAP_MS = 3 * HEARTBEAT_MS;

/** The instant up to which a session should be counted when it is closed at `now`. */
export function sessionEnd(session: ActiveSession, now: number): number {
  if (now < session.startedAt) return session.startedAt;
  if (now - session.lastSeenAt > MAX_GAP_MS) {
    return Math.min(now, session.lastSeenAt + HEARTBEAT_MS);
  }
  return now;
}
