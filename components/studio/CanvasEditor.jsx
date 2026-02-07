"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import StudioCanvas from "./StudioCanvas";

/**
 * CanvasEditor
 * - Rail (iconos) estilo Canva
 * - Panel izquierdo flotante (Design/Elements/Text/Uploads/Brand/Apps)
 * - Inspector flotante derecho (Propiedades)
 * - Zen mode: oculta TODO para dejar pantalla enorme
 *
 * Props esperadas:
 *  - doc: documento del canvas (meta/nodes/selectedId)
 *  - onChange: (nextDoc)=>void
 */
export default function CanvasEditor({ doc, onChange }) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [zen, setZen] = useState(false);
  const [activeTool, setActiveTool] = useState("design"); // design|elements|text|uploads|brand|apps

  const toggleZen = useCallback(() => {
    setZen((v) => !v);
    // cuando entras a zen, oculta ambos
    setLeftOpen(false);
    setRightOpen(false);
  }, []);

  // Hotkeys
  useEffect(() => {
    const onKeyDown = (e) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + \  -> toggle panel izquierdo
      if (isMod && e.key === "\\") {
        e.preventDefault();
        setLeftOpen((v) => !v);
      }

      // Ctrl/Cmd + i -> toggle inspector
      if (isMod && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setRightOpen((v) => !v);
      }

      // Z -> Zen (si no estás escribiendo)
      if (!isMod && (e.key === "z" || e.key === "Z")) {
        const el = document.activeElement;
        const tag = (el?.tagName || "").toLowerCase();
        const inputLike = tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable;
        if (!inputLike) toggleZen();
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleZen]);

  const selectedId = doc?.selectedId || null;
  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    return (doc?.nodes || []).find((n) => n.id === selectedId) || null;
  }, [doc?.nodes, selectedId]);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B1220]">
      {/* Top micro header (se va en ZEN) */}
      {!zen && (
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
              onClick={() => setLeftOpen((v) => !v)}
              title="Panel (Ctrl/Cmd+\)"
            >
              Panel
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
              onClick={() => setRightOpen((v) => !v)}
              title="Inspector (Ctrl/Cmd+I)"
            >
              Inspector
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/20 hover:bg-amber-500/25 text-amber-100 text-xs"
              onClick={toggleZen}
              title="Zen (Z)"
            >
              ZEN
            </button>

            <div className="ml-2 hidden lg:flex items-center gap-2 text-[11px] text-white/50">
              <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">Z = Zen</span>
              <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">Ctrl/Cmd+\ = Panel</span>
              <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">Ctrl/Cmd+I = Inspector</span>
            </div>
          </div>

          <div className="text-white/60 text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            AUREA CANVAS • {doc?.meta?.w || 1080}×{doc?.meta?.h || 1080}
          </div>
        </div>
      )}

      {/* Rail vertical estilo Canva (se va en ZEN) */}
      {!zen && (
        <div className="absolute left-3 top-16 bottom-3 z-30 w-[64px] rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,.45)] flex flex-col items-center py-2 gap-2">
          <RailBtn label="Diseño" active={activeTool === "design"} onClick={() => { setActiveTool("design"); setLeftOpen(true); }} />
          <RailBtn label="Elementos" active={activeTool === "elements"} onClick={() => { setActiveTool("elements"); setLeftOpen(true); }} />
          <RailBtn label="Texto" active={activeTool === "text"} onClick={() => { setActiveTool("text"); setLeftOpen(true); }} />
          <RailBtn label="Subidos" active={activeTool === "uploads"} onClick={() => { setActiveTool("uploads"); setLeftOpen(true); }} />
          <RailBtn label="Marca" active={activeTool === "brand"} onClick={() => { setActiveTool("brand"); setLeftOpen(true); }} />
          <div className="flex-1" />
          <RailBtn label="Apps" active={activeTool === "apps"} onClick={() => { setActiveTool("apps"); setLeftOpen(true); }} />
        </div>
      )}

      {/* Panel izquierdo flotante (se va en ZEN) */}
      {!zen && (
        <div
          className={`absolute left-[84px] top-16 bottom-3 z-30 w-[340px] rounded-2xl bg-[#060A12]/70 border border-white/10 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,.55)]
          transition-all duration-200 ${leftOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3 pointer-events-none"}`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="text-white/90 text-sm font-semibold tracking-wide">
              {activeToolTitle(activeTool)}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]"
                onClick={() => setLeftOpen(false)}
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-3 h-full overflow-auto">
            {/* Solo preview UI por ahora */}
            {activeTool === "design" && <DesignPanelPreview onPickPreset={(w,h)=>onChange?.({...(doc||{}), meta:{...(doc?.meta||{}), w, h, panX:0, panY:0, zoom:1}})} />}
            {activeTool === "elements" && <ElementsPanelPreview />}
            {activeTool === "text" && <TextPanelPreview onAddText={() => {/* luego lo conectamos */}} />}
            {activeTool === "uploads" && <UploadsPanelPreview />}
            {activeTool === "brand" && <BrandPanelPreview />}
            {activeTool === "apps" && <AppsPanelPreview />}
          </div>
        </div>
      )}

      {/* Inspector derecho flotante (se va en ZEN) */}
      {!zen && (
        <div
          className={`absolute right-3 top-16 bottom-3 z-30 w-[360px] rounded-2xl bg-[#060A12]/70 border border-white/10 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,.55)]
          transition-all duration-200 ${rightOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-3 pointer-events-none"}`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="text-white/90 text-sm font-semibold tracking-wide">Inspector</div>
            <button
              className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]"
              onClick={() => setRightOpen(false)}
              title="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="p-3 h-full overflow-auto space-y-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-white/70 text-xs">Selección</div>
              <div className="text-white/90 text-sm mt-1">
                {selectedNode ? `${String(selectedNode.type).toUpperCase()} • ${selectedNode.id.slice(-6)}` : "—"}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-white/70 text-xs">Documento</div>
              <div className="text-white/90 text-sm mt-1">
                Fondo: <span className="text-white/70">{doc?.meta?.bg || "#0B1220"}</span>
              </div>
              <div className="text-white/60 text-xs mt-2">
                (Por ahora preview. Luego conectamos sliders, color picker, capas, etc.)
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-white/70 text-xs">AUREA Tips</div>
              <div className="text-white/60 text-xs mt-2 leading-relaxed">
                Próximo: drag & drop, snapping, layers, assets, presets por red social.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas ocupa TODO el espacio (en Zen ocupa ABSOLUTAMENTE TODO) */}
      <div className="absolute inset-0">
        <StudioCanvas doc={doc} onChange={onChange} compact={zen} />
      </div>
    </div>
  );
}

