import { runInteraction, isRunning } from "../overlay";
import { ask, type CheckResponse, type PageMessage, type SlapPayload, type StatusResponse } from "../shared/messages";

/**
 * The page watcher. Runs only on sites the user has limited.
 *
 * It holds no truth of its own: it asks the background how much time is left,
 * sets a countdown, and when that runs out asks the background to confirm. The
 * background owns the clock, so several tabs of the same site can't disagree.
 */

const RESYNC_MS = 60_000;
/** A newer copy of the watcher (re-injected, or after an extension update) takes over. */
const TAKEOVER = "monkeyslap:watcher-takeover";
const token = `${Date.now()}-${Math.random()}`;

let timer: ReturnType<typeof setTimeout> | undefined;
let resync: ReturnType<typeof setInterval> | undefined;
let snoozeUntil = 0;
let dead = false;

/** After the extension is reloaded or removed, this old copy must go quiet. */
function shutDown() {
  dead = true;
  clearTimeout(timer);
  clearInterval(resync);
  document.removeEventListener("visibilitychange", sync);
  document.removeEventListener(TAKEOVER, onTakeover);
  try {
    chrome.runtime.onMessage.removeListener(onMessage);
  } catch {
    // The extension context is already gone.
  }
}

function onTakeover(e: Event) {
  if ((e as CustomEvent<string>).detail !== token) shutDown();
}

function onMessage(msg: PageMessage, _sender: unknown, sendResponse: (r: boolean) => void) {
  if (dead) return;
  if (msg.type === "slap") {
    void perform(msg.payload);
    sendResponse(true);
  } else if (msg.type === "ping") {
    sendResponse(true);
  }
}

async function call<T>(req: Parameters<typeof ask>[0]): Promise<T | null> {
  if (dead) return null;
  try {
    return await ask<T>(req);
  } catch (err) {
    if (!chrome.runtime?.id || String(err).includes("Extension context invalidated")) shutDown();
    return null;
  }
}

async function sync(): Promise<void> {
  clearTimeout(timer);
  if (dead || isRunning() || document.visibilityState !== "visible") return;

  const res = await call<StatusResponse>({ type: "status" });
  if (!res?.tracked) return;

  const wait = Math.max(res.status.remainingMs, snoozeUntil - Date.now(), 0);
  if (wait === 0) {
    await check();
  } else {
    // Time only counts while the tab is in front, so this may fire early;
    // sync() just recalculates and waits again.
    timer = setTimeout(() => void sync(), wait + 300);
  }
}

async function check(): Promise<void> {
  const res = await call<CheckResponse>({ type: "check" });
  if (res?.slap) await perform(res.slap);
}

async function perform(payload: SlapPayload): Promise<void> {
  const choice = await runInteraction(payload);
  if (!choice) return;
  if (choice === "leave" && !payload.test) {
    await call({ type: "leave" });
    return;
  }
  if (!payload.test) snoozeUntil = Date.now() + payload.reslapMinutes * 60_000;
  void sync();
}

function start() {
  document.dispatchEvent(new CustomEvent(TAKEOVER, { detail: token }));
  document.addEventListener(TAKEOVER, onTakeover);
  chrome.runtime.onMessage.addListener(onMessage);
  document.addEventListener("visibilitychange", sync);
  resync = setInterval(() => void sync(), RESYNC_MS);
  void sync();
}

start();
