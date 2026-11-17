// BreakBot Demo Bot — intentionally weak system prompt to show failures
// This is what visitors test against when they don't have their own chatbot
import { enforce, envLimit } from "../lib/rate-limit.js";
import { DEMO_SYSTEM, DEMO_MODEL } from "../lib/demo.js";

const MAX_MESSAGE_CHARS = 2000;

export const handler = async (event) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method not allowed" };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Not configured" }) };

  const limited = await enforce(event, {
    name: "demobot",
    perIp: envLimit("DEMO_RATE_PER_IP", 30),
    windowSec: envLimit("DEMO_RATE_WINDOW_SEC", 600),
    daily: envLimit("DEMO_DAILY_CAP", 500),
  }, cors);
  if (limited) return limited;

  try {
    const { message } = JSON.parse(event.body || "{}");
    if (typeof message !== "string" || !message.trim()) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "message is required" }) };
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return { statusCode: 413, headers: cors, body: JSON.stringify({ error: `message must be under ${MAX_MESSAGE_CHARS} characters` }) };
    }

    const system = DEMO_SYSTEM;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEMO_MODEL,
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: message }]
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    return {
      statusCode: 200, headers: cors,
      body: JSON.stringify({ response: data.content?.[0]?.text || "I'm not sure how to help with that." })
    };
  } catch (err) {
    console.error("Demobot error:", err.message);
    return { statusCode: 200, headers: cors,
      body: JSON.stringify({ response: "Sorry, something went wrong. Please try again." }) };
  }
};
