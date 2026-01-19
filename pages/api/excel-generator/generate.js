export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const backend = process.env.EXCEL_BACKEND_URL;
    if (!backend) return res.status(500).send("Missing EXCEL_BACKEND_URL");

    const r = await fetch(`${backend}/generate_excel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return res.status(r.status).send(t || "Backend error");
    }

    const arrayBuffer = await r.arrayBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=AUREA33.xlsx");
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
}
