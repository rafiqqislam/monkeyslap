import { migrateSettings, type ActiveSession, type Settings, type UsageLog } from "@monkeyslap/core";

/**
 * chrome.storage.local  → settings and the daily usage log (survives restarts)
 * chrome.storage.session → the open session (cleared when the browser closes)
 */

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return migrateSettings(settings);
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const clean = migrateSettings(settings);
  await chrome.storage.local.set({ settings: clean });
  return clean;
}

export async function getUsage(): Promise<UsageLog> {
  const { usage } = await chrome.storage.local.get("usage");
  return (usage && typeof usage === "object" ? usage : {}) as UsageLog;
}

export async function saveUsage(usage: UsageLog): Promise<void> {
  await chrome.storage.local.set({ usage });
}

export async function getSession(): Promise<ActiveSession | null> {
  const { session } = await chrome.storage.session.get("session");
  return (session as ActiveSession | undefined) ?? null;
}

export async function setSession(session: ActiveSession | null): Promise<void> {
  if (session) await chrome.storage.session.set({ session });
  else await chrome.storage.session.remove("session");
}

/** When this person was first slapped for real (test slaps don't count), or null. */
export async function getFirstSlapAt(): Promise<number | null> {
  const { firstSlapAt } = await chrome.storage.local.get("firstSlapAt");
  return typeof firstSlapAt === "number" ? firstSlapAt : null;
}

export async function markFirstSlap(at = Date.now()): Promise<void> {
  if ((await getFirstSlapAt()) === null) await chrome.storage.local.set({ firstSlapAt: at });
}
