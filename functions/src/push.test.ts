/**
 * Unit tests for the push notification module (pure logic only).
 * Run: cd functions && npx tsc -p . && node lib/push.test.js
 */
import assert from "node:assert/strict";
import { resolvePushLink, tokenDocId, cleanText } from "./push";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

// --- resolvePushLink: messenger ---
check("messenger: bare username becomes m.me link", () => {
  assert.equal(resolvePushLink("messenger", "acmewidgets"), "https://m.me/acmewidgets");
});
check("messenger: @username is trimmed", () => {
  assert.equal(resolvePushLink("messenger", "@acmewidgets"), "https://m.me/acmewidgets");
});
check("messenger: numeric id passes through", () => {
  assert.equal(resolvePushLink("messenger", "123456789"), "https://m.me/123456789");
});
check("messenger: existing m.me link is normalized", () => {
  assert.equal(resolvePushLink("messenger", "https://m.me/acmewidgets"), "https://m.me/acmewidgets");
  assert.equal(resolvePushLink("messenger", "m.me/acmewidgets?ref=x"), "https://m.me/acmewidgets");
});
check("messenger: empty value means no link", () => {
  assert.equal(resolvePushLink("messenger", ""), undefined);
  assert.equal(resolvePushLink("messenger", undefined), undefined);
});
check("messenger: garbage is rejected", () => {
  assert.throws(() => resolvePushLink("messenger", "not a handle!!!"));
});

// --- resolvePushLink: onpage ---
check("onpage: appends chatmize_chat=open", () => {
  assert.equal(
    resolvePushLink("onpage", "https://acme.com/pricing"),
    "https://acme.com/pricing?chatmize_chat=open",
  );
});
check("onpage: keeps existing query params", () => {
  assert.equal(
    resolvePushLink("onpage", "https://acme.com/?ref=push"),
    "https://acme.com/?ref=push&chatmize_chat=open",
  );
});
check("onpage: does not duplicate the param", () => {
  assert.equal(
    resolvePushLink("onpage", "https://acme.com/?chatmize_chat=open"),
    "https://acme.com/?chatmize_chat=open",
  );
});
check("onpage: non https is rejected", () => {
  assert.throws(() => resolvePushLink("onpage", "http://acme.com"));
  assert.throws(() => resolvePushLink("onpage", "notaurl"));
});
check("onpage: empty value means no link", () => {
  assert.equal(resolvePushLink("onpage", ""), undefined);
});

// --- resolvePushLink: website ---
check("website: full https url passes through", () => {
  assert.equal(resolvePushLink("website", "https://acme.com/sale"), "https://acme.com/sale");
});
check("website: bare domain gets https", () => {
  assert.equal(resolvePushLink("website", "acme.com/sale"), "https://acme.com/sale");
});
check("website: http is rejected", () => {
  assert.throws(() => resolvePushLink("website", "http://acme.com"));
});
check("website: javascript scheme is rejected", () => {
  assert.throws(() => resolvePushLink("website", "javascript:alert(1)"));
});
check("website: unknown link type defaults to website rules", () => {
  assert.equal(resolvePushLink("carrier-pigeon", "https://acme.com"), "https://acme.com");
});
check("website: empty value means no link", () => {
  assert.equal(resolvePushLink("website", ""), undefined);
});

// --- tokenDocId ---
check("tokenDocId: stable sha256 hex", () => {
  const a = tokenDocId("tok_abc");
  const b = tokenDocId("tok_abc");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});
check("tokenDocId: different tokens differ", () => {
  assert.notEqual(tokenDocId("tok_a"), tokenDocId("tok_b"));
});
check("tokenDocId: never contains the raw token", () => {
  const raw = "secret_token_xyz_123";
  assert.ok(!tokenDocId(raw).includes(raw));
});

// --- cleanText ---
check("cleanText: trims and caps length", () => {
  assert.equal(cleanText("  hi  ", 10), "hi");
  assert.equal(cleanText("x".repeat(200), 120).length, 120);
});
check("cleanText: strips control chars", () => {
  assert.equal(cleanText("a\u0000b", 10), "ab");
});

console.log(`\n${passed} checks passed`);
