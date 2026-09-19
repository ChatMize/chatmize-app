#!/usr/bin/env node
/**
 * SegMate read-only extractor for the migration importer.
 *
 * Usage: node scripts/segmate-extract.mjs --email user@example.com [--out dir]
 *
 * What it does (ALL READ-ONLY):
 *   1. Sends a PHP script to the SegMate app server (i-015a4a712c451631b) via
 *      AWS SSM (profile FlintKarlsAssistant). The PHP script reads DB creds
 *      from /var/www/html/.env ON THE SERVER ONLY and issues SELECTs.
 *   2. Polls the SSM command, parses the JSON result.
 *   3. Writes ~/workspace/chatmize/migration-staging/<rowkey>.json shaped as
 *      { bots: [...], packages: [...] } for the importer's "Upload staged JSON"
 *      step (or stage it directly with the migrationStageBots callable).
 *
 * NOTHING is written to SegMate (no INSERT/UPDATE/DELETE anywhere), nothing
 * is written to PayKickStart, and credentials never leave the server.
 * If AWS SSO expired, re-run: aws login --remote
 */
import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { resolve } from 'path';

const INSTANCE_ID = 'i-015a4a712c451631b';
const REGION = 'us-west-2';
const PROFILE = 'FlintKarlsAssistant';

const args = process.argv.slice(2);
const emailArg = args[args.indexOf('--email') + 1];
const outDir = args[args.indexOf('--out') + 1] || `${homedir()}/workspace/chatmize/migration-staging`;
if (!emailArg || !emailArg.includes('@')) {
  console.error('Usage: node scripts/segmate-extract.mjs --email user@example.com [--out dir]');
  process.exit(1);
}
const email = emailArg.trim().toLowerCase();

