// pages/api/excel.js
import ExcelJS from "exceljs";

/* ----------------------------- Config ----------------------------- */

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
};

/* ----------------------------- Helpers ----------------------------- */

function safeStr(x, fallback = "") {
  return typeof x === "string" ? x : fallback;
}

function clamp(str = "", max = 12000) {
  str = String(str || "");
  return str.length > max ? str.slice(0, max) : str;
}

function normalizeTheme(theme) {
  const t = (theme || "").toLowerCase();
  if (t.includes("dark") || t.includes("gold") || t.includes("dorado")) return "dark-gold";
  if (t.includes("verde") || t.includes("green") || t.includes("azul") || t.includes("blue")) return "green-blue";
  if (t.includes("blanco") || t.includes("light")) return "light";
  if (t.includes("plata") || t.includes("silver")) return "black-silver";
  return "dark-gold";
}

function themeColors(themeKey) {
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
        soft: "FFF9FAFB",
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
        soft: "FF0E1630",
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
        soft: "FF101010",
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
        soft: "FF0E0B14",
      };
  }
}

function parseDataUrl(dataUrl) {
  const m = /^data:(image\/\w+);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

function sanitizeFileName(name, fallback = "AUREA_excel.xlsx") {
  const raw = safeStr(name, "").trim() || fallback;
  const cleaned = raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 80);
  return cleaned.toLowerCase().endsWith(".xlsx") ? cleaned : `${cleaned}.xlsx`;
}

function sanitizeTableName(name, fallback = "tbl_data") {
  let n = safeStr(name, fallback).trim();
  // Excel table names: start with letter/underscore, no spaces, no special chars
  n = n.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "");
  if (!n) n = fallback;
  if (!/^[A-Za-z_]/.test(n)) n = `tbl_${n}`;
  return n.slice(0, 50);
}

