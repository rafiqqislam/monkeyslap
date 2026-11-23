import {
  clampMinutes,
  HEARTBEAT_MS,
  limitStatus,
  normalizeDomain,
  originPatterns,
  removeLimit,
  upsertLimit,
  usageFor,
  hostFromUrl,
  matchDomain,
  enabledDomains,
} from "@monkeyslap/core";
import type {
  CheckResponse,
  Dashboard,
  PageMessage,
  Request,
  Result,
  StatusResponse,
} from "../shared/messages";
import { getAuthState, signInWithGoogle, signOut } from "./auth";
import { hasAccess, injectIntoOpenTabs, injectWatcher, syncContentScripts } from "./scripts";
import { getSettings, saveSettings } from "./storage";
import { checkForSender, payloadFor, reconcile, statusForSender } from "./tracker";

const HEARTBEAT = "heartbeat";

async function setup() {
  await chrome.alarms.create(HEARTBEAT, { periodInMinutes: HEARTBEAT_MS / 60_000 });
  chrome.idle.setDetectionInterval(60);
  await syncContentScripts(await getSettings());
  await reconcile();
}

chrome.runtime.onInstalled.addListener(() => void setup());
chrome.runtime.onStartup.addListener(() => void setup());

// Anything that might change which tab the user is looking at.
const touch = () => void reconcile();
chrome.alarms.onAlarm.addListener((a) => a.name === HEARTBEAT && touch());
chrome.tabs.onActivated.addListener(touch);
chrome.tabs.onRemoved.addListener(touch);
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.url || change.status === "complete") touch();
});
chrome.windows.onFocusChanged.addListener(touch);
chrome.idle.onStateChanged.addListener(touch);
chrome.permissions.onRemoved.addListener(async () => {
  await syncContentScripts(await getSettings());
  touch();
});
// Access is often granted while the popup is closing, so finish setting up here.
chrome.permissions.onAdded.addListener(async () => {
  const settings = await getSettings();
  await syncContentScripts(settings);
  await Promise.all(enabledDomains(settings).map(injectIntoOpenTabs));
  touch();
});

async function dashboard(): Promise<Dashboard> {
  const { settings, usage } = await reconcile();
  const now = Date.now();
  const sites = await Promise.all(
    settings.limits.map(async (limit) => {
      const today = usageFor(usage, limit.domain, now);
      return { limit, usedMs: today.ms, slaps: today.slaps, granted: await hasAccess(limit.domain) };
    }),
  );
  return { settings, sites, auth: await getAuthState() };
}

async function testSlap(): Promise<"page" | "demo"> {
  const settings = await getSettings();
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const decision = { interaction: "slap" as const, intensity: 1 as const, slapNumber: 1 };

  if (tab?.id && hostFromUrl(tab.url ?? "") !== null) {
    const { usage } = await reconcile();
    const domain = matchDomain(hostFromUrl(tab.url), enabledDomains(settings));
    const status = domain ? limitStatus(settings, usage, domain, Date.now()) : null;
    const msg: PageMessage = { type: "slap", payload: payloadFor(settings, status, decision, true) };

    const send = () => chrome.tabs.sendMessage(tab.id!, msg).then(() => true, () => false);
    // The page may not have the watcher yet (not a limited site): clicking the
    // extension grants one-off access to this tab, so we can add it.
    if ((await send()) || ((await injectWatcher(tab.id)) && (await send()))) return "page";
  }

  // chrome:// pages, the Web Store, etc. can't be scripted: use the demo page.
  await chrome.tabs.create({ url: chrome.runtime.getURL("src/demo/index.html?slap=1") });
  return "demo";
}

const PAGE_MESSAGES = new Set<Request["type"]>(["status", "check", "leave"]);

/** Settings and account actions may only come from the extension's own pages. */
function fromExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && !!sender.url?.startsWith(chrome.runtime.getURL(""));
}

async function handle(req: Request, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (!PAGE_MESSAGES.has(req.type) && !fromExtensionPage(sender)) {
    throw new Error("Not allowed from a web page");
  }
  switch (req.type) {
    case "status": {
      const found = await statusForSender(sender);
      const res: StatusResponse = found
        ? { tracked: true, status: found.status, reslapMinutes: found.settings.reslapMinutes }
        : { tracked: false };
      return res;
    }
    case "check": {
      const res: CheckResponse = { slap: await checkForSender(sender) };
      return res;
    }
    case "leave": {
      if (sender.tab?.id) await chrome.tabs.update(sender.tab.id, { url: "chrome://newtab/" });
      return undefined;
    }
    case "dashboard":
      return dashboard();
    case "saveSettings": {
      const saved = await saveSettings(req.settings);
      await syncContentScripts(saved);
      await reconcile();
      return dashboard();
    }
    case "addSite": {
      const domain = normalizeDomain(req.domain);
      if (!domain) throw new Error("That doesn't look like a website address");
      const settings = await saveSettings(
        upsertLimit(await getSettings(), {
          domain,
          dailyMinutes: clampMinutes(req.dailyMinutes),
          enabled: true,
        }),
      );
      await syncContentScripts(settings);
      await injectIntoOpenTabs(domain);
      return dashboard();
    }
    case "removeSite": {
      const settings = await saveSettings(removeLimit(await getSettings(), req.domain));
      await syncContentScripts(settings);
      await chrome.permissions.remove({ origins: originPatterns(req.domain) }).catch(() => false);
      return dashboard();
    }
    case "testSlap":
      return testSlap();
    case "signIn":
      return signInWithGoogle();
    case "signOut":
      return signOut();
  }
}

chrome.runtime.onMessage.addListener((req: Request, sender, sendResponse) => {
  handle(req, sender).then(
    (data) => sendResponse({ ok: true, data } satisfies Result<unknown>),
    (err: unknown) =>
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      } satisfies Result<unknown>),
  );
  return true; // keep the channel open for the async response
});
