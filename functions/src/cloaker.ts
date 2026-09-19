/**
 * send.chat link cloaker resolver.
 *
 * Folded into the metaWebhook HTTP function: host-based routing at the top
 * of that handler calls handleCloakerRequest() first. When the request host
 * is send.chat (or www.send.chat, or the pre-DNS test host), the request is
 * resolved against the top-level `cloaked_links` Firestore collection.
 *
 * Contract (shared with Builder B, the frontend):
 *   collection: cloaked_links
 *   doc id:     `${workspaceSlug}_${slug}` (URL-safe, lowercase)
 *   fields: workspaceSlug, slug, fullShortUrl, destinationUrl,
 *           destinationType ('takeover'|'messenger'|'instagram'|'url'),
 *           cloakingMode ('masked'|'bridge'|'direct'),
 *           title, description, previewImage, connectedBotId, ref,
 *           clickCount (number, default 0), createdBy, createdAt, updatedAt.
 *   Optional extras the resolver also honors when present:
 *           messengerUrl, instagramUrl, chatEndpoint.
 *
 * Routing:
 *   GET /                    -> 301 https://chatmize.com
 *   GET /{workspace}/{slug}  -> 301 destinationUrl when cloakingMode is
 *                                'direct', or destinationType is 'url' /
 *                                'messenger' / 'instagram' (destinationUrl is
 *                                the stored m.me/ig.me URL for those types)
 *                             -> HTML takeover page (OG tags + chat widget)
 *                                when destinationType is 'takeover' or
 *                                cloakingMode is 'masked'/'bridge'
 *   missing doc              -> 404
 * Every resolved doc view increments clickCount by 1.
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";

/** Hosts that trigger the cloaker instead of the Meta webhook logic. */
const CLOAKER_HOSTS = new Set([
  "send.chat",
  "www.send.chat",
  // Pre-DNS-cutover test host for the new Firebase Hosting site.
  "chatmize-sendchat.web.app",
]);

/** Minimal structural types so this module needs no express typings. */
export interface CloakerReq {
  hostname?: string;
  path?: string;
  method?: string;
  body?: unknown;
  get(name: string): string | undefined;
  header(name: string): string | undefined;
}

export interface CloakerRes {
  status(code: number): CloakerRes;
  set(name: string, value: string): CloakerRes;
  send(body: string): void;
  json(body: unknown): void;
  redirect(status: number, url: string): void;
  sendStatus(code: number): void;
}

