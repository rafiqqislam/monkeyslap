import { migrateSettings, type ActiveSession, type Settings, type UsageLog } from "@monkeyslap/core";

/**
 * chrome.storage.local  → settings and the daily usage log (survives restarts)
 * chrome.storage.session → the open session (cleared when the browser closes)
 */

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return migrateSettings(settings);
}

/**
 * Saves settings. `updatedAt` records when they were last changed, so sync can
 * keep the newest copy. Untouched defaults use 0, so an account's saved settings
 * always win over a fresh install's defaults.
 */
export async function saveSettings(settings: Settings, updatedAt = Date.now()): Promise<Settings> {
  const clean = migrateSettings(settings);
  await chrome.storage.local.set({ settings: clean, settingsUpdatedAt: updatedAt });
  return clean;
}

export async function getSettingsUpdatedAt(): Promise<number> {
  const { settingsUpdatedAt } = await chrome.storage.local.get("settingsUpdatedAt");
  return typeof settingsUpdatedAt === "number" ? settingsUpdatedAt : 0;
}

/** A random id for this browser, so each device keeps its own usage rows in the account. */
export async function getDeviceId(): Promise<string> {
  const { deviceId } = await chrome.storage.local.get("deviceId");
  if (typeof deviceId === "string") return deviceId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ deviceId: id });
  return id;
}

export interface SyncState {
  lastSyncAt: number | null;
  lastError: string | null;
  /** The earliest day not yet confirmed uploaded; null means upload everything. */
  syncedThrough: string | null;
}

export async function getSyncState(): Promise<SyncState> {
  const { sync } = await chrome.storage.local.get("sync");
  const s = (sync ?? {}) as Partial<SyncState>;
  return { lastSyncAt: s.lastSyncAt ?? null, lastError: s.lastError ?? null, syncedThrough: s.syncedThrough ?? null };
}

export async function setSyncState(patch: Partial<SyncState> | null): Promise<void> {
  if (patch === null) {
    await chrome.storage.local.remove("sync");
    return;
  }
  await chrome.storage.local.set({ sync: { ...(await getSyncState()), ...patch } });
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
