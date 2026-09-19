exports.handler = async (event) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method not allowed" };

  try {
    const data = JSON.parse(event.body || "{}");
    const airtableToken = process.env.AIRTABLE_TOKEN;
    const airtableBase = process.env.AIRTABLE_BASE_ID;

    // Log even if Airtable not configured
    console.log("Waitlist submission:", JSON.stringify(data));

    if (airtableToken && airtableBase) {
      const res = await fetch(`https://api.airtable.com/v0/${airtableBase}/Leads`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${airtableToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: [{ fields: {
          Name: data.name || "", Email: data.email || "",
          Phone: data.phone || "", Chatbot: data.chatbot || "",
          Message: data.message || "", Source: data.source || "website",
          "Submitted At": new Date().toISOString()
        }}]})
      });
      if (!res.ok) console.error("Airtable error:", await res.text());
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Waitlist error:", err.message);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
  }
};
