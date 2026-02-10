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

/** Normaliza rutas de assets dentro de templates (clave para Konva) */
function normalizeAssetSrc(src) {
  if (!src || typeof src !== "string") return src;

  if (
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  ) {
    return src;
  }

  if (src.startsWith("/")) return src;

  let s = src.replace(/^\.\//, "");

  if (s.startsWith("templates/")) return `/${s}`;
  if (s.startsWith("assets/")) return `/templates/${s}`;

  // si ya viene "templates/assets/..." sin slash
  if (s.startsWith("templates/assets/")) return `/${s}`;

  // fallback: todo lo relativo se asume dentro de /templates/
  return `/templates/${s}`;
}

/** normaliza nodos: ids + srcs */
function normalizeNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter(Boolean)
    .map((n) => {
      const nn = { ...n };

      // id always
      nn.id = uid();

      // si el template trae imagen en src/url/imageSrc/etc
      const rawSrc = nn.src || nn.imageSrc || nn.url || nn.href || nn.dataURL || nn.dataUrl || null;
      if (rawSrc) {
        const fixed = normalizeAssetSrc(rawSrc);
        if (nn.src) nn.src = fixed;
        else if (nn.imageSrc) nn.imageSrc = fixed;
        else if (nn.url) nn.url = fixed;
        else nn.src = fixed; // standardize
        // si no tenía type, lo volvemos image (defensivo)
        if (!nn.type) nn.type = "image";
      }

      return nn;
    });
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

async function loadTemplateDoc(itemPath) {
  const res = await fetch(itemPath, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar template item");
  return res.json();
}

/* ----------------------------- PRO Variations Engine ----------------------------- */

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PRO_PALETTES = [
  { bg: "#0B1220", fg: "#F8FAFF", accent: "#FFD764", accent2: "#38BDF8" }, // Aurea gold + sky
  { bg: "#070A12", fg: "#EAF2FF", accent: "#38BDF8", accent2: "#A78BFA" }, // Sky + violet
  { bg: "#0B1022", fg: "#F2F7FF", accent: "#A78BFA", accent2: "#FFD764" }, // Violet + gold
  { bg: "#061018", fg: "#EFFFFB", accent: "#34D399", accent2: "#38BDF8" }, // Emerald + sky
];

const PRO_FONTS = [
  "Inter, system-ui, -apple-system, Segoe UI, Roboto",
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
  "SF Pro Display, Inter, system-ui, -apple-system, Segoe UI, Roboto",
];

function rgba(hex, a = 1) {
  const h = (hex || "#000000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function pickTextNodes(doc) {
  const texts = (doc.nodes || []).filter((n) => n.type === "text");
  const headline = texts[0] || null;
  const sub = texts[1] || null;
  const cta = texts[texts.length - 1] || null;
  return { headline, sub, cta };
}

function addDecorPRO(doc, seedStr) {
  const seed = hashSeed(seedStr);
  const rnd = mulberry32(seed);
  const pal = PRO_PALETTES[Math.floor(rnd() * PRO_PALETTES.length)];
  const font = PRO_FONTS[Math.floor(rnd() * PRO_FONTS.length)];

  const W = doc?.meta?.w || 1080;
  const H = doc?.meta?.h || 1080;

  const archetypes = ["hud_frame", "soft_card", "diagonal", "badge_top"];
  const arch = archetypes[Math.floor(rnd() * archetypes.length)];

  const jitter = (v, amt) => v + (rnd() * 2 - 1) * amt;

  const { headline, sub, cta } = pickTextNodes(doc);

  const restyled = (doc.nodes || []).map((n) => {
    if (n.type === "text") {
      const isHeadline = headline && n.id === headline.id;
      const isSub = sub && n.id === sub.id;
      const isCTA = cta && n.id === cta.id;

      const baseSize = n.fontSize || 28;
      const scale =
        isHeadline ? 0.92 + rnd() * 0.25 : isSub ? 0.9 + rnd() * 0.18 : 0.9 + rnd() * 0.16;

      const fill = isHeadline && rnd() > 0.55 ? pal.accent : isCTA && rnd() > 0.6 ? pal.fg : pal.fg;

      const opacity = isSub ? 0.72 + rnd() * 0.18 : isCTA ? 0.85 + rnd() * 0.12 : 0.92 + rnd() * 0.08;

      return {
        ...n,
        id: uid(),
        fontFamily: font,
        fill: fill.includes("rgba") ? fill : rgba(fill, opacity),
        fontSize: Math.max(14, Math.round(baseSize * scale)),
        x: Math.round(jitter(n.x || 0, isHeadline ? 8 : 14)),
        y: Math.round(jitter(n.y || 0, isHeadline ? 8 : 14)),
      };
    }

    if (n.type === "rect") {
      const alpha = 0.06 + rnd() * 0.12;
      return {
        ...n,
        id: uid(),
        fill: `rgba(255,255,255,${alpha.toFixed(3)})`,
        cornerRadius: Math.round((n.cornerRadius || 18) * (0.9 + rnd() * 0.6)),
        x: Math.round(jitter(n.x || 0, 10)),
        y: Math.round(jitter(n.y || 0, 10)),
      };
    }

    // IMPORTANTE: si es imagen, NO tocamos src, solo id
    if (n.type === "image") {
      return { ...n, id: uid() };
    }

    return { ...n, id: uid() };
  });

  const deco = [];

  if (arch === "hud_frame" || rnd() > 0.55) {
    const pad = Math.round(44 + rnd() * 22);
    deco.push(
      {
        id: uid(),
        type: "rect",
        x: pad,
        y: pad,
        width: W - pad * 2,
        height: H - pad * 2,
        fill: "rgba(255,255,255,0.00)",
        stroke: rgba(pal.fg, 0.14),
        strokeWidth: 2,
        cornerRadius: 28,
        draggable: false,
        listening: false,
      },
      {
        id: uid(),
        type: "rect",
        x: pad + 10,
        y: pad + 10,
        width: W - (pad + 10) * 2,
        height: H - (pad + 10) * 2,
        fill: "rgba(255,255,255,0.00)",
        stroke: rgba(pal.accent, 0.18),
        strokeWidth: 2,
        cornerRadius: 22,
        draggable: false,
        listening: false,
      }
    );
  }

  if (arch === "soft_card" || rnd() > 0.45) {
    const bw = Math.round(W * (0.62 + rnd() * 0.22));
    const bh = Math.round(92 + rnd() * 30);
    deco.push({
      id: uid(),
      type: "rect",
      x: Math.round((W - bw) / 2),
      y: Math.round(H - bh - (70 + rnd() * 30)),
      width: bw,
      height: bh,
      fill: rgba("#FFFFFF", 0.06),
      cornerRadius: 26,
      draggable: false,
      listening: false,
    });
  }

  if (arch === "diagonal" || rnd() > 0.62) {
    deco.push({
      id: uid(),
      type: "rect",
      x: Math.round(-W * 0.1),
      y: Math.round(H * (0.18 + rnd() * 0.12)),
      width: Math.round(W * 1.2),
      height: Math.round(120 + rnd() * 110),
      fill: rgba(pal.accent, 0.06),
      rotation: -12 + rnd() * 10,
      cornerRadius: 36,
      draggable: false,
      listening: false,
    });
  }

  if (arch === "badge_top" || rnd() > 0.5) {
    deco.push(
      {
        id: uid(),
        type: "rect",
        x: 70,
        y: 66,
        width: Math.round(180 + rnd() * 120),
        height: 48,
        fill: rgba(pal.accent, 0.18),
        cornerRadius: 16,
        draggable: false,
        listening: false,
      },
      {
        id: uid(),
        type: "text",
        x: 88,
        y: 79,
        text: rnd() > 0.5 ? "OFERTA" : "NUEVO",
        fontSize: 18,
        fontFamily: font,
        fill: rgba(pal.fg, 0.92),
        draggable: false,
        listening: false,
      }
    );
  }

  const dots = Math.round(14 + rnd() * 26);
  for (let i = 0; i < dots; i++) {
    const s = Math.round(6 + rnd() * 10);
    deco.push({
      id: uid(),
      type: "rect",
      x: Math.round(rnd() * (W - s)),
      y: Math.round(rnd() * (H - s)),
      width: s,
      height: s,
      fill: rgba(rnd() > 0.7 ? pal.accent2 : pal.accent, 0.10 + rnd() * 0.18),
      cornerRadius: 999,
      draggable: false,
      listening: false,
    });
  }

  const nodes2 = restyled.map((n) => {
    if (n.type !== "text") return n;

    const isHeadline = headline && n.text && headline.text && n.text === headline.text;
    const isSub = sub && n.text && sub.text && n.text === sub.text;
    const isCTA = cta && n.text && cta.text && n.text === cta.text;

    if (isHeadline) return { ...n, x: Math.round(W * 0.12), y: Math.round(H * 0.18), fill: rgba(pal.fg, 0.95) };
    if (isSub) return { ...n, x: Math.round(W * 0.12), y: Math.round(H * 0.27), fill: rgba(pal.fg, 0.75) };

    if (isCTA) {
      return {
        ...n,
        x: Math.round(W * 0.18),
        y: Math.round(H * 0.78),
        fontSize: Math.max(16, Math.round((n.fontSize || 26) * (0.9 + rnd() * 0.12))),
        fill: rgba(pal.fg, 0.82),
      };
    }

    return n;
  });

  // fondo PRO (sólido)
  const bgRect = {
    id: uid(),
    type: "rect",
    x: 0,
    y: 0,
    width: W,
    height: H,
    fill: pal.bg,
    draggable: false,
    listening: false,
  };

  const finalNodes = [bgRect, ...deco, ...nodes2];

  return {
    ...doc,
    meta: { ...doc.meta, bg: pal.bg },
    nodes: finalNodes,
    selectedId: null,
  };
}

function applyProVariation(baseDoc, seedStr) {
  return addDecorPRO(baseDoc, seedStr);
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

  const [marketTemplates, setMarketTemplates] = useState([]);
  const [q, setQ] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

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
      const hay = [t.title, t.subtitle, t.category, ...(Array.isArray(t.tags) ? t.tags : [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(qq);
    });
  }, [marketTemplates, q]);

  const [localDoc, setLocalDoc] = useState(() => normalizeDoc(externalDoc));

  const undoRef = useRef([]);
  const redoRef = useRef([]);

  const [activeTool, setActiveTool] = useState("design");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [zen, setZen] = useState(false);

  const [orbitMotion, setOrbitMotion] = useState(false);

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

  const createFromFormat = (t) => {
    const next = makeEmptyDoc(t);
    undoRef.current = [];
    redoRef.current = [];
    setSelectedTemplate(null);
    commit(next, { silent: true });
    onNewFromTemplate?.(t);
  };

  const resetDoc = () => {
    setLocalDoc(null);
    undoRef.current = [];
    redoRef.current = [];
    setSelectedTemplate(null);
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

  const applyTemplateVariation = useCallback(
    async (tpl, i) => {
      if (!tpl?.itemPath) return;

      const base = await loadTemplateDoc(tpl.itemPath);
      const fmt = (formats || []).find((f) => f.id === tpl.formatId) || null;

      const baseDoc = normalizeDoc({
        meta: {
          w: fmt?.w ?? base?.meta?.w ?? 1080,
          h: fmt?.h ?? base?.meta?.h ?? 1080,
          bg: fmt?.bg ?? base?.meta?.bg ?? "#0B1220",
          zoom: 1,
          panX: 0,
          panY: 0,
          presetKey: `${tpl.id}::v${i}`,
        },
        // ✅ AQUI VA EL FIX: normalizamos ids + rutas de imagen
        nodes: normalizeNodes(base?.nodes || []),
        selectedId: null,
      });

      const proDoc = applyProVariation(baseDoc, `${tpl.id}::v${i}`);

      undoRef.current = [];
      redoRef.current = [];
      commit(proDoc, { silent: true });
    },
    [commit, formats]
  );

  /* ----------------------------- Layout ----------------------------- */

  return (
    <div className={`w-full ${compact ? "h-[70vh]" : "h-[78vh]"} relative`}>
      <AureaFXStyles />

      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <GlowButton onClick={undo} disabled={!undoRef.current.length} title="Undo (Ctrl/Cmd+Z)">
            Undo
          </GlowButton>

          <GlowButton onClick={redo} disabled={!redoRef.current.length} title="Redo (Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z)">
            Redo
          </GlowButton>

          <GlowButton onClick={toggleZen} title="Zen (Ctrl/Cmd+\)" variant={zen ? "amber" : "soft"}>
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
            {localDoc.meta.w}×{localDoc.meta.h} • zoom {localDoc.meta.zoom?.toFixed?.(2) ?? "—"}
          </div>
        ) : null}
      </div>

      <div className={`absolute inset-0 ${zen ? "p-0" : ""}`}>
        {!zen && (
          <div className="absolute left-3 top-16 bottom-3 z-20 w-[78px] rounded-2xl border border-white/10 bg-black/35 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,.55)] flex flex-col items-center py-3 gap-2">
            <DockBtn label="Diseño" active={activeTool === "design"} onClick={() => { setActiveTool("design"); setLeftOpen(true); }} icon="▦" orbitMotion={orbitMotion} />
            <DockBtn label="Elementos" active={activeTool === "elements"} onClick={() => { setActiveTool("elements"); setLeftOpen(true); }} icon="⬡" orbitMotion={orbitMotion} />
            <DockBtn label="Texto" active={activeTool === "text"} onClick={() => { setActiveTool("text"); setLeftOpen(true); }} icon="T" orbitMotion={orbitMotion} />
            <DockBtn label="Subidos" active={activeTool === "uploads"} onClick={() => { setActiveTool("uploads"); setLeftOpen(true); }} icon="⇪" orbitMotion={orbitMotion} />
            <DockBtn label="Marca" active={activeTool === "brand"} onClick={() => { setActiveTool("brand"); setLeftOpen(true); }} icon="♥" orbitMotion={orbitMotion} />
            <DockBtn label="Apps" active={activeTool === "apps"} onClick={() => { setActiveTool("apps"); setLeftOpen(true); }} icon="⌁" orbitMotion={orbitMotion} />
          </div>
        )}

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
                <button className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]" onClick={resetDoc} title="Reset documento">
                  Reset
                </button>
                <button className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]" onClick={() => setLeftOpen(false)} title="Cerrar panel">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-3 h-full overflow-auto">
              {!hasDoc ? (
                <div className="text-white/60 text-sm">
                  Crea un documento para comenzar. <span className="text-white/40">(Diseño → elige una plantilla)</span>
                </div>
              ) : null}

              {activeTool === "design" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-white text-lg font-semibold leading-tight">¿Qué vamos a diseñar hoy?</div>
                    <div className="text-white/50 text-xs mt-1">Busca dentro del catálogo de plantillas.</div>

                    <div className="mt-3">
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Busca plantillas: doctores, cosmética, arquitectura, contabilidad..."
                        className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm outline-none focus:border-sky-400/40"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-white/80 text-sm font-semibold">Formatos</div>
                    <div className="text-white/40 text-[11px]">Tamaño + fondo</div>
                  </div>

                  <div className="space-y-2">
                    {(formats || []).map((f) => (
                      <button
                        key={f.id}
                        className="w-full text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-3"
                        onClick={() => createFromFormat(f)}
                      >
                        <div className="text-white font-medium">{f.title}</div>
                        <div className="text-white/60 text-xs">{f.subtitle}</div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-white/80 text-sm font-semibold">Plantillas</div>
                    <div className="text-white/40 text-[11px]">{filteredMarket.length} encontradas</div>
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
                          onClick={async () => {
                            try {
                              setSelectedTemplate(t);
                              await applyTemplateVariation(t, 0);
                            } catch (e) {
                              console.error(e);
                            }
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
                              <div className="text-white text-xs font-semibold truncate">{t.title}</div>
                              <div className="text-white/60 text-[10px] truncate">{t.subtitle || t.category || "Plantilla"}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedTemplate ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-white/80 text-sm font-semibold">Variaciones PRO</div>
                        <div className="text-white/40 text-[11px]">{selectedTemplate.proVariations || 24} estilos</div>
                      </div>

                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {Array.from({ length: selectedTemplate.proVariations || 24 }).map((_, i) => (
                          <button
                            key={i}
                            className="rounded-xl border border-white/10 bg-black/20 hover:bg-white/10 text-white/70 text-[11px] py-2"
                            onClick={async () => {
                              try {
                                await applyTemplateVariation(selectedTemplate, i);
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            title={`Aplicar variación ${i + 1}`}
                          >
                            V{i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-white/5 to-white/0 border border-white/10">
                    <div className="text-white font-semibold text-sm">Mis diseños</div>
                    <div className="text-white/50 text-xs">(Luego conectamos historial por proyecto)</div>
                    <div className="mt-3 text-white/40 text-[11px]">
                      Atajos: <span className="text-white/60">Ctrl/Cmd+Z</span> Undo •{" "}
                      <span className="text-white/60">Ctrl/Cmd+Y</span> Redo •{" "}
                      <span className="text-white/60">Ctrl/Cmd+\</span> Zen •{" "}
                      <span className="text-white/60">Ctrl/Cmd+B</span> Orbit
                    </div>
                  </div>
                </div>
              )}

              {activeTool === "elements" && (
                <div className="space-y-3">
                  <div className="text-white/60 text-xs">Figuras rápidas (preview UI)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 text-white text-xs" onClick={addShape} disabled={!hasDoc} title="Agregar rect">
                      + Rect
                    </button>
                    <button className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white text-xs opacity-70" disabled>
                      + Circle
                    </button>
                    <button className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white text-xs opacity-70" disabled>
                      + Line
                    </button>
                    <button className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white text-xs opacity-70" disabled>
                      + Icon
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-white/80 text-sm font-semibold">Panel Elementos</div>
                    <div className="text-white/50 text-xs mt-1">Aquí meteremos shapes premium, stickers, marcos, HUDs, etc.</div>
                  </div>
                </div>
              )}

              {activeTool === "text" && (
                <div className="space-y-3">
                  <button className="w-full px-3 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm" onClick={addText} disabled={!hasDoc}>
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

              {activeTool === "uploads" && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-white font-semibold">Subidos</div>
                  <div className="text-white/50 text-xs mt-1">Preview UI: aquí irá drag & drop + librería.</div>
                </div>
              )}

              {activeTool === "brand" && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-white font-semibold">Marca</div>
                  <div className="text-white/50 text-xs mt-1">Preview UI: logos, paleta, tipografías guardadas.</div>
                </div>
              )}

              {activeTool === "apps" && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-white font-semibold">Apps</div>
                  <div className="text-white/50 text-xs mt-1">Preview UI: generador IA, QR, mockups, etc.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {!zen && rightOpen && (
          <div className="absolute right-3 top-16 bottom-3 z-20 w-[320px] rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,.55)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="text-white font-semibold text-sm">Inspector</div>
              <button className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-[11px]" onClick={() => setRightOpen(false)} title="Cerrar inspector">
                ✕
              </button>
            </div>

            <div className="p-3 h-full overflow-auto">
              {!localDoc ? <div className="text-white/50 text-sm">Crea un documento para editar propiedades.</div> : <InspectorMini doc={localDoc} onChange={commit} />}
            </div>
          </div>
        )}

        <div className="absolute inset-0">
          {!hasDoc ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-xl font-semibold">AUREA STUDIO</div>
                <div className="text-white/60 text-sm mt-1">Abre “Diseño” y elige un formato.</div>
                <div className="text-white/40 text-xs mt-2">
                  Tip: <span className="text-white/60">Ctrl/Cmd+\</span> Zen mode • <span className="text-white/60">Ctrl/Cmd+B</span> Orbit
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
      className={`group relative w-[60px] h-[58px] rounded-2xl border flex flex-col items-center justify-center gap-1 transition overflow-hidden
      ${active ? "bg-amber-500/15 border-amber-400/30 text-amber-100" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}
      hover:scale-[1.03] active:scale-[0.98]`}
      title={label}
    >
      <span className={`pointer-events-none absolute inset-0 rounded-2xl aurea-orbit-border transition ${orbitMotion ? "aurea-orbit-always opacity-100" : active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
      <span className="pointer-events-none absolute -inset-10 aurea-glow-wash opacity-40 group-hover:opacity-70 transition" />
      <div className="relative z-10 text-[18px] leading-none">{icon}</div>
      <div className="relative z-10 text-[10px] leading-none tracking-wide">{label}</div>
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
    const next = { ...doc, nodes: doc.nodes.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)) };
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
              n.type === "text" ? (n.text || "Texto").slice(0, 18) : n.type === "rect" ? "Shape" : n.type;

            return (
              <button
                key={n.id}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 border transition ${
                  isSel ? "bg-sky-500/10 border-sky-400/30 text-white" : "bg-black/20 border-white/10 text-white/80 hover:bg-white/5"
                }`}
                onClick={() => onChange({ ...doc, selectedId: n.id })}
                title={label}
              >
                <div className="text-xs flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px]">{n.type}</span>
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
                <input className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm" value={selected.text || ""} onChange={(e) => patchSelected({ text: e.target.value })} />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-white/60 text-xs">Tamaño</label>
                    <input type="number" className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm" value={selected.fontSize || 32} onChange={(e) => patchSelected({ fontSize: Number(e.target.value) || 32 })} />
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs">Color</label>
                    <input className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm" value={selected.fill || "#E9EEF9"} onChange={(e) => patchSelected({ fill: e.target.value })} />
                  </div>
                </div>
              </>
            )}

            {selected.type === "rect" && (
              <>
                <label className="block text-white/60 text-xs mt-2">Color</label>
                <input className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm" value={selected.fill || "#2B3A67"} onChange={(e) => patchSelected({ fill: e.target.value })} />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-white/60 text-xs">Radius</label>
                    <input type="number" className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm" value={selected.cornerRadius || 0} onChange={(e) => patchSelected({ cornerRadius: Number(e.target.value) || 0 })} />
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs">Rotación</label>
                    <input type="number" className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-white text-sm" value={selected.rotation || 0} onChange={(e) => patchSelected({ rotation: Number(e.target.value) || 0 })} />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs" onClick={duplicate}>
                Duplicar
              </button>
              <button className="flex-1 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 text-xs" onClick={deleteSelected}>
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
      <span className="pointer-events-none absolute inset-0 rounded-xl aurea-orbit-border opacity-0 group-hover:opacity-100 transition" />
      <span className="pointer-events-none absolute -inset-10 aurea-glow-wash" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

/* ----------------------------- Premium FX: global CSS ----------------------------- */

function AureaFXStyles() {
  return (
    <style jsx global>{`
      .aurea-glow-soft {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.92);
      }
      .aurea-glow-amber {
        background: rgba(245, 158, 11, 0.1);
        border-color: rgba(245, 158, 11, 0.25);
        color: rgba(255, 255, 255, 0.95);
      }
      .aurea-glow-sky {
        background: rgba(56, 189, 248, 0.1);
        border-color: rgba(56, 189, 248, 0.25);
        color: rgba(255, 255, 255, 0.95);
      }
      .aurea-glow-danger {
        background: rgba(239, 68, 68, 0.12);
        border-color: rgba(239, 68, 68, 0.28);
        color: rgba(255, 255, 255, 0.95);
      }

      .aurea-glow-wash {
        background: radial-gradient(circle at 20% 0%, rgba(255, 215, 100, 0.18), rgba(0, 0, 0, 0) 55%);
        opacity: 0.6;
        transform: translateZ(0);
      }

      @property --aurea-rot {
        syntax: "<angle>";
        inherits: false;
        initial-value: 0deg;
      }

      .aurea-orbit-border::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 2px;

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

      .group:hover .aurea-orbit-border::before {
        animation: aurea-rotate 1.2s linear infinite;
      }

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
