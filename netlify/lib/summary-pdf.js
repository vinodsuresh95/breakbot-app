// Builds the "Executive Security Summary" PDF for the public live demo.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { findProbe } from "./demo.js";

// Keep in sync with HEADLINE_PROBES / INDUSTRY_PACK_COUNT in src/data/industryPacks.js.
const FULL_LIBRARY = "680+ probes across 16 industry packs";
const CONTACT_EMAIL = "hello@breakbot.io";

const C = {
  ink: rgb(0.06, 0.09, 0.16),
  body: rgb(0.2, 0.25, 0.33),
  muted: rgb(0.42, 0.47, 0.55),
  line: rgb(0.86, 0.88, 0.91),
  panel: rgb(0.96, 0.97, 0.98),
  navy: rgb(0.012, 0.027, 0.07),
  accent: rgb(0.024, 0.714, 0.831),
  FAIL: rgb(0.8, 0.15, 0.15),
  PARTIAL: rgb(0.8, 0.5, 0.0),
  PASS: rgb(0.1, 0.55, 0.35),
};
const SEVERITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const VERDICT_RANK = { FAIL: 0, PARTIAL: 1, PASS: 2 };

// Standard PDF fonts only cover basic Latin, so replace or drop anything else.
export function pdfSafe(text) {
  return String(text ?? "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/·|•/g, "-")
    .replace(/\t/g, "  ")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function truncate(text, max) {
  const s = String(text ?? "").trim();
  return s.length > max ? `${s.slice(0, max - 3).trimEnd()}...` : s;
}

/** Keeps only results for known probes, with clamped field sizes. */
export function cleanResults(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const r of input.slice(0, 10)) {
    const probe = findProbe(r?.id);
    if (!probe || seen.has(probe.id)) continue;
    seen.add(probe.id);
    out.push({
      probe,
      verdict: ["FAIL", "PARTIAL", "PASS"].includes(r.verdict) ? r.verdict : "PARTIAL",
      reason: truncate(r.reason, 300),
      response: truncate(r.response, 700),
    });
  }
  return out;
}

export function overallRisk(results) {
  const failed = results.filter((r) => r.verdict === "FAIL");
  if (failed.some((r) => r.probe.severity === "Critical")) return "Critical";
  if (failed.length) return "High";
  if (results.some((r) => r.verdict === "PARTIAL")) return "Medium";
  return "Low";
}

export function topFindings(results, n = 3) {
  return results
    .filter((r) => r.verdict !== "PASS")
    .sort((a, b) =>
      VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] ||
      SEVERITY_RANK[a.probe.severity] - SEVERITY_RANK[b.probe.severity])
    .slice(0, n);
}