/* ----------------------------- UI Bits ----------------------------- */

function RailBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-[52px] h-[52px] rounded-2xl border flex flex-col items-center justify-center gap-1 transition
      ${active ? "bg-amber-500/15 border-amber-400/25 text-amber-100" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
      title={label}
    >
      <div className="w-5 h-5 rounded-lg bg-white/10 border border-white/10" />
      <div className="text-[10px] leading-none">{label}</div>
    </button>
  );
}

function activeToolTitle(key) {
  if (key === "design") return "Diseño";
  if (key === "elements") return "Elementos";
  if (key === "text") return "Texto";
  if (key === "uploads") return "Subidos";
  if (key === "brand") return "Marca";
  if (key === "apps") return "Apps";
  return "Panel";
}

/* ----------------------------- Panel Previews (solo UI) ----------------------------- */

function Block({ title, subtitle, right, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-white/90 text-sm font-semibold">{title}</div>
          {subtitle && <div className="text-white/50 text-xs mt-0.5">{subtitle}</div>}
        </div>
        {right && <div className="text-white/40 text-xs">{right}</div>}
      </div>
    </button>
  );
}

function DesignPanelPreview({ onPickPreset }) {
  return (
    <div className="space-y-3">
      <div className="text-white/60 text-xs">Plantillas (preview)</div>
      <Block title="Instagram Post" subtitle="1080×1080" right="Pro" onClick={() => onPickPreset?.(1080, 1080)} />
      <Block title="Instagram Story" subtitle="1080×1920" right="Pro" onClick={() => onPickPreset?.(1080, 1920)} />
      <Block title="Facebook Cover" subtitle="1640×624" right="Pro" onClick={() => onPickPreset?.(1640, 624)} />
      <div className="pt-2 text-white/40 text-[11px]">
        Luego conectamos: categorías, búsqueda, assets premium, etc.
      </div>
    </div>
  );
}

function ElementsPanelPreview() {
  return (
    <div className="space-y-3">
      <div className="text-white/60 text-xs">Elementos (preview)</div>
      <div className="grid grid-cols-3 gap-2">
        {["Rect", "Circle", "Line", "Star", "Arrow", "Frame"].map((x) => (
          <div key={x} className="h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 text-xs">
            {x}
          </div>
        ))}
      </div>
      <div className="text-white/40 text-[11px]">Luego: SVG, stickers, icon packs, shapes pro.</div>
    </div>
  );
}

function TextPanelPreview() {
  return (
    <div className="space-y-3">
      <div className="text-white/60 text-xs">Texto (preview)</div>
      <Block title="Agregar título" subtitle="Estilo cine" />
      <Block title="Agregar subtítulo" subtitle="Estilo limpio" />
      <Block title="Agregar párrafo" subtitle="Lectura rápida" />
      <div className="text-white/40 text-[11px]">Luego: tipografías, presets, spacing, estilos guardados.</div>
    </div>
  );
}

function UploadsPanelPreview() {
  return (
    <div className="space-y-3">
      <div className="text-white/60 text-xs">Subidos (preview)</div>
      <div className="h-28 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 text-xs">
        Drag & drop aquí (próximo)
      </div>
      <div className="text-white/40 text-[11px]">Luego: librería por proyecto + historial.</div>
    </div>
  );
}

function BrandPanelPreview() {
  return (
    <div className="space-y-3">
      <div className="text-white/60 text-xs">Marca (preview)</div>
      <Block title="Paleta" subtitle="Negro + Dorado AUREA" />
      <Block title="Logos" subtitle="PNG/SVG" />
      <Block title="Estilos" subtitle="Botones + cards" />
      <div className="text-white/40 text-[11px]">Luego: brand kits por usuario.</div>
    </div>
  );
}

function AppsPanelPreview() {
  return (
    <div className="space-y-3">
      <div className="text-white/60 text-xs">Apps (preview)</div>
      <Block title="Generar imagen IA" subtitle="Firefly-like (próximo)" />
      <Block title="Mockups" subtitle="Pro pipeline" />
      <Block title="QR / Código" subtitle="Generador" />
      <div className="text-white/40 text-[11px]">Luego: marketplace.</div>
    </div>
  );
}
