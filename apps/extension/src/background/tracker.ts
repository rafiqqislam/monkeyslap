import {
  addSlap,
  addTime,
  decide,
  enabledDomains,
  hostFromUrl,
  limitStatus,
  matchDomain,
  pruneUsage,
  sessionEnd,
  type LimitStatus,
  type Settings,
  type UsageLog,
} from "@monkeyslap/core";
import type { SlapPayload } from "../shared/messages";
import { getSession, getSettings, getUsage, saveUsage, setSession } from "./storage";

/**
 * Time tracking.
 *
 * Time counts only while a limited site is the active tab of the focused Chrome
 * window and the screen isn't locked. Every tab/window/idle event, and a heartbeat
 * every 30 s, calls reconcile(): it closes the open session (adding its time to
 * today's total) and opens a new one if the user is still on a limited site.
 *
 * The service worker can be shut down at any moment, so the open session lives in
 * chrome.storage.session rather than in memory.
 */

// Serialise reconciles so two events can't double-count the same seconds.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

interface Target {
  domain: string;
  tabId: number;
}

async function currentTarget(settings: Settings): Promise<Target | null> {
  const domains = enabledDomains(settings);
  if (!domains.length) return null;

  const idle = await chrome.idle.queryState(60);
  // Only a locked screen stops the clock: watching a video without touching the
  // mouse still counts as scrolling time.
  if (idle === "locked") return null;

  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win?.focused || win.id === undefined) return null;
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (!tab?.id) return null;
  // tab.url is only visible for sites we have permission for, which are exactly
  // the sites being limited, so other browsing is never seen.
  const domain = matchDomain(hostFromUrl(tab.url), domains);
  return domain ? { domain, tabId: tab.id } : null;
}

export interface Snapshot {
  settings: Settings;
  usage: UsageLog;
}

/** Brings the usage log up to date with the present moment. */
export function reconcile(): Promise<Snapshot> {
  return serial(async () => {
    const now = Date.now();
    const [settings, prevUsage, session] = await Promise.all([
      getSettings(),
      getUsage(),
      getSession(),
    ]);

    let usage = prevUsage;
    if (session) {
      const end = sessionEnd(session, now);
      usage = addTime(usage, session.domain, session.startedAt, end);
    }

    const target = await currentTarget(settings);
    await setSession(
      target ? { domain: target.domain, tabId: target.tabId, startedAt: now, lastSeenAt: now } : null,
    );

    if (usage !== prevUsage) {
      usage = pruneUsage(usage, now);
      await saveUsage(usage);
    }
    return { settings, usage };
  });
}

function domainForSender(settings: Settings, sender: chrome.runtime.MessageSender): string | null {
  return matchDomain(hostFromUrl(sender.tab?.url ?? sender.url), enabledDomains(settings));
}

/** Today's status for the site a page belongs to. */
export async function statusForSender(
  sender: chrome.runtime.MessageSender,
): Promise<{ status: LimitStatus; settings: Settings } | null> {
  const { settings, usage } = await reconcile();
  const domain = domainForSender(settings, sender);
  if (!domain) return null;
  const status = limitStatus(settings, usage, domain, Date.now());
  return status ? { status, settings } : null;
}

export function payloadFor(
  settings: Settings,
  status: LimitStatus | null,
  decision: NonNullable<ReturnType<typeof decide>>,
  test = false,
): SlapPayload {
  return {
    decision,
    status,
    characterId: settings.characterId,
    characterScale: settings.characterScale,
    sound: settings.sound,
    reslapMinutes: settings.reslapMinutes,
    test,
  };
}

/**
 * Called by a page when its countdown runs out. Re-checks against the real
 * usage log, and if the limit really is reached, records the slap and returns it.
 */
export async function checkForSender(
  sender: chrome.runtime.MessageSender,
): Promise<SlapPayload | null> {
  const found = await statusForSender(sender);
  if (!found) return null;
  const decision = decide(found.status);
  if (!decision) return null;

  await serial(async () => {
    const usage = await getUsage();
    await saveUsage(addSlap(usage, found.status.domain, Date.now()));
  });
  return payloadFor(found.settings, found.status, decision);
}
