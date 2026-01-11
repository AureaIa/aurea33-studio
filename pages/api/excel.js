// pages/api/excel.js
import ExcelJS from "exceljs";

function safeStr(x, fallback = "") {
  return typeof x === "string" ? x : fallback;
}

function normalizeTheme(theme) {
  const t = (theme || "").toLowerCase();
  if (t.includes("dark") || t.includes("gold")) return "dark-gold";
  if (t.includes("verde") || t.includes("azul")) return "green-blue";
  if (t.includes("blanco")) return "light";
  if (t.includes("plata")) return "black-silver";
  if (t.includes("azul")) return "blue";
  return "dark-gold";
}

function themeColors(themeKey) {
  // argb: AARRGGBB
  switch (themeKey) {
    case "light":
      return {
        bg: "FFFFFFFF",
        headerBg: "FF111827",
        headerText: "FFFFFFFF",
        text: "FF111827",
        grid: "FFE5E7EB",
        accent: "FF2563EB",
        zebra: "FFF3F4F6",
      };
    case "green-blue":
      return {
        bg: "FF0B1020",
        headerBg: "FF0F172A",
        headerText: "FFFFFFFF",
        text: "FFF9FAFB",
        grid: "FF1F2937",
        accent: "FF22C55E",
        zebra: "FF0C1326",
      };
    case "black-silver":
      return {
        bg: "FF070707",
        headerBg: "FF0F0F0F",
        headerText: "FFFFFFFF",
        text: "FFF9FAFB",
        grid: "FF2A2A2A",
        accent: "FF94A3B8",
        zebra: "FF0B0B0B",
      };
    case "blue":
      return {
        bg: "FF0B1020",
        headerBg: "FF0B1B3A",
        headerText: "FFFFFFFF",
        text: "FFF9FAFB",
        grid: "FF1F2937",
        accent: "FF60A5FA",
        zebra: "FF0C1326",
      };
    default: // dark-gold
      return {
        bg: "FF07060A",
        headerBg: "FF111827",
        headerText: "FFFFD166",
        text: "FFF9FAFB",
        grid: "FF2A2A2A",
        accent: "FFFFD166",
        zebra: "FF0B0A10",
      };
  }
}

function toDataUrlPngBase64(b64OrDataUrl) {
  if (!b64OrDataUrl) return null;
  if (b64OrDataUrl.startsWith("data:image")) return b64OrDataUrl;
  return `data:image/png;base64,${b64OrDataUrl}`;
}

function parseDataUrl(dataUrl) {
  // data:image/png;base64,xxxx
  const m = /^data:(image\/\w+);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

async function quickChartPngBase64({ type, labels, datasets, title }) {
  // Generates a PNG chart using QuickChart (no key). Requires outbound internet.
  const payload = {
    width: 900,
    height: 450,
    backgroundColor: "transparent",
    format: "png",
    chart: {
      type: type || "bar",
      data: { labels, datasets },
      options: {
        plugins: {
          title: { display: !!title, text: title || "" },
          legend: { display: true },
        },
      },
    },
  };

  const r = await fetch("https://quickchart.io/chart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) throw new Error(`QuickChart error: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.toString("base64");
}

function applySheetBase(ws, colors) {
  ws.properties.defaultRowHeight = 18;
  ws.views = [{ state: "frozen", ySplit: 1 }]; // freeze header row
  ws.getRow(1).height = 22;

  // Header style
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: colors.headerText } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  // Borders + zebra rows
  ws.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: colors.grid } },
        left: { style: "thin", color: { argb: colors.grid } },
        bottom: { style: "thin", color: { argb: colors.grid } },
        right: { style: "thin", color: { argb: colors.grid } },
      };
      if (rowNumber > 1) {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        if (rowNumber % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.zebra } };
        }
      }
    });
  });

  // Auto filter on header
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, ws.columns.length) },
  };
}

