// components/studio/CanvasEditor.jsx
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

/** normalizeDoc = seguro anti-bugs */
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
        text: "Canva-killer UI (preview) ✨",
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

  // Left “Canva rail” + panel
  const [leftTab, setLeftTab] = useState("design"); // design | elements | text | uploads | brand | projects | apps
  const [leftOpen, setLeftOpen] = useState(true);

  // Floating Properties window
  const [propsOpen, setPropsOpen] = useState(false);
  const [propsMin, setPropsMin] = useState(false);
  const [propsPos, setPropsPos] = useState({ x: 0, y: 0 });
  const propsDragRef = useRef({ dragging: false, dx: 0, dy: 0 });

  // Keep local doc in sync when studio.doc changes from outside
  useEffect(() => {
    const next = normalizeDoc(externalDoc);
    setLocalDoc(next);
    undoRef.current = [];
    redoRef.current = [];
  }, [externalDoc?.meta?.presetKey, externalDoc?.meta?.w, externalDoc?.meta?.h]);

  const hasDoc = !!localDoc;
  const shellClass = compact ? "h-[70vh]" : "h-[78vh]";

  /** commit */
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
      } else if (k === "i") {
        // Ctrl/Cmd+I => toggle properties (nice pro shortcut)
        ev.preventDefault();
        setPropsOpen((s) => !s);
        setPropsMin(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // Position the floating props default nicely (only once)
  useEffect(() => {
    if (propsPos.x !== 0 || propsPos.y !== 0) return;
    setPropsPos({ x: 24, y: 120 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createFromTemplate = (t) => {
    const next = makeEmptyDoc(t);
    undoRef.current = [];
    redoRef.current = [];
    commit(next, { silent: true });
    onNewFromTemplate?.(t);
  };

  /* ----------------------------- UI Shell ----------------------------- */

  return (
    <div className={`w-full ${shellClass} flex gap-4`}>
      {/* LEFT: Canva-like rail + collapsible panel */}
      <div className="flex gap-3">
        <CanvaRail
          value={leftTab}
          onChange={(k) => {
            setLeftTab(k);
            setLeftOpen(true);
          }}
          onTogglePanel={() => setLeftOpen((s) => !s)}
          leftOpen={leftOpen}
        />

        {leftOpen && (
          <LeftPanel
            tab={leftTab}
            templates={templates}
            hasDoc={hasDoc}
            onReset={() => {
              setLocalDoc(null);
              undoRef.current = [];
              redoRef.current = [];
              onChange?.(null);
            }}
            onCreateFromTemplate={createFromTemplate}
            onOpenProps={() => {
              setPropsOpen(true);
              setPropsMin(false);
            }}
            doc={localDoc}
            onChangeDoc={commit}
          />
        )}
      </div>

      {/* MAIN: Canvas Area */}
      <div className="flex-1 rounded-[26px] border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden relative shadow-[0_20px_70px_rgba(0,0,0,.45)]">
        {/* Top HUD mini */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs shadow-[0_14px_35px_rgba(0,0,0,.35)] backdrop-blur-md"
              onClick={undo}
              disabled={!undoRef.current.length}
              title="Undo (Ctrl/Cmd+Z)"
            >
              Undo
            </button>
            <button
              className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs shadow-[0_14px_35px_rgba(0,0,0,.35)] backdrop-blur-md"
              onClick={redo}
              disabled={!redoRef.current.length}
              title="Redo (Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z)"
            >
              Redo
            </button>

            <div className="w-px h-7 bg-white/10 mx-1" />

            <button
              className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs shadow-[0_14px_35px_rgba(0,0,0,.35)] backdrop-blur-md"
              onClick={() => setLeftOpen((s) => !s)}
              title="Mostrar / ocultar panel izquierdo"
            >
              {leftOpen ? "Ocultar panel" : "Mostrar panel"}
            </button>

            <button
              className="px-3 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-400/20 hover:bg-emerald-500/25 text-emerald-100 text-xs shadow-[0_0_0_1px_rgba(16,185,129,.10)]"
              onClick={() => {
                setPropsOpen(true);
                setPropsMin(false);
              }}
              title="Propiedades (Ctrl/Cmd+I)"
            >
              Propiedades
            </button>
          </div>

          {hasDoc ? (
            <div className="text-white/70 text-xs px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              {localDoc.meta.w}×{localDoc.meta.h} • zoom {localDoc.meta.zoom?.toFixed?.(2) ?? "—"}
            </div>
          ) : (
            <div className="text-white/60 text-xs px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              Selecciona una plantilla para empezar
            </div>
          )}
        </div>

        {!hasDoc ? <EmptyState /> : <StudioCanvas doc={localDoc} onChange={commit} compact={compact} />}

        {/* Floating Properties Window */}
        {propsOpen && (
          <FloatingWindow
            title="Propiedades"
            subtitle="Edita capas y estilos"
            pos={propsPos}
            setPos={setPropsPos}
            dragRef={propsDragRef}
            minimized={propsMin}
            onMin={() => setPropsMin((s) => !s)}
            onClose={() => {
              setPropsOpen(false);
              setPropsMin(false);
            }}
          >
            {!localDoc ? (
              <div className="text-white/60 text-sm">Crea un documento para editar propiedades.</div>
            ) : (
              <Inspector doc={localDoc} onChange={commit} />
            )}
          </FloatingWindow>
        )}
      </div>
    </div>
  );
}

/* ============================= UI PIECES ============================= */

function CanvaRail({ value, onChange, onTogglePanel, leftOpen }) {
  const items = [
    { key: "design", label: "Diseño", icon: "▦" },
    { key: "elements", label: "Elementos", icon: "◈" },
    { key: "text", label: "Texto", icon: "T" },
    { key: "uploads", label: "Subidos", icon: "☁" },
    { key: "brand", label: "Marca", icon: "©" },
    { key: "projects", label: "Proyectos", icon: "▣" },
    { key: "apps", label: "Apps", icon: "⌁" },
  ];

  return (
    <div className="w-[86px] shrink-0 rounded-[26px] border border-white/10 bg-black/35 backdrop-blur-md p-2 shadow-[0_20px_70px_rgba(0,0,0,.45)]">
      <div className="flex flex-col gap-1">
        {items.map((it) => {
          const active = value === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={`w-full rounded-2xl px-2 py-3 border transition ${
                active
                  ? "bg-amber-400/10 border-amber-300/25 text-amber-100"
                  : "bg-white/0 border-white/0 hover:bg-white/5 text-white/80"
              }`}
              title={it.label}
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`h-9 w-9 rounded-2xl flex items-center justify-center border ${
                    active ? "bg-amber-400/10 border-amber-300/20" : "bg-white/5 border-white/10"
                  }`}
                >
                  <span className="text-[16px]">{it.icon}</span>
                </div>
                <div className={`text-[11px] ${active ? "text-amber-100" : "text-white/70"}`}>
                  {it.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 pt-2 border-t border-white/10">
        <button
          onClick={onTogglePanel}
          className="w-full rounded-2xl px-2 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]"
          title="Abrir / cerrar panel"
        >
          {leftOpen ? "⟨ Ocultar" : "⟩ Abrir"}
        </button>
      </div>
    </div>
  );
}

function LeftPanel({ tab, templates, hasDoc, onReset, onCreateFromTemplate, onOpenProps, doc, onChangeDoc }) {
  return (
    <div className="w-[360px] shrink-0 rounded-[26px] border border-white/10 bg-black/30 backdrop-blur-md p-3 shadow-[0_20px_70px_rgba(0,0,0,.45)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-white font-semibold text-[15px]">
            {tab === "design"
              ? "Plantillas"
              : tab === "elements"
              ? "Elementos"
              : tab === "text"
              ? "Texto"
              : tab === "uploads"
              ? "Subidos"
              : tab === "brand"
              ? "Marca"
              : tab === "projects"
              ? "Proyectos"
              : "Apps"}
          </div>
          <div className="text-white/50 text-xs">
            {tab === "design"
              ? "Elige un formato para iniciar"
              : "Preview UI (funciones después) 🔥"}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs border border-white/10"
            onClick={onReset}
            title="Reset documento"
          >
            Reset
          </button>
          <button
            className="px-3 py-1.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-100 text-xs border border-emerald-400/20"
            onClick={onOpenProps}
            title="Abrir propiedades"
          >
            Propiedades
          </button>
        </div>
      </div>

      {/* Content by tab */}
      {tab === "design" && (
        <>
          <div className="space-y-2">
            {(templates || []).map((t) => (
              <button
                key={t.id}
                className="w-full text-left rounded-[22px] border border-white/10 bg-white/5 hover:bg-white/10 transition p-3"
                onClick={() => onCreateFromTemplate(t)}
              >
                <div className="text-white font-medium">{t.title}</div>
                <div className="text-white/60 text-xs">{t.subtitle}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-[22px] bg-gradient-to-r from-white/5 to-white/0 border border-white/10">
            <div className="text-white font-semibold text-sm">Mis diseños</div>
            <div className="text-white/50 text-xs">(Luego conectamos historial por proyecto)</div>

            <div className="mt-3 text-white/40 text-[11px]">
              Atajos: <span className="text-white/60">Ctrl/Cmd+Z</span> Undo •{" "}
              <span className="text-white/60">Ctrl/Cmd+Y</span> Redo •{" "}
              <span className="text-white/60">Ctrl/Cmd+I</span> Propiedades
            </div>
          </div>
        </>
      )}

      {tab === "elements" && (
        <PreviewSection
          title="Elementos"
          desc="Aquí van shapes, stickers, grids, marcos, etc."
          pills={["Formas", "Líneas", "Marcos", "Stickers", "Grids", "Iconos"]}
        />
      )}

      {tab === "text" && (
        <TextQuickPanel hasDoc={hasDoc} doc={doc} onChangeDoc={onChangeDoc} />
      )}

      {tab === "uploads" && (
        <PreviewSection
          title="Subidos"
          desc="Aquí irá drag & drop de imágenes y assets."
          pills={["Subir imagen", "Biblioteca", "Recientes"]}
        />
      )}

      {tab === "brand" && (
        <PreviewSection
          title="Marca"
          desc="Kit de marca: logos, paletas, tipografías."
          pills={["Logo", "Paleta", "Tipografías", "Componentes"]}
        />
      )}

      {tab === "projects" && (
        <PreviewSection
          title="Proyectos"
          desc="Historial por proyecto / cliente / campaña."
          pills={["Recientes", "Favoritos", "Compartidos"]}
        />
      )}

      {tab === "apps" && (
        <PreviewSection
          title="Apps"
          desc="Mini-apps: QR, mockups, resize batch, etc."
          pills={["QR", "Mockup", "Resize", "Export pack"]}
        />
      )}
    </div>
  );
}

function PreviewSection({ title, desc, pills = [] }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/5 p-3">
      <div className="text-white font-semibold">{title}</div>
      <div className="text-white/60 text-xs mt-1">{desc}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pills.map((p) => (
          <div
            key={p}
            className="px-3 py-1.5 rounded-2xl bg-black/25 border border-white/10 text-white/80 text-xs"
          >
            {p}
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-white/50 text-xs">
        Preview UI listo ✅ — lógica en el siguiente paso.
      </div>
    </div>
  );
}

function TextQuickPanel({ hasDoc, doc, onChangeDoc }) {
  return (
    <div className="space-y-3">
      <div className="rounded-[22px] border border-white/10 bg-white/5 p-3">
        <div className="text-white/70 text-xs">Texto rápido</div>
        <div className="text-white/60 text-xs mt-1">Agrega títulos y subtítulos como Canva.</div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          <button
            className="w-full px-3 py-3 rounded-[18px] bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm text-left"
            onClick={() => {
              if (!hasDoc || !doc) return;
              const id = uid();
              onChangeDoc({
                ...doc,
                nodes: [
                  ...doc.nodes,
                  {
                    id,
                    type: "text",
                    x: 120,
                    y: 120,
                    text: "Título impactante",
                    fontSize: 86,
                    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
                    fill: "#E9EEF9",
                    draggable: true,
                  },
                ],
                selectedId: id,
              });
            }}
          >
            <div className="text-white font-semibold">Agregar título</div>
            <div className="text-white/60 text-xs">Grande • Pro</div>
          </button>

          <button
            className="w-full px-3 py-3 rounded-[18px] bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm text-left"
            onClick={() => {
              if (!hasDoc || !doc) return;
              const id = uid();
              onChangeDoc({
                ...doc,
                nodes: [
                  ...doc.nodes,
                  {
                    id,
                    type: "text",
                    x: 130,
                    y: 240,
                    text: "Subtítulo / descripción",
                    fontSize: 36,
                    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
                    fill: "rgba(233,238,249,0.78)",
                    draggable: true,
                  },
                ],
                selectedId: id,
              });
            }}
          >
            <div className="text-white font-semibold">Agregar subtítulo</div>
            <div className="text-white/60 text-xs">Mediano • Legible</div>
          </button>
        </div>

        {!hasDoc && (
          <div className="mt-3 text-white/50 text-xs rounded-2xl border border-white/10 bg-black/20 p-3">
            Crea una plantilla primero para poder insertar texto.
          </div>
        )}
      </div>

      <PreviewSection title="Estilos" desc="Luego: presets de tipografía (Heading, Subheading…)." pills={["Heading", "Subheading", "Body", "CTA"]} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center px-6">
        <div className="text-white text-2xl font-semibold tracking-wide">AUREA STUDIO</div>
        <div className="text-white/60 text-sm mt-1">Abre “Diseño” y elige un formato.</div>
        <div className="text-white/40 text-xs mt-3">
          Tip: Usa <span className="text-white/70">Ctrl/Cmd+I</span> para abrir Propiedades.
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Floating Window ----------------------------- */

function FloatingWindow({
  title,
  subtitle,
  pos,
  setPos,
  dragRef,
  minimized,
  onMin,
  onClose,
  children,
}) {
  const onMouseDown = (e) => {
    // drag only from header
    dragRef.current.dragging = true;
    dragRef.current.dx = e.clientX - pos.x;
    dragRef.current.dy = e.clientY - pos.y;
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.dragging) return;
      setPos({
        x: clamp(e.clientX - dragRef.current.dx, 10, window.innerWidth - 360),
        y: clamp(e.clientY - dragRef.current.dy, 80, window.innerHeight - 120),
      });
    };
    const onUp = () => {
      dragRef.current.dragging = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [pos.x, pos.y, setPos, dragRef]);

  return (
    <div
      className="absolute z-30"
      style={{
        left: pos.x,
        top: pos.y,
        width: 360,
      }}
    >
      <div className="rounded-[22px] border border-white/10 bg-black/55 backdrop-blur-xl shadow-[0_30px_110px_rgba(0,0,0,.60)] overflow-hidden">
        {/* Header */}
        <div
          className="px-3 py-3 border-b border-white/10 flex items-center justify-between cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
          title="Arrastra para mover"
        >
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 shadow-[0_0_25px_rgba(52,211,153,.35)]" />
            <div>
              <div className="text-white font-semibold text-sm">{title}</div>
              <div className="text-white/50 text-[11px]">{subtitle}</div>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={onMin}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-xs"
              title="Minimizar"
            >
              {minimized ? "Expandir" : "Min"}
            </button>
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-xs"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        {!minimized && <div className="p-3 max-h-[62vh] overflow-auto">{children}</div>}
      </div>
    </div>
  );
}

/* ----------------------------- Inspector (reused) ----------------------------- */

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
      <div className="rounded-[18px] border border-white/10 bg-white/5 p-3">
        <div className="text-white/70 text-xs">Documento</div>
        <div className="text-white text-sm mt-1">
          {doc.meta.w}×{doc.meta.h}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs border border-white/10"
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
            className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs border border-white/10"
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
      <div className="rounded-[18px] border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="text-white/70 text-xs">Capas</div>
          <div className="text-white/40 text-[11px]">{doc.nodes.length}</div>
        </div>

        <div className="mt-2 space-y-1 max-h-[220px] overflow-auto pr-1">
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
                  <span className="truncate max-w-[180px]">{label}</span>
                </div>
                <div className="text-[10px] text-white/40">#{idx + 1}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            className="flex-1 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs border border-white/10"
            onClick={bringToFront}
            disabled={!selected}
          >
            Frente
          </button>
          <button
            className="flex-1 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs border border-white/10"
            onClick={sendToBack}
            disabled={!selected}
          >
            Atrás
          </button>
        </div>
      </div>

      {/* Selección */}
      <div className="rounded-[18px] border border-white/10 bg-white/5 p-3">
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
                className="flex-1 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs border border-white/10"
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
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm outline-none"
                  value={selected.text || ""}
                  onChange={(e) => patchSelected({ text: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-white/60 text-xs">Tamaño</label>
                    <input
                      type="number"
                      className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm outline-none"
                      value={selected.fontSize || 32}
                      onChange={(e) => patchSelected({ fontSize: Number(e.target.value) || 32 })}
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs">Color</label>
                    <input
                      className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm outline-none"
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
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm outline-none"
                  value={selected.fill || "#2B3A67"}
                  onChange={(e) => patchSelected({ fill: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-white/60 text-xs">Radius</label>
                    <input
                      type="number"
                      className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm outline-none"
                      value={selected.cornerRadius || 0}
                      onChange={(e) => patchSelected({ cornerRadius: Number(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs">Rotación</label>
                    <input
                      type="number"
                      className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm outline-none"
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
