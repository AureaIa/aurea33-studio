"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import StudioCanvas from "./StudioCanvas";

/* ----------------------------- Formatos (Canvas Sizes) ----------------------------- */
/**
 * FORMATS = solo tamaño + fondo.
 * NO contienen diseño (nodes). Eso será TEMPLATES después.
 */
const FORMATS = [
  { id: "ig-post", title: "Instagram Post", subtitle: "1080×1080", w: 1080, h: 1080, bg: "#0B1220" },
  { id: "ig-story", title: "Instagram Story", subtitle: "1080×1920", w: 1080, h: 1920, bg: "#0B1220" },
  { id: "fb-cover", title: "Facebook Cover", subtitle: "820×312", w: 820, h: 312, bg: "#0B1220" },
];

const DEFAULT_FORMATS = FORMATS;

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
        text: "Canvas PRO (modo Canva)",
        fontSize: 34,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto",
        fill: "rgba(233,238,249,0.78)",
        draggable: true,
      },
    ],
    selectedId: null,
  });
}

/* ----------------------------- Templates Manifest Loader ----------------------------- */

async function loadManifest(signal) {
  const res = await fetch("/templates/manifest.json", { cache: "no-store", signal });
  if (!res.ok) throw new Error("No se pudo cargar manifest.json");
  return res.json();
}

/* ----------------------------- Component ----------------------------- */

