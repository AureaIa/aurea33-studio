"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import StudioCanvas from "./StudioCanvas";

/* ----------------------------- Plantillas ----------------------------- */

const TEMPLATES = [
  { id: "ig-post", title: "Instagram Post", subtitle: "1080×1080", w: 1080, h: 1080, bg: "#0B1220", presetKey: "ig_post" },
  { id: "ig-story", title: "Instagram Story", subtitle: "1080×1920", w: 1080, h: 1920, bg: "#0B1220", presetKey: "ig_story" },
  { id: "fb-cover", title: "Facebook Cover", subtitle: "820×312", w: 820, h: 312, bg: "#0B1220", presetKey: "fb_cover" },
];

/* ----------------------------- Utils ----------------------------- */

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeNum(x, fallback) {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

function safeStr(x, fallback) {
  return typeof x === "string" && x.length ? x : fallback;
}

/** normalizeDoc = tu “seguro anti-bugs”
 *  - NO deja que w/h regresen a undefined/0
 *  - conserva presetKey si existe
 *  - asegura campos base en meta
 */
function normalizeDoc(input) {
  if (!input) return null;

  const meta = input.meta || {};
  const w = Math.max(64, safeNum(meta.w, 1080));
  const h = Math.max(64, safeNum(meta.h, 1080));

  return {
    ...input,
    meta: {
      w,
      h,
      bg: safeStr(meta.bg, "#0B1220"),
      zoom: clamp(safeNum(meta.zoom, 1), 0.1, 4),
      panX: safeNum(meta.panX, 0),
      panY: safeNum(meta.panY, 0),
      presetKey: safeStr(meta.presetKey, ""), // StudioCanvas lo usará si existe
    },
    nodes: Array.isArray(input.nodes) ? input.nodes : [],
    selectedId: safeStr(input.selectedId, null),
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function makeEmptyDoc({ w, h, bg, presetKey }) {
  return normalizeDoc({
    meta: {
      w,
      h,
      bg: bg || "#0B1220",
      zoom: 1,
      panX: 0,
      panY: 0,
      presetKey: presetKey || "",
    },
    nodes: [
      {
        id: uid(),
        type: "text",
        x: 80,
        y: 90,
        text: "AUREA 33 STUDIO",
        fontSize: 72,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
        fill: "#E9EEF9",
        draggable: true,
      },
      {
        id: uid(),
        type: "text",
        x: 84,
        y: 180,
        text: "Canvas persistente PRO",
        fontSize: 34,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
        fill: "rgba(233,238,249,0.78)",
        draggable: true,
      },
    ],
    selectedId: null,
  });
}

/* ----------------------------- Component ----------------------------- */

export default function CanvasEditor({ studio, onChange, compact = false }) {
  const externalDoc = studio?.doc || null;

  // Local doc (single source for editor)
  const [localDoc, setLocalDoc] = useState(() => normalizeDoc(externalDoc));

  // Undo/Redo stacks (Paso 4 adelantado 🔥)
  const undoRef = useRef([]);
  const redoRef = useRef([]);

  // Keep local doc in sync when studio.doc changes from outside
  useEffect(() => {
    setLocalDoc(normalizeDoc(externalDoc));
    // resetea stacks cuando cambias de proyecto/doc externo
    undoRef.current = [];
    redoRef.current = [];
  }, [externalDoc]);

  const hasDoc = !!localDoc;

  const shellClass = compact ? "h-[70vh]" : "h-[78vh]";

  /** commit = aquí es donde “se podía romper” meta.w/h
   *  -> ahora normaliza siempre
   *  -> y alimenta undo/redo con throttling básico
   */
  const commit = useCallback(
    (nextDoc, opts = {}) => {
      const normalized = normalizeDoc(nextDoc);

      setLocalDoc((prev) => {
        // push undo si no es “silent”
        if (!opts.silent && prev && normalized) {
          undoRef.current.push(prev);
          // limita memoria (pro)
          if (undoRef.current.length > 80) undoRef.current.shift();
          // limpiar redo cuando haces un cambio nuevo
          redoRef.current = [];
        }
        return normalized;
      });

      onChange?.({ ...(studio || {}), doc: normalized });
    },
    [onChange, studio]
  );

  const undo = useCallback(() => {
    const stack = undoRef.current;
    if (!stack.length) return;

    setLocalDoc((cur) => {
      if (cur) redoRef.current.push(cur);
      const prev = stack.pop();
      onChange?.({ ...(studio || {}), doc: prev });
      return prev;
    });
  }, [onChange, studio]);

  const redo = useCallback(() => {
    const stack = redoRef.current;
    if (!stack.length) return;

    setLocalDoc((cur) => {
      if (cur) undoRef.current.push(cur);
      const next = stack.pop();
      onChange?.({ ...(studio || {}), doc: next });
      return next;
    });
  }, [onChange, studio]);

  // Keyboard shortcuts: Ctrl/Cmd+Z / Shift+Z / Y
  useEffect(() => {
    const onKeyDown = (ev) => {
      const isMod = ev.ctrlKey || ev.metaKey;
      if (!isMod) return;

      const k = ev.key.toLowerCase();

      if (k === "z" && !ev.shiftKey) {
        ev.preventDefault();
        undo();
      } else if ((k === "z" && ev.shiftKey) || k === "y") {
        ev.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  return (
    <div className={`w-full ${shellClass} flex gap-4`}>
      {/* ---------------- Left Sidebar ---------------- */}
      <LeftSidebar
        compact={compact}
        hasDoc={hasDoc}
        onReset={() => {
          // reset completo
          setLocalDoc(null);
          undoRef.current = [];
          redoRef.current = [];
          onChange?.({ ...(studio || {}), doc: null });
        }}
        onCreateFromTemplate={(t) => {
          const next = makeEmptyDoc(t);
          undoRef.current = [];
          redoRef.current = [];
          commit(next, { silent: true });
        }}
      />

      {/* ---------------- Main Canvas Area ---------------- */}
      <div className="flex-1 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden relative">
        {/* Top HUD mini (futurista + útil) */}
        <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs shadow-[0_14px_35px_rgba(0,0,0,.35)] backdrop-blur-md"
              onClick={undo}
              disabled={!undoRef.current.length}
              title="Undo (Ctrl/Cmd+Z)"
            >
              Undo
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs shadow-[0_14px_35px_rgba(0,0,0,.35)] backdrop-blur-md"
              onClick={redo}
              disabled={!redoRef.current.length}
              title="Redo (Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z)"
            >
              Redo
            </button>
          </div>

          {hasDoc ? (
            <div className="pointer-events-none text-white/70 text-xs px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              {localDoc.meta.w}×{localDoc.meta.h} • zoom {localDoc.meta.zoom?.toFixed?.(2) ?? "—"}
            </div>
          ) : null}
        </div>

        {!hasDoc ? (
          <EmptyState />
        ) : (
          <StudioCanvas doc={localDoc} onChange={commit} compact={compact} />
        )}
      </div>

      {/* ---------------- Right Inspector ---------------- */}
      <RightPanel doc={localDoc} onChange={commit} onUndo={undo} onRedo={redo} />
    </div>
  );
}

/* ----------------------------- Left Sidebar ----------------------------- */

function LeftSidebar({ compact, hasDoc, onReset, onCreateFromTemplate }) {
  return (
    <div className="w-[320px] shrink-0 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-white font-semibold">Plantillas</div>
          <div className="text-white/50 text-xs">Click para iniciar un documento</div>
        </div>

        <button
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
          onClick={onReset}
          title="Reset documento"
        >
          Reset
        </button>
      </div>

      <div className="space-y-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-3"
            onClick={() => onCreateFromTemplate(t)}
          >
            <div className="text-white font-medium">{t.title}</div>
            <div className="text-white/60 text-xs">{t.subtitle}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-white/5 to-white/0 border border-white/10">
        <div className="text-white font-semibold text-sm">Mis diseños</div>
        <div className="text-white/50 text-xs">(Luego conectamos historial por proyecto)</div>

        <div className="mt-3 text-white/40 text-[11px]">
          Atajos: <span className="text-white/60">Ctrl/Cmd+Z</span> Undo •{" "}
          <span className="text-white/60">Ctrl/Cmd+Y</span> Redo
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- EmptyState ----------------------------- */

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="text-white text-xl font-semibold">AUREA STUDIO</div>
        <div className="text-white/60 text-sm mt-1">Selecciona una plantilla para comenzar.</div>
      </div>
    </div>
  );
}

/* ----------------------------- Right Panel (Inspector + Layers) ----------------------------- */

function RightPanel({ doc, onChange, onUndo, onRedo }) {
  return (
    <div className="w-[320px] shrink-0 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-3">
      <div className="flex items-center justify-between">
        <div className="text-white font-semibold">Inspector</div>

        <div className="flex gap-2">
          <button
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px]"
            onClick={onUndo}
            title="Undo"
          >
            ⟲
          </button>
          <button
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px]"
            onClick={onRedo}
            title="Redo"
          >
            ⟳
          </button>
        </div>
      </div>

      {!doc ? (
        <div className="text-white/50 text-sm mt-3">Crea un documento para editar propiedades.</div>
      ) : (
        <Inspector doc={doc} onChange={onChange} />
      )}
    </div>
  );
}

/* ----------------------------- Inspector ----------------------------- */

function Inspector({ doc, onChange }) {
  const selected = useMemo(() => {
    if (!doc?.selectedId) return null;
    return doc.nodes.find((n) => n.id === doc.selectedId) || null;
  }, [doc]);

  const patchDoc = useCallback(
    (patch) => {
      onChange({ ...doc, ...patch });
    },
    [doc, onChange]
  );

  function patchSelected(patch) {
    if (!selected) return;
    const next = {
      ...doc,
      nodes: doc.nodes.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)),
    };
    onChange(next);
  }

  const bringToFront = () => {
    if (!selected) return;
    const rest = doc.nodes.filter((n) => n.id !== selected.id);
    patchDoc({ nodes: [...rest, selected] });
  };

  const sendToBack = () => {
    if (!selected) return;
    const rest = doc.nodes.filter((n) => n.id !== selected.id);
    patchDoc({ nodes: [selected, ...rest] });
  };

  const duplicate = () => {
    if (!selected) return;
    const copy = { ...selected, id: uid(), x: (selected.x || 0) + 24, y: (selected.y || 0) + 24 };
    patchDoc({ nodes: [...doc.nodes, copy], selectedId: copy.id });
  };

  const deleteSelected = () => {
    if (!selected) return;
    patchDoc({ nodes: doc.nodes.filter((n) => n.id !== selected.id), selectedId: null });
  };

  return (
    <div className="space-y-3 mt-3">
      {/* Documento */}
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
                    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
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

      {/* Layers (Paso 4 adelantado) */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="text-white/70 text-xs">Capas</div>
          <div className="text-white/40 text-[11px]">{doc.nodes.length}</div>
        </div>

        <div className="mt-2 space-y-1 max-h-[240px] overflow-auto pr-1">
          {doc.nodes
            .slice()
            .map((n, idx) => {
              const isSel = doc.selectedId === n.id;
              const label =
                n.type === "text"
                  ? (n.text || "Texto").slice(0, 18)
                  : n.type === "rect"
                  ? "Shape"
                  : n.type;

              return (
                <button
                  key={n.id}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2 border transition ${
                    isSel
                      ? "bg-sky-500/10 border-sky-400/30 text-white"
                      : "bg-black/20 border-white/10 text-white/80 hover:bg-white/5"
                  }`}
                  onClick={() => onChange({ ...doc, selectedId: n.id })}
                  title={label}
                >
                  <div className="text-xs flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px]">
                      {n.type}
                    </span>
                    <span className="truncate max-w-[160px]">{label}</span>
                  </div>
                  <div className="text-[10px] text-white/40">#{idx + 1}</div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Selección */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-white/70 text-xs">Selección</div>

        {!selected ? (
          <div className="text-white/50 text-sm mt-2">Haz click en un elemento del canvas.</div>
        ) : (
          <div className="space-y-2 mt-2">
            <div className="text-white text-sm">
              Tipo: <span className="text-white/70">{selected.type}</span>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
                onClick={bringToFront}
              >
                Frente
              </button>
              <button
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
                onClick={sendToBack}
              >
                Atrás
              </button>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
                onClick={duplicate}
              >
                Duplicar
              </button>
              <button
                className="flex-1 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 text-xs"
                onClick={deleteSelected}
              >
                Eliminar
              </button>
            </div>

            {selected.type === "text" && (
              <>
                <label className="block text-white/60 text-xs mt-2">Texto</label>
                <input
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                  value={selected.text || ""}
                  onChange={(e) => patchSelected({ text: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-white/60 text-xs">Tamaño</label>
                    <input
                      type="number"
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                      value={selected.fontSize || 32}
                      onChange={(e) => patchSelected({ fontSize: Number(e.target.value) || 32 })}
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs">Color</label>
                    <input
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                      value={selected.fill || "#E9EEF9"}
                      onChange={(e) => patchSelected({ fill: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {selected.type === "rect" && (
              <>
                <label className="block text-white/60 text-xs mt-2">Color</label>
                <input
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                  value={selected.fill || "#2B3A67"}
                  onChange={(e) => patchSelected({ fill: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-white/60 text-xs">Radius</label>
                    <input
                      type="number"
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                      value={selected.cornerRadius || 0}
                      onChange={(e) =>
                        patchSelected({ cornerRadius: Number(e.target.value) || 0 })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs">Rotación</label>
                    <input
                      type="number"
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                      value={selected.rotation || 0}
                      onChange={(e) =>
                        patchSelected({ rotation: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
