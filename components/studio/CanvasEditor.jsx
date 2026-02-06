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

/** normalizeDoc = tu “seguro anti-bugs” */
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

/* ----------------------------- Premium UI atoms ----------------------------- */

function Icon({ children }) {
  return (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
      {children}
    </span>
  );
}

function GlassBtn({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/90 text-xs shadow-[0_16px_40px_rgba(0,0,0,.38)] backdrop-blur-md transition " +
        className
      }
    >
      {children}
    </button>
  );
}

function Chip({ children }) {
  return (
    <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/70">
      {children}
    </span>
  );
}

/* ----------------------------- Floating panel ----------------------------- */

function FloatingPanel({
  title = "Panel",
  children,
  isOpen,
  onClose,
  minimized,
  onToggleMin,
  pos,
  onPos,
  width = 340,
}) {
  const dragRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      onPos?.({ x: startRef.current.ox + dx, y: startRef.current.oy + dy });
    };
    const onUp = () => setDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, onPos]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute z-30"
      style={{
        left: pos.x,
        top: pos.y,
        width,
      }}
    >
      <div className="rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl shadow-[0_22px_80px_rgba(0,0,0,.6)] overflow-hidden">
        {/* Header draggable */}
        <div
          ref={dragRef}
          className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gradient-to-r from-white/5 to-white/0 cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => {
            // only left click
            if (e.button !== 0) return;
            setDragging(true);
            startRef.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
          }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400/70 shadow-[0_0_0_6px_rgba(16,185,129,.12)]" />
            <div className="text-white font-semibold text-xs">{title}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]"
              onClick={onToggleMin}
              title={minimized ? "Expandir" : "Minimizar"}
            >
              {minimized ? "Expand" : "Min"}
            </button>
            <button
              className="px-2 py-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]"
              onClick={onClose}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {!minimized && <div className="p-3">{children}</div>}
      </div>
    </div>
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

  // Floating panels state
  const [tplOpen, setTplOpen] = useState(false);
  const [inspOpen, setInspOpen] = useState(true);
  const [inspMin, setInspMin] = useState(false);
  const [tplPos, setTplPos] = useState({ x: 18, y: 74 });
  const [inspPos, setInspPos] = useState({ x: 18, y: 74 });

  // Sync local doc from outside
  useEffect(() => {
    const next = normalizeDoc(externalDoc);
    setLocalDoc(next);
    undoRef.current = [];
    redoRef.current = [];
  }, [externalDoc?.meta?.presetKey, externalDoc?.meta?.w, externalDoc?.meta?.h]);

  const hasDoc = !!localDoc;

  const shellClass = compact ? "h-[70vh]" : "h-[82vh]";

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

  // Position inspector default on right (responsive)
  useEffect(() => {
    // set once: place inspector to the right side of canvas container
    // keep safe if user already moved it
    setInspPos((p) => (p.x === 18 && p.y === 74 ? { x: 24, y: 92 } : p));
  }, []);

  return (
    <div className={`w-full ${shellClass} relative`}>
      {/* ---------------- Main Canvas Area (FULL WIDTH) ---------------- */}
      <div className="absolute inset-0 rounded-3xl border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden">
        {/* Top HUD (premium) */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GlassBtn
              onClick={() => {
                setTplOpen(true);
                setInspOpen(true);
              }}
              title="Abrir paneles"
              className="hidden sm:inline-flex"
            >
              Panels
            </GlassBtn>

            <GlassBtn onClick={() => setTplOpen((v) => !v)} title="Plantillas">
              Templates
            </GlassBtn>

            <GlassBtn onClick={() => setInspOpen((v) => !v)} title="Inspector / Propiedades">
              Properties
            </GlassBtn>

            <div className="w-px h-8 bg-white/10 mx-1" />

            <GlassBtn
              onClick={undo}
              disabled={!undoRef.current.length}
              title="Undo (Ctrl/Cmd+Z)"
              className={!undoRef.current.length ? "opacity-40 cursor-not-allowed" : ""}
            >
              Undo
            </GlassBtn>

            <GlassBtn
              onClick={redo}
              disabled={!redoRef.current.length}
              title="Redo (Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z)"
              className={!redoRef.current.length ? "opacity-40 cursor-not-allowed" : ""}
            >
              Redo
            </GlassBtn>

            <GlassBtn
              onClick={() => {
                setLocalDoc(null);
                undoRef.current = [];
                redoRef.current = [];
                onChange?.(null);
              }}
              title="Reset documento"
              className="bg-white/4"
            >
              Reset
            </GlassBtn>
          </div>

          {hasDoc ? (
            <div className="flex items-center gap-2">
              <Chip>
                {localDoc.meta.w}×{localDoc.meta.h}
              </Chip>
              <Chip>zoom {localDoc.meta.zoom?.toFixed?.(2) ?? "—"}</Chip>
            </div>
          ) : (
            <Chip>Selecciona una plantilla</Chip>
          )}
        </div>

        {!hasDoc ? (
          <EmptyState />
        ) : (
          <div className="absolute inset-0">
            <StudioCanvas doc={localDoc} onChange={commit} compact={compact} />
          </div>
        )}

        {/* Subtle bottom hint */}
        <div className="absolute bottom-3 left-3 z-10 hidden md:flex gap-2 pointer-events-none">
          <Chip>Ctrl/Cmd+Z Undo</Chip>
          <Chip>Ctrl/Cmd+Y Redo</Chip>
          <Chip>Properties = flotante</Chip>
        </div>
      </div>

      {/* ---------------- Floating Templates Panel ---------------- */}
      <FloatingPanel
        title="Templates"
        isOpen={tplOpen}
        onClose={() => setTplOpen(false)}
        minimized={false}
        onToggleMin={() => {}}
        pos={tplPos}
        onPos={setTplPos}
        width={340}
      >
        <TemplatesPanel
          templates={templates}
          onCreateFromTemplate={(t) => {
            const next = makeEmptyDoc(t);
            undoRef.current = [];
            redoRef.current = [];
            commit(next, { silent: true });
            onNewFromTemplate?.(t);

            // place inspector on the right side once you have a doc
            setInspOpen(true);
            setInspMin(false);
            setTplOpen(false);
          }}
        />
      </FloatingPanel>

      {/* ---------------- Floating Inspector Panel ---------------- */}
      <FloatingPanel
        title="Properties"
        isOpen={inspOpen}
        onClose={() => setInspOpen(false)}
        minimized={inspMin}
        onToggleMin={() => setInspMin((v) => !v)}
        pos={inspPos}
        onPos={setInspPos}
        width={360}
      >
        {!localDoc ? (
          <div className="text-white/50 text-sm">Crea un documento para editar propiedades.</div>
        ) : (
          <Inspector doc={localDoc} onChange={commit} />
        )}
      </FloatingPanel>
    </div>
  );
}

