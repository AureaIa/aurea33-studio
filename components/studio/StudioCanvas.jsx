// components/studio/StudioCanvas.jsx
import React, { useMemo } from "react";
import CanvasEditor from "./CanvasEditor";

/* ----------------------------- helpers ----------------------------- */

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function makeDocFromTemplate(tpl) {
  const docId = uid();
  return {
    id: docId,
    title: tpl.title || "Diseño",
    width: tpl.width,
    height: tpl.height,
    background: tpl.background || "#0b0b0c",
    nodes: (tpl.nodes || []).map((n) => ({ ...n, id: uid() })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/* ----------------------------- templates ----------------------------- */

const TEMPLATES = [
  {
    id: "ig_post",
    title: "Instagram Post",
    width: 1080,
    height: 1080,
    background: "#0b0b0c",
    nodes: [
      {
        id: "t1",
        name: "Título",
        type: "text",
        x: 120,
        y: 140,
        text: "AUREA 33",
        fontSize: 110,
        fontFamily: "Inter",
        fill: "#f7c600",
        width: 840,
        align: "left",
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
      },
      {
        id: "r1",
        name: "Glass",
        type: "rect",
        x: 120,
        y: 760,
        width: 840,
        height: 220,
        fill: "rgba(255,255,255,0.06)",
        cornerRadius: 28,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
      },
      {
        id: "t2",
        name: "Sub",
        type: "text",
        x: 160,
        y: 810,
        text: "Diseño + IA. Listo en minutos.",
        fontSize: 44,
        fontFamily: "Inter",
        fill: "#ffffff",
        width: 760,
        align: "left",
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
      },
    ],
  },
  {
    id: "ig_story",
    title: "Instagram Story",
    width: 1080,
    height: 1920,
    background: "#0b0b0c",
    nodes: [
      {
        id: "t1",
        name: "Título",
        type: "text",
        x: 100,
        y: 180,
        text: "STORY",
        fontSize: 140,
        fontFamily: "Inter",
        fill: "#f7c600",
        width: 880,
        align: "left",
      },
      {
        id: "r1",
        name: "CTA Box",
        type: "rect",
        x: 100,
        y: 1480,
        width: 880,
        height: 320,
        fill: "rgba(0,0,0,0.35)",
        cornerRadius: 32,
      },
      {
        id: "t2",
        name: "CTA",
        type: "text",
        x: 140,
        y: 1540,
        text: "Escribe tu prompt\ny genera tu diseño.",
        fontSize: 58,
        fontFamily: "Inter",
        fill: "#ffffff",
        width: 800,
        align: "left",
      },
    ],
  },
  {
    id: "fb_cover",
    title: "Facebook Cover",
    width: 820,
    height: 312,
    background: "#0b0b0c",
    nodes: [
      {
        id: "t1",
        name: "Título",
        type: "text",
        x: 40,
        y: 60,
        text: "AUREA 33 STUDIO",
        fontSize: 54,
        fontFamily: "Inter",
        fill: "#f7c600",
        width: 740,
        align: "left",
      },
      {
        id: "t2",
        name: "Sub",
        type: "text",
        x: 40,
        y: 140,
        text: "Diseños tipo Adobe/Canva pero con IA.",
        fontSize: 28,
        fontFamily: "Inter",
        fill: "#ffffff",
        width: 740,
        align: "left",
      },
    ],
  },
];

/* ----------------------------- component ----------------------------- */

export default function StudioCanvas({ studio, onChange, compact }) {
  const safeStudio = useMemo(() => {
    return {
      meta: studio?.meta || { activeDocId: null, lastTemplate: null },
      docs: Array.isArray(studio?.docs) ? studio.docs : [],
    };
  }, [studio]);

  const { meta, docs } = safeStudio;

  const activeDoc = useMemo(() => {
    const id = meta?.activeDocId;
    if (id) {
      const hit = docs.find((d) => d.id === id);
      if (hit) return hit;
    }
    return docs[0] || null;
  }, [docs, meta]);

  function emit(nextStudio) {
    onChange?.(nextStudio);
  }

  function setActiveDocId(id) {
    emit({ ...safeStudio, meta: { ...meta, activeDocId: id } });
  }

  function createFromTemplate(tpl) {
    const doc = makeDocFromTemplate(tpl);
    emit({
      ...safeStudio,
      docs: [doc, ...docs],
      meta: { ...meta, activeDocId: doc.id, lastTemplate: tpl.id },
    });
  }

  function patchActiveDoc(nextDoc) {
    const nextDocs = docs.map((d) => (d.id === nextDoc.id ? nextDoc : d));
    emit({ ...safeStudio, docs: nextDocs, meta: { ...meta, activeDocId: nextDoc.id } });
  }

  const sidebarStyle = {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 12,
    overflow: "auto",
    background: "rgba(20,20,22,0.55)",
    backdropFilter: "blur(14px)",
  };

  const sectionTitle = {
    fontWeight: 900,
    marginBottom: 10,
    letterSpacing: 0.3,
  };

  const itemBtn = (active) => ({
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(247,198,0,0.18)" : "rgba(255,255,255,0.06)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: active ? 900 : 800,
    opacity: active ? 1 : 0.9,
  });

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: compact ? "240px 1fr" : "280px 1fr", gap: 10 }}>
      {/* Sidebar */}
      <aside style={sidebarStyle}>
        <div style={sectionTitle}>Plantillas</div>
        <div style={{ display: "grid", gap: 8 }}>
          {TEMPLATES.map((t) => (
            <button key={t.id} style={itemBtn(false)} onClick={() => createFromTemplate(t)}>
              {t.title} <span style={{ opacity: 0.7 }}>• {t.width}×{t.height}</span>
            </button>
          ))}
        </div>

        <div style={{ height: 16 }} />

        <div style={sectionTitle}>Mis diseños</div>
        {docs.length === 0 ? (
          <div style={{ opacity: 0.75, lineHeight: 1.4 }}>
            Aún no tienes diseños.
            <br />
            Crea uno desde una plantilla.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {docs.map((d) => (
              <button
                key={d.id}
                style={itemBtn(d.id === activeDoc?.id)}
                onClick={() => setActiveDocId(d.id)}
              >
                {d.title || "Diseño"} <span style={{ opacity: 0.7 }}>• {d.width}×{d.height}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Editor */}
      <main style={{ minHeight: 0, overflow: "hidden" }}>
        {activeDoc ? (
          <CanvasEditor doc={activeDoc} onChange={patchActiveDoc} compact={compact} />
        ) : (
          <div style={{ padding: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>AUREA STUDIO</div>
            <div style={{ opacity: 0.75 }}>Selecciona una plantilla para comenzar.</div>
          </div>
        )}
      </main>
    </div>
  );
}
