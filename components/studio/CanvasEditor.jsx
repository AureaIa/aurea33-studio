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

const RailIcon = ({ children }) => (
  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 grid place-items-center text-white/90 shadow-[0_14px_40px_rgba(0,0,0,.35)] backdrop-blur-md">
    {children}
  </div>
);

const Icon = {
  Design: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
      <path d="M8 9h8M8 13h8M8 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
    </svg>
  ),
  Elements: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
      <rect x="12" y="12" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
      <path d="M5 18h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
    </svg>
  ),
  Text: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 6h12M12 6v12M9 18h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.9" />
    </svg>
  ),
  Upload: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 14V4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.9" />
      <path d="M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.9" />
      <path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.9" />
    </svg>
  ),
  Brand: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 21s7-4.35 7-10a4 4 0 0 0-7-2 4 4 0 0 0-7 2c0 5.65 7 10 7 10Z" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
    </svg>
  ),
  Properties: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <circle cx="9" cy="7" r="2" fill="currentColor" opacity="0.9" />
      <circle cx="15" cy="12" r="2" fill="currentColor" opacity="0.9" />
      <circle cx="11" cy="17" r="2" fill="currentColor" opacity="0.9" />
    </svg>
  ),
};

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

  // Rail / Panels
  const [leftPanel, setLeftPanel] = useState(null); // "design" | "elements" | "text" | "upload" | "brand" | null
  const [propsOpen, setPropsOpen] = useState(false);
  const [propsMin, setPropsMin] = useState(false);

  // Sync when doc changes from outside
  useEffect(() => {
    const next = normalizeDoc(externalDoc);
    setLocalDoc(next);
    undoRef.current = [];
    redoRef.current = [];
  }, [externalDoc?.meta?.presetKey, externalDoc?.meta?.w, externalDoc?.meta?.h]);

  const hasDoc = !!localDoc;

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

  const createFromTemplate = useCallback(
    (t) => {
      const next = makeEmptyDoc(t);
      undoRef.current = [];
      redoRef.current = [];
      commit(next, { silent: true });
      onNewFromTemplate?.(t);
      // cuando creas doc, abre propiedades automáticamente (pero no estorba)
      setPropsOpen(true);
      setPropsMin(false);
    },
    [commit, onNewFromTemplate]
  );

  const addText = useCallback(() => {
    if (!localDoc) return;
    const id = uid();
    const next = {
      ...localDoc,
      nodes: [
        ...localDoc.nodes,
        {
          id,
          type: "text",
          x: 140,
          y: 120,
          text: "Texto nuevo",
          fontSize: 56,
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
          fill: "#E9EEF9",
          draggable: true,
        },
      ],
      selectedId: id,
    };
    commit(next);
    setPropsOpen(true);
    setPropsMin(false);
  }, [localDoc, commit]);

  const addShape = useCallback(() => {
    if (!localDoc) return;
    const id = uid();
    const next = {
      ...localDoc,
      nodes: [
        ...localDoc.nodes,
        {
          id,
          type: "rect",
          x: 160,
          y: 220,
          width: 360,
          height: 200,
          fill: "#2B3A67",
          cornerRadius: 26,
          draggable: true,
        },
      ],
      selectedId: id,
    };
    commit(next);
    setPropsOpen(true);
    setPropsMin(false);
  }, [localDoc, commit]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (ev) => {
      const isMod = ev.ctrlKey || ev.metaKey;
      if (!isMod) return;

      const k = ev.key.toLowerCase();

      // Undo/Redo
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

      // Panels
      if (k === "1") {
        ev.preventDefault();
        setLeftPanel((p) => (p === "design" ? null : "design"));
        return;
      }
      if (k === "2") {
        ev.preventDefault();
        setLeftPanel((p) => (p === "elements" ? null : "elements"));
        return;
      }
      if (k === "3") {
        ev.preventDefault();
        setLeftPanel((p) => (p === "text" ? null : "text"));
        return;
      }
      if (k === "4") {
        ev.preventDefault();
        setLeftPanel((p) => (p === "upload" ? null : "upload"));
        return;
      }
      if (k === "p") {
        ev.preventDefault();
        setPropsOpen((v) => !v);
        setPropsMin(false);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // Premium shell height
  const shellClass = compact ? "h-[70vh]" : "h-[78vh]";

  return (
    <div className={`w-full ${shellClass} relative`}>
      {/* MAIN: rail + canvas (SIN PANELES FIJOS) */}
      <div className="w-full h-full flex gap-3">
        {/* Rail estilo Canva */}
        <div className="w-[74px] shrink-0 rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl p-2 flex flex-col items-center gap-2 shadow-[0_18px_80px_rgba(0,0,0,.45)]">
          <RailButton
            active={leftPanel === "design"}
            label="Diseño"
            onClick={() => setLeftPanel((p) => (p === "design" ? null : "design"))}
            icon={<Icon.Design />}
          />
          <RailButton
            active={leftPanel === "elements"}
            label="Elementos"
            onClick={() => setLeftPanel((p) => (p === "elements" ? null : "elements"))}
            icon={<Icon.Elements />}
          />
          <RailButton
            active={leftPanel === "text"}
            label="Texto"
            onClick={() => setLeftPanel((p) => (p === "text" ? null : "text"))}
            icon={<Icon.Text />}
          />
          <RailButton
            active={leftPanel === "upload"}
            label="Subidos"
            onClick={() => setLeftPanel((p) => (p === "upload" ? null : "upload"))}
            icon={<Icon.Upload />}
          />
          <RailButton
            active={leftPanel === "brand"}
            label="Marca"
            onClick={() => setLeftPanel((p) => (p === "brand" ? null : "brand"))}
            icon={<Icon.Brand />}
          />

          <div className="h-px w-10 bg-white/10 my-1" />

          <RailButton
            active={propsOpen}
            label="Props"
            onClick={() => {
              setPropsOpen((v) => !v);
              setPropsMin(false);
            }}
            icon={<Icon.Properties />}
          />

          <div className="flex-1" />

          <div className="text-[10px] text-white/35 pb-1">
            Ctrl+1..4
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 rounded-3xl border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden relative shadow-[0_18px_80px_rgba(0,0,0,.45)]">
          {/* Top mini HUD (premium, NO estorba) */}
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
                className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={() => setLeftPanel((p) => (p === "design" ? null : "design"))}
                title="Diseño (Ctrl/Cmd+1)"
              >
                Diseño
              </button>
              <button
                className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={() => setLeftPanel((p) => (p === "elements" ? null : "elements"))}
                title="Elementos (Ctrl/Cmd+2)"
              >
                Elementos
              </button>
              <button
                className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={() => setPropsOpen(true)}
                title="Propiedades (Ctrl/Cmd+P)"
              >
                Propiedades
              </button>
            </div>

            {hasDoc ? (
              <div className="text-white/70 text-xs px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                {localDoc.meta.w}×{localDoc.meta.h} • zoom {localDoc.meta.zoom?.toFixed?.(2) ?? "—"}
              </div>
            ) : (
              <div className="text-white/55 text-xs px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                Selecciona una plantilla (Ctrl+1)
              </div>
            )}
          </div>

          {/* Content */}
          {!hasDoc ? (
            <EmptyState />
          ) : (
            <StudioCanvas doc={localDoc} onChange={commit} compact={compact} />
          )}
        </div>
      </div>

      {/* LEFT DRAWER (flotante) */}
      {leftPanel && (
        <LeftDrawer
          kind={leftPanel}
          templates={templates}
          hasDoc={hasDoc}
          onClose={() => setLeftPanel(null)}
          onCreateFromTemplate={createFromTemplate}
          onAddText={addText}
          onAddShape={addShape}
        />
      )}

      {/* PROPERTIES FLOATING WINDOW (derecha) */}
      {propsOpen && (
        <PropertiesWindow
          doc={localDoc}
          onChange={commit}
          onClose={() => setPropsOpen(false)}
          min={propsMin}
          setMin={setPropsMin}
          onAddText={addText}
          onAddShape={addShape}
        />
      )}
    </div>
  );
}

/* ----------------------------- Rail Button ----------------------------- */

function RailButton({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex flex-col items-center gap-1 py-2 rounded-2xl border transition ${
        active
          ? "bg-amber-400/10 border-amber-300/25 shadow-[0_0_0_1px_rgba(251,191,36,.12)]"
          : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10"
      }`}
      title={label}
    >
      <div className={`${active ? "text-amber-200" : "text-white/80"}`}>
        <RailIcon>{icon}</RailIcon>
      </div>
      <div className={`${active ? "text-amber-100" : "text-white/45"} text-[10px] leading-none`}>
        {label}
      </div>
    </button>
  );
}

/* ----------------------------- Left Drawer ----------------------------- */

function LeftDrawer({ kind, templates, hasDoc, onClose, onCreateFromTemplate, onAddText, onAddShape }) {
  const title =
    kind === "design"
      ? "Diseño"
      : kind === "elements"
      ? "Elementos"
      : kind === "text"
      ? "Texto"
      : kind === "upload"
      ? "Subidos"
      : kind === "brand"
      ? "Marca"
      : "Panel";

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* Backdrop (click to close) */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] pointer-events-auto"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute left-3 top-3 bottom-3 w-[360px] rounded-3xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-[0_18px_90px_rgba(0,0,0,.55)] pointer-events-auto overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div>
            <div className="text-white font-semibold">{title}</div>
            <div className="text-white/45 text-xs">
              {kind === "design"
                ? "Elige un formato para iniciar"
                : kind === "elements"
                ? "Próximo: shapes, stickers, assets"
                : kind === "text"
                ? "Añade texto con un click"
                : kind === "upload"
                ? "Próximo: uploads + librería"
                : "Próximo: colores + fonts + logos"}
            </div>
          </div>

          <button
            className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
            onClick={onClose}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {kind === "design" && (
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

              <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-white/5 to-white/0 border border-white/10">
                <div className="text-white/70 text-xs">Atajos</div>
                <div className="text-white/45 text-[11px] mt-1">
                  Ctrl/Cmd+1 Diseño • Ctrl/Cmd+P Propiedades
                </div>
              </div>
            </div>
          )}

          {kind === "elements" && (
            <div className="space-y-2">
              <button
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm"
                onClick={onAddShape}
                disabled={!hasDoc}
                title={!hasDoc ? "Crea un documento primero" : "Añadir Shape"}
              >
                + Shape rápido
              </button>

              <div className="grid grid-cols-2 gap-2">
                <GhostCard title="Formas" desc="Próximo" />
                <GhostCard title="Stickers" desc="Próximo" />
                <GhostCard title="Marcos" desc="Próximo" />
                <GhostCard title="Iconos" desc="Próximo" />
              </div>
            </div>
          )}

          {kind === "text" && (
            <div className="space-y-2">
              <button
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm"
                onClick={onAddText}
                disabled={!hasDoc}
                title={!hasDoc ? "Crea un documento primero" : "Añadir Texto"}
              >
                + Texto
              </button>

              <div className="grid grid-cols-2 gap-2">
                <GhostCard title="Título" desc="Próximo" />
                <GhostCard title="Subtítulo" desc="Próximo" />
                <GhostCard title="Neón" desc="Próximo" />
                <GhostCard title="Minimal" desc="Próximo" />
              </div>
            </div>
          )}

          {kind === "upload" && (
            <div className="space-y-2">
              <GhostBanner
                title="Subidos"
                desc="Aquí irá tu librería + drag & drop (próximo)."
              />
              <div className="grid grid-cols-2 gap-2">
                <GhostCard title="Mis imágenes" desc="Próximo" />
                <GhostCard title="Mis logos" desc="Próximo" />
              </div>
            </div>
          )}

          {kind === "brand" && (
            <div className="space-y-2">
              <GhostBanner
                title="Kit de marca"
                desc="Paleta, tipografías, logo-lockups (próximo)."
              />
              <div className="grid grid-cols-2 gap-2">
                <GhostCard title="Colores" desc="Próximo" />
                <GhostCard title="Fuentes" desc="Próximo" />
                <GhostCard title="Logos" desc="Próximo" />
                <GhostCard title="Estilos" desc="Próximo" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GhostCard({ title, desc }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-white/80 text-sm">{title}</div>
      <div className="text-white/40 text-xs mt-1">{desc}</div>
    </div>
  );
}

function GhostBanner({ title, desc }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 to-white/0 p-4">
      <div className="text-white font-semibold">{title}</div>
      <div className="text-white/45 text-sm mt-1">{desc}</div>
    </div>
  );
}

/* ----------------------------- Properties Window ----------------------------- */

function PropertiesWindow({ doc, onChange, onClose, min, setMin, onAddText, onAddShape }) {
  return (
    <div className="absolute inset-0 z-40 pointer-events-none">
      <div className="absolute right-3 top-3 bottom-3 w-[360px] pointer-events-auto">
        <div className="h-full rounded-3xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-[0_18px_90px_rgba(0,0,0,.55)] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              <div>
                <div className="text-white font-semibold">Propiedades</div>
                <div className="text-white/45 text-xs">Edita capas y estilos</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={() => setMin((v) => !v)}
                title="Minimizar"
              >
                {min ? "Max" : "Min"}
              </button>
              <button
                className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={onClose}
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          {min ? (
            <div className="p-4 text-white/55 text-sm">
              Minimizado. (Ctrl/Cmd+P)
            </div>
          ) : (
            <div className="p-4 overflow-auto">
              {!doc ? (
                <div className="text-white/55 text-sm">
                  Crea un documento para editar propiedades.
                </div>
              ) : (
                <Inspector doc={doc} onChange={onChange} onAddText={onAddText} onAddShape={onAddShape} />
              )}
            </div>
          )}
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
        <div className="text-white/60 text-sm mt-1">Abre “Diseño” y elige un formato.</div>
        <div className="text-white/35 text-xs mt-2">Atajo: Ctrl/Cmd+1</div>
      </div>
    </div>
  );
}

/* ----------------------------- Inspector ----------------------------- */

function Inspector({ doc, onChange, onAddText, onAddShape }) {
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
            onClick={onAddText}
          >
            + Texto
          </button>

          <button
            className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs"
            onClick={onAddShape}
          >
            + Shape
          </button>
        </div>
      </div>

      {/* Capas */}
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
                  <span className="truncate max-w-[160px]">{label}</span>
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