function colLetter(n) {
  let s = "";
  while (n > 0) {
    let m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function extractJson(raw) {
  const s = safeStr(raw, "").trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {}
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const chunk = s.slice(first, last + 1);
    try {
      return JSON.parse(chunk);
    } catch {}
  }
  return null;
}

/* ----------------------------- Table Builder ----------------------------- */

function buildTableRows(columns, rows) {
  return (rows || []).map((r) => columns.map((c) => r?.[c.key] ?? ""));
}

function sanitizeHeaderName(name, fallback) {
  let s = String(name ?? "").trim();
  if (!s) s = fallback;
  // limpia saltos / tabs y espacios dobles
  s = s.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  // quita chars raros que rompen tablas
  s = s.replace(/[^\w\u00C0-\u024F\s\-\(\)\[\]\/]/g, "");
  return s || fallback;
}

function makeUniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((h) => {
    const base = h;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function createStructuredTable(ws, tableName, columns, rows) {
  // Limpia hoja (seguro)
  if (ws.rowCount > 0) ws.spliceRows(1, ws.rowCount);

  const safeName = sanitizeTableName(tableName || "tbl_data", "tbl_data");

  // ✅ headers limpios + únicos (esto evita que Excel “repare” table1.xml)
  const rawHeaders = columns.map((c, i) =>
    sanitizeHeaderName(c.header || c.key, `Col ${i + 1}`)
  );
  const uniqueHeaders = makeUniqueHeaders(rawHeaders);

  const tableColumns = uniqueHeaders.map((h) => ({
    name: h,
    filterButton: true,
  }));

  const tableRows = buildTableRows(columns, rows);

  ws.addTable({
    name: safeName,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium9",
      showRowStripes: true,
    },
    columns: tableColumns,
    rows: tableRows,
  });

  // widths
  columns.forEach((c, idx) => {
    ws.getColumn(idx + 1).width = c.width || 18;
  });
}

/* ----------------------------- Prompt Builder (legacy OpenAI) ----------------------------- */

function buildWizardPrompt({ prompt, wizard, preferences, context }) {
  const w = wizard || {};
  const p = preferences || {};
  const c = context || {};

  const lines = [
    "Necesito diseñar un Excel profesional de última generación (nivel SaaS).",
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
    "Contexto extra (si existe):",
    clamp(JSON.stringify(c, null, 2), 5000),
    "",
    "Requisitos duros:",
    "- Devuelve SOLO JSON válido (sin markdown).",
    "- Debe incluir al menos 2 hojas: Data y Dashboard.",
    "- Data debe incluir columnas, tipos, formatos, validaciones, y ejemplo de filas (mínimo 12).",
    "- Debe incluir fórmulas sugeridas para totales y KPIs.",
    "- Si nivel=Directivo: Dashboard con KPIs (mínimo 4) y tabla resumen.",
    "- Fórmulas deben usar structured refs: tbl_data[...].",
  ];

  return lines.join("\n");
}

/* ----------------------------- OpenAI (optional / legacy) ----------------------------- */

async function buildExcelSpecWithOpenAI({ prompt, wizard, preferences, context }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no está definida");

  const model = process.env.OPENAI_EXCEL_MODEL || process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";

  const system = `
Eres AUREA 33 EXCEL — arquitecto experto en Excel.
Devuelve SOLO JSON válido.

Schema:
{
  "version":"1.0",
  "workbook":{
    "title":"string",
    "theme":"dark-gold|green-blue|light|black-silver",
    "sheets":[
      {
        "name":"Data",
        "kind":"data",
        "tableName":"tbl_data",
        "columns":[
          {"header":"Fecha","key":"fecha","type":"date|text|number|currency|percent|integer","width":14,"required":true,
           "validation":{"type":"list|number|date","values":["A"],"min":0,"max":999}}
        ],
        "exampleRows":[{"fecha":"2026-01-14"}],
        "totals":{"enabled":true,"label":"TOTAL","sumKeys":["monto"],"mode":"general"}
      },
      {
        "name":"Dashboard",
        "kind":"dashboard",
        "kpis":[{"label":"Total","formula":"=SUM(tbl_data[monto])","format":"currency"}],
        "summary":{"title":"Resumen","rows":[{"label":"Total","formula":"=SUM(tbl_data[monto])","format":"currency"}]}
      }
    ]
  }
}

Reglas:
- columns mínimo 6.
- exampleRows mínimo 12.
- keys snake_case.
- Si wizard.level incluye "directivo" => KPI mínimo 4.
- Fórmulas siempre con IFERROR(...) para evitar #NUM!/errores.
`.trim();

  const user = buildWizardPrompt({ prompt, wizard, preferences, context });

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.25,
      reasoning: { effort: "medium" },
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || "OpenAI error");

  const raw = data?.output_text || data?.output?.[0]?.content?.[0]?.text || "";
  const spec = extractJson(raw);
  if (!spec) throw new Error("La IA no devolvió JSON válido.");

  return { spec, model };
}

/* ----------------------------- Spec Normalizer ----------------------------- */

function normalizeSpec(inputSpec, themeKey) {
  const spec = inputSpec || {};

  const sheetsCandidate =
    (spec.workbook && Array.isArray(spec.workbook.sheets) ? spec.workbook.sheets : null) ||
    (Array.isArray(spec.sheets) ? spec.sheets : null) ||
    [];

  const wbIn = spec.workbook || {};

  const fixedSheets = sheetsCandidate.map((s) => {
    const kind = String(s.kind || "").toLowerCase();

    if (kind === "data" || s.name === "Data") {
      return {
        name: s.name || "Data",
        kind: "data",
        tableName: s.tableName || "tbl_data",
        columns: Array.isArray(s.columns) ? s.columns : [],
        exampleRows: Array.isArray(s.exampleRows) ? s.exampleRows : [],
        totals: s.totals || { enabled: true, label: "TOTAL", sumKeys: [], mode: "general" },
        style: s.style || null,
        useTable: true,
      };
    }

    if (kind === "dashboard" || s.name === "Dashboard") {
      return {
        name: s.name || "Dashboard",
        kind: "dashboard",
        layout: s.layout || { option: "A" },
        kpis: Array.isArray(s.kpis) ? s.kpis : [],
        summary: s.summary || { title: "Resumen", rows: [] },
        charts: Array.isArray(s.charts) ? s.charts : [],
      };
    }

    return { name: s.name || "Sheet", kind: kind || "unknown", ...s };
  });

  const hasData = fixedSheets.some((x) => String(x.kind).toLowerCase() === "data" || x.name === "Data");
  const hasDash = fixedSheets.some((x) => String(x.kind).toLowerCase() === "dashboard" || x.name === "Dashboard");

  if (!hasData) {
    fixedSheets.unshift({
      name: "Data",
      kind: "data",
      tableName: "tbl_data",
      columns: [],
      exampleRows: [],
      totals: { enabled: true, label: "TOTAL", sumKeys: [], mode: "general" },
      useTable: true,
    });
  }
  if (!hasDash) {
    fixedSheets.push({
      name: "Dashboard",
      kind: "dashboard",
      layout: { option: "A" },
      kpis: [],
      summary: { title: "Resumen", rows: [] },
      charts: [],
    });
  }

  return {
    version: spec.version || "1.1",
    workbook: {
      title: wbIn.title || "AUREA Excel",
      theme: wbIn.theme || themeKey,
      sheets: fixedSheets,
    },
  };
}

/* ----------------------------- Styling / Formats ----------------------------- */

function applyDataSheetStyling(ws, colors) {
  ws.properties.defaultRowHeight = 18;
  ws.getRow(1).height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: colors.headerText } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
  header.alignment = { vertical: "middle", horizontal: "center" };
}