export async function buildSummaryPdf({ email, company, results, date = new Date() }) {
  const doc = await PDFDocument.create();
  doc.setTitle("BreakBot Executive Security Summary");
  doc.setAuthor("BreakBot");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const W = 612, H = 792, M = 54, CW = W - 2 * M;
  let page, y;

  const footer = () => {
    page.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.5, color: C.line });
    page.drawText(pdfSafe("BreakBot - Live demo against a fictional, intentionally weak bot. Not an assessment of any real system."),
      { x: M, y: 28, size: 7.5, font: regular, color: C.muted });
  };
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
    footer();
  };
  const ensure = (h) => { if (y - h < 60) newPage(); };

  const wrap = (text, font, size, width) => {
    const lines = [];
    for (const para of pdfSafe(text).split("\n")) {
      let line = "";
      for (const word of para.split(/ +/)) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) <= width) { line = test; continue; }
        if (line) lines.push(line);
        // Hard-break words longer than the line.
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width) {
          let i = w.length;
          while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
          lines.push(w.slice(0, i));
          w = w.slice(i);
        }
        line = w;
      }
      lines.push(line);
    }
    return lines;
  };

  const text = (str, { font = regular, size = 10, color = C.body, x = M, width = CW, gap = 4 } = {}) => {
    const lh = size * 1.35;
    for (const line of wrap(str, font, size, width)) {
      ensure(lh);
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= lh;
    }
    y -= gap;
  };

  // ── Header band ──
  newPage();
  page.drawRectangle({ x: 0, y: H - 118, width: W, height: 118, color: C.navy });
  page.drawText("BREAK", { x: M, y: H - 52, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText("BOT", { x: M + bold.widthOfTextAtSize("BREAK", 16), y: H - 52, size: 16, font: bold, color: C.accent });
  page.drawText("Executive Security Summary", { x: M, y: H - 84, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("AI chatbot red-team results - live demo", { x: M, y: H - 104, size: 10, font: regular, color: rgb(0.7, 0.75, 0.82) });
  y = H - 146;

  const dateStr = date.toISOString().slice(0, 10);
  const meta = [
    ["Prepared for", truncate(company ? `${email} (${company})` : email, 90)],
    ["Date", dateStr],
    ["Target", "Aria - AcmeCorp support bot (fictional demo target)"],
    ["Scope", `${results.length}-probe live demo`],
  ];
  for (const [k, v] of meta) {
    page.drawText(k.toUpperCase(), { x: M, y: y - 8, size: 7.5, font: bold, color: C.muted });
    page.drawText(pdfSafe(v), { x: M + 90, y: y - 8.5, size: 9.5, font: regular, color: C.ink });
    y -= 16;
  }
  y -= 10;

  // ── Score panel ──
  const failed = results.filter((r) => r.verdict === "FAIL").length;
  const partial = results.filter((r) => r.verdict === "PARTIAL").length;
  const risk = overallRisk(results);
  const riskColor = { Critical: C.FAIL, High: C.FAIL, Medium: C.PARTIAL, Low: C.PASS }[risk];
  page.drawRectangle({ x: M, y: y - 74, width: CW, height: 74, color: C.panel, borderColor: C.line, borderWidth: 0.75 });
  page.drawText(`${failed} of ${results.length}`, { x: M + 18, y: y - 40, size: 26, font: bold, color: failed ? C.FAIL : C.PASS });
  page.drawText(partial ? `attacks succeeded, ${partial} partially` : "attacks succeeded",
    { x: M + 18, y: y - 58, size: 9.5, font: regular, color: C.body });
  page.drawText("OVERALL RISK", { x: M + 300, y: y - 26, size: 7.5, font: bold, color: C.muted });
  page.drawText(risk, { x: M + 300, y: y - 50, size: 20, font: bold, color: riskColor });
  y -= 96;

  // ── All results ──
  text("Results", { font: bold, size: 13, color: C.ink, gap: 6 });
  for (const r of results) {
    ensure(20);
    page.drawRectangle({ x: M, y: y - 14, width: 52, height: 14, color: C[r.verdict] });
    page.drawText(r.verdict, { x: M + 26 - bold.widthOfTextAtSize(r.verdict, 7.5) / 2, y: y - 10, size: 7.5, font: bold, color: rgb(1, 1, 1) });
    page.drawText(pdfSafe(r.probe.title), { x: M + 64, y: y - 11, size: 10, font: bold, color: C.ink });
    const sev = `${r.probe.severity} severity`;
    page.drawText(sev, { x: W - M - regular.widthOfTextAtSize(sev, 8.5), y: y - 11, size: 8.5, font: regular, color: C.muted });
    y -= 22;
  }
  y -= 10;

  // ── Top findings ──
  const top = topFindings(results);
  text(top.length ? `Top ${top.length === 1 ? "finding" : `${top.length} findings`}` : "No failures this run",
    { font: bold, size: 13, color: C.ink, gap: 6 });
  if (!top.length) {
    text("The demo bot held up against every probe in this run. Model replies vary between runs, and a real audit uses hundreds of probes plus multi-turn attacks.");
  }
  top.forEach((r, i) => {
    ensure(120);
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: C.line });
    y -= 12;
    text(`${i + 1}. ${r.probe.title}`, { font: bold, size: 11.5, color: C.ink, gap: 1 });
    text(`${r.probe.category}  |  ${r.probe.severity}  |  ${r.verdict}`, { size: 8.5, color: C[r.verdict], gap: 6 });
    text("WHAT HAPPENED", { font: bold, size: 7.5, color: C.muted, gap: 1 });
    text(r.reason || "The judge flagged this reply as unsafe.", { gap: 6 });
    text("ATTACK", { font: bold, size: 7.5, color: C.muted, gap: 1 });
    text(truncate(r.probe.prompt, 320), { font: mono, size: 8, color: C.body, gap: 6 });
    text("BOT REPLIED", { font: bold, size: 7.5, color: C.muted, gap: 1 });
    text(truncate(r.response, 360) || "(empty reply)", { font: mono, size: 8, color: C.body, gap: 6 });
    text("RECOMMENDED FIX", { font: bold, size: 7.5, color: C.muted, gap: 1 });
    text(r.probe.fix, { gap: 12 });
  });

  // ── CTA ──
  ensure(150);
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: C.line });
  y -= 14;
  text("What a full BreakBot audit adds", { font: bold, size: 13, color: C.ink, gap: 6 });
  for (const b of [
    `The full library: ${FULL_LIBRARY}, run against your own bot.`,
    "Multi-turn attacks across RAG, memory, tools and connected APIs.",
    "Every finding manually reviewed, with reproducible evidence.",
    "Specific remediation, then a retest to prove the fix worked.",
  ]) text(`-  ${b}`, { x: M + 6, width: CW - 6, gap: 2 });
  y -= 8;
  text(`Want these results for your own chatbot? Email ${CONTACT_EMAIL}. We only test endpoints you authorize in writing, preferably staging.`,
    { font: bold, size: 10, color: C.ink });

  return doc.save();
}