/* ----------------------------- Templates Panel ----------------------------- */

function TemplatesPanel({ templates, onCreateFromTemplate }) {
  return (
    <div>
      <div className="mb-3">
        <div className="text-white font-semibold">Plantillas</div>
        <div className="text-white/50 text-xs">Click para iniciar un documento</div>
      </div>

      <div className="space-y-2">
        {(templates || []).map((t) => (
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
        <div className="text-white/60 text-sm mt-1">Abre Templates y elige un formato.</div>
        <div className="text-white/40 text-xs mt-3">
          Tip: activa <span className="text-white/70">Properties</span> para editar capas y estilos.
        </div>
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
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="text-white/70 text-xs">Documento</div>
        <div className="text-white text-sm mt-1">
          {doc.meta.w}×{doc.meta.h}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs"
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
            className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs"
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

      {/* Layers */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
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
                className={`w-full flex items-center justify-between rounded-2xl px-3 py-2 border transition ${
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
                  <span className="truncate max-w-[170px]">{label}</span>
                </div>
                <div className="text-[10px] text-white/40">#{idx + 1}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selección */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
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
                className="flex-1 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs"
                onClick={bringToFront}
              >
                Frente
              </button>
              <button
                className="flex-1 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs"
                onClick={sendToBack}
              >
                Atrás
              </button>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs"
                onClick={duplicate}
              >
                Duplicar
              </button>
              <button
                className="flex-1 px-3 py-2 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 text-xs"
                onClick={deleteSelected}
              >
                Eliminar
              </button>
            </div>

            {selected.type === "text" && (
              <>
                <label className="block text-white/60 text-xs mt-2">Texto</label>
                <input
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                  value={selected.text || ""}
                  onChange={(e) => patchSelected({ text: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-white/60 text-xs">Tamaño</label>
                    <input
                      type="number"
                      className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                      value={selected.fontSize || 32}
                      onChange={(e) => patchSelected({ fontSize: Number(e.target.value) || 32 })}
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs">Color</label>
                    <input
                      className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
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
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                  value={selected.fill || "#2B3A67"}
                  onChange={(e) => patchSelected({ fill: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-white/60 text-xs">Radius</label>
                    <input
                      type="number"
                      className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
                      value={selected.cornerRadius || 0}
                      onChange={(e) => patchSelected({ cornerRadius: Number(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs">Rotación</label>
                    <input
                      type="number"
                      className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm"
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
