// Public live demo: saves the visitor as a lead, then returns the Executive Security Summary PDF.
// POST { email, company?, results: [{ id, verdict, reason, response }] }
import { enforce, envLimit } from "../lib/rate-limit.js";
import { saveLead } from "../lib/leads.js";
import { buildSummaryPdf, cleanResults, overallRisk } from "../lib/summary-pdf.js";

const json = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: json, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const email = String(body.email || "").trim().slice(0, 254);
  const company = String(body.company || "").trim().slice(0, 120);
  if (!EMAIL_RE.test(email)) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: "Please enter a valid work email." }) };
  }
  const results = cleanResults(body.results);
  if (!results.length) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: "Run the demo first." }) };
  }

  const limited = await enforce(event, {
    name: "demo-report",
    perIp: envLimit("DEMO_REPORT_RATE_PER_IP", 5),
    windowSec: 3600,
    daily: envLimit("DEMO_REPORT_DAILY_CAP", 300),
  }, json, { failOpen: true });
  if (limited) return limited;

  const failed = results.filter((r) => r.verdict === "FAIL").length;
  try {
    await saveLead({
      Email: email,
      Name: "",
      Chatbot: company,
      Message: `Live demo PDF: ${failed}/${results.length} failed, risk ${overallRisk(results)}. Failed: ${
        results.filter((r) => r.verdict === "FAIL").map((r) => r.probe.title).join(", ") || "none"}`,
      Source: "demo-pdf",
    });
  } catch (err) {
    // Still hand over the PDF; the lead is lost, so log enough to notice.
    console.error("demo-report lead save failed:", err.message);
  }

  try {
    const pdf = await buildSummaryPdf({ email, company, results });
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="BreakBot-Executive-Summary.pdf"',
        "Cache-Control": "no-store",
      },
      body: Buffer.from(pdf).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error("demo-report PDF error:", err.message);
    return { statusCode: 500, headers: json, body: JSON.stringify({ error: "Could not build the report. Please try again." }) };
  }
};