function applyGridAndZebra(ws, colors) {
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
}

function setColumnFormats(ws, columns) {
  columns.forEach((c, idx) => {
    const col = ws.getColumn(idx + 1);
    const type = (c.type || "").toLowerCase();

    if (type === "date") col.numFmt = "yyyy-mm-dd";
    else if (type === "currency") col.numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
    else if (type === "percent") col.numFmt = "0.00%";
    else if (type === "integer") col.numFmt = "0";
    else if (type === "number") col.numFmt = "#,##0.00";
  });
}

/* ----------------------------- Validations ----------------------------- */

function ensureDefaultValidations(columns) {
  const paymentKeys = new Set([
    "pago",
    "metodo_pago",
    "metodopago",
    "forma_pago",
    "formapago",
    "payment",
    "payment_method",
  ]);
  const payValues = ["Efectivo", "Transferencia", "Depósito", "Tarjeta Débito", "Tarjeta Crédito"];

  columns.forEach((c) => {
    const key = String(c.key || "").trim();
    if (!key) return;

    // pago
    if (paymentKeys.has(key.toLowerCase()) || key.toLowerCase().includes("pago")) {
      if (!c.validation) c.validation = { type: "list", values: payValues };
    }

    // estatus
    if (key.toLowerCase() === "estatus" && !c.validation) {
      c.validation = { type: "list", values: ["Pendiente", "Pagado", "Vencido", "Parcial"] };
    }
  });
}

function applyValidations(ws, columns, rowStart, rowEnd) {
  columns.forEach((c, idx) => {
    if (c.computed) return; // ✅ NO validar columnas calculadas como total
    const v = c.validation;
    if (!v) return;

    const colIdx = idx + 1;
    const colL = colLetter(colIdx);
    const range = `${colL}${rowStart}:${colL}${rowEnd}`;
    const type = (v.type || "").toLowerCase();

    if (type === "list" && Array.isArray(v.values) && v.values.length) {
      const formulae = [`"${v.values.map((x) => String(x).replace(/"/g, '""')).join(",")}"`];
      ws.dataValidations.add(range, {
        type: "list",
        allowBlank: true,
        formulae,
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "Valor inválido",
        error: "Selecciona un valor de la lista.",
      });
      return;
    }

    if (type === "number") {
      const min = typeof v.min === "number" ? v.min : 0;
      const max = typeof v.max === "number" ? v.max : 999999999;
      ws.dataValidations.add(range, {
        type: "decimal",
        operator: "between",
        allowBlank: true,
        formulae: [min, max],
        showErrorMessage: true,
        errorTitle: "Número inválido",
        error: "Ingresa un número dentro del rango permitido.",
      });
      return;
    }

    if (type === "date") {
      ws.dataValidations.add(range, {
        type: "date",
        operator: "between",
        allowBlank: true,
        formulae: ["DATE(2000,1,1)", "DATE(2100,12,31)"],
        showErrorMessage: true,
        errorTitle: "Fecha inválida",
        error: "Ingresa una fecha válida.",
      });
    }
  });
}

