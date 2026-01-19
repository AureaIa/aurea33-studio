// ===============================
// BLOQUE A (imports + constantes + utils)
// ===============================
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { parseIntent } from "../lib/excel/intentParser";

/** 1) Para qué es el Excel (puedes editar) */
const PURPOSES = [
  "Contable / Finanzas",
  "Control diario (operación)",
  "Ventas / CRM",
  "Inventario / Almacén",
  "Nómina / RH",
  "Proyectos / Seguimiento",
  "Reportes directivos (KPI)",
  "Otro",
];

/** 2) Nivel */
const LEVELS = ["Básico", "Profesional", "Directivo"];

/** 3) Periodicidad */
const PERIODS = ["Diario", "Semanal", "Mensual", "Anual"];

/** 4) Giros (lista grande + buscador) */
const INDUSTRIES = [
  "Agencia de marketing / publicidad",
  "Arquitectura / construcción",
  "Abogado / despacho jurídico",
  "Administración / oficina",
  "Agricultura / ganadería",
  "Alimentos y bebidas (restaurante / cafetería)",
  "Automotriz (taller / refacciones)",
  "Belleza / estética / barbería",
  "Bienes raíces / inmobiliaria",
  "Call center / atención a clientes",
  "Clínica / salud / consultorio",
  "Comercio (tienda / e-commerce)",
  "Contabilidad / despacho contable",
  "Educación (escuela / cursos)",
  "Eventos (wedding planner / producción)",
  "Farmacia",
  "Fintech / servicios financieros",
  "Fitness / gimnasio",
  "Fotografía / video",
  "Gobierno / administración pública",
  "Hotel / turismo",
  "Importación / exportación",
  "Ingeniería / manufactura",
  "IT / software / desarrollo",
  "Logística / paquetería",
  "Mantenimiento / servicios técnicos",
  "Médico dental",
  "Moda / textiles",
  "Panadería / repostería",
  "Psicología / terapia",
  "Retail (cadena de tiendas)",
  "Seguros",
  "Streaming / creador de contenido",
  "Transporte / flotillas",
  "Veterinaria",
  "Otro",
];

/** Temas visuales */
const THEMES = [
  "Dark/Gold (Aurea33)",
  "Verde/Azul",
  "Azul corporativo",
  "Blanco minimalista",
  "Negro/Plata",
];

/** Métodos de pago */
const PAY_METHODS = [
  { key: "cash", label: "Efectivo" },
  { key: "transfer", label: "Transferencia/SPEI" },
  { key: "debit", label: "Tarjeta Débito" },
  { key: "credit", label: "Tarjeta Crédito" },
  { key: "deposit", label: "Depósito" },
];

const CHARTS = [
  { key: "bar", label: "Barras" },
  { key: "pie", label: "Pastel" },
  { key: "line", label: "Línea" },
];

function uid() {
  return Math.random().toString(36).slice(2);
}

function Bubble({ role, children }) {
  const base = "max-w-[85%] px-4 py-3 rounded-2xl text-sm border shadow-sm";
  const assistant = "bg-zinc-950/70 border-zinc-800 text-white";
  const user = "bg-blue-600/90 border-blue-500 text-white ml-auto";
  return (
    <div className={`w-full flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`${base} ${role === "user" ? user : assistant}`}>{children}</div>
    </div>
  );
}

function QuickButton({ active, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-full text-xs border transition ${
        active
          ? "bg-yellow-400 text-black border-yellow-400 font-semibold"
          : "bg-zinc-900 text-white border-zinc-800 hover:border-zinc-600"
      } ${disabled ? "opacity-50 cursor-not-allowed hover:border-zinc-800" : ""}`}
    >
      {label}
    </button>
  );
}

function Toggle({ enabled, onToggle, disabled, labelOn = "Activo", labelOff = "Inactivo" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`px-3 py-2 rounded-xl text-xs border ${
        disabled
          ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
          : enabled
          ? "bg-yellow-400 text-black border-yellow-400 font-semibold"
          : "bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500"
      }`}
    >
      {enabled ? labelOn : labelOff}
    </button>
  );
}

