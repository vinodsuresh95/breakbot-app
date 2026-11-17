// Saves a lead to the Airtable "Leads" table, the same table the waitlist uses.
// Only fields that already exist in that table are written.
export async function saveLead(fields) {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) {
    console.warn("Lead not saved: Airtable is not configured (source:", fields.Source, ")");
    return false;
  }
  const res = await fetch(`https://api.airtable.com/v0/${base}/Leads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      records: [{ fields: { ...fields, "Submitted At": new Date().toISOString() } }],
    }),
  });
  if (!res.ok) {
    console.error("Airtable error:", res.status, await res.text());
    return false;
  }
  return true;
}
