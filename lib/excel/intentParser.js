// /lib/excel/intentParser.js
// Intent Parser PRO (reglas + scoring) — ES-MX

const DEFAULT_INTENT = {
  domain: "generic",
  period: "one_time",
  layout: "simple_table",
  features: {
    payment_methods: false,
    commissions: false,
    categories: true,
    budget: false,
    taxes: false,
    charts: [],
    kpis: []
  },
  columns: ["date", "concept", "amount", "type", "notes"],
  currency: "MXN",
  locale: "es-MX",
  confidence: 0.2,
  notes: []
};

const KEYWORDS = {
  period: {
    daily: [/diari[oa]/i, /cada d[ií]a/i, /\bhoy\b/i],
    weekly: [/semanal/i, /cada semana/i],
    monthly: [/mensual/i, /cada mes/i],
    annual: [/anual/i, /cada a[nñ]o/i]
  },
  layout: {
    dashboard: [/dashboard/i, /tablero/i, /kpi/i, /tarjetas/i, /resumen/i],
    ledger: [/ledger/i, /libro/i, /movimientos/i, /registro/i, /contabil/i],
    report: [/reporte/i, /informe/i]
  },
  domain: {
    finance_personal: [/finanzas personales/i, /gastos/i, /ingresos/i, /ahorro/i, /presupuesto/i],
    business_tpv: [/negocio/i, /ventas/i, /tpv/i, /terminal/i, /caja/i, /cobros/i],
    hospital: [/hospital/i, /cl[ií]nica/i, /radiolog/i, /unirad/i, /paciente/i],
    agenda: [/agenda/i, /citas/i, /calendario/i, /horarios/i]
  },
  payment_methods: {
    cash: [/efectivo/i],
    transfer: [/transfer/i, /spei/i],
    debit: [/d[eé]bito/i],
    credit: [/cr[eé]dito/i],
    deposit: [/dep[oó]sito/i]
  },
  charts: {
    bar: [/barra/i, /barras/i],
    pie: [/pastel/i, /pie/i, /circular/i],
    line: [/l[ií]nea/i, /tendencia/i]
  },
  commissions: [/comisi[oó]n/i, /tasa/i, /%/],
  taxes: [/iva/i, /impuesto/i, /factura/i, /sat/i]
};

function pickBest(matchMap, text) {
  let best = null;
  let score = 0;
  for (const [key, patterns] of Object.entries(matchMap)) {
    const hits = patterns.reduce((acc, rx) => acc + (rx.test(text) ? 1 : 0), 0);
    if (hits > score) {
      score = hits;
      best = key;
    }
  }
  return { best, score };
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function includesAny(text, patterns) {
  return patterns.some((rx) => rx.test(text));
}

/**
 * parseIntent(text: string) -> intent JSON
 */
function parseIntent(textRaw = "") {
  const text = String(textRaw).trim();
  const intent = JSON.parse(JSON.stringify(DEFAULT_INTENT));
  if (!text) return intent;

  let totalSignals = 0;
  let strongSignals = 0;

  // Domain
  const d = pickBest(KEYWORDS.domain, text);
  if (d.best && d.score > 0) {
    intent.domain = d.best;
    totalSignals += d.score;
    if (d.score >= 2) strongSignals++;
  }

  // Period
  const p = pickBest(KEYWORDS.period, text);
  if (p.best && p.score > 0) {
    intent.period = p.best;
    totalSignals += p.score;
  }

  // Layout
  const l = pickBest(KEYWORDS.layout, text);
  if (l.best && l.score > 0) {
    intent.layout = l.best;
    totalSignals += l.score;
    if (l.best === "dashboard") strongSignals++;
  }

  // Payment methods
  const methods = [];
  for (const [m, patterns] of Object.entries(KEYWORDS.payment_methods)) {
    if (includesAny(text, patterns)) methods.push(m);
  }
  if (methods.length) {
    intent.features.payment_methods = true;
    totalSignals += methods.length;
    strongSignals++;
  }

  // Commissions
  if (KEYWORDS.commissions.some((rx) => rx.test(text))) {
    intent.features.commissions = true;
    totalSignals += 1;
  }

  // Taxes
  if (KEYWORDS.taxes.some((rx) => rx.test(text))) {
    intent.features.taxes = true;
    totalSignals += 1;
  }

  // Charts
  const charts = [];
  for (const [c, patterns] of Object.entries(KEYWORDS.charts)) {
    if (includesAny(text, patterns)) charts.push(c);
  }
  if (charts.length) {
    intent.features.charts = uniq(charts);
    totalSignals += charts.length;
  }

  // KPI defaults if dashboard
  if (intent.layout === "dashboard") {
    intent.features.kpis = uniq([
      "total_income",
      "total_expense",
      "net",
      intent.features.payment_methods ? "by_payment_method" : null
    ].filter(Boolean));
  }

  // Columns (evoluciona según features)
  const baseCols = ["date", "concept", "amount", "type"];
  const extraCols = [];
  if (intent.features.payment_methods) extraCols.push("payment_method");
  extraCols.push("notes");
  intent.columns = uniq([...baseCols, ...extraCols]);

  // Layout mapping
  if (intent.layout === "ledger") intent.layout = "ledger";
  if (intent.layout === "report") intent.layout = "report";
  if (intent.layout === "simple_table") intent.layout = "simple_table";

  // Confidence (heurística simple pero útil)
  // 0.2 base + 0.1 por señal hasta 0.95
  const conf = Math.min(0.95, 0.2 + 0.1 * totalSignals + 0.1 * strongSignals);
  intent.confidence = Number(conf.toFixed(2));

  // Notes
  if (intent.features.payment_methods && !intent.features.commissions) {
    intent.notes.push("Se detectaron métodos de pago; considera activar comisiones si hay tarjeta.");
  }
  if (intent.layout === "dashboard" && intent.features.charts.length === 0) {
    intent.notes.push("Dashboard detectado sin tipo de gráficas; se aplicarán barras por defecto.");
    intent.features.charts = ["bar"];
  }

  return intent;
}

export { parseIntent, DEFAULT_INTENT };
