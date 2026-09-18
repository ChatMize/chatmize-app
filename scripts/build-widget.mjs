/**
 * Builds the standalone visitor widget: src/widget/widget.ts -> dist/widget.js
 * (IIFE, minified, self-contained incl. the Firebase Firestore SDK).
 *
 * Runs as part of `npm run build` (after vite build, since vite empties dist).
 * The Firebase web API key + project id are injected at build time from
 * firebase-applet-config.json — both are public client config, not secrets.
 */
import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptsDir);
const appletConfig = JSON.parse(
  readFileSync(path.join(repoRoot, 'firebase-applet-config.json'), 'utf8')
);

const apiKey = process.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey;
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId;
if (!apiKey || !projectId) {
  console.error('[build-widget] missing Firebase apiKey/projectId; aborting.');
  process.exit(1);
}

await build({
  entryPoints: [path.join(repoRoot, 'src/widget/widget.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  outfile: path.join(repoRoot, 'dist/widget.js'),
  define: {
    CM_FIREBASE_API_KEY: JSON.stringify(apiKey),
    CM_PROJECT_ID: JSON.stringify(projectId),
  },
  logLevel: 'info',
});

console.log('[build-widget] dist/widget.js built');
