// Simple IP + daily rate limiter for Netlify functions, backed by Netlify Blobs.
// Counts are not atomic, so bursts can slip a few requests over the limit.
// That is fine for its job: stopping anyone from draining API credits.
import crypto from "node:crypto";
import { connectLambda, getStore } from "@netlify/blobs";

export function clientIp(event) {
  const h = event.headers || {};
  return (
    h["x-nf-client-connection-ip"] ||
    (h["x-forwarded-for"] || "").split(",")[0].trim() ||
    "unknown"
  );
}

// Reads a non-negative integer env var. 0 means "block everything" (kill switch).
export function envLimit(name, fallback) {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

// Raw IPs are never stored, only a short hash.
function ipKey(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

async function bump(store, key, windowMs, now) {
  const current = await store.get(key, { type: "json" });
  const entry = current && now - current.start < windowMs ? current : { start: now, count: 0 };
  entry.count += 1;
  await store.setJSON(key, entry);
  return entry;
}

/**
 * Counts this request and says whether it may proceed.
 * opts: { name, perIp, windowSec, daily }
 * Returns { ok: true } or { ok: false, reason: "ip" | "daily", retryAfter }.
 */
export async function checkLimits(event, opts, { store, now = Date.now() } = {}) {
  const { name, perIp, windowSec, daily } = opts;
  if (!store) {
    connectLambda(event);
    store = getStore("rate-limits");
  }

  const windowMs = windowSec * 1000;
  const ip = await bump(store, `${name}/ip/${ipKey(clientIp(event))}`, windowMs, now);
  if (ip.count > perIp) {
    return { ok: false, reason: "ip", retryAfter: Math.max(1, Math.ceil((ip.start + windowMs - now) / 1000)) };
  }

  const today = new Date(now).toISOString().slice(0, 10);
  const day = await bump(store, `${name}/day/${today}`, Infinity, now);
  if (day.count > daily) {
    const midnight = Date.parse(`${today}T00:00:00Z`) + 86_400_000;
    return { ok: false, reason: "daily", retryAfter: Math.max(1, Math.ceil((midnight - now) / 1000)) };
  }

  return { ok: true };
}

/**
 * Returns a 429 response when the request is over the limit, or null to continue.
 * failOpen: if the limiter itself errors, let the request through (true) or block it (false).
 */
export async function enforce(event, opts, headers, { failOpen = false, ...deps } = {}) {
  try {
    const result = await checkLimits(event, opts, deps);
    if (result.ok) return null;
    const error =
      result.reason === "daily"
        ? "Demo capacity reached for today. Please try again tomorrow."
        : "Too many requests. Please slow down and try again shortly.";
    return {
      statusCode: 429,
      headers: { ...headers, "Retry-After": String(result.retryAfter) },
      body: JSON.stringify({ error }),
    };
  } catch (err) {
    console.error(`Rate limiter error (${opts.name}):`, err.message);
    if (failOpen) return null;
    return { statusCode: 503, headers, body: JSON.stringify({ error: "Service temporarily unavailable" }) };
  }
}
