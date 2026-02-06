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
    meta: { w, h, bg: bg || "#0B1220", zoom: 1, panX: 0, panY: 0, presetKey: presetKey || "" },
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

/* ----------------------------- LocalStorage UI ----------------------------- */

const UI_KEY = "aurea33:studio:ui";

function loadUI() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveUI(patch) {
  try {
    const cur = loadUI() || {};
    localStorage.setItem(UI_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {}
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

  // ✅ UI state (Canva-style)
  const ui0 = typeof window !== "undefined" ? loadUI() : null;
  const [leftOpen, setLeftOpen] = useState(ui0?.leftOpen ?? false);
  const [leftTab, setLeftTab] = useState(ui0?.leftTab ?? "design");
  const [rightOpen, setRightOpen] = useState(ui0?.rightOpen ?? false);

  useEffect(() => saveUI({ leftOpen, leftTab, rightOpen }), [leftOpen, leftTab, rightOpen]);

  // Sync local doc when doc changes outside
  useEffect(() => {
    const next = normalizeDoc(externalDoc);
    setLocalDoc(next);
    undoRef.current = [];
    redoRef.current = [];
  }, [externalDoc?.meta?.presetKey, externalDoc?.meta?.w, externalDoc?.meta?.h]);

  const hasDoc = !!localDoc;
  const shellClass = compact ? "h-[70vh]" : "h-[78vh]";

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

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (ev) => {
      const isMod = ev.ctrlKey || ev.metaKey;

      // Undo/Redo
      if (isMod) {
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
      }

      // Panels
      if (isMod && ev.key === "1") {
        ev.preventDefault();
        openLeft("design");
      }
      if (isMod && ev.key === "2") {
        ev.preventDefault();
        openLeft("elements");
      }
      if (isMod && ev.key === "3") {
        ev.preventDefault();
        openLeft("text");
      }
      if (isMod && (ev.key.toLowerCase() === "p")) {
        ev.preventDefault();
        setRightOpen((s) => !s);
      }

      if (ev.key === "Escape") {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const openLeft = (tab) => {
    setLeftTab(tab);
    setLeftOpen(true);
  };

  const closeLeft = () => setLeftOpen(false);

  const addText = () => {
    if (!localDoc) return;
    const id = uid();
    commit({
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
    });
  };

  const addShape = () => {
    if (!localDoc) return;
    const id = uid();
    commit({
      ...localDoc,
      nodes: [
        ...localDoc.nodes,
        { id, type: "rect", x: 140, y: 180, width: 320, height: 180, fill: "#2B3A67", cornerRadius: 24, draggable: true },
      ],
      selectedId: id,
    });
  };

  return (
    <div className={`w-full ${shellClass} relative`}>
      <div className="w-full h-full flex gap-3">
        {/* -------- Left Dock (siempre visible) -------- */}
        <LeftDock
          active={leftOpen ? leftTab : null}
          onPick={(tab) => {
            if (leftOpen && leftTab === tab) closeLeft();
            else openLeft(tab);
          }}
        />

        {/* -------- Left Drawer (retraíble) -------- */}
        {leftOpen && (
          <LeftDrawer
            tab={leftTab}
            templates={templates}
            hasDoc={hasDoc}
            onClose={closeLeft}
            onReset={() => {
              setLocalDoc(null);
              undoRef.current = [];
              redoRef.current = [];
              onChange?.(null);
              closeLeft();
            }}
            onCreateFromTemplate={(t) => {
              const next = makeEmptyDoc(t);
              undoRef.current = [];
              redoRef.current = [];
              commit(next, { silent: true });
              onNewFromTemplate?.(t);
              closeLeft(); // opcional: cierra al elegir
            }}
            onAddText={addText}
            onAddShape={addShape}
          />
        )}

        {/* -------- Main Canvas Area (FULL) -------- */}
        <div className="flex-1 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden relative">
          {/* HUD TOP (premium, compacto) */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
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

              <div className="w-px h-7 bg-white/10 mx-1" />

              <button
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={() => openLeft("design")}
                title="Diseño (Ctrl/Cmd+1)"
              >
                Diseño
              </button>
              <button
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={() => openLeft("elements")}
                title="Elementos (Ctrl/Cmd+2)"
              >
                Elementos
              </button>
              <button
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={() => openLeft("text")}
                title="Texto (Ctrl/Cmd+3)"
              >
                Texto
              </button>

              <button
                className="ml-1 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/20 hover:bg-emerald-500/25 text-emerald-100 text-xs"
                onClick={() => setRightOpen(true)}
                title="Propiedades (Ctrl/Cmd+P)"
              >
                Propiedades
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

          {/* Right Drawer (flotante) */}
          {rightOpen && (
            <RightDrawer
              doc={localDoc}
              onClose={() => setRightOpen(false)}
              onUndo={undo}
              onRedo={redo}
              onChange={commit}
              onAddText={addText}
              onAddShape={addShape}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Left Dock ----------------------------- */

function DockBtn({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-2xl border transition ${
        active
          ? "bg-amber-400/10 border-amber-300/30 text-white"
          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
      }`}
      title={label}
    >
      <span className="w-7 h-7 rounded-xl bg-black/30 border border-white/10 grid place-items-center text-[12px]">
        {icon}
      </span>
      <span className="text-xs">{label}</span>
    </button>
  );
}

function LeftDock({ active, onPick }) {
  return (
    <div className="w-[86px] shrink-0 rounded-2xl border border-white/10 bg-black/25 backdrop-blur-md p-2 flex flex-col gap-2">
      <DockBtn active={active === "design"} label="Diseño" icon="▦" onClick={() => onPick("design")} />
      <DockBtn active={active === "elements"} label="Elementos" icon="⬡" onClick={() => onPick("elements")} />
      <DockBtn active={active === "text"} label="Texto" icon="T" onClick={() => onPick("text")} />
      <DockBtn active={active === "uploads"} label="Subidos" icon="⇪" onClick={() => onPick("uploads")} />
      <DockBtn active={active === "brand"} label="Marca" icon="♥" onClick={() => onPick("brand")} />
      <DockBtn active={active === "apps"} label="Apps" icon="⌁" onClick={() => onPick("apps")} />
      <div className="mt-auto pt-2 border-t border-white/10">
        <div className="text-[10px] text-white/35 text-center">AUREA</div>
      </div>
    </div>
  );
}

/* ----------------------------- Left Drawer ----------------------------- */

function LeftDrawer({ tab, templates, hasDoc, onClose, onReset, onCreateFromTemplate, onAddText, onAddShape }) {
  return (
    <div className="w-[340px] shrink-0 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md overflow-hidden">
      <div className="p-3 flex items-center justify-between border-b border-white/10">
        <div>
          <div className="text-white font-semibold">
            {tab === "design" ? "Plantillas" :
             tab === "elements" ? "Elementos" :
             tab === "text" ? "Texto" :
             tab === "uploads" ? "Subidos" :
             tab === "brand" ? "Marca" :
             tab === "apps" ? "Apps" : "Panel"}
          </div>
          <div className="text-white/45 text-xs">Esc (cerrar) • Ctrl/Cmd+1/2/3</div>
        </div>

        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
            onClick={onReset}
            title="Reset"
          >
            Reset
          </button>
          <button
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
            onClick={onClose}
            title="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-3">
        {tab === "design" && (
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
              <div className="text-white font-semibold text-sm">Mis diseños</div>
              <div className="text-white/50 text-xs">(Luego conectamos historial por proyecto)</div>
              <div className="mt-2 text-white/40 text-[11px]">
                Atajos: <span className="text-white/60">Ctrl/Cmd+Z</span> Undo •{" "}
                <span className="text-white/60">Ctrl/Cmd+Y</span> Redo •{" "}
                <span className="text-white/60">Ctrl/Cmd+P</span> Propiedades
              </div>
            </div>
          </div>
        )}

        {tab === "elements" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-white/70 text-xs">Acciones rápidas</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs" onClick={onAddShape}>
                  + Shape
                </button>
                <button className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs" onClick={onAddText}>
                  + Texto
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-white/70 text-xs">Próximamente</div>
              <div className="text-white/50 text-sm mt-1">
                Íconos, stickers, figuras, mockups, elementos de marca, imágenes IA.
              </div>
            </div>
          </div>
        )}

        {tab === "text" && (
          <div className="space-y-3">
            <button
              className="w-full px-3 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/20 hover:bg-emerald-500/25 text-emerald-100 text-sm"
              onClick={onAddText}
              disabled={!hasDoc}
              title={!hasDoc ? "Crea un documento primero" : "Agregar texto"}
            >
              Agregar texto
            </button>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-white/70 text-xs">Próximamente</div>
              <div className="text-white/50 text-sm mt-1">
                Presets: título, subtítulo, cuerpo, tipografías premium, estilos AUREA.
              </div>
            </div>
          </div>
        )}

        {tab === "uploads" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/70 text-xs">Subidos</div>
            <div className="text-white/50 text-sm mt-1">
              (Preview) Aquí va upload de imágenes/PNG/SVG + librería por proyecto.
            </div>
          </div>
        )}

        {tab === "brand" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/70 text-xs">Marca</div>
            <div className="text-white/50 text-sm mt-1">
              (Preview) Logos, colores, tipografías, kits por cliente.
            </div>
          </div>
        )}

        {tab === "apps" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-white/70 text-xs">Apps</div>
            <div className="text-white/50 text-sm mt-1">
              (Preview) Herramientas futuras: remover fondo, mockups, QR, generador IA.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Right Drawer (Inspector flotante) ----------------------------- */

function RightDrawer({ doc, onClose, onUndo, onRedo, onChange, onAddText, onAddShape }) {
  return (
    <div className="absolute top-3 right-3 bottom-3 w-[340px] z-30 pointer-events-auto">
      <div className="h-full rounded-2xl border border-white/10 bg-black/35 backdrop-blur-md overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,.55)]">
        <div className="p-3 flex items-center justify-between border-b border-white/10">
          <div>
            <div className="text-white font-semibold">Propiedades</div>
            <div className="text-white/45 text-xs">Ctrl/Cmd+P • Esc</div>
          </div>

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
            <button
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
              onClick={onClose}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-3">
          {!doc ? (
            <div className="text-white/50 text-sm">
              Crea un documento para editar propiedades.
            </div>
          ) : (
            <Inspector doc={doc} onChange={onChange} onAddText={onAddText} onAddShape={onAddShape} />
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
        <div className="text-white/40 text-[11px] mt-2">Atajo: Ctrl/Cmd+1</div>
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
    (patch) => onChange({ ...doc, ...patch }),
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
            onClick={onAddText}
          >
            + Texto
          </button>
          <button
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
            onClick={onAddShape}
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
              n.type === "text" ? (n.text || "Texto").slice(0, 18) :
              n.type === "rect" ? "Shape" : n.type;

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
              <button className="flex-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs" onClick={bringToFront}>
                Frente
              </button>
              <button className="flex-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs" onClick={sendToBack}>
                Atrás
              </button>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs" onClick={duplicate}>
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
