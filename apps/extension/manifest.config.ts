import { readFileSync, existsSync } from "node:fs";
import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

/**
 * The public half of the extension's signing key. It pins the extension ID, so the
 * Google sign-in return address (https://<id>.chromiumapp.org/) stays the same on
 * every machine and build. Generate it once with `npm run key -w @monkeyslap/extension`.
 */
const keyFile = new URL("./extension-key.pub.txt", import.meta.url);
const key = existsSync(keyFile) ? readFileSync(keyFile, "utf8").trim() : undefined;

const icons = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

export default defineManifest({
  manifest_version: 3,
  name: "MonkeySlap",
  version: pkg.version,
  description: "Set a daily time limit on distracting sites. Go over it and a monkey slaps you.",
  ...(key ? { key } : {}),
  icons,
  action: {
    default_popup: "src/popup/index.html",
    default_icon: icons,
    default_title: "MonkeySlap",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  permissions: ["storage", "alarms", "idle", "scripting", "activeTab", "identity"],
  // Requested one site at a time, only for the sites the user chooses to limit.
  optional_host_permissions: ["https://*/*", "http://*/*"],
});
