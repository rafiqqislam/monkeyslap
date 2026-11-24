import { daysAgo, migrateSettings, pickSettingsSource, usageRows } from "@monkeyslap/core";
import { supabase } from "./auth";
import {
  getDeviceId,
  getFirstSlapAt,
  getSettings,
  getSettingsUpdatedAt,
  getSyncState,
  getUsage,
  markFirstSlap,
  saveSettings,
  setSyncState,
} from "./storage";

/**
 * Backup and sync for signed-in users (see supabase/migrations/0001_sync.sql).
 *
 * - Settings: one row per user. Whichever copy was changed most recently wins.
 * - Usage: each device uploads its own daily rows; it never downloads other
 *   devices' usage (limits are enforced per device for now).
 * - Everything still works offline and signed out; sync just catches up later.
 */

export const SYNC_ALARM = "sync";
export const SYNC_EVERY_MINUTES = 10;

/** Called after settings come down from the account, so tracking can update. */
type OnSettingsPulled = () => Promise<void>;

let running: Promise<void> | null = null;

/** Runs a sync unless one is already in progress. Never throws. */
export function syncNow(onSettingsPulled?: OnSettingsPulled): Promise<void> {
  running ??= doSync(onSettingsPulled).finally(() => {
    running = null;
  });
  return running;
}

async function doSync(onSettingsPulled?: OnSettingsPulled): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;

  try {
    // 1. Settings: pull the account's copy and keep whichever is newer.
    const remote = await sb
      .from("user_settings")
      .select("settings, updated_at, first_slap_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (remote.error) throw remote.error;

    const localAt = await getSettingsUpdatedAt();
    const remoteAt = remote.data ? Date.parse(remote.data.updated_at as string) : null;
    if (remote.data?.first_slap_at) await markFirstSlap(Date.parse(remote.data.first_slap_at as string));

    if (pickSettingsSource(localAt, remoteAt) === "remote" && remote.data) {
      await saveSettings(migrateSettings(remote.data.settings), remoteAt!);
      await onSettingsPulled?.();
    } else {
      const firstSlapAt = await getFirstSlapAt();
      const pushed = await sb.from("user_settings").upsert({
        user_id: userId,
        settings: await getSettings(),
        updated_at: new Date(localAt || Date.now()).toISOString(),
        first_slap_at: firstSlapAt ? new Date(firstSlapAt).toISOString() : null,
      });
      if (pushed.error) throw pushed.error;
    }

    // 2. Usage: upload this device's rows. Everything the first time, then the
    //    last couple of days (today keeps changing; yesterday may have been
    //    finished after the last sync).
    const state = await getSyncState();
    const since = state.syncedThrough ?? undefined;
    const deviceId = await getDeviceId();
    const rows = usageRows(await getUsage(), since).map((r) => ({
      user_id: userId,
      device_id: deviceId,
      day: r.day,
      domain: r.domain,
      ms: r.ms,
      slaps: r.slaps,
      updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const res = await sb
        .from("daily_usage")
        .upsert(rows.slice(i, i + 500), { onConflict: "user_id,device_id,day,domain" });
      if (res.error) throw res.error;
    }

    await setSyncState({ lastSyncAt: Date.now(), lastError: null, syncedThrough: daysAgo(Date.now(), 1) });
  } catch (err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
    await setSyncState({ lastError: message });
  }
}

/** Forget sync progress, e.g. after signing out, so the next account gets a full upload. */
export async function resetSync(): Promise<void> {
  await setSyncState(null);
}
