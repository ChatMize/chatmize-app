#!/usr/bin/env node
/**
 * Build the ChatMize Overlays SDK snippet.
 *
 * Reads sdk/overlays.src.js, injects the public Firebase web config
 * (projectId / web API key / Firestore database id — all public-by-design
 * values already shipped in the web app bundle), minifies with esbuild,
 * and writes public/overlays.js (served at https://app.chatmize.com/overlays.js).
 *
 * Budget: minified output must stay under 20 KB (20480 bytes).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SDK_VERSION = "1.0.0";
const BUDGET = 20480;

const applet = JSON.parse(readFileSync(join(root, "firebase-applet-config.json"), "utf8"));
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || applet.projectId;
const apiKey = process.env.VITE_FIREBASE_API_KEY || applet.apiKey;
const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || applet.firestoreDatabaseId;

if (!projectId || !apiKey || !dbId) {
  console.error("build-sdk: missing Firebase web config (projectId/apiKey/firestoreDatabaseId)");
  process.exit(1);
}

let src = readFileSync(join(root, "sdk", "overlays.src.js"), "utf8");
src = src
  .replaceAll("__FIREBASE_PROJECT_ID__", projectId)
  .replaceAll("__FIREBASE_API_KEY__", apiKey)
  .replaceAll("__FIRESTORE_DB_ID__", dbId)
  .replaceAll("__SDK_VERSION__", SDK_VERSION);

if (/__FIREBASE_|__FIRESTORE_|__SDK_VERSION__/.test(src)) {
  console.error("build-sdk: unreplaced build tokens remain in the SDK source");
  process.exit(1);
}

const out = buildSync({
  stdin: { contents: src, loader: "js", resolveDir: root },
  minify: true,
  target: "es2019",
  write: false,
}).outputFiles[0].text;

const banner = `/* ChatMize Overlays SDK v${SDK_VERSION} | (c) ChatMize | https://chatmize.com */\n`;
const final = banner + out;

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "overlays.js"), final);

const bytes = Buffer.byteLength(final, "utf8");
console.log(`build-sdk: public/overlays.js = ${bytes} bytes (budget ${BUDGET})`);
if (bytes > BUDGET) {
  console.error(`build-sdk: FAILED — snippet exceeds the 20 KB budget by ${bytes - BUDGET} bytes`);
  process.exit(1);
}
console.log("build-sdk: OK");
