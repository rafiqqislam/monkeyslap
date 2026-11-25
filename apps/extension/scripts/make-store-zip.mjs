// Packages dist/ for the Chrome Web Store.
//
// The store doesn't accept a "key" field in manifest.json, so it's removed here.
// On the FIRST upload only (--first), the private key goes in as key.pem, which
// makes the store keep our extension ID (and so Google sign-in keeps working).
//
//   npm run store:first -w @monkeyslap/extension   # first-ever upload
//   npm run store -w @monkeyslap/extension         # every update after that
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const dist = here("../dist");
const privateKey = here("../.keys/private.pem");
const outDir = here("../release");
const first = process.argv.includes("--first");

if (!existsSync(join(dist, "manifest.json"))) throw new Error("No build found. Run the build first.");
const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
if (readFileSync(join(dist, "service-worker-loader.js"), "utf8").includes("localhost")) {
  throw new Error("dist/ holds a dev build (npm run dev). Run a normal build first.");
}

const stage = mkdtempSync(join(tmpdir(), "monkeyslap-store-"));
try {
  cpSync(dist, stage, { recursive: true });
  delete manifest.key;
  writeFileSync(join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));
  if (first) {
    if (!existsSync(privateKey)) throw new Error(`Missing ${privateKey}. Restore it from your backup.`);
    cpSync(privateKey, join(stage, "key.pem"));
  }

  mkdirSync(outDir, { recursive: true });
  const name = `monkeyslap-${manifest.version}${first ? "-first-upload" : ""}.zip`;
  const out = join(outDir, name);
  rmSync(out, { force: true });
  execFileSync("zip", ["-qrX", out, "."], { cwd: stage });

  const listing = execFileSync("unzip", ["-Z1", out], { encoding: "utf8" }).trim().split("\n");
  if (listing.some((f) => f.startsWith(".") || f.includes("/.") || f.endsWith(".map"))) {
    throw new Error(`Unexpected files in the zip: ${listing.filter((f) => f.includes(".")).join(", ")}`);
  }
  console.log(`Created release/${name}`);
  console.log(`  version ${manifest.version}, ${listing.length} files${first ? ", includes key.pem (first upload only)" : ""}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