/* ----------------------------- Formulas / Totals ----------------------------- */

function safeFormula(f) {
  const s = String(f || "").trim();
  if (!s) return "";
  if (/^=IFERROR\(/i.test(s)) return s;
  if (s.startsWith("=")) return `=IFERROR(${s.slice(1)},0)`;
  return `=IFERROR(${s},0)`;
}

function ensureMinExampleRows(columns, rows) {
  let out = Array.isArray(rows) ? rows : [];
  if (out.length >= 12) return out;

  // Si hay 1 fila, la “clonamos” para llegar a 12
  if (out.length > 0) {
    const seed = out[0];
    const base = new Date();
    out = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(base.getTime() - i * 86400000);
      const copy = { ...seed };
      Object.keys(copy).forEach((k) => {
        const kk = k.toLowerCase();
        if (kk === "fecha" || kk.includes("date")) copy[k] = d.toISOString().slice(0, 10);
      });
      return copy;
    });
    return out;
  }

  // Si viene vacío, generamos 12 filas placeholder (para evitar totals circulares)
  const base = new Date();
  const payDefaults = ["Efectivo", "Transferencia", "Depósito", "Tarjeta Débito", "Tarjeta Crédito"];

  out = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date(base.getTime() - i * 86400000);
    const row = {};
    columns.forEach((c) => {
      const type = (c.type || "").toLowerCase();
      const k = c.key;

      if (!k) return;

      if (type === "date") row[k] = d.toISOString().slice(0, 10);
      else if (type === "currency" || type === "number" || type === "integer") row[k] = 0;
      else if (k.toLowerCase().includes("pago")) row[k] = payDefaults[i % payDefaults.length];
      else row[k] = "";
    });
    return row;
  });

  return out;
}

function addRowTotalFormulasIfRequested(ws, columns, totalsCfg) {
  const mode = (totalsCfg?.mode || "").toLowerCase();
  if (mode !== "row_col") return;

  const totalColIdx = columns.findIndex((c) => String(c.key || "").toLowerCase() === "total") + 1;
  if (totalColIdx <= 0) return;

  const inferredCurrencyKeys = columns
    .filter((c) => (c.type || "").toLowerCase() === "currency")
    .map((c) => c.key)
    .filter((k) => String(k).toLowerCase() !== "total");

  const sumLetters = inferredCurrencyKeys
    .map((key) => {
      const idx = columns.findIndex((c) => c.key === key);
      return idx >= 0 ? colLetter(idx + 1) : null;
    })
    .filter(Boolean);

  const totalColL = colLetter(totalColIdx);
  const firstDataRow = 2;
  const lastDataRow = ws.rowCount; // filas actuales de la tabla

  if (lastDataRow < firstDataRow) return;

  for (let r = firstDataRow; r <= lastDataRow; r++) {
    if (!sumLetters.length) continue;
    const sumExpr = sumLetters.map((L) => `${L}${r}`).join(",");
    ws.getCell(`${totalColL}${r}`).value = { formula: safeFormula(`=SUM(${sumExpr})`) };
  }
}

