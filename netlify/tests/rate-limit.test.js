import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLimits, enforce } from "../lib/rate-limit.js";

function memoryStore() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : null; },
    async setJSON(k, v) { m.set(k, structuredClone(v)); },
  };
}
const ev = (ip) => ({ headers: { "x-nf-client-connection-ip": ip } });
const opts = { name: "t", perIp: 3, windowSec: 60, daily: 5 };

test("blocks an IP after its limit, then resets after the window", async () => {
  const store = memoryStore(); const t0 = Date.parse("2026-11-06T10:00:00Z");
  for (let i = 0; i < 3; i++) assert.equal((await checkLimits(ev("1.1.1.1"), opts, { store, now: t0 })).ok, true);
  const r = await checkLimits(ev("1.1.1.1"), opts, { store, now: t0 + 1000 });
  assert.deepEqual([r.ok, r.reason, r.retryAfter], [false, "ip", 59]);
  assert.equal((await checkLimits(ev("1.1.1.1"), opts, { store, now: t0 + 61_000 })).ok, true);
});

test("daily cap applies across many IPs and resets next UTC day", async () => {
  const store = memoryStore(); const t0 = Date.parse("2026-11-06T23:00:00Z");
  for (let i = 0; i < 5; i++) assert.equal((await checkLimits(ev(`2.0.0.${i}`), opts, { store, now: t0 })).ok, true);
  const r = await checkLimits(ev("2.0.0.99"), opts, { store, now: t0 });
  assert.deepEqual([r.ok, r.reason, r.retryAfter], [false, "daily", 3600]);
  assert.equal((await checkLimits(ev("2.0.0.99"), opts, { store, now: t0 + 3_600_001 })).ok, true);
});

test("limit 0 acts as a kill switch", async () => {
  const r = await checkLimits(ev("3.3.3.3"), { ...opts, perIp: 0 }, { store: memoryStore() });
  assert.equal(r.ok, false);
});

test("raw IPs are never stored", async () => {
  const keys = []; const store = { async get() { return null; }, async setJSON(k) { keys.push(k); } };
  await checkLimits(ev("9.8.7.6"), opts, { store });
  assert.ok(keys.every((k) => !k.includes("9.8.7.6")));
});

test("enforce returns 429 with Retry-After, and handles limiter errors", async () => {
  const store = memoryStore();
  for (let i = 0; i < 3; i++) assert.equal(await enforce(ev("4.4.4.4"), opts, {}, { store }), null);
  const res = await enforce(ev("4.4.4.4"), opts, {}, { store });
  assert.equal(res.statusCode, 429); assert.ok(res.headers["Retry-After"]);

  const broken = { async get() { throw new Error("down"); }, async setJSON() {} };
  assert.equal((await enforce(ev("5.5.5.5"), opts, {}, { store: broken })).statusCode, 503);
  assert.equal(await enforce(ev("5.5.5.5"), opts, {}, { store: broken, failOpen: true }), null);
});
