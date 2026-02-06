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

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** normalizeDoc = “seguro anti-bugs”
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
      ...meta,
      w,
      h,
      bg: safeStr(meta.bg, "#0B1220"),
      zoom: clamp(safeNum(meta.zoom, 1), 0.1, 4),
      panX: safeNum(meta.panX, 0),
      panY: safeNum(meta.panY, 0),
      presetKey: safeStr(meta.presetKey, ""),
    },
    nodes: Array.isArray(input.nodes) ? input.nodes : [],
    selectedId: typeof input.selectedId === "string" ? input.selectedId : null,
  };
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

/* ----------------------------- UI helpers ----------------------------- */

function PillButton({ active, children, onClick, title, className = "" }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-xl text-xs border transition select-none",
        "shadow-[0_14px_35px_rgba(0,0,0,.35)] backdrop-blur-md",
        active
          ? "bg-emerald-500/12 border-emerald-400/25 text-emerald-100"
          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function IconRailButton({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex flex-col items-center justify-center gap-2 py-3 rounded-2xl border transition",
        active ? "bg-white/10 border-white/20" : "bg-black/10 border-white/10 hover:bg-white/5",
      ].join(" ")}
      title={label}
    >
      <div className="text-white/90 text-lg leading-none">{icon}</div>
      <div className="text-[11px] text-white/70">{label}</div>
    </button>
  );
}

/* ----------------------------- Component ----------------------------- */

