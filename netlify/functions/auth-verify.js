import crypto from "node:crypto";

function safeEqual(actual, expected) {
  const a = Buffer.from(actual || "", "utf8");
  const b = Buffer.from(expected || "", "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const expected = (process.env.DASHBOARD_API_KEY || "").trim();
  const supplied = event.headers["x-dashboard-key"] || event.headers["X-Dashboard-Key"] || "";

  if (!expected) {
    return { statusCode: 503, body: JSON.stringify({ error: "Dashboard authentication is not configured" }) };
  }
  if (!safeEqual(supplied, expected)) {
    return { statusCode: 401, body: JSON.stringify({ ok: false }) };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ ok: true }),
  };
}
