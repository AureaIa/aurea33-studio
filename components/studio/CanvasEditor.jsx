"use client";

import React, { useEffect, useMemo, useState } from "react";
import StudioCanvas from "./StudioCanvas";

/* ----------------------------- Plantillas ----------------------------- */

const TEMPLATES = [
  {
    id: "ig-post",
    title: "Instagram Post",
    subtitle: "1080×1080",
    w: 1080,
    h: 1080,
    bg: "#0B1220",
  },
  {
    id: "ig-story",
    title: "Instagram Story",
    subtitle: "1080×1920",
    w: 1080,
    h: 1920,
    bg: "#0B1220",
  },
  {
    id: "fb-cover",
    title: "Facebook Cover",
    subtitle: "820×312",
    w: 820,
    h: 312,
    bg: "#0B1220",
  },
];

/* ----------------------------- Helpers ----------------------------- */

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeEmptyDoc({ w, h, bg }) {
  return {
    meta: {
      w,
      h,
      bg: bg || "#0B1220",
      zoom: 0.75,
      panX: 0,
      panY: 0,
    },
    nodes: [
      // puedes arrancar con un headline para que se sienta “pro”
      {
        id: uid(),
        type: "text",
        x: 80,
        y: 80,
        text: "AUREA 33 STUDIO",
        fontSize: 72,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
        fill: "#E9EEF9",
        draggable: true,
      },
    ],
    selectedId: null,
  };
}

/* ----------------------------- Component ----------------------------- */

export default function CanvasEditor({ studio, onChange, compact = false }) {
  const doc = studio?.doc || null;

  // si no existe doc aún, muestra “selecciona plantilla”
  const [localDoc, setLocalDoc] = useState(doc);

  useEffect(() => {
    setLocalDoc(doc || null);
  }, [doc]);

  function commit(nextDoc) {
    setLocalDoc(nextDoc);
    onChange?.({ ...(studio || {}), doc: nextDoc });
  }

  const hasDoc = !!localDoc;

  const shellClass = compact
    ? "h-[70vh]"
    : "h-[78vh]";

  return (
    <div className={`w-full ${shellClass} flex gap-4`}>
      {/* ---------------- Left Sidebar ---------------- */}
      <div className="w-[320px] shrink-0 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-white font-semibold">Plantillas</div>
            <div className="text-white/50 text-xs">
              Click para iniciar un documento
            </div>
          </div>

          <button
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
            onClick={() => {
              // reset
              commit(null);
              onChange?.({ ...(studio || {}), doc: null });
            }}
            title="Volver a seleccionar plantilla"
          >
            Reset
          </button>
        </div>

        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-3"
              onClick={() => {
                const next = makeEmptyDoc(t);
                commit(next);
              }}
            >
              <div className="text-white font-medium">{t.title}</div>
              <div className="text-white/60 text-xs">{t.subtitle}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-white/5 to-white/0 border border-white/10">
          <div className="text-white font-semibold text-sm">Mis diseños</div>
          <div className="text-white/50 text-xs">
            (Aquí luego conectamos historial por proyecto)
          </div>
        </div>
      </div>

      {/* ---------------- Main Canvas Area ---------------- */}
      <div className="flex-1 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden">
        {!hasDoc ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-white text-xl font-semibold">
                AUREA STUDIO
              </div>
              <div className="text-white/60 text-sm mt-1">
                Selecciona una plantilla para comenzar.
              </div>
            </div>
          </div>
        ) : (
          <StudioCanvas
            doc={localDoc}
            onChange={commit}
            compact={compact}
          />
        )}
      </div>

      {/* ---------------- Right Inspector ---------------- */}
      <div className="w-[320px] shrink-0 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-3">
        <div className="text-white font-semibold mb-2">Inspector</div>

        {!hasDoc ? (
          <div className="text-white/50 text-sm">
            Crea un documento para editar propiedades.
          </div>
        ) : (
          <Inspector doc={localDoc} onChange={commit} />
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Inspector ----------------------------- */

function Inspector({ doc, onChange }) {
  const selected = useMemo(() => {
    if (!doc?.selectedId) return null;
    return doc.nodes.find((n) => n.id === doc.selectedId) || null;
  }, [doc]);

  function patchSelected(patch) {
    if (!selected) return;
    const next = {
      ...doc,
      nodes: doc.nodes.map((n) =>
        n.id === selected.id ? { ...n, ...patch } : n
      ),
    };
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-white/70 text-xs">Documento</div>
        <div className="text-white text-sm mt-1">
          {doc.meta.w}×{doc.meta.h}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
            onClick={() => {
              const id = uid();
              const next = {
                ...doc,
                nodes: [
                  ...doc.nodes,
                  {
                    id,
                    type: "text",
                    x: 120,
                    y: 120,
                    text: "Texto nuevo",
                    fontSize: 44,
                    fontFamily:
                      "Inter, system-ui, -apple-system, Segoe UI, Roboto",
                    fill: "#E9EEF9",
                    draggable: true,
                  },
                ],
                selectedId: id,
              };
              onChange(next);
            }}
          >
            + Texto
          </button>

          <button
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
            onClick={() => {
              const id = uid();
              const next = {
                ...doc,
                nodes: [
                  ...doc.nodes,
                  {
                    id,
                    type: "rect",
                    x: 140,
                    y: 180,
                    width: 320,
                    height: 180,
                    fill: "#2B3A67",
                    cornerRadius: 24,
                    draggable: true,
                  },
                ],
                selectedId: id,
              };
              onChange(next);
            }}
          >
            + Shape
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-white/70 text-xs">Selección</div>

        {!selected ? (
          <div className="text-white/50 text-sm mt-2">
            Haz click en un elemento del canvas.
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            <div className="text-white text-sm">
              Tipo: <span className="text-white/70">{selected.type}</span>
            </div>

            {selected.type === "text" && (
              <>
                <label className="block text-white/60 text-xs">Texto</label>
                <input
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                  value={selected.text || ""}
                  onChange={(e) => patchSelected({ text: e.target.value })}
                />

                <label className="block text-white/60 text-xs mt-2">
                  Tamaño
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                  value={selected.fontSize || 32}
                  onChange={(e) =>
                    patchSelected({ fontSize: Number(e.target.value) || 32 })
                  }
                />
              </>
            )}

            {selected.type === "rect" && (
              <>
                <label className="block text-white/60 text-xs">Color</label>
                <input
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                  value={selected.fill || "#2B3A67"}
                  onChange={(e) => patchSelected({ fill: e.target.value })}
                />
              </>
            )}

            <button
              className="w-full mt-2 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 text-xs"
              onClick={() => {
                const next = {
                  ...doc,
                  nodes: doc.nodes.filter((n) => n.id !== selected.id),
                  selectedId: null,
                };
                onChange(next);
              }}
            >
              Eliminar elemento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