export default function CanvasEditor({
  doc,
  onChange,
  formats = DEFAULT_FORMATS,
  onNewFromTemplate,
  compact = false,
}) {
  const externalDoc = doc || null;

  /* ----------------------------- Templates Marketplace State ----------------------------- */

  const [marketTemplates, setMarketTemplates] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    loadManifest(controller.signal)
      .then((m) => setMarketTemplates(Array.isArray(m.items) ? m.items : []))
      .catch(() => setMarketTemplates([]));
    return () => controller.abort();
  }, []);

  const filteredMarket = useMemo(() => {
    const qq = (q || "").trim().toLowerCase();
    if (!qq) return marketTemplates;

    return marketTemplates.filter((t) => {
      const hay = [
        t.title,
        t.subtitle,
        t.category,
        ...(Array.isArray(t.tags) ? t.tags : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(qq);
    });
  }, [marketTemplates, q]);

  // Local doc (single source for editor)
  const [localDoc, setLocalDoc] = useState(() => normalizeDoc(externalDoc));

  // Undo/Redo stacks
  const undoRef = useRef([]);
  const redoRef = useRef([]);

  // Panels (Canva-like)
  const [activeTool, setActiveTool] = useState("design"); // design | elements | text | uploads | brand | apps
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [zen, setZen] = useState(false);

  // Orbit motion toggle (anti-distracción by default)
  const [orbitMotion, setOrbitMotion] = useState(false);

  // Keep local doc in sync when studio.doc changes from outside
  useEffect(() => {
    const next = normalizeDoc(externalDoc);
    setLocalDoc(next);
    undoRef.current = [];
    redoRef.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalDoc?.meta?.presetKey, externalDoc?.meta?.w, externalDoc?.meta?.h]);

  const hasDoc = !!localDoc;

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

  // Zen toggle helper (consistente)
  const toggleZen = useCallback(() => {
    setZen((v) => {
      const next = !v;
      if (next) {
        setLeftOpen(false);
        setRightOpen(false);
      } else {
        setLeftOpen(true);
        setRightOpen(true);
      }
      return next;
    });
  }, []);

  // Keyboard shortcuts: Ctrl/Cmd+Z / Shift+Z / Y + Zen (Ctrl/Cmd+\) + Orbit motion (Ctrl/Cmd+B)
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
      } else if (k === "\\") {
        ev.preventDefault();
        toggleZen();
      } else if (k === "b") {
        ev.preventDefault();
        setOrbitMotion((v) => !v);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, toggleZen]);

  /* ----------------------------- Actions ----------------------------- */

  const createFromTemplate = (t) => {
    const next = makeEmptyDoc(t);
    undoRef.current = [];
    redoRef.current = [];
    commit(next, { silent: true });
    onNewFromTemplate?.(t);
  };

  const resetDoc = () => {
    setLocalDoc(null);
    undoRef.current = [];
    redoRef.current = [];
    onChange?.(null);
  };

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
    });
  };

  /* ----------------------------- Layout ----------------------------- */

  return (
    <div className={`w-full ${compact ? "h-[70vh]" : "h-[78vh]"} relative`}>
      <AureaFXStyles />

      {/* ======== TOP HUD (mini) ======== */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <GlowButton onClick={undo} disabled={!undoRef.current.length} title="Undo (Ctrl/Cmd+Z)">
            Undo
          </GlowButton>

          <GlowButton
            onClick={redo}
            disabled={!redoRef.current.length}
            title="Redo (Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z)"
          >
            Redo
          </GlowButton>

          <GlowButton
            onClick={toggleZen}
            title="Zen (Ctrl/Cmd+\)"
            variant={zen ? "amber" : "soft"}
          >
            ZEN
          </GlowButton>

          <GlowButton
            onClick={() => setOrbitMotion((v) => !v)}
            title="Orbit motion (Ctrl/Cmd+B)"
            variant={orbitMotion ? "sky" : "soft"}
          >
            Orbit
          </GlowButton>

          <GlowButton onClick={() => setLeftOpen((v) => !v)} title="Mostrar/Ocultar panel izquierdo">
            {leftOpen ? "Ocultar panel" : "Panel"}
          </GlowButton>

          <GlowButton onClick={() => setRightOpen((v) => !v)} title="Mostrar/Ocultar inspector">
            {rightOpen ? "Ocultar inspector" : "Inspector"}
          </GlowButton>
        </div>

        {hasDoc ? (
          <div className="pointer-events-none text-white/70 text-xs px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            {localDoc.meta.w}×{localDoc.meta.h} • zoom{" "}
            {localDoc.meta.zoom?.toFixed?.(2) ?? "—"}
          </div>
        ) : null}
      </div>

      {/* ======== MAIN STAGE WRAP ======== */}
      <div className={`absolute inset-0 ${zen ? "p-0" : ""}`}>
        {/* ======== CANVA-DOCK (izquierda, siempre visible) ======== */}
        {!zen && (
          <div className="absolute left-3 top-16 bottom-3 z-20 w-[64px] rounded-2xl border border-white/10 bg-black/35 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,.55)] flex flex-col items-center py-3 gap-2">
            <DockBtn
              label="Diseño"
              active={activeTool === "design"}
              onClick={() => {
                setActiveTool("design");
                setLeftOpen(true);
              }}
              icon="▦"
              orbitMotion={orbitMotion}
            />
            <DockBtn
              label="Elementos"
              active={activeTool === "elements"}
              onClick={() => {
                setActiveTool("elements");
                setLeftOpen(true);
              }}
              icon="⬡"
              orbitMotion={orbitMotion}
            />
            <DockBtn
              label="Texto"
              active={activeTool === "text"}
              onClick={() => {
                setActiveTool("text");
                setLeftOpen(true);
              }}
              icon="T"
              orbitMotion={orbitMotion}
            />
            <DockBtn
              label="Subidos"
              active={activeTool === "uploads"}
              onClick={() => {
                setActiveTool("uploads");
                setLeftOpen(true);
              }}
              icon="⇪"
              orbitMotion={orbitMotion}
            />
            <DockBtn
              label="Marca"
              active={activeTool === "brand"}
              onClick={() => {
                setActiveTool("brand");
                setLeftOpen(true);
              }}
              icon="♥"
              orbitMotion={orbitMotion}
            />
            <DockBtn
              label="Apps"
              active={activeTool === "apps"}
              onClick={() => {
                setActiveTool("apps");
                setLeftOpen(true);
              }}
              icon="⌁"
              orbitMotion={orbitMotion}
            />
          </div>
        )}

        {/* ======== LEFT DRAWER (retraíble) ======== */}
        {!zen && leftOpen && (
          <div className="absolute left-[84px] top-16 bottom-3 z-20 w-[320px] rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,.55)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="text-white font-semibold text-sm">
                {activeTool === "design"
                  ? "Plantillas"
                  : activeTool === "elements"
                  ? "Elementos"
                  : activeTool === "text"
                  ? "Texto"
                  : activeTool === "uploads"
                  ? "Subidos"
                  : activeTool === "brand"
                  ? "Marca"
                  : "Apps"}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]"
                  onClick={resetDoc}
                  title="Reset documento"
                >
                  Reset
                </button>
                <button
                  className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]"
                  onClick={() => setLeftOpen(false)}
                  title="Cerrar panel"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-3 h-full overflow-auto">
              {!hasDoc ? (
                <div className="text-white/60 text-sm">
                  Crea un documento para comenzar.{" "}
                  <span className="text-white/40">(Diseño → elige una plantilla)</span>
                </div>
              ) : null}

              {/* DESIGN: templates */}
              {activeTool === "design" && (
                <div className="space-y-3">
                  {/* Header tipo Canva */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-white text-lg font-semibold leading-tight">
                      ¿Qué vamos a diseñar hoy?
                    </div>
                    <div className="text-white/50 text-xs mt-1">
                      Busca dentro del catálogo de plantillas.
                    </div>

                    <div className="mt-3">
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Busca plantillas: doctores, cosmética, arquitectura, contabilidad..."
                        className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm outline-none focus:border-sky-400/40"
                      />
                    </div>
                  </div>

                  {/* Sección: Formatos */}
                  <div className="flex items-center justify-between">
                    <div className="text-white/80 text-sm font-semibold">Formatos</div>
                    <div className="text-white/40 text-[11px]">Tamaño + fondo</div>
                  </div>

                  <div className="space-y-2">
                    {(formats || []).map((f) => (
                      <button
                        key={f.id}
                        className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-3"
                        onClick={() => createFromTemplate(f)}
                      >
                        <div className="text-white font-medium">{f.title}</div>
                        <div className="text-white/60 text-xs">{f.subtitle}</div>
                      </button>
                    ))}
                  </div>

                  {/* Sección: Plantillas Marketplace */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-white/80 text-sm font-semibold">Plantillas</div>
                    <div className="text-white/40 text-[11px]">
                      {filteredMarket.length} encontradas
                    </div>
                  </div>

                  {filteredMarket.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/60 text-sm">
                      No hay plantillas que coincidan con tu búsqueda.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredMarket.map((t) => (
                        <button
                          key={t.id}
                          className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden text-left
                            hover:scale-[1.02] hover:ring-1 hover:ring-amber-400/25 hover:shadow-[0_18px_60px_rgba(0,0,0,.55)]"
                          onClick={() => {
                            // Paso 3: aquí aplicaremos doc real de plantilla
                            console.log("template click:", t.id);
                          }}
                          title={t.title}
                        >
                          <div className="relative w-full aspect-[4/3] bg-black/30 overflow-hidden">
                            <img
                              src={t.preview || "/templates/previews/demo.jpg"}
                              alt={t.title}
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition duration-300 group-hover:scale-[1.04]"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
                            <div className="absolute bottom-2 left-2 right-2">
                              <div className="text-white text-xs font-semibold truncate">
                                {t.title}
                              </div>
                              <div className="text-white/60 text-[10px] truncate">
                                {t.subtitle || t.category || "Plantilla"}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Mis diseños */}
                  <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-white/5 to-white/0 border border-white/10">
                    <div className="text-white font-semibold text-sm">Mis diseños</div>
                    <div className="text-white/50 text-xs">
                      (Luego conectamos historial por proyecto)
                    </div>
                    <div className="mt-3 text-white/40 text-[11px]">
                      Atajos: <span className="text-white/60">Ctrl/Cmd+Z</span> Undo •{" "}
                      <span className="text-white/60">Ctrl/Cmd+Y</span> Redo •{" "}
                      <span className="text-white/60">Ctrl/Cmd+\</span> Zen •{" "}
                      <span className="text-white/60">Ctrl/Cmd+B</span> Orbit
                    </div>
                  </div>
                </div>
              )}

              {/* ELEMENTS */}
              {activeTool === "elements" && (
                <div className="space-y-3">
                  <div className="text-white/60 text-xs">Figuras rápidas (preview UI)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 text-white text-xs"
                      onClick={addShape}
                      disabled={!hasDoc}
                      title="Agregar rect"
                    >
                      + Rect
                    </button>
                    <button
                      className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white text-xs opacity-70"
                      disabled
                    >
                      + Circle
                    </button>
                    <button
                      className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white text-xs opacity-70"
                      disabled
                    >
                      + Line
                    </button>
                    <button
                      className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white text-xs opacity-70"
                      disabled
                    >
                      + Icon
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-white/80 text-sm font-semibold">Panel Elementos</div>
                    <div className="text-white/50 text-xs mt-1">
                      Aquí meteremos shapes premium, stickers, marcos, HUDs, etc.
                    </div>
                  </div>
                </div>
              )}

              {/* TEXT */}
              {activeTool === "text" && (
                <div className="space-y-3">
                  <button
                    className="w-full px-3 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm"
                    onClick={addText}
                    disabled={!hasDoc}
                  >
                    + Agregar texto
                  </button>

                  <div className="space-y-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-white/80 text-sm font-semibold">Título</div>
                      <div className="text-white/50 text-xs">Preset (próximamente)</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-white/80 text-sm font-semibold">Subtítulo</div>
                      <div className="text-white/50 text-xs">Preset (próximamente)</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="text-white/80 text-sm font-semibold">Cuerpo</div>
                      <div className="text-white/50 text-xs">Preset (próximamente)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Uploads / Brand / Apps */}
              {activeTool === "uploads" && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-white font-semibold">Subidos</div>
                  <div className="text-white/50 text-xs mt-1">
                    Preview UI: aquí irá drag & drop + librería.
                  </div>
                </div>
              )}

              {activeTool === "brand" && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-white font-semibold">Marca</div>
                  <div className="text-white/50 text-xs mt-1">
                    Preview UI: logos, paleta, tipografías guardadas.
                  </div>
                </div>
              )}

              {activeTool === "apps" && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-white font-semibold">Apps</div>
                  <div className="text-white/50 text-xs mt-1">
                    Preview UI: generador IA, QR, mockups, etc.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======== RIGHT DRAWER (Inspector retraíble) ======== */}
        {!zen && rightOpen && (
          <div className="absolute right-3 top-16 bottom-3 z-20 w-[320px] rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,.55)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="text-white font-semibold text-sm">Inspector</div>
              <button
                className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]"
                onClick={() => setRightOpen(false)}
                title="Cerrar inspector"
              >
                ✕
              </button>
            </div>

            <div className="p-3 h-full overflow-auto">
              {!localDoc ? (
                <div className="text-white/50 text-sm">Crea un documento para editar propiedades.</div>
              ) : (
                <InspectorMini doc={localDoc} onChange={commit} />
              )}
            </div>
          </div>
        )}

        {/* ======== CANVAS AREA ======== */}
        <div className="absolute inset-0">
          {!hasDoc ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-xl font-semibold">AUREA STUDIO</div>
                <div className="text-white/60 text-sm mt-1">Abre “Diseño” y elige un formato.</div>
                <div className="text-white/40 text-xs mt-2">
                  Tip: <span className="text-white/60">Ctrl/Cmd+\</span> Zen mode •{" "}
                  <span className="text-white/60">Ctrl/Cmd+B</span> Orbit
                </div>
              </div>
            </div>
          ) : (
            <StudioCanvas doc={localDoc} onChange={commit} compact={true} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Dock Button ----------------------------- */

function DockBtn({ label, icon, active, onClick, orbitMotion }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-[44px] h-[44px] rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition overflow-hidden
      ${
        active
          ? "bg-amber-500/15 border-amber-400/30 text-amber-100"
          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
      }
      hover:scale-[1.03] active:scale-[0.98]`}
      title={label}
    >
      {active ? (
        <span
          className={`pointer-events-none absolute inset-0 rounded-2xl aurea-orbit-border ${
            orbitMotion ? "aurea-orbit-always" : ""
          }`}
        />
      ) : null}
      <div className="relative z-10 text-sm leading-none">{icon}</div>
      <div className="relative z-10 text-[9px] leading-none">{label}</div>
    </button>
  );
}

/* ----------------------------- Inspector Mini ----------------------------- */

function InspectorMini({ doc, onChange }) {
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
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-white/70 text-xs">Documento</div>
        <div className="text-white text-sm mt-1">
          {doc.meta.w}×{doc.meta.h}
        </div>
        <div className="text-white/50 text-xs mt-1">Fondo: {doc.meta.bg}</div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-white/70 text-xs">Capas</div>
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

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-white/70 text-xs">Selección</div>

        {!selected ? (
          <div className="text-white/50 text-sm mt-2">Haz click en un elemento del canvas.</div>
        ) : (
          <div className="space-y-2 mt-2">
            <div className="text-white text-sm">
              Tipo: <span className="text-white/70">{selected.type}</span>
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
                      onChange={(e) => patchSelected({ rotation: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </>
            )}

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
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Premium FX: GlowButton ----------------------------- */

function GlowButton({ children, className = "", variant = "soft", disabled = false, ...props }) {
  const v =
    variant === "amber"
      ? "aurea-glow-amber"
      : variant === "danger"
      ? "aurea-glow-danger"
      : variant === "sky"
      ? "aurea-glow-sky"
      : "aurea-glow-soft";

  return (
    <button
      {...props}
      disabled={disabled}
      className={`group relative isolate overflow-hidden rounded-xl border px-3 py-2 text-xs shadow-[0_14px_35px_rgba(0,0,0,.35)] backdrop-blur-md transition
      ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.01] active:scale-[0.99]"}
      ${v} ${className}`}
    >
      {/* Orbit / border light */}
      <span className="pointer-events-none absolute inset-0 rounded-xl aurea-orbit-border opacity-0 group-hover:opacity-100 transition" />
      {/* Soft glow wash */}
      <span className="pointer-events-none absolute -inset-10 aurea-glow-wash" />
      {/* Content */}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

/* ----------------------------- Premium FX: global CSS ----------------------------- */
/** Pegado dentro del mismo archivo para no tocar globals.css */
function AureaFXStyles() {
  return (
    <style jsx global>{`
      /* ===== Base buttons ===== */
      .aurea-glow-soft {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.10);
        color: rgba(255, 255, 255, 0.92);
      }
      .aurea-glow-amber {
        background: rgba(245, 158, 11, 0.10);
        border-color: rgba(245, 158, 11, 0.25);
        color: rgba(255, 255, 255, 0.95);
      }
      .aurea-glow-sky {
        background: rgba(56, 189, 248, 0.10);
        border-color: rgba(56, 189, 248, 0.25);
        color: rgba(255, 255, 255, 0.95);
      }
      .aurea-glow-danger {
        background: rgba(239, 68, 68, 0.12);
        border-color: rgba(239, 68, 68, 0.28);
        color: rgba(255, 255, 255, 0.95);
      }

      /* Soft glow wash */
      .aurea-glow-wash {
        background: radial-gradient(
          circle at 20% 0%,
          rgba(255, 215, 100, 0.18),
          rgba(0, 0, 0, 0) 55%
        );
        opacity: 0.6;
        transform: translateZ(0);
      }

      /* ✅ Permite animar custom properties en Chrome/Edge */
      @property --aurea-rot {
        syntax: "<angle>";
        inherits: false;
        initial-value: 0deg;
      }

      /* ===== Orbit border (punto recorriendo contorno) ===== */
      .aurea-orbit-border::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 2px; /* grosor borde */

        background: conic-gradient(
          from var(--aurea-rot),
          rgba(255, 215, 100, 0) 0deg,
          rgba(255, 215, 100, 0) 330deg,
          rgba(255, 215, 100, 1) 345deg,
          rgba(255, 215, 100, 0) 360deg
        );

        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;

        filter: drop-shadow(0 0 18px rgba(255, 215, 100, 0.55));
        opacity: 0.95;
        animation: none;
      }

      /* hover motion (GlowButton usa className group) */
      .group:hover .aurea-orbit-border::before {
        animation: aurea-rotate 1.2s linear infinite;
      }

      /* always motion (Dock activo cuando orbitMotion=true) */
      .aurea-orbit-always::before {
        animation: aurea-rotate 1.2s linear infinite;
      }

      @keyframes aurea-rotate {
        0% {
          --aurea-rot: 0deg;
        }
        100% {
          --aurea-rot: 360deg;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .group:hover .aurea-orbit-border::before,
        .aurea-orbit-always::before {
          animation: none !important;
        }
      }
    `}</style>
  );
}