function addTotalsRowGeneral(ws, specColumns) {
  const firstDataRow = 2;
  const lastDataRow = ws.rowCount;

  // Si no hay data rows, no agregues totals (evita cosas raras)
  if (lastDataRow < firstDataRow) return null;

  const totalRow = lastDataRow + 1;
  ws.getCell(`A${totalRow}`).value = "TOTAL";
  ws.getRow(totalRow).font = { bold: true };

  specColumns.forEach((c, idx) => {
    const type = (c.type || "").toLowerCase();
    if (!["currency", "number", "integer"].includes(type)) return;

    const colIdx = idx + 1;
    const L = colLetter(colIdx);
    ws.getCell(`${L}${totalRow}`).value = {
      formula: safeFormula(`=SUM(${L}${firstDataRow}:${L}${lastDataRow})`),
    };
    ws.getCell(`${L}${totalRow}`).font = { bold: true };
  });

  return totalRow;
}

/* ----------------------------- Dashboard (Option A) ----------------------------- */

function buildDashboardSheet({ wb, dash, dataSheetName, dashSpec, colors, logoDataUrl }) {
  dash.views = [{ state: "frozen", ySplit: 2 }];

  dash.columns = [
    { header: "A", key: "a", width: 18 },
    { header: "B", key: "b", width: 34 },
    { header: "C", key: "c", width: 18 },
    { header: "D", key: "d", width: 18 },
  ];

  dash.mergeCells("A1:D1");
  dash.getCell("A1").value = "AUREA 33 · Dashboard";
  dash.getCell("A1").font = { bold: true, size: 16, color: { argb: colors.headerText } };
  dash.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
  dash.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  dash.getRow(1).height = 28;

  dash.getCell("A2").value = "KPIs";
  dash.getCell("A2").font = { bold: true, color: { argb: colors.accent } };

  if (logoDataUrl) {
    const parsed = parseDataUrl(logoDataUrl);
    if (parsed?.b64) {
      const imgId = wb.addImage({ base64: parsed.b64, extension: "png" });
      dash.addImage(imgId, { tl: { col: 2.9, row: 0.15 }, ext: { width: 160, height: 56 } });
    }
  }

  const kpis = Array.isArray(dashSpec?.kpis) ? dashSpec.kpis : [];

  const fallbackKpis = [
    { label: "Filas registradas", formula: `=COUNTA(${dataSheetName}!A:A)-1`, format: "integer" },
    { label: "Ingresos (col E)", formula: `=SUM(${dataSheetName}!E:E)`, format: "currency" },
    { label: "Egresos (col F)", formula: `=SUM(${dataSheetName}!F:F)`, format: "currency" },
  ];

  const finalKpis = kpis.length ? kpis : fallbackKpis;

  const firstLabelRow = 2; // B2
  for (let i = 0; i < Math.min(finalKpis.length, 10); i++) {
    const labelRow = firstLabelRow + i * 2;
    const valueRow = labelRow + 1;

    const label = finalKpis[i]?.label || `KPI ${i + 1}`;
    const formulaRaw = finalKpis[i]?.formula || "";
    const formula = formulaRaw ? safeFormula(formulaRaw) : "";
    const fmt = (finalKpis[i]?.format || "").toLowerCase();

    dash.getCell(`B${labelRow}`).value = label;
    dash.getCell(`B${labelRow}`).font = { bold: true, color: { argb: colors.headerText } };
    dash.getCell(`B${labelRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
    dash.getCell(`B${labelRow}`).alignment = { vertical: "middle", horizontal: "left" };

    dash.getCell(`B${valueRow}`).value = formula ? { formula } : "—";
    dash.getCell(`B${valueRow}`).font = { bold: true, size: 15, color: { argb: colors.accent } };
    dash.getCell(`B${valueRow}`).alignment = { vertical: "middle", horizontal: "left" };

    if (fmt === "currency") dash.getCell(`B${valueRow}`).numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
    if (fmt === "percent") dash.getCell(`B${valueRow}`).numFmt = "0.00%";
    if (fmt === "integer") dash.getCell(`B${valueRow}`).numFmt = "0";
    if (fmt === "number") dash.getCell(`B${valueRow}`).numFmt = "#,##0.00";
  }

  const summary = dashSpec?.summary || null;
  const sTitle = summary?.title || "Resumen";
  const rows = Array.isArray(summary?.rows) ? summary.rows : [];

  const anchorRow = Math.max(9, firstLabelRow + Math.min(finalKpis.length, 10) * 2 + 1);

  dash.getCell(`A${anchorRow}`).value = sTitle;
  dash.getCell(`A${anchorRow}`).font = { bold: true, size: 12, color: { argb: colors.headerText } };
  dash.getCell(`A${anchorRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };

  dash.getCell(`A${anchorRow + 1}`).value = "Métrica";
  dash.getCell(`B${anchorRow + 1}`).value = "Valor";
  [`A${anchorRow + 1}`, `B${anchorRow + 1}`].forEach((cell) => {
    dash.getCell(cell).font = { bold: true, color: { argb: colors.headerText } };
    dash.getCell(cell).fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
    dash.getCell(cell).alignment = { vertical: "middle", horizontal: "center" };
  });

  const baseRow = anchorRow + 2;
  if (rows.length) {
    rows.slice(0, 12).forEach((rr, i) => {
      dash.getCell(`A${baseRow + i}`).value = rr.label || `Item ${i + 1}`;
      const f = rr.formula ? safeFormula(rr.formula) : "";
      dash.getCell(`B${baseRow + i}`).value = f ? { formula: f } : rr.value ?? "—";

      const fmt = (rr.format || "").toLowerCase();
      if (fmt === "currency") dash.getCell(`B${baseRow + i}`).numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
      if (fmt === "percent") dash.getCell(`B${baseRow + i}`).numFmt = "0.00%";
      if (fmt === "integer") dash.getCell(`B${baseRow + i}`).numFmt = "0";
      if (fmt === "number") dash.getCell(`B${baseRow + i}`).numFmt = "#,##0.00";
    });
  } else {
    dash.getCell(`A${baseRow}`).value = "Filas registradas";
    dash.getCell(`B${baseRow}`).value = { formula: safeFormula(`=COUNTA(${dataSheetName}!A:A)-1`) };
  }

  dash.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: colors.grid } },
        left: { style: "thin", color: { argb: colors.grid } },
        bottom: { style: "thin", color: { argb: colors.grid } },
        right: { style: "thin", color: { argb: colors.grid } },
      };
      if (rowNumber > 2 && rowNumber % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.zebra } };
      }
    });
  });
}

