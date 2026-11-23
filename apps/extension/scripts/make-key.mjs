// Creates the extension's signing key once, which pins its ID.
//
// - extension-key.pub.txt (public, committed) goes into manifest.json as "key".
// - .keys/private.pem (secret, git-ignored). Back it up: include it as key.pem
//   in the zip on the FIRST Chrome Web Store upload to keep this same ID there.
import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const pubFile = new URL("../extension-key.pub.txt", import.meta.url);
const keyDir = new URL("../.keys/", import.meta.url);

function idFromPublicKey(b64) {
  const hash = createHash("sha256").update(Buffer.from(b64, "base64")).digest("hex").slice(0, 32);
  return [...hash].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}

if (existsSync(pubFile)) {
  const b64 = readFileSync(pubFile, "utf8").trim();
  console.log(`Key already exists. Extension ID: ${idFromPublicKey(b64)}`);
} else {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const b64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  mkdirSync(keyDir, { recursive: true });
  writeFileSync(new URL("private.pem", keyDir), privateKey.export({ type: "pkcs8", format: "pem" }));
  writeFileSync(pubFile, `${b64}\n`);
  console.log(`Created key. Extension ID: ${idFromPublicKey(b64)}`);
}
