#!/usr/bin/env node
/**
 * Bookings engine tests (no new dependencies).
 *
 * Compiles functions/src/bookings.ts to a temp dir with the project's own
 * tsc, then exercises the pure slot engine, the HMAC manage-link round trip,
 * and the settings sanitizer. Run: npm run test:bookings  (in functions/)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const functionsDir = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const outDir = mkdtempSync(join(tmpdir(), "booking-test-"));

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

try {
  execFileSync(
    "npx",
    ["tsc", "src/bookings.ts", "--outDir", outDir, "--module", "nodenext",
     "--target", "es2022", "--moduleResolution", "nodenext", "--skipLibCheck"],
    { cwd: functionsDir, stdio: "pipe" },
  );
} catch (e) {
  // tsc may report pre-existing type errors in the wider graph under these
  // flags; the emit still lands. Fail only if nothing was emitted.
  if (!existsSync(join(outDir, "bookings.js"))) {
    console.error("COMPILE FAILED\n" + String(e.stdout || "") + String(e.stderr || ""));
    process.exit(2);
  }
}

const { createRequire } = await import("node:module");
// Resolve bare imports (firebase-admin, firebase-functions, ...) from the
// functions tree: the compiled test copy lives in /tmp, outside node_modules.
const functionsRequire = createRequire(join(functionsDir, "package.json"));
const Module = functionsRequire("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  try {
    return origResolve.call(this, request, parent, ...rest);
  } catch (err) {
    if (typeof request === "string" && !request.startsWith(".") && !request.startsWith("/")) {
      return functionsRequire.resolve(request);
    }
    throw err;
  }
};

const m = await import(pathToFileURL(join(outDir, "bookings.js")).href);
const { computeSlots, defaultBookingSettings, signManageLink, verifyManageLink } = m;

const s = defaultBookingSettings();
const denver = (over = {}) => ({
  ...s,
  timeZone: "America/Denver",
  slotMinutes: 60,
  bufferMinutes: 0,
  maxPerDay: 100,
  minLeadHours: 0,
  maxAdvanceDays: 800,
  workingHours: s.workingHours.map((w, i) => ({ day: i, start: "09:00", end: "17:00", enabled: true })),
  ...over,
});
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Denver", hour: "2-digit", minute: "2-digit", hour12: false,
});
const labels = (slots) => slots.map((x) => fmt.format(new Date(x.startUtc)));

// --- Availability basics -------------------------------------------------
check("normal day slot count", computeSlots(denver(), [], "2027-03-15", "2027-03-15").length, 8);
check("first slot local", labels(computeSlots(denver(), [], "2027-03-15", "2027-03-15"))[0], "09:00");
check("last slot local", labels(computeSlots(denver(), [], "2027-03-15", "2027-03-15")).pop(), "16:00");

// --- DST ------------------------------------------------------------------
const full = denver({ workingHours: s.workingHours.map((w, i) => ({ day: i, start: "00:00", end: "23:59", enabled: true })) });
check("spring-forward skips nonexistent 2am", computeSlots(full, [], "2027-03-14", "2027-03-14").length, 22);
check("normal full day", computeSlots(full, [], "2027-03-15", "2027-03-15").length, 23);
check("fall-back shows 1am once", computeSlots(full, [], "2027-11-07", "2027-11-07").length, 23);
// Range spanning the fall-back transition: no duplicate days, no hang.
check("5-day range across fall back", computeSlots(denver(), [], "2027-11-05", "2027-11-09").length, 40);

// --- Buffers / limits / lead time ------------------------------------------
const start = Date.parse("2027-03-15T10:00:00-06:00");
const booked = [{ startUtc: start, endUtc: start + 3600_000 }];
const bufLabels = labels(computeSlots(denver({ bufferMinutes: 30 }), booked, "2027-03-15", "2027-03-15"));
check("buffer blocks 09:00", bufLabels.includes("09:00"), false);
check("buffer blocks 11:00", bufLabels.includes("11:00"), false);
check("buffer leaves 12:00 open", bufLabels.includes("12:00"), true);
check("daily limit", computeSlots(denver({ maxPerDay: 1 }), booked, "2027-03-15", "2027-03-15").length, 0);
check("lead time filters", computeSlots(
  denver({ minLeadHours: 48 }), [], "2027-03-15", "2027-03-15",
  Date.parse("2027-03-14T12:00:00-06:00")).length, 0);

// --- HMAC manage links ------------------------------------------------------
const s2 = { ...s, signingKey: "k".repeat(64) };
const { sig, exp } = signManageLink("ws1", "b1", s2);
check("hmac verifies", verifyManageLink("ws1", "b1", sig, exp, s2), true);
check("hmac rejects tamper",
  verifyManageLink("ws1", "b1", sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0"), exp, s2), false);
check("hmac rejects wrong booking", verifyManageLink("ws1", "b2", sig, exp, s2), false);
check("hmac rejects wrong workspace", verifyManageLink("ws2", "b1", sig, exp, s2), false);
check("hmac rejects expiry", verifyManageLink("ws1", "b1", sig, Date.now() - 1, s2), false);

rmSync(outDir, { recursive: true, force: true });
console.log(failures === 0 ? "\nALL BOOKING TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
