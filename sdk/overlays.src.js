/**
 * ChatMize Overlays SDK v__SDK_VERSION__
 * Embeddable overlay / popup renderer for customer websites.
 * Vanilla JS, zero dependencies.
 *
 * Usage:
 *   <script src="https://app.chatmize.com/overlays.js" data-workspace="WS_ID" async></script>
 *
 * The snippet fetches the workspace's published overlay config from Firestore
 * (public read-only doc `overlayConfigs/{workspaceId}`), renders eligible
 * overlays (triggers: time delay, scroll depth, exit intent, immediate),
 * enforces frequency capping via localStorage, and reports batched
 * impression/click/lead events to POST {origin}/__overlay/track.
 */
(function () {
  "use strict";

  /* Build-time tokens (replaced by scripts/build-sdk.mjs). */
  var PROJECT_ID = "__FIREBASE_PROJECT_ID__";
  var API_KEY = "__FIREBASE_API_KEY__";
  var DB_ID = "__FIRESTORE_DB_ID__";
  var SDK_VERSION = "__SDK_VERSION__";

  /* ------------------------------------------------------------------ */
  /* Boot: locate our own <script> tag and read data-workspace.          */
  /* ------------------------------------------------------------------ */
  function findScript() {
    if (document.currentScript) return document.currentScript;
    var tags = document.getElementsByTagName("script");
    for (var i = tags.length - 1; i >= 0; i--) {
      var src = tags[i].getAttribute("src") || "";
      if (src.indexOf("overlays.js") !== -1) return tags[i];
    }
    return null;
  }

  var scriptTag = findScript();
  if (!scriptTag) return;
  var WS = (scriptTag.getAttribute("data-workspace") || "").trim();
  if (!WS || !/^[A-Za-z0-9_-]{1,128}$/.test(WS)) return;

  var SCRIPT_ORIGIN = (function () {
    try {
      return new URL(scriptTag.src, location.href).origin;
    } catch (e) {
      return location.origin;
    }
  })();
  var TRACK_URL = SCRIPT_ORIGIN + "/__overlay/track";
  var CONFIG_URL =
    "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
    "/databases/" + DB_ID + "/documents/overlayConfigs/" + encodeURIComponent(WS) +
    "?key=" + API_KEY;

  var IS_TOUCH = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  /* ------------------------------------------------------------------ */
  /* Small helpers.                                                      */
  /* ------------------------------------------------------------------ */
  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function safeColor(c, fallback) {
    return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
  }
  function safeUrl(u) {
    if (typeof u !== "string") return "";
    u = u.trim();
    return /^https?:\/\//i.test(u) ? u : "";
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function on(elm, evt, fn) {
    if (elm.addEventListener) elm.addEventListener(evt, fn, false);
  }

  /* Minimal Firestore REST value decoder (only shapes we publish). */
  function dec(v) {
    if (!v || typeof v !== "object") return null;
    if ("stringValue" in v) return v.stringValue;
    if ("booleanValue" in v) return !!v.booleanValue;
    if ("integerValue" in v) return parseInt(v.integerValue, 10);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("nullValue" in v) return null;
    if ("timestampValue" in v) return v.timestampValue;
    if ("arrayValue" in v) {
      var arr = v.arrayValue.values || [], out = [];
      for (var i = 0; i < arr.length; i++) out.push(dec(arr[i]));
      return out;
    }
    if ("mapValue" in v) {
      var f = v.mapValue.fields || {}, o = {};
      for (var k in f) if (Object.prototype.hasOwnProperty.call(f, k)) o[k] = dec(f[k]);
      return o;
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Event tracking: localStorage queue, batched POST, beacon on unload. */
  /* ------------------------------------------------------------------ */
  function qKey() { return "cmz_ovlq:" + WS; }
  var flushing = false, flushTimer = null, unloading = false;

  function track(overlayId, event, data) {
    try {
      var q = JSON.parse(localStorage.getItem(qKey()) || "[]");
      var ev = { overlayId: overlayId, event: event, ts: Date.now() };
      /* Optional lead payload (email/name) — only attached for lead events. */
      if (data && typeof data === "object") {
        var d = {};
        if (typeof data.email === "string" && data.email) d.email = String(data.email).slice(0, 254);
        if (typeof data.name === "string" && data.name) d.name = String(data.name).slice(0, 120);
        if (d.email || d.name) ev.data = d;
      }
      q.push(ev);
      if (q.length > 200) q = q.slice(-200);
      localStorage.setItem(qKey(), JSON.stringify(q));
    } catch (e) { /* storage unavailable: drop */ }
    scheduleFlush(4000);
  }

  function scheduleFlush(ms) {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(); }, ms);
  }

  function flush() {
    if (flushing) return;
    var q = [];
    try { q = JSON.parse(localStorage.getItem(qKey()) || "[]"); } catch (e) {}
    if (!q.length) return;
    flushing = true;
    var batch = q.slice(0, 25);
    var body = JSON.stringify({ workspaceId: WS, sdk: SDK_VERSION, events: batch });
    var done = function (ok) {
      flushing = false;
      if (ok) {
        try {
          var rest = JSON.parse(localStorage.getItem(qKey()) || "[]").slice(batch.length);
          localStorage.setItem(qKey(), JSON.stringify(rest));
        } catch (e) {}
      }
    };
    try {
      if (unloading && navigator.sendBeacon) {
        done(navigator.sendBeacon(TRACK_URL, body));
        return;
      }
      fetch(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
      }).then(function (r) { done(r.ok); }, function () { done(false); });
    } catch (e) { done(false); }
  }

  on(window, "pagehide", function () { unloading = true; flush(); });
  on(document, "visibilitychange", function () {
    if (document.hidden) { unloading = true; flush(); }
  });

  /* ------------------------------------------------------------------ */
  /* Frequency capping via localStorage.                                 */
  /* ------------------------------------------------------------------ */
  var shownThisLoad = {};
  var modalShownThisLoad = false;

  function fKey() { return "cmz_ovlf:" + WS; }
  function canShow(ov, isBar) {
    if (shownThisLoad[ov.id]) return false;
    if (!isBar && modalShownThisLoad) return false; /* one modal/slider/takeover per load */
    var f = ov.frequency || {};
    var cdH = num(f.cooldownHours, 24), maxV = num(f.maxPerVisitor, 0);
    try {
      var all = JSON.parse(localStorage.getItem(fKey()) || "{}");
      var rec = all[ov.id];
      if (rec) {
        if (maxV > 0 && rec.n >= maxV) return false;
        if (cdH > 0 && Date.now() - rec.last < cdH * 3600e3) return false;
      }
    } catch (e) {}
    return true;
  }
  function markShown(ov, isBar) {
    shownThisLoad[ov.id] = true;
    if (!isBar) modalShownThisLoad = true;
    try {
      var all = JSON.parse(localStorage.getItem(fKey()) || "{}");
      var rec = all[ov.id] || { n: 0, last: 0 };
      rec.n += 1; rec.last = Date.now();
      all[ov.id] = rec;
      localStorage.setItem(fKey(), JSON.stringify(all));
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /* Targeting: domain whitelist + page path patterns.                   */
  /* ------------------------------------------------------------------ */
  function domainAllowed(list) {
    if (!list || !list.length) return true;
    var h = location.hostname.toLowerCase();
    for (var i = 0; i < list.length; i++) {
      var d = String(list[i]).toLowerCase().replace(/^\*\./, "");
      if (!d) continue;
      if (h === d || h.slice(-d.length - 1) === "." + d) return true;
    }
    return false;
  }
  function pageAllowed(pt) {
    if (!pt || pt.mode === "all" || !pt.patterns || !pt.patterns.length) return true;
    var path = location.pathname + location.search;
    var hit = false;
    for (var i = 0; i < pt.patterns.length; i++) {
      var pat = String(pt.patterns[i]);
      var re = "^" + pat.split("*").map(escRe).join(".*") + "$";
      try { if (new RegExp(re).test(path)) { hit = true; break; } } catch (e) {}
    }
    return pt.mode === "include" ? hit : !hit;
  }

  /* ------------------------------------------------------------------ */
  /* Styles (shadow DOM, CSS vars for brand + theme).                     */
  /* ------------------------------------------------------------------ */
  var CSS = [
    ".cmz-wrap{--cmz-brand:#3b82f6;--cmz-bg:#0f172a;--cmz-fg:#f8fafc;--cmz-mut:#94a3b8;",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
    "color:var(--cmz-fg);line-height:1.45;box-sizing:border-box}",
    ".cmz-wrap.cmz-light{--cmz-bg:#ffffff;--cmz-fg:#0f172a;--cmz-mut:#64748b}",
    ".cmz-wrap *{box-sizing:border-box;margin:0;padding:0}",
    ".cmz-back{position:fixed;inset:0;background:rgba(2,6,23,.72);z-index:2147483000;",
    "display:flex;align-items:center;justify-content:center;padding:16px;animation:cmzIn .25s ease}",
    ".cmz-card{position:relative;width:100%;max-width:430px;background:var(--cmz-bg);border-radius:18px;",
    "padding:30px 28px 26px;box-shadow:0 25px 70px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.08);",
    "text-align:center;animation:cmzPop .3s cubic-bezier(.2,.9,.3,1.2)}",
    ".cmz-takeover .cmz-back{background:color-mix(in srgb,var(--cmz-brand) 12%,rgba(2,6,23,.94));}",
    ".cmz-takeover .cmz-card{max-width:560px;padding:48px 44px}",
    ".cmz-badge{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;",
    "color:var(--cmz-brand);background:color-mix(in srgb,var(--cmz-brand) 14%,transparent);",
    "border:1px solid color-mix(in srgb,var(--cmz-brand) 35%,transparent);",
    "padding:5px 12px;border-radius:999px;margin-bottom:14px}",
    ".cmz-h{font-size:26px;font-weight:800;margin:0 0 10px;letter-spacing:-.01em}",
    ".cmz-takeover .cmz-h{font-size:34px}",
    ".cmz-sub{font-size:15px;color:var(--cmz-mut);margin:0 0 18px}",
    ".cmz-code{display:inline-block;font-family:ui-monospace,Menlo,monospace;font-weight:800;font-size:15px;",
    "letter-spacing:.08em;border:2px dashed var(--cmz-brand);border-radius:10px;padding:8px 16px;margin:0 0 18px;cursor:pointer}",
    ".cmz-field{width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(148,163,184,.35);",
    "background:rgba(148,163,184,.08);color:var(--cmz-fg);font-size:14px;margin:0 0 10px;outline:none}",
    ".cmz-field:focus{border-color:var(--cmz-brand)}",
    ".cmz-cta{display:block;width:100%;padding:14px;border:0;border-radius:12px;background:var(--cmz-brand);",
    "color:#fff;font-size:16px;font-weight:800;cursor:pointer;margin-top:6px}",
    ".cmz-cta:hover{filter:brightness(1.08)}",
    ".cmz-x{position:absolute;top:10px;right:12px;background:none;border:0;color:var(--cmz-mut);",
    "font-size:22px;cursor:pointer;line-height:1;padding:4px}",
    ".cmz-x:hover{color:var(--cmz-fg)}",
    ".cmz-brandline{margin-top:16px;font-size:11px;color:var(--cmz-mut)}",
    ".cmz-brandline a{color:var(--cmz-mut);text-decoration:none}",
    ".cmz-ok{font-size:44px;margin-bottom:10px}",
    /* slider */
    ".cmz-slider .cmz-back{background:none;inset:auto;padding:0;justify-content:flex-end;align-items:flex-end}",
    ".cmz-drawer{width:360px;max-width:calc(100vw - 32px);background:var(--cmz-bg);border-radius:16px 16px 0 0;",
    "padding:26px 24px 22px;box-shadow:0 -12px 50px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.08);",
    "margin:0 16px 0 0;animation:cmzSlide .35s cubic-bezier(.2,.9,.3,1)}",
    ".cmz-slider.cmz-left .cmz-back{justify-content:flex-start}",
    ".cmz-slider.cmz-left .cmz-drawer{margin:0 0 0 16px}",
    /* sticky bar */
    ".cmz-stickybar .cmz-back{background:none;inset:auto;padding:0;display:block;animation:cmzDrop .3s ease}",
    ".cmz-bar{width:100%;background:var(--cmz-bg);border-bottom:1px solid rgba(255,255,255,.08);",
    "padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}",
    ".cmz-stickybar.cmz-bottom .cmz-bar{border-bottom:0;border-top:1px solid rgba(255,255,255,.08)}",
    ".cmz-bar .cmz-h{font-size:15px;margin:0}",
    ".cmz-bar .cmz-cta{width:auto;padding:9px 20px;font-size:13px;margin:0}",
    ".cmz-bar .cmz-x{position:static;margin-left:6px}",
    "@keyframes cmzIn{from{opacity:0}to{opacity:1}}",
    "@keyframes cmzPop{from{opacity:0;transform:scale(.92) translateY(10px)}to{opacity:1;transform:none}}",
    "@keyframes cmzSlide{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}",
    "@keyframes cmzDrop{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:none}}",
  ].join("\n");

  /* ------------------------------------------------------------------ */
  /* Render one overlay into a shadow root.                              */
  /* ------------------------------------------------------------------ */
  function renderOverlay(ov) {
    var type = ov.type || "popup_modal";
    var isBar = type === "sticky_bar";
    var brand = safeColor(ov.brandColor, "#3b82f6");
    var theme = ov.theme === "light" ? "cmz-light" : "";

    var host = el("div");
    host.setAttribute("data-cmz-overlay", String(ov.id));
    var root = host.attachShadow({ mode: "open" });
    var style = el("style"); style.textContent = CSS; root.appendChild(style);

    var wrapCls = "cmz-wrap " + theme;
    if (type === "page_takeover") wrapCls += " cmz-takeover";
    else if (type === "slider") wrapCls += " cmz-slider" + (ov.position === "bottom_left" ? " cmz-left" : "");
    else if (isBar) wrapCls += " cmz-stickybar" + (ov.position === "bottom_bar" ? " cmz-bottom" : "");
    var wrap = el("div", wrapCls);
    wrap.style.setProperty("--cmz-brand", brand);
    var back = el("div", "cmz-back");
    wrap.appendChild(back);
    root.appendChild(wrap);

    var closed = false;
    function close() {
      if (closed) return; closed = true;
      if (host.parentNode) host.parentNode.removeChild(host);
      if (!isBar) document.body.style.overflow = "";
      on(document, "keydown", function () {}); /* noop keeps handler list stable */
    }
    function addClose(btn) { on(btn, "click", function (e) { e.stopPropagation(); close(); }); return btn; }

    /* Shared content builder: badge, headline, sub, offer code, email form / CTA. */
    function buildCard(card, compact) {
      if (ov.badgeText) card.appendChild(el("div", "cmz-badge", ov.badgeText));
      if (ov.headline) card.appendChild(el("div", "cmz-h", ov.headline));
      if (ov.subheadline) card.appendChild(el("div", "cmz-sub", ov.subheadline));
      if (ov.offerCode && !compact) {
        var code = el("div", "cmz-code", ov.offerCode);
        code.title = "Click to copy";
        on(code, "click", function () { copyText(ov.offerCode); code.textContent = "Copied!"; });
        card.appendChild(code);
      }

      if (ov.requireEmailCapture) {
        var form = el("form");
        var emailInput = el("input", "cmz-field");
        emailInput.type = "email"; emailInput.required = true; emailInput.placeholder = "Enter your email";
        emailInput.setAttribute("aria-label", "Email address");
        form.appendChild(emailInput);
        if (ov.requireNameCapture) {
          var nameInput = el("input", "cmz-field");
          nameInput.type = "text"; nameInput.placeholder = "Your name";
          nameInput.setAttribute("aria-label", "Name");
          form.appendChild(nameInput);
        }
        var submit = el("button", "cmz-cta", ov.ctaText || "Claim Offer");
        submit.type = "submit";
        form.appendChild(submit);
        on(form, "submit", function (e) {
          e.preventDefault();
          var v = (emailInput.value || "").trim();
          if (!/^\S+@\S+\.\S+$/.test(v)) { emailInput.focus(); return; }
          /* The email/name are persisted by the backend tracking route —
             never silently dropped. */
          track(ov.id, "lead", {
            email: v,
            name: nameInput ? (nameInput.value || "").trim() : "",
          });
          card.innerHTML = "";
          card.appendChild(el("div", "cmz-ok", "✓"));
          card.appendChild(el("div", "cmz-h", "You're in!"));
          card.appendChild(el("div", "cmz-sub", ov.offerCode ? "Your code: " + ov.offerCode : "Check your inbox for next steps."));
          card.appendChild(addClose(el("button", "cmz-x", "×")));
        });
        card.appendChild(form);
      } else {
        var cta = el("button", "cmz-cta", ov.ctaText || "Learn More");
        on(cta, "click", function () {
          track(ov.id, "click");
          var act = ov.ctaAction || "open_url";
          var url = safeUrl(ov.redirectUrl);
          if (act === "copy_code" && ov.offerCode) {
            copyText(ov.offerCode);
            cta.textContent = "Copied!";
            setTimeout(close, 1200);
          } else if (url && (act === "open_url" || act === "open_bot" || act === "enter_contest")) {
            location.href = url;
          } else {
            close();
          }
        });
        card.appendChild(cta);
      }

      if (!ov.removeBranding) {
        var bl = el("div", "cmz-brandline");
        var a = el("a", null, "Powered by ChatMize");
        a.href = "https://chatmize.com"; a.target = "_blank"; a.rel = "noopener";
        bl.appendChild(a);
        card.appendChild(bl);
      }
    }

    if (isBar) {
      var bar = el("div", "cmz-bar");
      if (ov.headline) bar.appendChild(el("div", "cmz-h", ov.headline));
      var barCta = el("button", "cmz-cta", ov.ctaText || "Learn More");
      on(barCta, "click", function () {
        track(ov.id, "click");
        var url = safeUrl(ov.redirectUrl);
        if (url) location.href = url;
      });
      bar.appendChild(barCta);
      bar.appendChild(addClose(el("button", "cmz-x", "×")));
      back.appendChild(bar);
    } else {
      var card = el("div", type === "slider" ? "cmz-drawer" : "cmz-card");
      card.appendChild(addClose(el("button", "cmz-x", "×")));
      buildCard(card, false);
      back.appendChild(card);
      if (type === "popup_modal" || type === "page_takeover") {
        on(back, "click", function (e) { if (e.target === back) close(); });
      }
    }

    document.body.appendChild(host);
    if (!isBar) {
      document.body.style.overflow = "hidden";
      on(document, "keydown", function esc(e) {
        if (e.key === "Escape") { close(); }
      });
    }
    track(ov.id, "impression");
    markShown(ov, isBar);
    return close;
  }

  function copyText(t) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t);
      } else {
        var ta = el("textarea"); ta.value = t;
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /* Triggers.                                                           */
  /* ------------------------------------------------------------------ */
  var PRIORITY = { page_takeover: 0, popup_modal: 1, slider: 2, sticky_bar: 3 };

  function effectiveTrigger(ov) {
    var mt = ov.mobileTrigger;
    if (IS_TOUCH && mt && mt.enabled !== false && mt.triggerType) {
      var t = mt.triggerType === "exit_intent" ? "time_delay" : mt.triggerType;
      return { type: t, delay: num(mt.delaySeconds, 5), scroll: num(mt.scrollPercent, 50) };
    }
    var dt = ov.triggerType === "exit_intent" && IS_TOUCH ? "time_delay" : (ov.triggerType || "time_delay");
    return { type: dt, delay: num(ov.triggerDelaySeconds, 5), scroll: num(ov.triggerScrollPercent, 50) };
  }

  function armTrigger(ov) {
    var tr = effectiveTrigger(ov);
    var fired = false;
    function fire() {
      if (fired) return; fired = true;
      if (!canShow(ov, false)) return;
      renderOverlay(ov);
    }
    if (tr.type === "immediate") { fire(); return; }
    if (tr.type === "time_delay") { setTimeout(fire, Math.max(0, tr.delay) * 1000); return; }
    if (tr.type === "scroll_depth") {
      var check = function () {
        var h = document.documentElement;
        var pct = (window.scrollY + window.innerHeight) / Math.max(1, h.scrollHeight) * 100;
        if (pct >= tr.scroll) { fire(); detach(); }
      };
      var detach = function () { window.removeEventListener("scroll", check); };
      on(window, "scroll", check);
      setTimeout(check, 500);
      return;
    }
    if (tr.type === "exit_intent" && !IS_TOUCH) {
      on(document, "mouseout", function (e) {
        if (!e.relatedTarget && e.clientY <= 0) fire();
      });
      return;
    }
    /* Unknown trigger: fall back to a short delay. */
    setTimeout(fire, 5000);
  }

  /* ------------------------------------------------------------------ */
  /* Main: fetch config, filter, arm.                                    */
  /* ------------------------------------------------------------------ */
  function init(config) {
    var list = (config && config.overlays) || [];
    if (!list.length) return;
    var eligible = [];
    for (var i = 0; i < list.length; i++) {
      var ov = list[i];
      if (!ov || !ov.id) continue;
      if (!domainAllowed(ov.whitelistedDomains) || !pageAllowed(ov.pageTargeting)) continue;
      eligible.push(ov);
    }
    if (!eligible.length) return;
    /* A/B allocation: overlays sharing an abGroup compete for the visitor.
       One winner per group, weighted by abWeight, sticky via localStorage
       so a visitor always sees the same variant. */
    var singles = [], groups = {}, gk, gi, vi;
    for (gi = 0; gi < eligible.length; gi++) {
      var grp = eligible[gi].abGroup;
      if (grp) { (groups[grp] = groups[grp] || []).push(eligible[gi]); }
      else singles.push(eligible[gi]);
    }
    for (gk in groups) {
      var variants = groups[gk];
      var abKey = "cmz_ovl_ab:" + WS + ":" + gk;
      var storedId = null;
      try { storedId = localStorage.getItem(abKey); } catch (e) {}
      var chosen = null;
      for (vi = 0; vi < variants.length; vi++) {
        if (variants[vi].id === storedId) { chosen = variants[vi]; break; }
      }
      if (!chosen) {
        var total = 0;
        for (vi = 0; vi < variants.length; vi++) total += variants[vi].abWeight || 50;
        var roll = Math.random() * total, acc = 0;
        for (vi = 0; vi < variants.length; vi++) {
          acc += variants[vi].abWeight || 50;
          if (roll <= acc) { chosen = variants[vi]; break; }
        }
        chosen = chosen || variants[0];
        try { localStorage.setItem(abKey, chosen.id); } catch (e) {}
      }
      singles.push(chosen);
    }
    eligible = singles;
    eligible.sort(function (a, b) {
      return (PRIORITY[a.type] || 9) - (PRIORITY[b.type] || 9);
    });

    var armed = false;
    for (var j = 0; j < eligible.length; j++) {
      var ovj = eligible[j];
      var isBar = ovj.type === "sticky_bar";
      if (isBar) {
        if (canShow(ovj, true)) renderOverlay(ovj);
        continue;
      }
      if (!armed) { armed = true; armTrigger(ovj); }
    }
  }

  function boot() {
    var loaded = false;
    function done(config) {
      if (loaded) return; loaded = true;
      try { init(config); } catch (e) { /* never break the host page */ }
    }
    try {
      fetch(CONFIG_URL, { cache: "no-store" }).then(
        function (r) {
          if (r.status === 404) { done(null); return null; }
          if (!r.ok) { done(null); return null; }
          return r.json();
        },
        function () { done(null); }
      ).then(function (doc) {
        if (!doc || !doc.fields) { done(null); return; }
        var cfg = {};
        for (var k in doc.fields) {
          if (Object.prototype.hasOwnProperty.call(doc.fields, k)) cfg[k] = dec(doc.fields[k]);
        }
        done(cfg);
      }, function () { done(null); });
    } catch (e) { done(null); }
    /* Safety net: never leave triggers unarmed because of a hung fetch. */
    setTimeout(function () { done(null); }, 8000);
  }

  if (document.readyState === "loading") {
    on(document, "DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