const aws = (a) => execFileSync('aws', ['--profile', PROFILE, '--region', REGION, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// --- Remote PHP: SELECT-only extraction. Credentials stay on the server. ---
const php = String.raw`<?php
// SELECT-ONLY SegMate extractor. No writes of any kind.
$envPath = file_exists('/var/www/html/.env') ? '/var/www/html/.env' : '/var/www/segmate/.env';
$env = [];
foreach (file($envPath) as $line) {
  $line = trim($line);
  if ($line === '' || $line[0] === '#') continue;
  [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
  $env[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
}
$pdo = new PDO(
  "mysql:host={$env['DB_HOST']};port=" . ($env['DB_PORT'] ?? 3306) . ";dbname={$env['DB_DATABASE']};charset=utf8mb4",
  $env['DB_USERNAME'], $env['DB_PASSWORD'],
  [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);
$email = $argv[1];
$out = ['email' => $email, 'extractedAt' => gmdate('c'), 'tables' => []];

$user = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
$user->execute([$email]);
$u = $user->fetch();
if (!$u) { echo json_encode(['error' => 'no SegMate user for email']); exit(1); }
$uid = (int)$u['id'];
// strip anything secret-ish from the user row
foreach (['password', 'remember_token'] as $k) unset($u[$k]);
$out['user'] = $u;
$out['segmateUserId'] = $uid;
$out['isTemplateAllowed'] = isset($u['is_template_allowed']) ? (int)$u['is_template_allowed'] : null;

$grab = function ($table, $where, $params, $limit = 500) use ($pdo, &$out) {
  try {
    $cols = $pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_COLUMN);
    $hasUser = in_array('user_id', $cols);
    $sql = "SELECT * FROM `$table`" . ($hasUser ? " WHERE user_id = ?" : " WHERE $where") . " LIMIT $limit";
    $st = $pdo->prepare($sql);
    $st->execute($hasUser ? [$params] : [$params]);
    $rows = $st->fetchAll();
    $out['tables'][$table] = ['columns' => $cols, 'rowCount' => count($rows), 'rows' => $rows];
  } catch (Exception $e) {
    $out['tables'][$table] = ['error' => substr($e->getMessage(), 0, 200)];
  }
};

// Fanpages + shareable bots (the importable units)
$grab('users_fanpages', 'user_id = ?', $uid);
$grab('shareable_conversations', 'user_id = ?', $uid);

// Bot-content tables: counts + samples (best effort; missing user_id falls back gracefully)
foreach (['conversations', 'sequences', 'automations', 'tags', 'postengage_messaging', 'checkbox',
          'qr_codes', 'persistent_menu', 'ice_breakers', 'greeting', 'segments', 'schedulers'] as $t) {
  $grab($t, 'user_id = ?', $uid, 50);
}
echo json_encode($out, JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
`;

const b64 = Buffer.from(php, 'utf8').toString('base64');
const remoteCmd = `printf '%s' '${b64}' | base64 -d > /tmp/segx.php && php /tmp/segx.php '${email.replace(/'/g, "'\\''")}' && rm -f /tmp/segx.php`;

console.log('sending SSM command (read-only SELECTs)...');
const sendOut = JSON.parse(aws(['ssm', 'send-command',
  '--instance-ids', INSTANCE_ID,
  '--document-name', 'AWS-RunShellScript',
  '--parameters', JSON.stringify({ commands: [remoteCmd] }),
  '--timeout-seconds', '300',
]));
const commandId = sendOut.Command.CommandId;
console.log('command id:', commandId);

let result;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const inv = JSON.parse(aws(['ssm', 'get-command-invocation', '--command-id', commandId, '--instance-id', INSTANCE_ID]));
  if (inv.Status === 'InProgress' || inv.Status === 'Pending') continue;
  result = inv;
  break;
}
if (!result) throw new Error('SSM command timed out');
if (result.Status !== 'Success') {
  console.error('STDERR:', result.StandardErrorContent);
  throw new Error(`SSM command ${result.Status}`);
}
const data = JSON.parse(result.StandardOutputContent);
if (data.error) throw new Error(data.error);

// --- Reshape into importer staging format ---
const MAX_ROW_BYTES = 300_000;
const slim = (row) => {
  let j = JSON.stringify(row);
  if (j.length <= MAX_ROW_BYTES) return { row, truncated: false };
  // drop the largest string field and retry once
  const entries = Object.entries(row).sort((a, b) => String(b[1]).length - String(a[1]).length);
  const slimmed = { ...row, [entries[0][0]]: `[truncated ${(String(entries[0][1]).length / 1024).toFixed(0)}KB blob]` };
  return { row: slimmed, truncated: true };
};

const sc = data.tables?.shareable_conversations?.rows ?? [];
const isTemplate = data.isTemplateAllowed === 1;
const toItem = (r, kind) => {
  const { row, truncated } = slim(r);
  const name = row.title || row.name || row.conversation_name || `SegMate ${kind} #${row.id}`;
  return { name: String(name), niche: row.niche || row.category || '', source: 'shareable_conversations', sourceId: row.id, truncated, raw: row };
};
const staged = {
  email,
  extractedAt: data.extractedAt,
  segmateUserId: data.segmateUserId,
  isTemplateAllowed: data.isTemplateAllowed,
  fanpages: (data.tables?.users_fanpages?.rows ?? []).length,
  bots: isTemplate ? [] : sc.map((r) => toItem(r, 'bot')),
  packages: isTemplate ? sc.map((r) => toItem(r, 'package')) : [],
  counts: Object.fromEntries(Object.entries(data.tables ?? {}).map(([t, v]) => [t, v.rowCount ?? 0])),
};

mkdirSync(outDir, { recursive: true });
const rowKey = createHash('sha256').update(email).digest('hex').slice(0, 16);
const outPath = resolve(outDir, `${rowKey}.json`);
writeFileSync(outPath, JSON.stringify(staged, null, 2));
console.log(`wrote ${outPath}`);
console.log(`bots=${staged.bots.length} packages=${staged.packages.length} fanpages=${staged.fanpages}`);
console.log('Next: upload this file in the migration dashboard ("Upload staged JSON"), or stage via the migrationStageBots callable.');