function Card({ title, desc, children }) {
  return (
    <div className="bg-black/40 border border-zinc-800 rounded-2xl p-4">
      <div className="font-semibold">{title}</div>
      {desc ? <div className="text-xs text-zinc-400 mt-1">{desc}</div> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

const mapPeriodToIntent = (p) => {
  if (p === "Diario") return "daily";
  if (p === "Semanal") return "weekly";
  if (p === "Mensual") return "monthly";
  if (p === "Anual") return "annual";
  return "one_time";
};

const guessDomainFromWizard = ({ purpose, industry }) => {
  const p = (purpose || "").toLowerCase();
  const i = (industry || "").toLowerCase();
  if (p.includes("contable") || p.includes("finanzas") || p.includes("control diario")) return "finance_personal";
  if (p.includes("ventas") || p.includes("crm")) return "business_tpv";
  if (i.includes("clínica") || i.includes("salud") || i.includes("consultorio")) return "hospital";
  if (p.includes("inventario")) return "inventory";
  if (p.includes("nómina") || p.includes("rh")) return "hr";
  if (p.includes("proyectos")) return "projects";
  return "generic";
};

const guessLayoutFromWizard = ({ level }) => {
  if (level === "Directivo") return "dashboard";
  if (level === "Profesional") return "ledger";
  return "simple_table";
};

const guessType = (header) => {
  const h = String(header || "").toLowerCase();
  if (h.includes("fecha") || h.includes("date")) return "date";
  if (h.includes("monto") || h.includes("importe") || h.includes("total") || h.includes("precio") || h.includes("costo"))
    return "currency";
  if (h.includes("cantidad") || h.includes("qty") || h.includes("unidades") || h.includes("stock")) return "number";
  if (h.includes("porcentaje") || h.includes("%") || h.includes("ratio") || h.includes("margen") || h.includes("comisi"))
    return "percent";
  if (h.includes("iva") || h.includes("impuesto")) return "currency";
  if (h.includes("neto")) return "currency";
  return "text";
};

const parseColumnsFromText = (text) => {
  const t = (text || "").trim();
  if (!t) return [];
  const raw = t
    .split(/[,;\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set();
  const cols = [];
  for (const r of raw) {
    const key = r
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^\w_]/g, "");
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    cols.push({ header: r, key, type: guessType(r) });
  }
  return cols;
};

const themeToToken = (t) => {
  if (t?.includes("Dark/Gold")) return "dark-gold";
  if (t?.includes("Verde/Azul")) return "green-blue";
  if (t?.includes("Blanco minimalista")) return "light";
  if (t?.includes("Negro/Plata")) return "black-silver";
  if (t?.includes("Azul corporativo")) return "blue-corp";
  return "dark-gold";
};

function makeExampleRows(columns, n = 12) {
  const base = new Date();
  const payLabels = ["Efectivo", "Transferencia/SPEI", "Tarjeta Crédito", "Tarjeta Débito"];
  const cats = ["Ventas", "Gastos fijos", "Gastos variables", "Servicios", "Compras", "Marketing", "Nómina"];
  return Array.from({ length: n }).map((_, i) => {
    const d = new Date(base.getTime() - i * 86400000);
    const row = {};
    for (const c of columns) {
      const k = c.key;
      const t = (c.type || "").toLowerCase();
      if (t === "date") row[k] = d.toISOString().slice(0, 10);
      else if (t === "currency") row[k] = Math.round(((i + 1) * 135.75) * 100) / 100;
      else if (t === "number" || t === "integer") row[k] = i + 1;
      else if (t === "percent") row[k] = 0.1 + (i % 5) * 0.03;
      else row[k] = `${c.header || k} ${i + 1}`;
    }
    if (row.pago != null) row.pago = payLabels[i % payLabels.length];
    if (row.categoria != null) row.categoria = cats[i % cats.length];
    if (row.comision != null) row.comision = Math.round((i % 4 === 0 ? 12.5 : 0) * 100) / 100;
    if (row.neto != null) row.neto = Math.max(0, (row.ingreso || row.monto || 0) - (row.comision || 0) - (row.iva || 0));
    return row;
  });
}

function buildKpisDeterministic({ tableName = "tbl_data", columns = [] }) {
  const keys = new Set(columns.map((c) => c.key));
  const hasIngreso = keys.has("ingreso");
  const hasEgreso = keys.has("egreso");
  const hasMonto = keys.has("monto");
  const hasNeto = keys.has("neto");
  const hasPago = keys.has("pago");
  const hasCategoria = keys.has("categoria");

  const colRef = (col) => `${tableName}[[#Data],[${col}]]`; // ✅ excluye Totals row

  const kpis = [];

  if (hasIngreso && hasEgreso) {
    kpis.push({ label: "Ingresos", formula: `=SUM(${colRef("ingreso")})`, format: "currency" });
    kpis.push({ label: "Egresos", formula: `=SUM(${colRef("egreso")})`, format: "currency" });
    kpis.push({
      label: "Balance",
      formula: `=SUM(${colRef("ingreso")})-SUM(${colRef("egreso")})`,
      format: "currency",
    });
  } else if (hasMonto) {
    kpis.push({ label: "Total", formula: `=SUM(${colRef("monto")})`, format: "currency" });
    kpis.push({ label: "Promedio", formula: `=AVERAGE(${colRef("monto")})`, format: "currency" });
    kpis.push({ label: "Máximo", formula: `=MAX(${colRef("monto")})`, format: "currency" });
  }

  if (hasNeto) kpis.push({ label: "Neto", formula: `=SUM(${colRef("neto")})`, format: "currency" });

  if (hasMonto) kpis.push({ label: "Ticket prom.", formula: `=IFERROR(AVERAGE(${colRef("monto")}),0)`, format: "currency" });
  if (hasIngreso) kpis.push({ label: "Ticket prom.", formula: `=IFERROR(AVERAGE(${colRef("ingreso")}),0)`, format: "currency" });

  if (hasPago && (hasMonto || hasIngreso)) {
    const baseCol = hasIngreso ? "ingreso" : "monto";
    kpis.push({
      label: "% Tarjeta",
      formula: `=IFERROR((SUMIFS(${colRef(baseCol)},${colRef("pago")},"Tarjeta*"))/SUM(${colRef(baseCol)}),0)`,
      format: "percent",
    });
  }

  if (hasCategoria) kpis.push({ label: "Categorías", formula: `="Top por categoría"`, format: "text" });

  const firstKey = columns[0]?.key || (hasMonto ? "monto" : hasIngreso ? "ingreso" : "fecha");
  kpis.push({ label: "Registros", formula: `=ROWS(${colRef(firstKey)})`, format: "integer" });

  return kpis;
}

  // ===============================
// BLOQUE B (templates + helpers + normalizers)
// ===============================
const TEMPLATE_MAP = {
  daily_control: {
    label: "Control Diario PRO",
    columns: [
      { header: "Fecha", key: "fecha", type: "date", width: 14, required: true },
      { header: "Concepto", key: "concepto", type: "text", width: 28, required: true },
      { header: "Categoría", key: "categoria", type: "text", width: 18, required: true },
      { header: "Forma de pago", key: "pago", type: "text", width: 18, required: false },
      { header: "Ingreso", key: "ingreso", type: "currency", width: 14, required: false, validation: { type: "number", min: 0 } },
      { header: "Egreso", key: "egreso", type: "currency", width: 14, required: false, validation: { type: "number", min: 0 } },
      { header: "Comisión", key: "comision", type: "currency", width: 12, required: false, validation: { type: "number", min: 0 } },
      { header: "IVA", key: "iva", type: "currency", width: 12, required: false, validation: { type: "number", min: 0 } },
      { header: "Neto", key: "neto", type: "currency", width: 12, required: false },
      { header: "Notas", key: "notas", type: "text", width: 32, required: false },
    ],
    totals: { enabled: true, label: "TOTAL", mode: "general" },
  },

  finance_ledger: {
    label: "Libro Contable / Finanzas",
    columns: [
      { header: "Fecha", key: "fecha", type: "date", width: 14, required: true },
      { header: "Cuenta", key: "cuenta", type: "text", width: 18, required: false },
      { header: "Categoría", key: "categoria", type: "text", width: 18, required: true },
      { header: "Concepto", key: "concepto", type: "text", width: 28, required: true },
      { header: "Forma de pago", key: "pago", type: "text", width: 18, required: false },
      { header: "Ingreso", key: "ingreso", type: "currency", width: 14, required: false, validation: { type: "number", min: 0 } },
      { header: "Egreso", key: "egreso", type: "currency", width: 14, required: false, validation: { type: "number", min: 0 } },
      { header: "Comisión", key: "comision", type: "currency", width: 12, required: false, validation: { type: "number", min: 0 } },
      { header: "IVA", key: "iva", type: "currency", width: 12, required: false, validation: { type: "number", min: 0 } },
      { header: "Neto", key: "neto", type: "currency", width: 12, required: false },
      { header: "Proveedor/Cliente", key: "tercero", type: "text", width: 22, required: false },
      { header: "Notas", key: "notas", type: "text", width: 28, required: false },
    ],
    totals: { enabled: true, label: "TOTAL", mode: "general" },
  },

  sales_crm: {
    label: "Ventas / CRM",
    columns: [
      { header: "Fecha", key: "fecha", type: "date", width: 14, required: true },
      { header: "Cliente", key: "cliente", type: "text", width: 22, required: true },
      { header: "Producto/Servicio", key: "producto", type: "text", width: 22, required: true },
      { header: "Canal", key: "canal", type: "text", width: 14, required: false },
      { header: "Categoría", key: "categoria", type: "text", width: 18, required: false },
      { header: "Forma de pago", key: "pago", type: "text", width: 18, required: false },
      { header: "Monto", key: "monto", type: "currency", width: 14, required: true, validation: { type: "number", min: 0 } },
      { header: "Comisión", key: "comision", type: "currency", width: 12, required: false, validation: { type: "number", min: 0 } },
      { header: "IVA", key: "iva", type: "currency", width: 12, required: false, validation: { type: "number", min: 0 } },
      { header: "Neto", key: "neto", type: "currency", width: 12, required: false },
      {
        header: "Estatus",
        key: "estatus",
        type: "text",
        width: 14,
        required: false,
        validation: { type: "list", values: ["Pendiente", "Pagado", "Vencido", "Parcial"] },
      },
      { header: "Notas", key: "notas", type: "text", width: 28, required: false },
    ],
    totals: { enabled: true, label: "TOTAL", mode: "general" },
  },

  inventory: {
    label: "Inventario PRO",
    columns: [
      { header: "Fecha", key: "fecha", type: "date", width: 14, required: true },
      { header: "SKU", key: "sku", type: "text", width: 16, required: true },
      { header: "Producto", key: "producto", type: "text", width: 26, required: true },
      { header: "Categoría", key: "categoria", type: "text", width: 18, required: false },
      { header: "Stock", key: "stock", type: "integer", width: 10, required: true, validation: { type: "number", min: 0 } },
      { header: "Stock mínimo", key: "stock_min", type: "integer", width: 12, required: false, validation: { type: "number", min: 0 } },
      { header: "Costo", key: "costo", type: "currency", width: 14, required: false, validation: { type: "number", min: 0 } },
      { header: "Precio", key: "precio", type: "currency", width: 14, required: false, validation: { type: "number", min: 0 } },
      { header: "Proveedor", key: "proveedor", type: "text", width: 18, required: false },
      { header: "Notas", key: "notas", type: "text", width: 28, required: false },
    ],
    totals: { enabled: true, label: "TOTAL", mode: "general" },
  },
};

const TEMPLATE_KEYS = Object.keys(TEMPLATE_MAP);

function chooseTemplateKey({ purpose, industry, level }) {
  const p = String(purpose || "").toLowerCase();
  const i = String(industry || "").toLowerCase();
  const l = String(level || "").toLowerCase();

  if (p.includes("ventas") || p.includes("crm")) return "sales_crm";
  if (p.includes("inventario") || p.includes("almacén")) return "inventory";
  if (p.includes("contable") || p.includes("finanzas")) return "finance_ledger";
  if (p.includes("control diario")) return "daily_control";

  if (i.includes("clínica") || i.includes("salud") || i.includes("consultorio")) return "finance_ledger";
  if (l.includes("directivo")) return "finance_ledger";

  return "daily_control";
}

function buildPaymentValidationValues(selectedKeys = []) {
  const labels = selectedKeys
    .map((k) => PAY_METHODS.find((x) => x.key === k)?.label)
    .filter(Boolean);
  return labels.length ? labels : ["Efectivo", "Transferencia/SPEI", "Tarjeta Débito", "Tarjeta Crédito"];
}

/**
 * Merge no destructivo:
 * - Conserva orden de baseCols
 * - Agrega extras al final
 * - Si same key, merge props
 */
function mergeColumns(baseCols = [], overrideCols = []) {
  const byKey = new Map();
  for (const c of baseCols) byKey.set(String(c.key), { ...c });

  for (const o of overrideCols) {
    const k = String(o.key);
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, { ...o });
    else byKey.set(k, { ...byKey.get(k), ...o });
  }

  const seen = new Set();
  const out = [];
  for (const c of baseCols) {
    const k = String(c.key);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(byKey.get(k));
  }
  for (const [k, v] of byKey.entries()) {
    if (seen.has(k)) continue;
    out.push(v);
  }
  return out;
}

function ensureColumn(cols, col, atIndex = null) {
  const has = cols.some((c) => String(c.key).toLowerCase() === String(col.key).toLowerCase());
  if (has) return cols;
  const next = [...cols];
  if (atIndex == null || atIndex < 0 || atIndex > next.length) next.push(col);
  else next.splice(atIndex, 0, col);
  return next;
}

function normalizeSpecHard(spec) {
  const out = spec && typeof spec === "object" ? { ...spec } : {};
  out.version = out.version || "1.2";

  out.workbook = out.workbook && typeof out.workbook === "object" ? { ...out.workbook } : {};
  out.workbook.sheets = Array.isArray(out.workbook.sheets) ? out.workbook.sheets : [];

  out.workbook.sheets = out.workbook.sheets
    .filter((s) => s && typeof s === "object")
    .map((s) => {
      const sh = { ...s };
      sh.name = sh.name || "Data";
      sh.kind = sh.kind || "data";

      if (sh.kind === "data") {
        sh.tableName = sh.tableName || "tbl_data";
        sh.columns = Array.isArray(sh.columns) ? sh.columns : [];
        sh.exampleRows = Array.isArray(sh.exampleRows) ? sh.exampleRows : [];
        sh.totals = sh.totals && typeof sh.totals === "object" ? sh.totals : { enabled: true, label: "TOTAL", mode: "general" };
      }

      if (sh.kind === "dashboard") {
        sh.kpis = Array.isArray(sh.kpis) ? sh.kpis : [];
        sh.charts = Array.isArray(sh.charts) ? sh.charts : [];
        sh.layout = sh.layout && typeof sh.layout === "object" ? sh.layout : { option: "A" };
      }

      return sh;
    });

  return out;
}

function pctFromChoice(choice, fallback) {
  const s = String(choice || "").trim();
  if (!s) return fallback;
  if (s.toLowerCase() === "otro") return fallback;
  const m = s.match(/([\d.]+)\s*%/);
  if (!m) return fallback;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return fallback;
  return v / 100;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
// ===============================
// BLOQUE C (componente principal + buildSpec + submit)
// ===============================
export default function ExcelWizardBubbles({ onGenerateExcel, onSubmit, busy = false, status = "" }) {
  const [answers, setAnswers] = useState({
    purpose: null,
    level: null,
    periodicity: null,
    industry: null,

    theme: "Dark/Gold (Aurea33)",

    // Plantilla: auto por wizard + selector manual
    templateMode: "AUTO", // AUTO | MANUAL
    templateKeyManual: "daily_control",

    // Charts
    wantCharts: true,
    charts: ["bar"],

    // Pagos
    paymentMethodsEnabled: true,
    paymentMethods: ["cash", "transfer", "debit", "credit"],
    commissions: true,
    taxes: false,

    // Comisión por tipo
    commissionRates: { debit: 0.025, credit: 0.035 },

    // Categorías base
    categoriesEnabled: true,
    categories: ["Ventas", "Servicios", "Compras", "Marketing", "Nómina", "Gastos fijos", "Gastos variables"],

    // OVERRIDE columnas
    columnsMode: "MERGE", // MERGE | OVERRIDE
    columnsMinCountToApply: 4,

    wantImages: false,
    images: [],
    fileName: "AUREA_excel.xlsx",
    sheetName: "AUREA",
  });

  const [step, setStep] = useState(1);
  const [industryQuery, setIndustryQuery] = useState("");

  const [contextQs, setContextQs] = useState([]);
  const [contextA, setContextA] = useState({});

  const [intentPreview, setIntentPreview] = useState(null);
  const [showIntent, setShowIntent] = useState(false);

  const bottomRef = useRef(null);
  const scrollBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  const industriesFiltered = useMemo(() => {
    const q = industryQuery.trim().toLowerCase();
    if (!q) return INDUSTRIES;
    return INDUSTRIES.filter((x) => x.toLowerCase().includes(q));
  }, [industryQuery]);

  const pushAssistant = (text) => ({ id: uid(), role: "assistant", text });
  const pushUser = (text) => ({ id: uid(), role: "user", text });

  const messages = useMemo(() => {
    const arr = [];
    arr.push(pushAssistant("🧾 Modo Excel: vamos a crear tu archivo PRO con un wizard rápido."));
    arr.push(pushAssistant("1️⃣ ¿Para qué necesitas el Excel?"));

    if (answers.purpose) {
      arr.push(pushUser(answers.purpose));
      arr.push(pushAssistant("2️⃣ ¿Qué nivel necesitas?"));
    }
    if (answers.level) {
      arr.push(pushUser(answers.level));
      arr.push(pushAssistant("3️⃣ Periodicidad"));
    }
    if (answers.periodicity) {
      arr.push(pushUser(answers.periodicity));
      arr.push(pushAssistant("4️⃣ ¿Giro del negocio? (puedes buscar)"));
    }
    if (answers.industry) {
      arr.push(pushUser(answers.industry));
      arr.push(pushAssistant("🎨 Preferencias PRO: tema, pagos, comisiones, gráficas, plantilla."));
    }

    if (step >= 6) {
      arr.push(pushAssistant("🧩 Preguntas inteligentes para armar el Excel EXACTO."));
      for (const q of contextQs) {
        arr.push(pushAssistant(q.question + (q.hint ? `\n\nHint: ${q.hint}` : "")));
        const a = contextA[q.id];
        if (a != null && String(a).trim() !== "") arr.push(pushUser(String(a)));
      }
      arr.push(pushAssistant("✅ Al final genero el Excel con fórmulas, validaciones y dashboard si aplica."));
    }

    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, step, contextQs, contextA]);

  const setAnswer = (key, value) => setAnswers((p) => ({ ...p, [key]: value }));

  const goNext = (nextStep) => {
    setStep(nextStep);
    setTimeout(scrollBottom, 60);
  };

  const handleImages = (files) => {
    const list = Array.from(files || []);
    setAnswers((p) => ({ ...p, images: list, wantImages: list.length > 0 }));
  };

  const buildContextualQuestions = (state) => {
    const qs = [];

    qs.push({
      id: "columns_need",
      type: "text",
      question: "🧩 Describe qué columnas necesitas (o qué quieres controlar).",
      hint:
        "Tip: si escribes 'OVERRIDE:' al inicio, reemplazo toda la plantilla. Ej: OVERRIDE: Fecha, Concepto, Categoría, Pago, Ingreso, Egreso, Comisión, IVA, Neto",
    });

    qs.push({
      id: "totals_auto",
      type: "choice",
      question: "¿Quieres totales automáticos?",
      choices: ["Sí, por fila y por columna", "Solo total general", "No"],
    });

    if (state.paymentMethodsEnabled && state.commissions) {
      qs.push({
        id: "commission_input_mode",
        type: "choice",
        question: "💳 Comisión por tarjeta: ¿cómo la manejarás?",
        choices: ["Auto (por % débito/crédito)", "Manual (yo escribiré comisión)", "Mixto"],
      });
      qs.push({
        id: "commission_debit",
        type: "choice",
        question: "Porcentaje Débito",
        choices: ["1.5%", "2.0%", "2.5%", "3.0%", "Otro"],
      });
      qs.push({
        id: "commission_credit",
        type: "choice",
        question: "Porcentaje Crédito",
        choices: ["2.5%", "3.0%", "3.5%", "4.0%", "Otro"],
      });
    }

    if ((state.purpose || "").includes("Contable")) {
      qs.push({
        id: "accounting_type",
        type: "choice",
        question: "¿Qué tipo de control contable?",
        choices: ["Ingresos/Egresos", "Cuentas por cobrar/pagar", "Flujo de efectivo", "Mixto"],
      });
      qs.push({
        id: "currency",
        type: "choice",
        question: "¿Moneda?",
        choices: ["MXN", "USD", "EUR", "Otra"],
      });
      qs.push({
        id: "tax_mode",
        type: "choice",
        question: "Impuestos/IVA: ¿cómo lo quieres?",
        choices: ["Sin IVA", "IVA manual", "IVA auto 16% (sobre ingreso/monto)"],
      });
    }

    if ((state.purpose || "").includes("Ventas")) {
      qs.push({
        id: "sales_granularity",
        type: "choice",
        question: "¿Cómo quieres registrar ventas?",
        choices: ["Por ticket/venta", "Por día", "Por producto", "Mixto"],
      });
      qs.push({
        id: "crm_fields",
        type: "choice",
        question: "¿Incluimos CRM (clientes/leads)?",
        choices: ["Sí", "No"],
      });
    }

    if ((state.purpose || "").includes("Inventario")) {
      qs.push({
        id: "inventory_mode",
        type: "choice",
        question: "¿Inventario por…?",
        choices: ["SKU/Producto", "Categorías", "Almacenes", "Mixto"],
      });
      qs.push({
        id: "inventory_alerts",
        type: "choice",
        question: "¿Quieres alertas (stock mínimo)?",
        choices: ["Sí", "No"],
      });
    }

    if (state.level === "Directivo" || (state.purpose || "").includes("Reportes directivos")) {
      qs.push({
        id: "kpi_focus",
        type: "text",
        question: "📊 ¿Qué KPIs quieres ver arriba? (lista rápida)",
        hint: "Ej: Total, neto, ticket promedio, % tarjeta, top categorías, top clientes…",
      });
      qs.push({
        id: "dashboard",
        type: "choice",
        question: "¿Creamos un Dashboard en otra hoja?",
        choices: ["Sí (recomendado)", "No"],
      });
    }

    if (state.categoriesEnabled) {
      qs.push({
        id: "categories_custom",
        type: "text",
        question: "🏷️ Categorías: ¿quieres personalizarlas?",
        hint: "Deja vacío para usar las sugeridas. O escribe: Ventas, Compras, Marketing, Nómina...",
      });
    }

    return qs;
  };

  const computeTemplateKey = () => {
    if (answers.templateMode === "MANUAL") return answers.templateKeyManual;
    return chooseTemplateKey({ purpose: answers.purpose, industry: answers.industry, level: answers.level });
  };

  const buildWizardPrompt = () => {
    const parts = [];
    if (answers.purpose) parts.push(`Propósito: ${answers.purpose}`);
    if (answers.level) parts.push(`Nivel: ${answers.level}`);
    if (answers.periodicity) parts.push(`Periodicidad: ${answers.periodicity}`);
    if (answers.industry) parts.push(`Giro: ${answers.industry}`);

    const tKey = computeTemplateKey();
    parts.push(`Plantilla: ${TEMPLATE_MAP[tKey]?.label || tKey}`);

    if (answers.paymentMethodsEnabled) {
      const labels = answers.paymentMethods.map((k) => PAY_METHODS.find((x) => x.key === k)?.label).filter(Boolean);
      if (labels.length) parts.push(`Métodos de pago: ${labels.join(", ")}`);
    } else {
      parts.push("Sin métodos de pago");
    }

    if (answers.commissions) parts.push("Incluir comisiones por tarjeta");
    if (answers.taxes) parts.push("Incluir impuestos/IVA");

    if (answers.wantCharts) {
      const cl = answers.charts.map((k) => CHARTS.find((x) => x.key === k)?.label).filter(Boolean);
      if (cl.length) parts.push(`Gráficas: ${cl.join(", ")}`);
    } else {
      parts.push("Sin gráficas");
    }

    if (contextA.columns_need) parts.push(`Columnas deseadas: ${contextA.columns_need}`);
    if (contextA.kpi_focus) parts.push(`KPIs: ${contextA.kpi_focus}`);
    if (contextA.accounting_type) parts.push(`Contable: ${contextA.accounting_type}`);
    if (contextA.sales_granularity) parts.push(`Ventas: ${contextA.sales_granularity}`);
    if (contextA.inventory_mode) parts.push(`Inventario: ${contextA.inventory_mode}`);
    if (contextA.tax_mode) parts.push(`IVA: ${contextA.tax_mode}`);
    if (contextA.commission_input_mode) parts.push(`Comisión: ${contextA.commission_input_mode}`);

    return (parts.join(". ") + ".").trim();
  };

  const buildExcelSpec = () => {
    const templateKey = computeTemplateKey();
    const tpl = TEMPLATE_MAP[templateKey] || TEMPLATE_MAP.daily_control;

    // base columns
    let cols = Array.isArray(tpl.columns) ? [...tpl.columns] : [];

    // OVERRIDE logic
    const columnsNeedText = String(contextA.columns_need || "").trim();
    const explicitOverride = /^override\s*:/i.test(columnsNeedText);
    const cleanText = columnsNeedText.replace(/^override\s*:/i, "").trim();
    const customCols = parseColumnsFromText(cleanText);

    const shouldApplyCustom =
      (explicitOverride && customCols.length >= 3) ||
      (!explicitOverride && customCols.length >= (answers.columnsMinCountToApply || 4));

    if (shouldApplyCustom) {
      const normalizedCustom = customCols.map((c) => ({
        header: c.header,
        key: c.key,
        type: c.type || "text",
        width: 18,
        required: false,
      }));

      if (explicitOverride || answers.columnsMode === "OVERRIDE") cols = normalizedCustom;
      else cols = mergeColumns(cols, normalizedCustom);
    }

    // ensure categoria if categoriesEnabled
    if (answers.categoriesEnabled) {
      cols = ensureColumn(
        cols,
        { header: "Categoría", key: "categoria", type: "text", width: 18, required: false },
        2
      );

      const catList = String(contextA.categories_custom || "")
        .split(/[,;\n]/g)
        .map((s) => s.trim())
        .filter(Boolean);

      const categories = catList.length ? catList : answers.categories;
      cols = cols.map((c) => {
        if (String(c.key).toLowerCase() === "categoria") {
          return { ...c, validation: { type: "list", values: categories } };
        }
        return c;
      });
    }

    // ensure pago + validation list
    if (answers.paymentMethodsEnabled) {
      cols = ensureColumn(
        cols,
        { header: "Forma de pago", key: "pago", type: "text", width: 18, required: false },
        3
      );

      const payValues = buildPaymentValidationValues(answers.paymentMethods);
      cols = cols.map((c) => {
        if (String(c.key).toLowerCase() === "pago") return { ...c, validation: { type: "list", values: payValues } };
        return c;
      });
    }

    // ensure commission/iva/neto columns if enabled
    const wantsCommission = answers.paymentMethodsEnabled && answers.commissions;
    const wantsIVA = !!answers.taxes;
    if (wantsCommission) cols = ensureColumn(cols, { header: "Comisión", key: "comision", type: "currency", width: 12, required: false }, null);
    if (wantsIVA) cols = ensureColumn(cols, { header: "IVA", key: "iva", type: "currency", width: 12, required: false }, null);

    // Ensure neto if we have ingreso/monto + (commission or iva)
    const keys = new Set(cols.map((c) => String(c.key)));
    const hasIngreso = keys.has("ingreso");
    const hasEgreso = keys.has("egreso");
    const hasMonto = keys.has("monto");
    const needsNeto = (hasIngreso || hasMonto) && (wantsCommission || wantsIVA);
    if (needsNeto) cols = ensureColumn(cols, { header: "Neto", key: "neto", type: "currency", width: 12, required: false }, null);

    // totals
    const totalsAuto = String(contextA.totals_auto || "");
    const wantsRowCol = totalsAuto.toLowerCase().includes("fila") && totalsAuto.toLowerCase().includes("columna");

    const totals = {
      enabled: !String(totalsAuto).toLowerCase().startsWith("no"),
      label: (tpl.totals && tpl.totals.label) || "TOTAL",
      mode: wantsRowCol ? "row_col" : (tpl.totals && tpl.totals.mode) || "general",
      sumKeys: cols
        .filter((c) => ["currency", "number", "integer"].includes(String(c.type || "").toLowerCase()))
        .map((c) => c.key),
    };

    const exampleRows = makeExampleRows(cols, 12);

    const wantsDashboard =
      answers.level === "Directivo" ||
      String(answers.purpose || "").includes("Reportes directivos") ||
      String(contextA.dashboard || "").startsWith("Sí");

    const tableName = "tbl_data";
    const sheets = [];

    sheets.push({
      name: "Data",
      kind: "data",
      tableName,
      columns: cols,
      exampleRows,
      totals,
      meta: {
        purpose: answers.purpose,
        periodicity: answers.periodicity,
        industry: answers.industry,
        templateKey,
      },
    });

    if (wantsDashboard) {
      const kpis = buildKpisDeterministic({ tableName, columns: cols });
      sheets.push({
        name: "Dashboard",
        kind: "dashboard",
        layout: {
          option: "A",
          kpiCard: { merge: false, labelTop: true },
          spacing: "comfortable",
        },
        kpis,
        charts: answers.wantCharts
          ? (answers.charts || []).map((t) => ({
              type: t,
              title: "Resumen",
              from: "Data",
              tableName,
            }))
          : [],
      });
    }

    const spec = {
      version: "1.2",
      workbook: {
        theme: themeToToken(answers.theme),
        title: (answers.fileName || "AUREA_excel.xlsx").replace(/\.xlsx$/i, ""),
        industry: answers.industry || "",
        level: answers.level || "Profesional",
        periodicity: answers.periodicity || "Mensual",
        sheets,
      },
      notes: {
        wizard: {
          purpose: answers.purpose,
          level: answers.level,
          periodicity: answers.periodicity,
          industry: answers.industry,
        },
        context: { ...contextA },
        options: {
          wantCharts: !!answers.wantCharts,
          charts: answers.wantCharts ? answers.charts : [],
          paymentMethodsEnabled: !!answers.paymentMethodsEnabled,
          paymentMethods: answers.paymentMethodsEnabled ? answers.paymentMethods : [],
          commissions: !!answers.commissions,
          taxes: !!answers.taxes,
          templateMode: answers.templateMode,
          templateKey: templateKey,
          columnsMode: answers.columnsMode,
        },
      },
    };

    return normalizeSpecHard(spec);
  };

  useEffect(() => {
    const prompt = buildWizardPrompt();
    const parsed = parseIntent(prompt);

    const enriched = {
      ...parsed,
      domain: guessDomainFromWizard(answers),
      period: mapPeriodToIntent(answers.periodicity),
      layout: guessLayoutFromWizard(answers),
      features: {
        ...parsed.features,
        payment_methods: !!answers.paymentMethodsEnabled,
        commissions: !!answers.commissions,
        taxes: !!answers.taxes,
        charts: answers.wantCharts ? answers.charts : [],
      },
    };

    setIntentPreview(enriched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    answers.purpose,
    answers.level,
    answers.periodicity,
    answers.industry,
    answers.templateMode,
    answers.templateKeyManual,
    answers.columnsMode,
    answers.paymentMethodsEnabled,
    answers.paymentMethods,
    answers.commissions,
    answers.taxes,
    answers.wantCharts,
    answers.charts,
    contextA.columns_need,
    contextA.kpi_focus,
    contextA.accounting_type,
    contextA.sales_granularity,
    contextA.inventory_mode,
    contextA.dashboard,
    contextA.tax_mode,
    contextA.commission_input_mode,
    contextA.categories_custom,
  ]);

  const submitAll = async () => {
    const spec = buildExcelSpec();
    const prompt = buildWizardPrompt();
    const intent = intentPreview || parseIntent(prompt);

    const payload = {
      fileName: answers.fileName || "AUREA_excel.xlsx",
      prompt,
      intent,
      spec,
      wizard: {
        purpose: answers.purpose,
        level: answers.level,
        periodicity: answers.periodicity,
        industry: answers.industry,
      },
      preferences: {
        theme: answers.theme,
        wantCharts: answers.wantCharts,
        wantImages: answers.wantImages,
      },
      context: { ...contextA },
      file: {
        fileName: answers.fileName || "AUREA_excel.xlsx",
        sheetName: "Data",
      },
    };

    if (typeof onGenerateExcel === "function") {
      await onGenerateExcel(payload);
      return;
    }

    const res = await fetch("/api/excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      console.error("Excel API error:", data);
      alert(`Error generando Excel: ${data?.error || res.statusText}`);
      return;
    }

    if (data.downloadUrl) window.open(data.downloadUrl, "_blank");
    else alert("Excel generado ✅ (pero tu API no regresó downloadUrl). Revisa consola.");

    onSubmit?.(payload, answers.images);
  };

  const disabledAll = busy;

  // Debug utilities
  const debugToConsole = () => {
    const prompt = buildWizardPrompt();
    const spec = buildExcelSpec();
    console.log("AUREA prompt:", prompt);
    console.log("AUREA intent:", intentPreview);
    console.log("AUREA spec:", spec);
    alert("Prompt/Intent/Spec enviados a consola ✅");
  };

  const debugCopyAll = async () => {
    const prompt = buildWizardPrompt();
    const spec = buildExcelSpec();
    const pack = JSON.stringify({ prompt, intent: intentPreview, spec }, null, 2);
    const ok = await copyToClipboard(pack);
    alert(ok ? "Copiado al clipboard ✅" : "No se pudo copiar 😅");
  };
// ===============================
// BLOQUE D (UI completo + cierre del componente)
// ===============================
  return (
    <div className="space-y-4">
      {/* STATUS BAR */}
      <div className="flex items-center justify-between gap-3 bg-black/40 border border-zinc-800 rounded-2xl p-3">
        <div className="text-xs text-zinc-300">
          <span className="font-semibold text-yellow-300">Excel Wizard</span>{" "}
          <span className="text-zinc-500">•</span>{" "}
          <span className="text-zinc-400">
            {busy ? "Generando…" : "Listo"} {status ? `• ${status}` : ""}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <button
            type="button"
            disabled={disabledAll}
            className={`px-3 py-2 rounded-xl text-xs border ${
              disabledAll
                ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500"
            }`}
            onClick={() => {
              setStep(1);
              setIndustryQuery("");
              setContextQs([]);
              setContextA({});
              setAnswers((p) => ({
                ...p,
                purpose: null,
                level: null,
                periodicity: null,
                industry: null,
              }));
              setTimeout(scrollBottom, 80);
            }}
          >
            Reset
          </button>

          <button
            type="button"
            disabled={disabledAll}
            className={`px-3 py-2 rounded-xl text-xs border ${
              disabledAll
                ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500"
            }`}
            onClick={() => setShowIntent((v) => !v)}
          >
            {showIntent ? "Ocultar Intent" : "Ver Intent"}
          </button>

          <button
            type="button"
            disabled={disabledAll}
            className={`px-3 py-2 rounded-xl text-xs border ${
              disabledAll
                ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500"
            }`}
            onClick={debugToConsole}
          >
            Debug
          </button>

          <button
            type="button"
            disabled={disabledAll}
            className={`px-3 py-2 rounded-xl text-xs border ${
              disabledAll
                ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500"
            }`}
            onClick={debugCopyAll}
          >
            Copiar Debug
          </button>
        </div>
      </div>

      {/* INTENT PREVIEW */}
      {showIntent && (
        <div className="bg-black/40 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-white">🧠 Intent detectado (live)</div>
            <div className="text-xs text-zinc-400">(Debug)</div>
          </div>
          <pre className="mt-3 text-xs bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 overflow-auto max-h-[220px] text-zinc-200">
{JSON.stringify(intentPreview, null, 2)}
          </pre>
        </div>
      )}

      {/* CHAT AREA */}
      <div className="bg-zinc-950/40 border border-zinc-800 rounded-2xl p-4 h-[420px] overflow-y-auto space-y-3">
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role}>
            <div className="whitespace-pre-line">{m.text}</div>
          </Bubble>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <Card title="1️⃣ ¿Para qué es este Excel?" desc="Elige una opción.">
          <div className="flex flex-wrap gap-2">
            {PURPOSES.map((p) => (
              <QuickButton
                key={p}
                label={p}
                active={answers.purpose === p}
                disabled={disabledAll}
                onClick={() => {
                  setAnswer("purpose", p);
                  goNext(2);
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <Card title="2️⃣ Nivel del Excel" desc="Básico / Pro / Directivo (con dashboard).">
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <QuickButton
                key={l}
                label={l}
                active={answers.level === l}
                disabled={disabledAll}
                onClick={() => {
                  setAnswer("level", l);
                  goNext(3);
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <Card title="3️⃣ Periodicidad" desc="Define cómo se organizan registros y totales.">
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <QuickButton
                key={p}
                label={p}
                active={answers.periodicity === p}
                disabled={disabledAll}
                onClick={() => {
                  setAnswer("periodicity", p);
                  goNext(4);
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <Card title="4️⃣ Giro del negocio" desc="Busca y selecciona.">
          <input
            value={industryQuery}
            onChange={(e) => setIndustryQuery(e.target.value)}
            placeholder="Busca (ej: clínica, e-commerce, agencia...)"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
            disabled={disabledAll}
          />
          <div className="mt-3 flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-1">
            {industriesFiltered.map((x) => (
              <QuickButton
                key={x}
                label={x}
                active={answers.industry === x}
                disabled={disabledAll}
                onClick={() => {
                  setAnswer("industry", x);
                  goNext(5);
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {/* STEP 5 */}
      {step === 5 && (
        <Card title="⚙️ Preferencias PRO" desc="Esto impacta intención y estructura real del Excel.">
          {/* Tema */}
          <div className="text-xs text-zinc-400 mb-2">Tema</div>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <QuickButton
                key={t}
                label={t}
                active={answers.theme === t}
                disabled={disabledAll}
                onClick={() => setAnswer("theme", t)}
              />
            ))}
          </div>

          {/* Plantilla */}
          <div className="mt-4 bg-black/30 border border-zinc-800 rounded-xl p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-semibold text-sm">🧩 Plantilla</div>
              <div className="flex gap-2 flex-wrap">
                <Toggle
                  enabled={answers.templateMode === "AUTO"}
                  disabled={disabledAll}
                  onToggle={() => setAnswer("templateMode", answers.templateMode === "AUTO" ? "MANUAL" : "AUTO")}
                  labelOn="AUTO"
                  labelOff="MANUAL"
                />
                <div className="text-xs text-zinc-400">
                  {answers.templateMode === "AUTO"
                    ? "Auto según Purpose/Industry/Level"
                    : "Elige una plantilla fija"}
                </div>
              </div>
            </div>

            {answers.templateMode === "MANUAL" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {TEMPLATE_KEYS.map((k) => (
                  <QuickButton
                    key={k}
                    label={TEMPLATE_MAP[k]?.label || k}
                    active={answers.templateKeyManual === k}
                    disabled={disabledAll}
                    onClick={() => setAnswer("templateKeyManual", k)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Column override mode */}
          <div className="mt-4 bg-black/30 border border-zinc-800 rounded-xl p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="font-semibold text-sm">🧱 Columnas (MERGE / OVERRIDE)</div>
              <div className="flex gap-2 flex-wrap">
                <Toggle
                  enabled={answers.columnsMode === "MERGE"}
                  disabled={disabledAll}
                  onToggle={() => setAnswer("columnsMode", answers.columnsMode === "MERGE" ? "OVERRIDE" : "MERGE")}
                  labelOn="MERGE"
                  labelOff="OVERRIDE"
                />
                <div className="text-xs text-zinc-400">
                  {answers.columnsMode === "MERGE"
                    ? "No destructivo (recomendado)"
                    : "Reemplaza columnas si detecta suficientes"}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-zinc-500 mt-2">
              Tip: en “Columnas deseadas” puedes forzar con <b>OVERRIDE:</b>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Métodos de pago */}
            <div className="bg-black/30 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">💳 Métodos de pago</div>
                <Toggle
                  enabled={answers.paymentMethodsEnabled}
                  disabled={disabledAll}
                  onToggle={() => setAnswer("paymentMethodsEnabled", !answers.paymentMethodsEnabled)}
                />
              </div>

              {answers.paymentMethodsEnabled && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {PAY_METHODS.map((m) => (
                    <QuickButton
                      key={m.key}
                      label={m.label}
                      active={answers.paymentMethods.includes(m.key)}
                      disabled={disabledAll}
                      onClick={() => {
                        setAnswers((p) => {
                          const has = p.paymentMethods.includes(m.key);
                          const next = has ? p.paymentMethods.filter((x) => x !== m.key) : [...p.paymentMethods, m.key];
                          return { ...p, paymentMethods: next.length ? next : ["cash"] };
                        });
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <QuickButton
                  label={answers.commissions ? "✅ Comisiones" : "❌ Comisiones"}
                  active={answers.commissions}
                  disabled={disabledAll}
                  onClick={() => setAnswer("commissions", !answers.commissions)}
                />
                <QuickButton
                  label={answers.taxes ? "✅ Impuestos/IVA" : "❌ Impuestos/IVA"}
                  active={answers.taxes}
                  disabled={disabledAll}
                  onClick={() => setAnswer("taxes", !answers.taxes)}
                />
              </div>
            </div>

            {/* Gráficas */}
            <div className="bg-black/30 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">📊 Gráficas</div>
                <Toggle
                  enabled={answers.wantCharts}
                  disabled={disabledAll}
                  onToggle={() => setAnswer("wantCharts", !answers.wantCharts)}
                />
              </div>

              {answers.wantCharts && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {CHARTS.map((c) => (
                    <QuickButton
                      key={c.key}
                      label={c.label}
                      active={answers.charts.includes(c.key)}
                      disabled={disabledAll}
                      onClick={() => {
                        setAnswers((p) => {
                          const has = p.charts.includes(c.key);
                          const next = has ? p.charts.filter((x) => x !== c.key) : [...p.charts, c.key];
                          return { ...p, charts: next.length ? next : ["bar"] };
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* archivo / hoja */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-zinc-400 mb-1">Nombre del archivo</div>
              <input
                value={answers.fileName}
                onChange={(e) => setAnswer("fileName", e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
                placeholder="AUREA_excel.xlsx"
                disabled={disabledAll}
              />
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1">Nombre de la hoja (UI)</div>
              <input
                value={answers.sheetName}
                onChange={(e) => setAnswer("sheetName", e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
                placeholder="AUREA"
                disabled={disabledAll}
              />
              <div className="text-[11px] text-zinc-500 mt-1">
                Nota: El motor usa <b>Data</b> como hoja base para compatibilidad.
              </div>
            </div>
          </div>

          {/* imágenes opcionales */}
          <div className="mt-4">
            <div className="text-xs text-zinc-400 mb-2">🖼️ (Opcional) Subir logo/imagenes</div>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleImages(e.target.files)}
              className="block w-full text-xs text-zinc-300"
              disabled={disabledAll}
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={disabledAll}
              className={`px-5 py-2 rounded-xl font-semibold transition ${
                disabledAll
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-yellow-400 text-black hover:bg-yellow-500"
              }`}
              onClick={() => {
                const qs = buildContextualQuestions(answers);
                setContextQs(qs);
                setContextA({});
                goNext(6);
              }}
            >
              Continuar a preguntas inteligentes →
            </button>
          </div>
        </Card>
      )}

      {/* STEP 6+ */}
      {step >= 6 && (
        <Card title="🧩 FASE 2 — Preguntas inteligentes" desc="Responde rápido. Al final genero el Excel PRO.">
          <div className="space-y-3">
            {contextQs.map((q) => {
              const val = contextA[q.id] ?? "";
              return (
                <div key={q.id} className="bg-black/30 border border-zinc-800 rounded-xl p-3">
                  <div className="text-sm font-semibold">{q.question}</div>

                  {q.type === "choice" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {q.choices.map((c) => (
                        <QuickButton
                          key={c}
                          label={c}
                          active={val === c}
                          disabled={disabledAll}
                          onClick={() => setContextA((p) => ({ ...p, [q.id]: c }))}
                        />
                      ))}
                    </div>
                  ) : (
                    <>
                      {q.hint ? <div className="text-xs text-zinc-400 mt-1">{q.hint}</div> : null}
                      <textarea
                        value={val}
                        onChange={(e) => setContextA((p) => ({ ...p, [q.id]: e.target.value }))}
                        className="mt-2 w-full min-h-[80px] rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
                        placeholder="Escribe aquí…"
                        disabled={disabledAll}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={disabledAll}
              className={`px-5 py-2 rounded-xl border transition ${
                disabledAll
                  ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-zinc-900 border-zinc-800 text-white hover:border-zinc-600"
              }`}
              onClick={() => goNext(5)}
            >
              ← Volver
            </button>

            <button
              type="button"
              disabled={disabledAll}
              className={`px-5 py-2 rounded-xl font-semibold transition ${
                disabledAll
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-yellow-400 text-black hover:bg-yellow-500"
              }`}
              onClick={submitAll}
            >
              {busy ? "Generando…" : "Generar Excel PRO"}
            </button>
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            Si algo falla: abre consola y presiona <b>Debug</b>. Usa <b>Copiar Debug</b> para mandarme todo.
          </div>
        </Card>
      )}
    </div>
  );
}


