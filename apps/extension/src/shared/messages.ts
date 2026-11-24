import type { DaySummary, Decision, LimitStatus, Settings, SiteLimit } from "@monkeyslap/core";

/** Everything the slap overlay needs to run, sent from the background to a page. */
export interface SlapPayload {
  decision: Decision;
  status: LimitStatus | null;
  characterId: string;
  characterScale: number;
  sound: boolean;
  reslapMinutes: number;
  /** True for "Test the slap" from the popup: nothing is recorded. */
  test?: boolean;
}

export interface AuthUser {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthState {
  /** False until Supabase keys are added (see docs/SETUP.md). */
  configured: boolean;
  user: AuthUser | null;
  /** When this device last backed up to the account (signed in only). */
  lastSyncAt?: number | null;
  /** The last sync problem, if the most recent attempt failed. */
  syncError?: string | null;
}

export interface SiteRow {
  limit: SiteLimit;
  usedMs: number;
  slaps: number;
  /** The limit in force right now (1 min until the first slap ever). */
  limitMs: number;
  /** Whether Chrome has granted access to this site. Without it, nothing is tracked. */
  granted: boolean;
}

export interface Dashboard {
  settings: Settings;
  sites: SiteRow[];
  auth: AuthState;
  /** True until the first real slap: every site slaps after 1 minute until then. */
  firstSlapPending: boolean;
}

export interface Stats {
  /** The last N days, oldest first, ending today. */
  days: DaySummary[];
}

/** Messages sent to the background service worker. */
export type Request =
  // From the page watcher (the site is taken from the sender, never from the message)
  | { type: "status" }
  | { type: "check" }
  | { type: "leave" }
  // From the popup
  | { type: "dashboard" }
  | { type: "saveSettings"; settings: Settings }
  | { type: "addSite"; domain: string; dailyMinutes: number }
  | { type: "removeSite"; domain: string }
  | { type: "testSlap" }
  | { type: "signIn" }
  | { type: "signOut" }
  // From the profile page
  | { type: "stats"; days: number };

export type StatusResponse =
  | { tracked: false }
  | { tracked: true; status: LimitStatus; reslapMinutes: number };

export type CheckResponse = { slap: SlapPayload | null };

/** Messages sent from the background to a page. */
export type PageMessage = { type: "slap"; payload: SlapPayload } | { type: "ping" };

export interface Ok<T = undefined> {
  ok: true;
  data: T;
}
export interface Err {
  ok: false;
  error: string;
}
export type Result<T = undefined> = Ok<T> | Err;

/** Sends a message to the background and unwraps the result. */
export async function ask<T>(req: Request): Promise<T> {
  const res = (await chrome.runtime.sendMessage(req)) as Result<T> | undefined;
  if (!res) throw new Error("No response from background");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
