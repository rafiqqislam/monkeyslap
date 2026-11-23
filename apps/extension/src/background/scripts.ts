import { enabledDomains, originPatterns, type Settings } from "@monkeyslap/core";
import watcherPath from "../content/watcher.ts?script";

const SCRIPT_ID = "monkeyslap-watcher";

export async function hasAccess(domain: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: originPatterns(domain) });
}

/** Domains that are limited AND that the user has granted access to. */
async function watchableDomains(settings: Settings): Promise<string[]> {
  const domains = enabledDomains(settings);
  const granted = await Promise.all(domains.map(hasAccess));
  return domains.filter((_, i) => granted[i]);
}

/**
 * Registers the small page watcher on exactly the limited sites, and nowhere else.
 * Called whenever the list of sites changes and when the browser starts.
 */
export async function syncContentScripts(settings: Settings): Promise<void> {
  const domains = await watchableDomains(settings);
  const matches = domains.flatMap(originPatterns);

  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  if (!matches.length) return;

  await chrome.scripting.registerContentScripts([
    {
      id: SCRIPT_ID,
      js: [watcherPath],
      matches,
      runAt: "document_idle",
      persistAcrossSessions: true,
    },
  ]);
}

/** Starts the watcher in tabs that were already open on a newly added site. */
export async function injectIntoOpenTabs(domain: string): Promise<void> {
  if (!(await hasAccess(domain))) return;
  const tabs = await chrome.tabs.query({ url: originPatterns(domain) });
  await Promise.all(tabs.map((t) => (t.id ? injectWatcher(t.id) : null)));
}

/** Runs the watcher in one tab. It ignores repeat injections. */
export async function injectWatcher(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [watcherPath] });
    return true;
  } catch {
    return false;
  }
}