export default function CanvasEditor({
  doc,
  onChange,
  templates = TEMPLATES,
  onNewFromTemplate,
  onDuplicate,
  compact = false,
}) {
  const externalDoc = doc || null;

  // Local doc (single source for editor)
  const [localDoc, setLocalDoc] = useState(() => normalizeDoc(externalDoc));

  // Undo/Redo stacks
  const undoRef = useRef([]);
  const redoRef = useRef([]);

  // NEW: Canva-like navigation
  const [activeTool, setActiveTool] = useState("design"); // design | elements | text | uploads | brand | apps
  const [leftOpen, setLeftOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(false); // floating properties panel
  const [propsMin, setPropsMin] = useState(false);
  const [zen, setZen] = useState(false);

  // Keep local doc in sync when doc changes from outside
  useEffect(() => {
    const next = normalizeDoc(externalDoc);
    setLocalDoc(next);
    undoRef.current = [];
    redoRef.current = [];
  }, [externalDoc?.meta?.presetKey, externalDoc?.meta?.w, externalDoc?.meta?.h]);

  const hasDoc = !!localDoc;
  const shellClass = compact ? "h-[70vh]" : "h-[78vh]";

  /** commit = normaliza siempre + undo/redo */
  const commit = useCallback(
    (nextDoc, opts = {}) => {
      const normalized = normalizeDoc(nextDoc);

      if (!normalized) {
        setLocalDoc(null);
        onChange?.(null);
        return;
      }

      setLocalDoc((prev) => {
        if (!opts.silent && prev) {
          undoRef.current.push(prev);
          if (undoRef.current.length > 80) undoRef.current.shift();
          redoRef.current = [];
        }
        return normalized;
      });

      onChange?.(normalized);
    },
    [onChange]
  );

  const undo = useCallback(() => {
    const stack = undoRef.current;
    if (!stack.length) return;

    setLocalDoc((cur) => {
      if (cur) redoRef.current.push(cur);
      const prev = stack.pop();
      onChange?.(prev);
      return prev;
    });
  }, [onChange]);

  const redo = useCallback(() => {
    const stack = redoRef.current;
    if (!stack.length) return;

    setLocalDoc((cur) => {
      if (cur) undoRef.current.push(cur);
      const next = stack.pop();
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  // Keyboard shortcuts:
  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Y redo, Ctrl/Cmd+Shift+Z redo
  // Ctrl/Cmd+\ Zen
  // Ctrl/Cmd+1..4 tools
  useEffect(() => {
    const onKeyDown = (ev) => {
      const isMod = ev.ctrlKey || ev.metaKey;
      if (!isMod) return;

      const k = ev.key.toLowerCase();

      if (k === "z" && !ev.shiftKey) {
        ev.preventDefault();
        undo();
        return;
      }
      if ((k === "z" && ev.shiftKey) || k === "y") {
        ev.preventDefault();
        redo();
        return;
      }
      if (ev.key === "\\") {
        ev.preventDefault();
        setZen((v) => !v);
        return;
      }
      if (k === "1") {
        ev.preventDefault();
        setLeftOpen(true);
        setActiveTool("design");
        return;
      }
      if (k === "2") {
        ev.preventDefault();
        setLeftOpen(true);
        setActiveTool("elements");
        return;
      }
      if (k === "3") {
        ev.preventDefault();
        setLeftOpen(true);
        setActiveTool("text");
        return;
      }
      if (k === "4") {
        ev.preventDefault();
        setPropsOpen(true);
        setPropsMin(false);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* ----------------------------- Layout ----------------------------- */

  return (
    <div className={`w-full ${shellClass} flex gap-4`}>
      {/* LEFT: Icon Rail + Panel (Canva-like) */}
      {!zen && (
        <div className="flex gap-3">
          {/* Rail */}
          <div className="w-[88px] shrink-0 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-2">
            <div className="space-y-2">
              <IconRailButton
                active={activeTool === "design"}
                label="Diseño"
                icon="▦"
                onClick={() => {
                  setActiveTool("design");
                  setLeftOpen(true);
                }}
              />
              <IconRailButton
                active={activeTool === "elements"}
                label="Elementos"
                icon="⬡"
                onClick={() => {
                  setActiveTool("elements");
                  setLeftOpen(true);
                }}
              />
              <IconRailButton
                active={activeTool === "text"}
                label="Texto"
                icon="T"
                onClick={() => {
                  setActiveTool("text");
                  setLeftOpen(true);
                }}
              />
              <IconRailButton
                active={activeTool === "uploads"}
                label="Subidos"
                icon="⇪"
                onClick={() => {
                  setActiveTool("uploads");
                  setLeftOpen(true);
                }}
              />
              <IconRailButton
                active={activeTool === "brand"}
                label="Marca"
                icon="♥"
                onClick={() => {
                  setActiveTool("brand");
                  setLeftOpen(true);
                }}
              />
              <IconRailButton
                active={activeTool === "apps"}
                label="Apps"
                icon="⌁"
                onClick={() => {
                  setActiveTool("apps");
                  setLeftOpen(true);
                }}
              />
              <div className="h-px bg-white/10 my-2" />
              <IconRailButton
                active={propsOpen}
                label="Props"
                icon="⚙"
                onClick={() => {
                  setPropsOpen(true);
                  setPropsMin(false);
                }}
              />
            </div>

            <div className="mt-3">
              <PillButton
                active={leftOpen}
                onClick={() => setLeftOpen((v) => !v)}
                title="Mostrar/Ocultar panel izquierdo"
                className="w-full justify-center"
              >
                {leftOpen ? "Ocultar" : "Panel"}
              </PillButton>
            </div>
          </div>

          {/* Panel */}
          {leftOpen && (
            <div className="w-[340px] shrink-0 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-white font-semibold">
                    {activeTool === "design" && "Plantillas"}
                    {activeTool === "elements" && "Elementos"}
                    {activeTool === "text" && "Texto"}
                    {activeTool === "uploads" && "Subidos"}
                    {activeTool === "brand" && "Marca"}
                    {activeTool === "apps" && "Apps"}
                  </div>
                  <div className="text-white/50 text-xs">
                    {activeTool === "design" && "Elige un formato para iniciar"}
                    {activeTool !== "design" && "Preview UI (funciones en camino)"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
                    onClick={() => {
                      setLocalDoc(null);
                      undoRef.current = [];
                      redoRef.current = [];
                      onChange?.(null);
                    }}
                    title="Reset documento"
                  >
                    Reset
                  </button>

                  <button
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/20 hover:bg-emerald-500/25 text-emerald-100 text-xs"
                    onClick={() => {
                      setPropsOpen(true);
                      setPropsMin(false);
                    }}
                    title="Abrir Propiedades"
                  >
                    Propiedades
                  </button>
                </div>
              </div>

              {/* DESIGN */}
              {activeTool === "design" && (
                <div className="space-y-2">
                  {(templates || []).map((t) => (
                    <button
                      key={t.id}
                      className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-3"
                      onClick={() => {
                        const next = makeEmptyDoc(t);
                        undoRef.current = [];
                        redoRef.current = [];
                        commit(next, { silent: true });
                        onNewFromTemplate?.(t);
                      }}
                    >
                      <div className="text-white font-medium">{t.title}</div>
                      <div className="text-white/60 text-xs">{t.subtitle}</div>
                    </button>
                  ))}

                  <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-white/5 to-white/0 border border-white/10">
                    <div className="text-white font-semibold text-sm">Mis diseños</div>
                    <div className="text-white/50 text-xs">(Luego conectamos historial por proyecto)</div>
                    <div className="mt-3 text-white/40 text-[11px]">
                      Atajos: <span className="text-white/60">Ctrl/Cmd+Z</span> Undo •{" "}
                      <span className="text-white/60">Ctrl/Cmd+Y</span> Redo •{" "}
                      <span className="text-white/60">Ctrl/Cmd+\\</span> Zen
                    </div>
                  </div>
                </div>
              )}

              {/* ELEMENTS (preview UI) */}
              {activeTool === "elements" && (
                <div className="space-y-2">
                  <PreviewCard title="Formas" desc="Cuadros, círculos, líneas, stickers (próximamente)" />
                  <PreviewCard title="Íconos" desc="Pack premium de íconos (próximamente)" />
                  <PreviewCard title="Frames" desc="Marcos para fotos y promos (próximamente)" />
                  <PreviewCard title="Decoración" desc="HUD, glow, partículas (próximamente)" />
                </div>
              )}

              {/* TEXT (preview UI) */}
              {activeTool === "text" && (
                <div className="space-y-2">
                  <button
                    className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-3"
                    onClick={() => {
                      if (!hasDoc) return;
                      const id = uid();
                      const next = {
                        ...localDoc,
                        nodes: [
                          ...localDoc.nodes,
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
                      commit(next);
                    }}
                  >
                    <div className="text-white font-medium">+ Agregar texto</div>
                    <div className="text-white/60 text-xs">Crea un bloque de texto editable</div>
                  </button>

                  <PreviewCard title="Estilos" desc="Titulares, subtítulos, presets (próximamente)" />
                </div>
              )}

              {/* UPLOADS (preview UI) */}
              {activeTool === "uploads" && (
                <div className="space-y-2">
                  <PreviewCard title="Subir imagen" desc="Drag & drop + librería (próximamente)" />
                  <PreviewCard title="Mis assets" desc="Por proyecto/cliente (próximamente)" />
                </div>
              )}

              {/* BRAND (preview UI) */}
              {activeTool === "brand" && (
                <div className="space-y-2">
                  <PreviewCard title="Kit de marca" desc="Colores, logos, fuentes (próximamente)" />
                  <PreviewCard title="Presets Aurea" desc="Oro/negro premium (próximamente)" />
                </div>
              )}

              {/* APPS (preview UI) */}
              {activeTool === "apps" && (
                <div className="space-y-2">
                  <PreviewCard title="Generar layout IA" desc="Auto-layout + grids (próximamente)" />
                  <PreviewCard title="Remove BG" desc="Quitar fondo en 1 click (próximamente)" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MAIN CANVAS */}
      <div className="flex-1 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden relative">
        {/* Top HUD (hide in Zen) */}
        {!zen && (
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2">
              <PillButton onClick={undo} title="Undo (Ctrl/Cmd+Z)">
                Undo
              </PillButton>
              <PillButton onClick={redo} title="Redo (Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z)">
                Redo
              </PillButton>

              <div className="w-px h-7 bg-white/10 mx-1" />

              <PillButton
                active={zen}
                onClick={() => setZen((v) => !v)}
                title="Zen (Ctrl/Cmd+\\)"
              >
                Zen
              </PillButton>

              <PillButton
                onClick={() => setLeftOpen((v) => !v)}
                title="Mostrar/Ocultar panel izquierdo"
              >
                {leftOpen ? "Ocultar panel" : "Mostrar panel"}
              </PillButton>

              <PillButton
                active={propsOpen}
                onClick={() => {
                  setPropsOpen(true);
                  setPropsMin(false);
                }}
                title="Abrir Propiedades (Ctrl/Cmd+4)"
              >
                Propiedades
              </PillButton>
            </div>

            {hasDoc ? (
              <div className="pointer-events-none text-white/70 text-xs px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                {localDoc.meta.w}×{localDoc.meta.h} • zoom {localDoc.meta.zoom?.toFixed?.(2) ?? "—"}
              </div>
            ) : null}
          </div>
        )}

        {!hasDoc ? (
          <EmptyState />
        ) : (
          <StudioCanvas doc={localDoc} onChange={commit} compact={compact || zen} />
        )}

        {/* FLOATING PROPERTIES PANEL */}
        {propsOpen && !zen && (
          <div className="absolute right-4 top-16 z-20 w-[340px]">
            <div className="rounded-2xl border border-white/10 bg-black/45 backdrop-blur-xl shadow-[0_22px_70px_rgba(0,0,0,.55)] overflow-hidden">
              {/* header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <div className="text-white/90 text-sm font-semibold">Propiedades</div>
                  <div className="text-white/40 text-[11px]">Editar capas y estilos</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px]"
                    onClick={() => setPropsMin((v) => !v)}
                    title="Minimizar"
                  >
                    {propsMin ? "Max" : "Min"}
                  </button>
                  <button
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px]"
                    onClick={() => setPropsOpen(false)}
                    title="Cerrar"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* body */}
              {!propsMin && (
                <div className="p-3">
                  {!localDoc ? (
                    <div className="text-white/50 text-sm">Crea un documento para editar propiedades.</div>
                  ) : (
                    <Inspector doc={localDoc} onChange={commit} />
                  )}
                </div>
              )}

              {propsMin && (
                <div className="p-3 text-white/60 text-sm">
                  Panel minimizado. (Click “Max” para abrir)
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Small Components ----------------------------- */

function PreviewCard({ title, desc }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-white font-medium">{title}</div>
      <div className="text-white/55 text-xs mt-1">{desc}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="text-white text-xl font-semibold">AUREA STUDIO</div>
        <div className="text-white/60 text-sm mt-1">Abre “Diseño” y elige un formato.</div>
        <div className="text-white/35 text-xs mt-2">Atajo: Ctrl/Cmd+\\ Zen</div>
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
    <div className="space-y-3">
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

      {/* Capas */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="text-white/70 text-xs">Capas</div>
          <div className="text-white/40 text-[11px]">{doc.nodes.length}</div>
        </div>

        <div className="mt-2 space-y-1 max-h-[240px] overflow-auto pr-1">
          {doc.nodes.slice().map((n, idx) => {
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
                      onChange={(e) => patchSelected({ cornerRadius: Number(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs">Rotación</label>
                    <input
                      type="number"
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                      value={selected.rotation || 0}
                      onChange={(e) => patchSelected({ rotation: Number(e.target.value) || 0 })}
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
