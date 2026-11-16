// Cloudflare Worker: Instagram comment keyword -> private reply with a button -> follow check -> link.
// Secrets: VERIFY_TOKEN, APP_SECRET, PAGE_ACCESS_TOKEN. Vars: RULES (JSON), IG_USER_ID, PAGE_ID, GRAPH_VERSION.
// KV binding: SEEN (remembers answered comments and who already got a link).
import { verifySignature, verifyChallenge, loadRules, parseEvents, decide, afterFollowCheck, openerMessage } from "./logic.js";

const KEEP_SECONDS = 60 * 60 * 24 * 90; // remember for 90 days

function graph(env, path, init = {}) {
  const v = env.GRAPH_VERSION || "v24.0";
  const url = new URL(`https://graph.facebook.com/${v}/${path}`);
  url.searchParams.set("access_token", env.PAGE_ACCESS_TOKEN);
  return fetch(url, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } })
    .then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`Graph ${r.status}: ${JSON.stringify(body.error || body)}`);
      return body;
    });
}

const send = (env, recipient, message) =>
  graph(env, "me/messages", { method: "POST", body: JSON.stringify({ recipient, message }) });

async function follows(env, userId) {
  const p = await graph(env, `${userId}?fields=is_user_follow_business`);
  return p.is_user_follow_business === true;
}

/** A tiny view of KV for the pure decide() functions. */
async function seenSet(env, keys) {
  const hits = new Set();
  for (const k of keys) if (await env.SEEN.get(k)) hits.add(k);
  return { has: (k) => hits.has(k) };
}
const remember = (env, keys) => Promise.all((keys || []).map((k) => env.SEEN.put(k, "1", { expirationTtl: KEEP_SECONDS })));

async function handle(env, body) {
  const rules = loadRules(env.RULES);
  const events = parseEvents(body, [env.IG_USER_ID, env.PAGE_ID]);
  for (const ev of events) {
    try {
      if (ev.type === "comment") {
        const seen = await seenSet(env, [`comment:${ev.commentId}`]);
        const d = decide(rules, ev, seen);
        if (d.action !== "opener") continue;
        await remember(env, d.keys); // before sending, so a Meta retry cannot send twice
        await send(env, { comment_id: ev.commentId }, openerMessage(d.rule));
        console.log(JSON.stringify({ did: "opener", rule: d.rule.id, comment: ev.commentId }));
      } else {
        const d = decide(rules, ev, { has: () => false });
        if (d.action !== "check-follow") continue;
        const isFollowing = await follows(env, ev.userId);
        const seen = await seenSet(env, [`sent:${d.rule.id}:${ev.userId}`]);
        const next = afterFollowCheck(d.rule, ev.userId, isFollowing, seen);
        if (next.action === "skip") { console.log(JSON.stringify({ did: "skip", reason: next.reason, rule: d.rule.id })); continue; }
        if (next.keys) await remember(env, next.keys);
        await send(env, { id: ev.userId }, next.message);
        console.log(JSON.stringify({ did: next.action, rule: d.rule.id }));
      }
    } catch (err) {
      console.log(JSON.stringify({ error: String(err), event: ev.type }));
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET") {
      const challenge = verifyChallenge(url.searchParams, env.VERIFY_TOKEN);
      return challenge === null ? new Response("forbidden", { status: 403 }) : new Response(challenge);
    }
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    const raw = await request.text();
    if (!(await verifySignature(raw, request.headers.get("x-hub-signature-256"), env.APP_SECRET))) {
      return new Response("bad signature", { status: 401 });
    }
    let body;
    try { body = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
    ctx.waitUntil(handle(env, body)); // answer Meta at once; Meta retries slow endpoints
    return new Response("ok");
  },
};

export { handle };