/* ----------------------------- Workbook Builder ----------------------------- */

async function buildWorkbookExcelJS({ spec, colors, logoDataUrl }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AUREA 33";
  wb.created = new Date();

  const sheets = spec?.workbook?.sheets || [];
  const dataSheetSpec =
    sheets.find((s) => (s.kind || "").toLowerCase() === "data") || sheets.find((s) => s.name === "Data");

  const dashSheetSpec =
    sheets.find((s) => (s.kind || "").toLowerCase() === "dashboard") || sheets.find((s) => s.name === "Dashboard");

  const dataName = dataSheetSpec?.name || "Data";
  const dashName = dashSheetSpec?.name || "Dashboard";

  const ws = wb.addWorksheet(dataName);
  const dash = wb.addWorksheet(dashName);

  let columns = Array.isArray(dataSheetSpec?.columns) ? dataSheetSpec.columns : [];
  let rows = Array.isArray(dataSheetSpec?.exampleRows) ? dataSheetSpec.exampleRows : [];

  // Mínimos duros si columns vienen vacías
  if (columns.length < 6) {
    columns = [
      { header: "Fecha", key: "fecha", type: "date", width: 14, required: true },
      { header: "Concepto", key: "concepto", type: "text", width: 26, required: true },
      { header: "Categoría", key: "categoria", type: "text", width: 18, required: true },
      { header: "Forma de pago", key: "pago", type: "text", width: 16, required: false },
      { header: "Ingreso", key: "ingreso", type: "currency", width: 14, required: false },
      { header: "Egreso", key: "egreso", type: "currency", width: 14, required: false },
    ];
  }

  // Validaciones default (pago / estatus)
  ensureDefaultValidations(columns);

  // Totals config
  const totalsCfg = dataSheetSpec?.totals || { mode: "general" };

  // ✅ Si row_col => agrega columna Total ANTES de crear la tabla
  if (String(totalsCfg?.mode || "").toLowerCase() === "row_col") {
    const hasTotal = columns.some((c) => String(c.key || "").toLowerCase() === "total");
    if (!hasTotal) {
      columns = [
        ...columns,
        { header: "Total", key: "total", type: "currency", width: 14, required: false, computed: true },
      ];
    } else {
      // si ya existía, márcala computed por si acaso
      columns = columns.map((c) =>
        String(c.key || "").toLowerCase() === "total" ? { ...c, computed: true } : c
      );
    }
  }

  // ✅ Asegura mínimo 12 filas (evita totals raros y circular warnings)
  rows = ensureMinExampleRows(columns, rows);

  // ✅ CREA TABLA REAL (tbl_data) ya con columnas finales
  const tableName = sanitizeTableName(dataSheetSpec?.tableName || "tbl_data", "tbl_data");
  createStructuredTable(ws, tableName, columns, rows);

  // Estilo + formatos
  applyDataSheetStyling(ws, colors);
  setColumnFormats(ws, columns);


  // ✅ Validations PRO (rango largo para seguir capturando)
  const dvRowStart = 2;
  const dvRowEnd = Math.max(200, ws.rowCount + 200);
  applyValidations(ws, columns, dvRowStart, dvRowEnd);

  // ✅ Fórmulas de total por fila (si row_col)
  addRowTotalFormulasIfRequested(ws, columns, totalsCfg);

  // ✅ Totals row (sumatorias por columna)
  addTotalsRowGeneral(ws, columns);

  // Bordes + zebra
  applyGridAndZebra(ws, colors);

  // Hidden SPEC sheet (debug)
  const specWs = wb.addWorksheet("__AUREA_SPEC");
  specWs.state = "veryHidden";
  specWs.getCell("A1").value = "AUREA_EXCEL_SPEC_JSON";
  specWs.getCell("A2").value = JSON.stringify(spec, null, 2);

  // Dashboard
  buildDashboardSheet({
    wb,
    dash,
    dataSheetName: dataName,
    dashSpec: dashSheetSpec,
    colors,
    logoDataUrl,
  });

  wb.properties.date1904 = false;
  wb.calcProperties.fullCalcOnLoad = true;

  return wb;
}