function buildWizardPrompt({ prompt, wizard, preferences, context }) {
  const w = wizard || {};
  const p = preferences || {};
  const c = context || {};

  const lines = [
    "Necesito que diseñes un Excel profesional.",
    "",
    `Objetivo (texto del usuario): ${safeStr(prompt, "")}`,
    "",
    "Perfil (Wizard):",
    `- Para qué: ${safeStr(w.purpose, "—")}`,
    `- Nivel: ${safeStr(w.level, "—")}`,
    `- Periodicidad: ${safeStr(w.periodicity, "—")}`,
    `- Giro: ${safeStr(w.industry, "—")}`,
    "",
    "Preferencias:",
    `- Tema: ${safeStr(p.theme, "—")}`,
    `- Gráficas: ${p.wantCharts ? "Sí" : "No"}`,
    `- Imágenes: ${p.wantImages ? "Sí" : "No"}`,
    "",
    "Respuestas contextuales (FASE 2):",
    JSON.stringify(c, null, 2),
    "",
    "Requisitos duros:",
    "- Devuelve SOLO JSON válido (sin markdown).",
    "- Debe incluir hojas: Data y Dashboard.",
    "- Debe incluir columnas, tipos, formatos, validaciones y fórmulas sugeridas.",
    "- Si nivel=Directivo: Dashboard con KPIs arriba + tabla resumen abajo.",
  ];

  return lines.join("\n");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const {
      prompt,
      wizard,
      preferences,
      context,
      file,
      // opcional:
      logoDataUrl, // "data:image/png;base64,..."
    } = req.body || {};

    if (!safeStr(prompt).trim() && !wizard) {
      return res.status(400).json({ error: "prompt requerido (y/o wizard)" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY no está definida" });
    }

    const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
    const themeKey = normalizeTheme(preferences?.theme);
    const colors = themeColors(themeKey);

    // 1) Pedimos a OpenAI un SPEC PRO (texto + JSON -> solo JSON de salida)
    const system = `
Eres un arquitecto experto en Excel (nivel SaaS). Devuelve SOLO JSON válido.
Schema:
{
  "sheetNameData": "Data",
  "sheetNameDashboard": "Dashboard",
  "columns": [
    {
      "header": "Fecha",
      "key": "fecha",
      "type": "date|text|number|currency|percent",
      "width": 14,
      "validation": { "type": "list|number|date|text", "values": ["A","B"] }
    }
  ],
  "exampleRows": [ { "fecha": "2026-01-07" } ],
  "totals": {
    "rowTotals": true,
    "colTotals": true,
    "grandTotal": true,
    "totalLabel": "TOTAL"
  },
  "kpis": [
    { "label": "Total", "formula": "=SUM(Data!D:D)", "format":"currency|number|percent|text" }
  ],
  "summaryTable": {
    "title": "Resumen",
    "dimensions": ["categoria"],
    "metrics": ["monto"],
    "notes": "breve"
  },
  "chartPlan": {
    "enabled": true,
    "type": "bar|line|pie",
    "title": "Top resumen",
    "xKey": "label",
    "yKey": "value"
  },
  "notes": "breve"
}
Reglas:
- columns mínimo 6 (si no aplica, inventa las necesarias).
- exampleRows mínimo 10.
- keys en snake_case, sin espacios.
- Si wizard.level es Directivo => kpis mínimo 4 y summaryTable obligatorio.
- Incluye sugerencias de fórmulas para totales.
`.trim();

    const userPrompt = buildWizardPrompt({ prompt, wizard, preferences, context });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(400).json({ error: data?.error?.message || "OpenAI error" });
    }

    const raw = data?.choices?.[0]?.message?.content || "{}";

    let spec;
    try {
      spec = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "La IA no devolvió JSON válido. Reintenta." });
    }

    // 2) Construimos el Excel PRO
    const wb = new ExcelJS.Workbook();
    wb.creator = "AUREA 33";
    wb.created = new Date();

    const sheetNameData = spec.sheetNameData || "Data";
    const sheetNameDash = spec.sheetNameDashboard || "Dashboard";

    const ws = wb.addWorksheet(sheetNameData);
    const dash = wb.addWorksheet(sheetNameDash);

    const columns = Array.isArray(spec.columns) ? spec.columns : [];
    const rows = Array.isArray(spec.exampleRows) ? spec.exampleRows : [];

    if (columns.length < 4) {
      return res.status(400).json({ error: "Spec insuficiente: columns" });
    }

    // Map columns to ExcelJS format
    ws.columns = columns.map((c) => ({
      header: c.header || c.key,
      key: c.key,
      width: c.width || 18,
    }));

    // Add example rows (data)
    rows.forEach((rr) => ws.addRow(rr));

    // Format columns by type
    columns.forEach((c, idx) => {
      const colNumber = idx + 1;
      const col = ws.getColumn(colNumber);
      const type = (c.type || "").toLowerCase();

      if (type === "date") col.numFmt = "yyyy-mm-dd";
      if (type === "currency") col.numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
      if (type === "percent") col.numFmt = "0.00%";
      if (type === "number") col.numFmt = "#,##0.00";
    });

    // Totals row/col/grand total (simple + robust)
    const totals = spec.totals || {};
    const wantRowTotals = totals.rowTotals ?? true;
    const wantColTotals = totals.colTotals ?? true;
    const wantGrandTotal = totals.grandTotal ?? true;

    // Add Row total column if requested (sum numeric/currency columns)
    let totalColIndex = null;
    if (wantRowTotals) {
      totalColIndex = ws.columns.length + 1;
      ws.getRow(1).getCell(totalColIndex).value = "Total fila";
      ws.getRow(1).getCell(totalColIndex).font = { bold: true, color: { argb: colors.headerText } };
      ws.getRow(1).getCell(totalColIndex).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
      ws.getColumn(totalColIndex).width = 16;

      // detect numeric columns to sum
      const numericColLetters = columns
        .map((c, i) => ({ c, i: i + 1 }))
        .filter(({ c }) => ["number", "currency", "percent"].includes((c.type || "").toLowerCase()))
        .map(({ i }) => ExcelJS.Workbook.xlsx?.utils?.encodeCol?.(i) || null); // fallback below

      // we do our own letter encoder
      const colLetter = (n) => {
        let s = "";
        while (n > 0) {
          let m = (n - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          n = Math.floor((n - 1) / 26);
        }
        return s;
      };

      const numericIdxs = columns
        .map((c, i) => ({ c, i: i + 1 }))
        .filter(({ c }) => ["number", "currency", "percent"].includes((c.type || "").toLowerCase()))
        .map(({ i }) => i);

      for (let rIdx = 2; rIdx <= ws.rowCount; rIdx++) {
        if (!numericIdxs.length) break;
        const ranges = numericIdxs.map((i) => `${colLetter(i)}${rIdx}`).join(",");
        ws.getRow(rIdx).getCell(totalColIndex).value = { formula: `SUM(${ranges})` };
        ws.getRow(rIdx).getCell(totalColIndex).numFmt = "#,##0.00";
      }
    }

    // Add Totals row at bottom if requested
    if (wantColTotals) {
      const lastRow = ws.rowCount + 1;
      const label = totals.totalLabel || "TOTAL";
      ws.getRow(lastRow).getCell(1).value = label;
      ws.getRow(lastRow).font = { bold: true, color: { argb: colors.text } };

      const colLetter = (n) => {
        let s = "";
        while (n > 0) {
          let m = (n - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          n = Math.floor((n - 1) / 26);
        }
        return s;
      };

      const endDataRow = ws.rowCount - 1; // because we just added total row
      for (let cIdx = 2; cIdx <= ws.columns.length; cIdx++) {
        // sum only numeric-like columns + rowTotal col
        const type = (columns[cIdx - 1]?.type || "").toLowerCase();
        const isSumCol =
          ["number", "currency", "percent"].includes(type) ||
          (wantRowTotals && cIdx === totalColIndex);

        if (!isSumCol) continue;

        ws.getRow(lastRow).getCell(cIdx).value = {
          formula: `SUM(${colLetter(cIdx)}2:${colLetter(cIdx)}${endDataRow})`,
        };
        ws.getRow(lastRow).getCell(cIdx).font = { bold: true };
        ws.getRow(lastRow).getCell(cIdx).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colors.zebra },
        };
      }
    }

    applySheetBase(ws, colors);

    // 3) Dashboard (KPIs + resumen)
    dash.columns = [{ header: "A", key: "a", width: 24 }, { header: "B", key: "b", width: 24 }, { header: "C", key: "c", width: 24 }, { header: "D", key: "d", width: 24 }];

    // Title
    dash.mergeCells("A1:D1");
    dash.getCell("A1").value = "AUREA · Dashboard";
    dash.getCell("A1").font = { bold: true, size: 16, color: { argb: colors.headerText } };
    dash.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
    dash.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
    dash.getRow(1).height = 26;

    // KPIs
    const kpis = Array.isArray(spec.kpis) ? spec.kpis : [];
    const startRow = 3;
    const kpiCols = ["A", "B", "C", "D"];

    const kpiCount = Math.min(4, kpis.length || 0);
    for (let i = 0; i < kpiCount; i++) {
      const col = kpiCols[i];
      const box = `${col}${startRow}:${col}${startRow + 2}`;
      dash.mergeCells(box);

      dash.getCell(`${col}${startRow}`).value = kpis[i].label || `KPI ${i + 1}`;
      dash.getCell(`${col}${startRow}`).font = { bold: true, color: { argb: colors.headerText } };
      dash.getCell(`${col}${startRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
      dash.getCell(`${col}${startRow}`).alignment = { vertical: "top", horizontal: "left" };

      dash.getCell(`${col}${startRow + 1}`).value = { formula: kpis[i].formula || "" };
      dash.getCell(`${col}${startRow + 1}`).font = { bold: true, size: 14, color: { argb: colors.accent } };
      dash.getCell(`${col}${startRow + 1}`).alignment = { vertical: "middle", horizontal: "left" };

      const fmt = (kpis[i].format || "").toLowerCase();
      if (fmt === "currency") dash.getCell(`${col}${startRow + 1}`).numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
      if (fmt === "percent") dash.getCell(`${col}${startRow + 1}`).numFmt = "0.00%";
      if (fmt === "number") dash.getCell(`${col}${startRow + 1}`).numFmt = "#,##0.00";
    }

    // Summary table placeholder
    dash.getCell("A7").value = spec?.summaryTable?.title || "Resumen";
    dash.getCell("A7").font = { bold: true, size: 12, color: { argb: colors.headerText } };
    dash.getCell("A7").fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };

    // Create a basic summary from numeric columns (client can replace later)
    dash.getCell("A8").value = "Métrica";
    dash.getCell("B8").value = "Valor";
    ["A8", "B8"].forEach((cell) => {
      dash.getCell(cell).font = { bold: true, color: { argb: colors.headerText } };
      dash.getCell(cell).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
      dash.getCell(cell).alignment = { vertical: "middle", horizontal: "center" };
    });

    // If we have a currency/number column, reference its total row (if exists)
    const dataLastRow = ws.rowCount;
    const hasTotalsRow = wantColTotals; // we added it
    const totalsRowIndex = hasTotalsRow ? dataLastRow : null;

    // pick first numeric/currency column as "Total principal"
    const firstNumericIdx = columns.findIndex((c) =>
      ["currency", "number"].includes((c.type || "").toLowerCase())
    );
    if (firstNumericIdx >= 0 && totalsRowIndex) {
      const colLetter = (n) => {
        let s = "";
        while (n > 0) {
          let m = (n - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          n = Math.floor((n - 1) / 26);
        }
        return s;
      };
      const letter = colLetter(firstNumericIdx + 1);
      dash.getCell("A9").value = "Total principal";
      dash.getCell("B9").value = { formula: `=${sheetNameData}!${letter}${totalsRowIndex}` };
      dash.getCell("B9").numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
    } else {
      dash.getCell("A9").value = "Total principal";
      dash.getCell("B9").value = "—";
    }

    // 4) Logo / imágenes (opcional)
    if (logoDataUrl) {
      const parsed = parseDataUrl(logoDataUrl);
      if (parsed?.b64) {
        const imgId = wb.addImage({ base64: parsed.b64, extension: "png" });
        // position top-right
        dash.addImage(imgId, { tl: { col: 3.2, row: 0.2 }, ext: { width: 160, height: 60 } });
      }
    }

    // 5) Gráficas como imagen (QuickChart) si wantCharts
    if (preferences?.wantCharts) {
      try {
        // Simple dataset from first numeric column (first 8 rows)
        const labels = [];
        const values = [];
        const firstTextIdx = columns.findIndex((c) => (c.type || "").toLowerCase() === "text");
        const numIdx = columns.findIndex((c) => ["currency", "number"].includes((c.type || "").toLowerCase()));

        for (let rIdx = 2; rIdx <= Math.min(9, ws.rowCount); rIdx++) {
          const labelCell = firstTextIdx >= 0 ? ws.getRow(rIdx).getCell(firstTextIdx + 1).value : `R${rIdx - 1}`;
          const valCell = numIdx >= 0 ? ws.getRow(rIdx).getCell(numIdx + 1).value : null;

          labels.push(String(labelCell || `R${rIdx - 1}`).slice(0, 18));
          values.push(typeof valCell === "number" ? valCell : 0);
        }

        const b64png = await quickChartPngBase64({
          type: spec?.chartPlan?.type || "bar",
          labels,
          datasets: [{ label: "Serie", data: values }],
          title: spec?.chartPlan?.title || "Gráfica",
        });

        const chartId = wb.addImage({ base64: b64png, extension: "png" });
        dash.addImage(chartId, { tl: { col: 0, row: 10.2 }, ext: { width: 700, height: 320 } });
      } catch (e) {
        // If hosting blocks outbound fetch, don't fail the whole excel
        console.warn("Chart generation skipped:", e?.message || e);
        dash.getCell("A10").value = "⚠️ No se pudo generar la gráfica automáticamente (bloqueo de red).";
        dash.getCell("A10").font = { color: { argb: "FFFFA500" }, italic: true };
      }
    }

    // Dashboard styling
    dash.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: colors.grid } },
          left: { style: "thin", color: { argb: colors.grid } },
          bottom: { style: "thin", color: { argb: colors.grid } },
          right: { style: "thin", color: { argb: colors.grid } },
        };
        if (rowNumber > 1 && rowNumber % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.zebra } };
        }
      });
    });

    // 6) Enviar el archivo directo como attachment (sin URL)
    const outFileName = safeStr(file?.fileName, "AUREA_excel.xlsx") || "AUREA_excel.xlsx";
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${outFileName}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("EXCEL SERVER ERROR:", e);
    return res.status(500).json({ error: "Excel server error", details: String(e?.message || e) });
  }
}
