// Pure logic for the comment-to-DM webhook: no network, no storage. Tested with node --test.

const enc = new TextEncoder();

/** Check Meta's X-Hub-Signature-256 header against the raw body, using the App Secret. */
export async function verifySignature(rawBody, header, appSecret) {
  if (!header || !header.startsWith("sha256=") || !appSecret) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(rawBody)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7).toLowerCase();
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/** Answer Meta's GET verification: the challenge string, or null when the token does not match. */
export function verifyChallenge(params, verifyToken) {
  if (params.get("hub.mode") === "subscribe" && verifyToken && params.get("hub.verify_token") === verifyToken) {
    return params.get("hub.challenge") || "";
  }
  return null;
}

/** Parse and check the rules list. Each rule: id, keywords[], opener, button, link, notFollowing, optional media[]. */
export function loadRules(json) {
  const rules = typeof json === "string" ? JSON.parse(json) : json;
  if (!Array.isArray(rules) || !rules.length) throw new Error("RULES must be a non-empty JSON array");
  const ids = new Set();
  for (const r of rules) {
    for (const k of ["id", "opener", "button", "link", "notFollowing"]) {
      if (!r[k] || typeof r[k] !== "string") throw new Error(`rule ${r.id || "?"}: missing ${k}`);
    }
    if (!/^[a-z0-9_-]{1,32}$/i.test(r.id)) throw new Error(`rule ${r.id}: id must be letters, digits, _ or -`);
    if (ids.has(r.id)) throw new Error(`rule ${r.id}: duplicate id`);
    ids.add(r.id);
    if (!Array.isArray(r.keywords) || !r.keywords.length) throw new Error(`rule ${r.id}: keywords must be a non-empty list`);
    if (r.button.length > 20) throw new Error(`rule ${r.id}: button text is limited to 20 characters`);
  }
  return rules;
}

const norm = (s) => (s || "").normalize("NFKC").toLowerCase();

/** The first rule whose keyword appears in the comment and whose media list (if any) contains the post. */
export function matchRule(rules, text, mediaId) {
  const t = norm(text);
  return rules.find((r) => (!r.media || !r.media.length || r.media.includes(mediaId)) &&
    r.keywords.some((k) => t.includes(norm(k)))) || null;
}

export const payloadFor = (rule) => `CLAIM:${rule.id}`;

/** Turn one webhook body into a list of events the worker acts on. Ignores echoes, own comments and anything unknown. */
export function parseEvents(body, ownIds = []) {
  const own = new Set(ownIds.filter(Boolean).map(String));
  const out = [];
  if (!body || body.object !== "instagram" || !Array.isArray(body.entry)) return out;
  for (const entry of body.entry) {
    for (const ch of entry.changes || []) {
      const v = ch.value || {};
      if (ch.field !== "comments" || !v.id) continue;
      if (v.from && own.has(String(v.from.id))) continue;
      out.push({ type: "comment", commentId: String(v.id), text: v.text || "", mediaId: v.media ? String(v.media.id) : "",
        userId: v.from ? String(v.from.id) : "", username: v.from ? v.from.username || "" : "" });
    }
    for (const m of entry.messaging || []) {
      const sender = m.sender ? String(m.sender.id) : "";
      if (!sender || own.has(sender)) continue;
      if (m.message) {
        if (m.message.is_echo) continue;
        out.push({ type: "message", userId: sender, text: m.message.text || "",
          payload: m.message.quick_reply ? m.message.quick_reply.payload || "" : "" });
      } else if (m.postback) {
        out.push({ type: "message", userId: sender, text: m.postback.title || "", payload: m.postback.payload || "" });
      }
    }
  }
  return out;
}

/** Which rule a direct message claims: the button payload, or the button text typed by hand. */
export function claimedRule(rules, ev) {
  if (ev.payload && ev.payload.startsWith("CLAIM:")) return rules.find((r) => payloadFor(r) === ev.payload) || null;
  const t = norm(ev.text).trim();
  return t ? rules.find((r) => norm(r.button).trim() === t) || null : null;
}

/** Message bodies for the Send API. */
export const openerMessage = (rule) => ({
  text: rule.opener,
  quick_replies: [{ content_type: "text", title: rule.button, payload: payloadFor(rule) }],
});
export const linkMessage = (rule) => ({ text: `${rule.linkText || "這是你要的資料："}\n${rule.link}` });
export const notFollowingMessage = (rule) => ({
  text: rule.notFollowing,
  quick_replies: [{ content_type: "text", title: rule.button, payload: payloadFor(rule) }],
});

/**
 * Decide what to do for one event, given what the store already knows.
 * Returns { action, rule, keys } where action is one of:
 *   "opener"        private-reply to the comment with the button
 *   "check-follow"  look up the follow status, then call afterFollowCheck
 *   "skip"          nothing to do (duplicate, no rule, already handled)
 */
export function decide(rules, ev, seen) {
  if (ev.type === "comment") {
    const rule = matchRule(rules, ev.text, ev.mediaId);
    if (!rule) return { action: "skip", reason: "no keyword" };
    const commentKey = `comment:${ev.commentId}`;
    if (seen.has(commentKey)) return { action: "skip", reason: "comment already answered" };
    return { action: "opener", rule, keys: [commentKey] };
  }
  const rule = claimedRule(rules, ev);
  if (!rule) return { action: "skip", reason: "not a claim" };
  return { action: "check-follow", rule };
}

/** After the follow lookup: send the link once per person and rule; re-ask if they do not follow yet. */
export function afterFollowCheck(rule, userId, follows, seen) {
  const sentKey = `sent:${rule.id}:${userId}`;
  if (follows !== true) return { action: "not-following", message: notFollowingMessage(rule) };
  if (seen.has(sentKey)) return { action: "skip", reason: "link already sent" };
  return { action: "send-link", message: linkMessage(rule), keys: [sentKey] };
}
