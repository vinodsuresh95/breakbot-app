// Public live demo: runs one demo probe against the fictional AcmeCorp bot and judges it.
// GET  -> list of probes (ids and titles only)
// POST {id} -> result for that probe
import { enforce, envLimit } from "../lib/rate-limit.js";
import { DEMO_PROBES, findProbe, runProbe } from "../lib/demo.js";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };

export const handler = async (event) => {
  if (event.httpMethod === "GET") {
    const probes = DEMO_PROBES.map(({ id, title, category, severity }) => ({ id, title, category, severity }));
    return { statusCode: 200, headers, body: JSON.stringify({ probes }) };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let id;
  try {
    ({ id } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }
  const probe = findProbe(id);
  if (!probe) return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown probe" }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 503, headers, body: JSON.stringify({ error: "Demo is not configured" }) };

  // One demo run = 5 calls, so the default allows 5 runs per IP per 10 minutes.
  const limited = await enforce(event, {
    name: "demo-probe",
    perIp: envLimit("LIVE_DEMO_RATE_PER_IP", 25),
    windowSec: envLimit("LIVE_DEMO_RATE_WINDOW_SEC", 600),
    daily: envLimit("LIVE_DEMO_DAILY_CAP", 500),
  }, headers);
  if (limited) return limited;

  try {
    const result = await runProbe(key, probe);
    return { statusCode: 200, headers, body: JSON.stringify({ result }) };
  } catch (err) {
    console.error("demo-probe error:", probe.id, err.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "The demo bot did not respond in time. Please try again." }) };
  }
};