/* ----------------------------- Handler ----------------------------- */

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const body = req.body || {};

    console.log("[EXCEL] keys:", Object.keys(body));
    console.log("[EXCEL] has spec:", !!body.spec, "mode:", body.mode, "engine:", body.engine);

    const {
      prompt,
      wizard,
      preferences,
      context,
      file,
      logoDataUrl,
      mode, // "spec" | "generate"
      engine, // "exceljs" | "openpyxl" (por ahora usamos exceljs)
      spec: incomingSpec,
    } = body;

    const themeKey = normalizeTheme(preferences?.theme);
    const colors = themeColors(themeKey);

    let rawSpec = incomingSpec || null;
    let model = "local-spec";
    const promptText = safeStr(prompt).trim();

    if (!rawSpec) {
      if (!promptText && !wizard) {
        return res.status(400).json({ error: "Necesito spec OR (prompt y/o wizard)" });
      }
      const out = await buildExcelSpecWithOpenAI({ prompt: promptText, wizard, preferences, context });
      rawSpec = out.spec;
      model = out.model;
    }

    const spec = normalizeSpec(rawSpec, themeKey);

    if (String(mode || "").toLowerCase() === "spec") {
      return res.status(200).json({ ok: true, model, spec });
    }

    const outFileName = sanitizeFileName(file?.fileName || file?.name || "AUREA_excel.xlsx");

    const wb = await buildWorkbookExcelJS({
      spec,
      colors,
      logoDataUrl: safeStr(logoDataUrl) || null,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${outFileName}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("EXCEL SERVER ERROR:", e);
    return res.status(500).json({
      error: "Excel server error",
      details: String(e?.message || e),
    });
  }
}
