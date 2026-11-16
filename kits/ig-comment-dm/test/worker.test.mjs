import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifySignature, verifyChallenge, loadRules, matchRule, parseEvents, decide, afterFollowCheck } from "../src/logic.js";
import worker from "../src/worker.js";

const RULES = readFileSync(new URL("../rules.example.json", import.meta.url), "utf8");
const rules = loadRules(RULES);
const SECRET = "app-secret";

async function sign(raw) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(raw)));
  return "sha256=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const comment = (id, text, from = "u1") => ({ object: "instagram", entry: [{ id: "ig1", changes: [{ field: "comments",
  value: { id, text, from: { id: from, username: "someone" }, media: { id: "m1" } } }] }] });
const tap = (from, payload) => ({ object: "instagram", entry: [{ id: "ig1", messaging: [{ sender: { id: from }, recipient: { id: "ig1" },
  message: { mid: "x", text: "已追蹤，傳給我", quick_reply: { payload } } }] }] });

// ---- pure logic
test("signature: right secret passes, tampered body or wrong secret fails", async () => {
  const raw = JSON.stringify(comment("c1", "攻略"));
  const h = await sign(raw);
  assert.equal(await verifySignature(raw, h, SECRET), true);
  assert.equal(await verifySignature(raw + " ", h, SECRET), false);
  assert.equal(await verifySignature(raw, h, "other"), false);
  assert.equal(await verifySignature(raw, null, SECRET), false);
});

test("challenge: returned only for the right verify token", () => {
  const p = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "42" });
  assert.equal(verifyChallenge(p, "tok"), "42");
  assert.equal(verifyChallenge(p, "nope"), null);
});

test("rules: bad rules are refused", () => {
  assert.throws(() => loadRules("[]"));
  assert.throws(() => loadRules([{ id: "a", keywords: ["x"], opener: "o", button: "b", link: "l" }]), /notFollowing/);
  assert.throws(() => loadRules([{ id: "a", keywords: ["x"], opener: "o", button: "一二三四五六七八九十一二三四五六七八九十一", link: "l", notFollowing: "n" }]), /20/);
});

test("keyword match ignores case and full-width forms; media filter applies", () => {
  assert.equal(matchRule(rules, "我要 GUIDE！", "m1").id, "guide");
  assert.equal(matchRule(rules, "我要ｇｕｉｄｅ", "m1").id, "guide");
  assert.equal(matchRule(rules, "好棒", "m1"), null);
  const only = loadRules([{ ...rules[0], media: ["m9"] }]);
  assert.equal(matchRule(only, "攻略", "m1"), null);
  assert.equal(matchRule(only, "攻略", "m9").id, "guide");
});

test("events: own comments and echoes are ignored", () => {
  assert.equal(parseEvents(comment("c1", "攻略", "ig1"), ["ig1"]).length, 0);
  const echo = { object: "instagram", entry: [{ messaging: [{ sender: { id: "u1" }, message: { is_echo: true, text: "hi" } }] }] };
  assert.equal(parseEvents(echo, ["ig1"]).length, 0);
  assert.equal(parseEvents({ object: "page", entry: [] }).length, 0);
});

test("decide: an answered comment is skipped; follow check sends the link once", () => {
  const [ev] = parseEvents(comment("c1", "攻略"));
  assert.equal(decide(rules, ev, new Set()).action, "opener");
  assert.equal(decide(rules, ev, new Set(["comment:c1"])).action, "skip");
  assert.equal(afterFollowCheck(rules[0], "u1", false, new Set()).action, "not-following");
  assert.equal(afterFollowCheck(rules[0], "u1", true, new Set()).action, "send-link");
  assert.equal(afterFollowCheck(rules[0], "u1", true, new Set(["sent:guide:u1"])).action, "skip");
});

// ---- the worker end to end, with Graph and KV faked
function fakeEnv() {
  const kv = new Map();
  return { VERIFY_TOKEN: "tok", APP_SECRET: SECRET, PAGE_ACCESS_TOKEN: "pt", IG_USER_ID: "ig1", PAGE_ID: "p1", RULES,
    SEEN: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } }, kv };
}
function fakeGraph(following) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ path: u.pathname, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    const body = u.pathname.endsWith("/me/messages") ? { message_id: "mid" } : { is_user_follow_business: following() };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return calls;
}
async function post(env, body) {
  const raw = JSON.stringify(body);
  const waits = [];
  const res = await worker.fetch(new Request("https://w.example/", { method: "POST", body: raw, headers: { "x-hub-signature-256": await sign(raw) } }),
    env, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  return res;
}

test("worker: GET verification and unsigned POST", async () => {
  const env = fakeEnv();
  const ok = await worker.fetch(new Request("https://w.example/?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=abc"), env, {});
  assert.equal(await ok.text(), "abc");
  const bad = await worker.fetch(new Request("https://w.example/", { method: "POST", body: "{}" }), env, { waitUntil() {} });
  assert.equal(bad.status, 401);
});

test("worker: comment -> one private reply even when Meta retries", async () => {
  const env = fakeEnv();
  const calls = fakeGraph(() => true);
  await post(env, comment("c1", "給我攻略"));
  await post(env, comment("c1", "給我攻略"));
  const sends = calls.filter((c) => c.method === "POST");
  assert.equal(sends.length, 1);
  assert.deepEqual(sends[0].body.recipient, { comment_id: "c1" });
  assert.equal(sends[0].body.message.quick_replies[0].payload, "CLAIM:guide");
});

test("worker: not following -> asked again; following -> link once, second tap sends nothing", async () => {
  const env = fakeEnv();
  let following = false;
  const calls = fakeGraph(() => following);
  await post(env, tap("u1", "CLAIM:guide"));
  following = true;
  await post(env, tap("u1", "CLAIM:guide"));
  await post(env, tap("u1", "CLAIM:guide"));
  const sends = calls.filter((c) => c.method === "POST").map((c) => c.body.message.text);
  assert.equal(sends.length, 2);
  assert.match(sends[0], /還沒看到你的追蹤/);
  assert.match(sends[1], /https:\/\/example\.com\/guide/);
});
