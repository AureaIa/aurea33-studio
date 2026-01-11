"use client";

import React, { useMemo, useRef, useState } from "react";

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

function QuickButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-full text-xs border transition ${
        active
          ? "bg-yellow-400 text-black border-yellow-400 font-semibold"
          : "bg-zinc-900 text-white border-zinc-800 hover:border-zinc-600"
      }`}
    >
      {label}
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

/**
 * ExcelWizardBubbles
 * - onSubmit(payload, images)
 */
export default function ExcelWizardBubbles({ onSubmit }) {
  const [answers, setAnswers] = useState({
    purpose: null,
    level: null,
    periodicity: null,
    industry: null,

    theme: "Dark/Gold (Aurea33)",
    wantCharts: true,
    wantImages: false,
    images: [],

    fileName: "AUREA_excel.xlsx",
    sheetName: "AUREA",
  });

  const [step, setStep] = useState(1);
  const [industryQuery, setIndustryQuery] = useState("");
  const [contextQs, setContextQs] = useState([]);
  const [contextA, setContextA] = useState({});

  const bottomRef = useRef(null);
  const scrollBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  const industriesFiltered = useMemo(() => {
    const q = industryQuery.trim().toLowerCase();
    if (!q) return INDUSTRIES;
    return INDUSTRIES.filter((x) => x.toLowerCase().includes(q));
  }, [industryQuery]);

  // Preguntas contextuales (FASE 2)
  const buildContextualQuestions = (state) => {
    const qs = [];

    qs.push({
      id: "columns_need",
      type: "text",
      question: "🧩 Ahora sí: describe qué columnas necesitas (o qué quieres controlar).",
      hint: "Ej: Fecha, concepto, ingreso, egreso, categoría, forma de pago…",
    });

    qs.push({
      id: "totals_auto",
      type: "choice",
      question: "¿Quieres totales automáticos?",
      choices: ["Sí, por fila y por columna", "Solo total general", "No"],
    });

    if (state.purpose?.includes("Contable")) {
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
    }

    if (state.purpose?.includes("Ventas")) {
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

    if (state.purpose?.includes("Inventario")) {
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

    if (state.level === "Directivo") {
      qs.push({
        id: "kpi_focus",
        type: "text",
        question: "📊 Nivel Directivo: ¿Qué KPIs quieres ver arriba? (lista rápida)",
        hint: "Ej: Total ventas, margen, top 5 productos, ticket promedio…",
      });
      qs.push({
        id: "dashboard",
        type: "choice",
        question: "¿Creamos un Dashboard en otra hoja?",
        choices: ["Sí (recomendado)", "No"],
      });
    }

    return qs;
  };

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
      arr.push(pushAssistant("3️⃣ ¿Periodicidad?"));
    }
    if (answers.periodicity) {
      arr.push(pushUser(answers.periodicity));
      arr.push(pushAssistant("4️⃣ ¿Giro del negocio/empresa? (puedes buscar)"));
    }
    if (answers.industry) {
      arr.push(pushUser(answers.industry));
      arr.push(pushAssistant("🎨 Preferencias rápidas: tema, gráficas e imágenes."));
    }

    if (step >= 6) {
      arr.push(pushAssistant("🧩 FASE 2: preguntas inteligentes para armar el Excel EXACTO."));
      for (const q of contextQs) {
        arr.push(pushAssistant(q.question + (q.hint ? `\n\nHint: ${q.hint}` : "")));
        const a = contextA[q.id];
        if (a) arr.push(pushUser(String(a)));
      }
      arr.push(pushAssistant("✅ Cuando termines, genero el Excel con fórmulas, estilos y gráficos si los activaste."));
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

  const submitAll = () => {
    const payload = {
      mode: "excel",
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
        fileName: answers.fileName,
        sheetName: answers.sheetName,
      },
    };

    onSubmit?.(payload, answers.images);
  };

  return (
    <div className="space-y-4">
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
        <Card title="2️⃣ Nivel del Excel" desc="Básico / Pro / Directivo (con reportes).">
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <QuickButton
                key={l}
                label={l}
                active={answers.level === l}
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
        <Card title="4️⃣ Giro del negocio" desc="Busca y selecciona. Esto activa preguntas inteligentes.">
          <input
            value={industryQuery}
            onChange={(e) => setIndustryQuery(e.target.value)}
            placeholder="Escribe para buscar (ej: clínica, e-commerce, agencia...)"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
          />
          <div className="mt-3 flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-1">
            {industriesFiltered.map((x) => (
              <QuickButton
                key={x}
                label={x}
                active={answers.industry === x}
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
        <Card title="🎨 Preferencias rápidas" desc="Estilo + extras (gráficas / imágenes).">
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <QuickButton key={t} label={t} active={answers.theme === t} onClick={() => setAnswer("theme", t)} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <QuickButton
              label={answers.wantCharts ? "📊 Gráficas: Sí" : "📊 Gráficas: No"}
              active={answers.wantCharts}
              onClick={() => setAnswer("wantCharts", !answers.wantCharts)}
            />
            <QuickButton
              label={answers.wantImages ? "🖼️ Imágenes: Sí" : "🖼️ Imágenes: No"}
              active={answers.wantImages}
              onClick={() => setAnswer("wantImages", !answers.wantImages)}
            />
          </div>

          {answers.wantImages && (
            <div className="mt-4">
              <div className="text-xs text-zinc-400 mb-2">
                Puedes subir logo/imagenes. (Por ahora enviamos una como logo opcional)
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleImages(e.target.files)}
                className="block w-full text-xs text-zinc-300"
              />
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-zinc-400 mb-1">Nombre del archivo</div>
              <input
                value={answers.fileName}
                onChange={(e) => setAnswer("fileName", e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
                placeholder="AUREA_excel.xlsx"
              />
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1">Nombre de la hoja</div>
              <input
                value={answers.sheetName}
                onChange={(e) => setAnswer("sheetName", e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white"
                placeholder="AUREA"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="px-5 py-2 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition"
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
              className="px-5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white hover:border-zinc-600 transition"
              onClick={() => goNext(5)}
            >
              ← Volver preferencias
            </button>
            <button
              type="button"
              className="px-5 py-2 rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-500 transition"
              onClick={submitAll}
            >
              Generar Excel PRO
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