interface CloakedLinkDoc {
  workspaceSlug: string;
  slug: string;
  fullShortUrl?: string;
  destinationUrl: string;
  destinationType: "takeover" | "messenger" | "instagram" | "url";
  cloakingMode: "masked" | "bridge" | "direct";
  title?: string;
  description?: string;
  previewImage?: string;
  connectedBotId?: string;
  ref?: string;
  messengerUrl?: string;
  instagramUrl?: string;
  chatEndpoint?: string;
  clickCount?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

const SLUG_RE = /^[A-Za-z0-9_-]+$/;
const PATH_RE = /^\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/?$/;

function getHost(req: CloakerReq): string {
  const h = (req.hostname || "").toLowerCase();
  if (h) return h;
  const fwd = req.get("x-forwarded-host") || req.header("x-forwarded-host") || "";
  return fwd.split(",")[0].trim().toLowerCase();
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

async function loadLink(
  workspaceSlug: string,
  slug: string,
): Promise<{ ref: FirebaseFirestore.DocumentReference; data: CloakedLinkDoc } | null> {
  const docId = `${workspaceSlug.toLowerCase()}_${slug.toLowerCase()}`;
  const ref = getFirestore("chatmize-prod").collection("cloaked_links").doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { ref, data: snap.data() as CloakedLinkDoc };
}

function bumpClicks(ref: FirebaseFirestore.DocumentReference): Promise<void> {
  return ref
    .update({ clickCount: FieldValue.increment(1) })
    .then(() => undefined)
    .catch(() => undefined);
}

/**
 * Handle one request. Returns true when this request belonged to the
 * cloaker (response already sent), false when the caller should continue
 * with its own logic (non-send.chat host).
 */
export async function handleCloakerRequest(req: CloakerReq, res: CloakerRes): Promise<boolean> {
  if (!CLOAKER_HOSTS.has(getHost(req))) return false;

  const path = req.path || "/";

  // Chat widget posts land here when no custom chatEndpoint is configured.
  if (req.method === "POST") {
    const m = path.match(PATH_RE);
    if (!m || !SLUG_RE.test(m[1]) || !SLUG_RE.test(m[2])) {
      res.sendStatus(404);
      return true;
    }
    const link = await loadLink(m[1], m[2]);
    if (!link) {
      res.sendStatus(404);
      return true;
    }
    // Default canned reply. Wire a real AI endpoint by setting the doc's
    // chatEndpoint field; the widget then posts there directly instead.
    res.json({
      reply:
        "Thanks for reaching out. A teammate will follow up here shortly. " +
        "For the fastest reply, continue this chat in Messenger or Instagram using the buttons below.",
    });
    return true;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.sendStatus(405);
    return true;
  }

  // Bare domain -> chatmize.com (Karl's call).
  if (path === "/" || path === "") {
    res.redirect(301, "https://chatmize.com");
    return true;
  }

  const m = path.match(PATH_RE);
  if (!m || !SLUG_RE.test(m[1]) || !SLUG_RE.test(m[2])) {
    res.status(404).send("Link not found");
    return true;
  }

  const link = await loadLink(m[1], m[2]);
  if (!link) {
    res.status(404).send("Link not found");
    return true;
  }
  const data = link.data;
  void bumpClicks(link.ref);

  const mode = data.cloakingMode || "direct";
  const type = data.destinationType || "url";
  const dest = (data.destinationUrl || "").trim();

  // Takeover page: rendered card with OG tags, live chat panel, and
  // continue-in-Messenger/Instagram buttons.
  if (mode === "masked" || mode === "bridge" || type === "takeover") {
    res.status(200).set("Content-Type", "text/html; charset=utf-8").send(renderTakeoverPage(data, getHost(req)));
    return true;
  }

  // Direct / url / messenger / instagram: plain 301 to the destination.
  if (!isHttpUrl(dest)) {
    res.status(404).send("Link not found");
    return true;
  }
  res.redirect(301, dest);
  return true;
}

/** Resolve the Messenger / Instagram continue buttons for a takeover page. */
function continueUrls(data: CloakedLinkDoc): { messenger: string; instagram: string } {
  let messenger = (data.messengerUrl || "").trim();
  let instagram = (data.instagramUrl || "").trim();
  const dest = (data.destinationUrl || "").trim();
  if (!messenger && data.destinationType === "messenger" && isHttpUrl(dest)) messenger = dest;
  if (!instagram && data.destinationType === "instagram" && isHttpUrl(dest)) instagram = dest;
  if (!isHttpUrl(messenger)) messenger = "";
  if (!isHttpUrl(instagram)) instagram = "";
  return { messenger, instagram };
}

function renderTakeoverPage(data: CloakedLinkDoc, host: string): string {
  const title = (data.title || "Chat with us").slice(0, 120);
  const description = (data.description || "").slice(0, 300);
  const image = (data.previewImage || "").trim();
  const ws = (data.workspaceSlug || "").toLowerCase();
  const slug = (data.slug || "").toLowerCase();
  const pageUrl = `https://${host}/${encodeURIComponent(ws)}/${encodeURIComponent(slug)}`;
  const { messenger, instagram } = continueUrls(data);
  const endpoint = (data.chatEndpoint || "").trim();

  const buttons: string[] = [];
  if (messenger) {
    buttons.push(
      `<a class="btn btn-messenger" href="${esc(messenger)}" target="_blank" rel="noopener">Continue in Messenger</a>`,
    );
  }
  if (instagram) {
    buttons.push(
      `<a class="btn btn-instagram" href="${esc(instagram)}" target="_blank" rel="noopener">Continue in Instagram DM</a>`,
    );
  }

  // JSON-encode values injected into the inline script.
  const js = (v: string) => JSON.stringify(v);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(pageUrl)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n` : ""}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">\n` : ""}<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#0f172a;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border-radius:20px;max-width:520px;width:100%;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.35)}
.hero{width:100%;max-height:280px;object-fit:cover;display:block}
.body{padding:28px}
h1{font-size:26px;line-height:1.25;margin-bottom:10px}
p.desc{font-size:16px;line-height:1.55;color:#475569;margin-bottom:20px}
.buttons{display:flex;flex-direction:column;gap:10px;margin-bottom:22px}
.btn{display:block;text-align:center;padding:13px 18px;border-radius:12px;font-weight:600;font-size:16px;text-decoration:none;color:#fff}
.btn-messenger{background:#0084ff}
.btn-instagram{background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)}
.chat{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
.chat-head{background:#1e293b;color:#fff;padding:12px 16px;font-weight:600;font-size:15px}
.chat-log{height:240px;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f8fafc}
.msg{max-width:82%;padding:10px 14px;border-radius:14px;font-size:15px;line-height:1.45}
.msg.bot{background:#fff;border:1px solid #e2e8f0;align-self:flex-start}
.msg.user{background:#0084ff;color:#fff;align-self:flex-end}
.msg.typing{color:#94a3b8;font-style:italic}
.chat-form{display:flex;border-top:1px solid #e2e8f0}
.chat-form input{flex:1;border:0;padding:13px 14px;font-size:15px;outline:none}
.chat-form button{border:0;background:#0084ff;color:#fff;font-weight:600;padding:0 22px;font-size:15px;cursor:pointer}
.footer{text-align:center;padding:16px;font-size:13px;color:#94a3b8}
.footer a{color:#64748b;text-decoration:none}
@media(max-width:560px){.body{padding:20px}h1{font-size:22px}}
</style>
</head>
<body>
<main class="card">
${image ? `<img class="hero" src="${esc(image)}" alt="">\n` : ""}<div class="body">
<h1>${esc(title)}</h1>
${description ? `<p class="desc">${esc(description)}</p>\n` : ""}<div class="buttons">
${buttons.join("\n")}
</div>
<div class="chat" id="chat">
<div class="chat-head">Live chat</div>
<div class="chat-log" id="chatLog"></div>
<form class="chat-form" id="chatForm">
<input id="chatInput" type="text" placeholder="Type your message" autocomplete="off" maxlength="500">
<button type="submit">Send</button>
</form>
</div>
</div>
<div class="footer">Powered by <a href="https://chatmize.com">ChatMize</a></div>
</main>
<script>
(function(){
var ENDPOINT = ${js(endpoint)};
var POST_URL = window.location.pathname + window.location.search;
var log = document.getElementById('chatLog');
var form = document.getElementById('chatForm');
var input = document.getElementById('chatInput');
function addMsg(text, who){
  var d = document.createElement('div');
  d.className = 'msg ' + who;
  d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
addMsg(${js("Hi there. Ask us anything, we usually reply right away.")}, 'bot');
form.addEventListener('submit', function(e){
  e.preventDefault();
  var text = input.value.trim();
  if(!text) return;
  addMsg(text, 'user');
  input.value = '';
  var typing = addMsg('Typing', 'typing');
  fetch(ENDPOINT || POST_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({message: text})
  }).then(function(r){ return r.json(); })
    .then(function(data){
      typing.remove();
      addMsg((data && data.reply) || 'Thanks. We will be right with you.', 'bot');
    })
    .catch(function(){
      typing.remove();
      addMsg('Something went wrong sending that. Please try again or use one of the buttons above.', 'bot');
    });
});
})();
</script>
</body>
</html>`;
}
