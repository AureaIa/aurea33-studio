// components/studio/StudioCanvas.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Line } from "react-konva";

/* -------------------------------- Utils -------------------------------- */

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function deepCopy(x) {
  return JSON.parse(JSON.stringify(x));
}

function snapVal(v, snap = 6) {
  return Math.round(v / snap) * snap;
}

function rgbaToHexOrRaw(v) {
  // si es rgba(...) lo dejamos, si es #... lo dejamos
  return typeof v === "string" ? v : "#ffffff";
}

/* --------------------------- Image loader hook -------------------------- */
function useHtmlImage(src) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!src) return setImg(null);
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setImg(image);
    image.src = src;
  }, [src]);
  return img;
}

/* ------------------------------ Defaults -------------------------------- */

const FONTS = ["Inter", "Arial", "Helvetica", "Montserrat", "Poppins", "Roboto", "Times New Roman", "Georgia", "Impact"];
const TOOL = { SELECT: "select", TEXT: "text", RECT: "rect", IMAGE: "image" };
const ALIGN = ["left", "center", "right"];

/* ------------------------------ Geometry -------------------------------- */

function getNodeRect(n) {
  // Approx rect used for marquee/snap
  if (!n) return { x: 0, y: 0, width: 0, height: 0 };
  if (n.type === "text") return { x: n.x || 0, y: n.y || 0, width: n.width || 600, height: (n.fontSize || 48) * 1.2 };
  return { x: n.x || 0, y: n.y || 0, width: n.width || 10, height: n.height || 10 };
}

/* ------------------------------ Main ------------------------------------ */

export default function StudioCanvas({ doc, onChange, compact }) {
  const isClient = typeof window !== "undefined";

  const stageRef = useRef(null);
  const trRef = useRef(null);

  const [tool, setTool] = useState(TOOL.SELECT);

  const [selectedIds, setSelectedIds] = useState([]);
  const selectedId = selectedIds?.[0] || null;

  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const [marquee, setMarquee] = useState(null); // {x,y,w,h}
  const [clipboard, setClipboard] = useState(null);

  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Zoom/Pan (viewport transform)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

  // Guides
  const [guides, setGuides] = useState([]); // [{type:'v',x},{type:'h',y}]

  // Undo/Redo history (in-memory)
  const historyRef = useRef({ stack: [], index: -1 });

  const width = doc?.width || 1080;
  const height = doc?.height || 1080;
  const background = doc?.background || "#0b0b0c";
  const nodes = doc?.nodes || [];

  const viewport = useMemo(() => {
    const w = compact ? 820 : 980;
    const h = compact ? 560 : 700;
    const r = width / height;
    let vw = w;
    let vh = Math.round(w / r);
    if (vh > h) {
      vh = h;
      vw = Math.round(h * r);
    }
    return { vw, vh };
  }, [width, height, compact]);

  const stageSize = useMemo(() => ({ w: viewport.vw, h: viewport.vh }), [viewport]);

  const activeNode = useMemo(() => {
    return selectedId ? nodes.find((n) => n.id === selectedId) : null;
  }, [nodes, selectedId]);

  const selectedNodes = useMemo(() => {
    const set = new Set(selectedIds);
    return nodes.filter((n) => set.has(n.id));
  }, [nodes, selectedIds]);

  /* ------------------------------ Commit -------------------------------- */

  const commit = useCallback(
    (patch, { pushHistory = true } = {}) => {
      const nextDoc = { ...(doc || {}), ...patch, updatedAt: Date.now() };

      if (pushHistory) {
        const h = historyRef.current;
        const snap = deepCopy(nextDoc);
        h.stack = h.stack.slice(0, h.index + 1);
        h.stack.push(snap);
        h.index = h.stack.length - 1;
      }
      onChange?.(nextDoc);
    },
    [doc, onChange]
  );

  const pushHistoryNow = useCallback(() => {
    if (!doc) return;
    const h = historyRef.current;
    const snap = deepCopy(doc);
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(snap);
    h.index = h.stack.length - 1;
  }, [doc]);

  useEffect(() => {
    if (!doc) return;
    const h = historyRef.current;
    if (h.stack.length === 0) {
      h.stack = [deepCopy(doc)];
      h.index = 0;
    }
  }, [doc]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    onChange?.(deepCopy(h.stack[h.index]));
  }, [onChange]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    onChange?.(deepCopy(h.stack[h.index]));
  }, [onChange]);

  const updateNode = useCallback(
    (id, next, { push = false } = {}) => {
      const nextNodes = nodes.map((n) => (n.id === id ? { ...n, ...next } : n));
      commit({ nodes: nextNodes }, { pushHistory: push });
    },
    [nodes, commit]
  );

  const updateMany = useCallback(
    (ids, patch) => {
      const set = new Set(ids);
      const nextNodes = nodes.map((n) => (set.has(n.id) ? { ...n, ...patch } : n));
      commit({ nodes: nextNodes });
    },
    [nodes, commit]
  );

  const reorder = useCallback(
    (id, dir) => {
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx < 0) return;
      const next = [...nodes];
      const [item] = next.splice(idx, 1);
      if (dir === "front") next.push(item);
      else if (dir === "back") next.unshift(item);
      else if (dir === "up") next.splice(Math.min(next.length, idx + 1), 0, item);
      else if (dir === "down") next.splice(Math.max(0, idx - 1), 0, item);
      commit({ nodes: next });
    },
    [nodes, commit]
  );

  // (continúa en Segmento 2/5)
  /* --------------------------- Add elements ------------------------------ */

  const addText = useCallback(() => {
    const id = uid();
    const n = {
      id,
      name: "Texto",
      type: "text",
      x: 140,
      y: 140,
      text: "Título aquí",
      fontSize: 72,
      fontFamily: "Inter",
      fill: "#f7c600",
      width: 860,
      rotation: 0,
      opacity: 1,
      align: "left",
      draggable: true,
      locked: false,
      hidden: false,
    };
    commit({ nodes: [...nodes, n] });
    setTool(TOOL.SELECT);
    setSelectedIds([id]);
  }, [nodes, commit]);

  const addRect = useCallback(() => {
    const id = uid();
    const n = {
      id,
      name: "Caja",
      type: "rect",
      x: 120,
      y: 760,
      width: 840,
      height: 180,
      fill: "rgba(0,0,0,0.35)",
      cornerRadius: 22,
      rotation: 0,
      opacity: 1,
      draggable: true,
      locked: false,
      hidden: false,
    };
    commit({ nodes: [...nodes, n] });
    setTool(TOOL.SELECT);
    setSelectedIds([id]);
  }, [nodes, commit]);

  const onUpload = useCallback(
    async (file) => {
      if (!file) return;
      const reader = new FileReader();
      const id = uid();
      reader.onload = () => {
        const src = String(reader.result || "");
        const n = {
          id,
          name: "Imagen",
          type: "image",
          x: 120,
          y: 220,
          width: 840,
          height: 520,
          src,
          rotation: 0,
          opacity: 1,
          draggable: true,
          locked: false,
          hidden: false,
        };
        commit({ nodes: [...nodes, n] });
        setTool(TOOL.SELECT);
        setSelectedIds([id]);
      };
      reader.readAsDataURL(file);
    },
    [nodes, commit]
  );

  const removeSelected = useCallback(() => {
    if (!selectedIds?.length) return;
    const set = new Set(selectedIds);
    commit({ nodes: nodes.filter((n) => !set.has(n.id)) });
    setSelectedIds([]);
  }, [selectedIds, nodes, commit]);

  const duplicateSelected = useCallback(() => {
    if (!selectedIds?.length) return;
    const set = new Set(selectedIds);
    const picked = nodes.filter((n) => set.has(n.id));
    if (!picked.length) return;

    const clones = picked.map((n) => ({
      ...deepCopy(n),
      id: uid(),
      x: (n.x || 0) + 24,
      y: (n.y || 0) + 24,
      name: (n.name || n.type) + " (copia)",
    }));

    commit({ nodes: [...nodes, ...clones] });
    setSelectedIds(clones.map((c) => c.id));
  }, [selectedIds, nodes, commit]);

  /* ------------------------------ Export -------------------------------- */

  const exportPNG = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const uri = stage.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = uri;
    a.download = `aurea_studio_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aurea_doc_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [doc]);

  const importJSON = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const next = JSON.parse(String(reader.result || "{}"));
          if (!next || typeof next !== "object") return;
          onChange?.(next);
          setSelectedIds([]);
          setView({ scale: 1, x: 0, y: 0 });
          historyRef.current = { stack: [deepCopy(next)], index: 0 };
        } catch (e) {
          alert("JSON inválido 😵");
        }
      };
      reader.readAsText(file);
    },
    [onChange]
  );

  /* --------------------------- Fit / Center ------------------------------ */

  const fitToView = useCallback(() => {
    const pad = 24;
    const sx = (stageSize.w - pad * 2) / width;
    const sy = (stageSize.h - pad * 2) / height;
    const s = clamp(Math.min(sx, sy), 0.05, 6);
    const x = (stageSize.w - width * s) / 2;
    const y = (stageSize.h - height * s) / 2;
    setView({ scale: s, x, y });
  }, [stageSize.w, stageSize.h, width, height]);

  useEffect(() => {
    if (!isClient) return;
    fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, compact, isClient]);

  /* -------------------------- Transformer sync --------------------------- */

  useEffect(() => {
    if (!isClient) return;
    const stage = stageRef.current;
    const tr = trRef.current;
    if (!stage || !tr) return;

    const konvaNodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean);

    tr.nodes(konvaNodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, nodes, isClient]);

  /* ---------------------------- Keyboard -------------------------------- */

  useEffect(() => {
    if (!isClient) return;

    const onKeyDown = (e) => {
      if (e.code === "Space") {
        setSpaceDown(true);
        return;
      }

      const isCmd = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (key === "delete" || key === "backspace") {
        if (selectedIds.length) {
          e.preventDefault();
          removeSelected();
        }
        return;
      }

      if (isCmd && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if (isCmd && key === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (isCmd && key === "c") {
        e.preventDefault();
        const set = new Set(selectedIds);
        const picked = nodes.filter((n) => set.has(n.id));
        if (picked.length) setClipboard(deepCopy(picked));
        return;
      }

      if (isCmd && key === "v") {
        e.preventDefault();
        if (!clipboard?.length) return;
        const clones = clipboard.map((n) => ({
          ...deepCopy(n),
          id: uid(),
          x: (n.x || 0) + 24,
          y: (n.y || 0) + 24,
          name: (n.name || n.type) + " (pegado)",
        }));
        commit({ nodes: [...nodes, ...clones] });
        setSelectedIds(clones.map((c) => c.id));
        return;
      }

      if (!isCmd) {
        if (key === "v") setTool(TOOL.SELECT);
        if (key === "t") setTool(TOOL.TEXT);
        if (key === "r") setTool(TOOL.RECT);
      }
    };

    const onKeyUp = (e) => {
      if (e.code === "Space") {
        setSpaceDown(false);
        setIsPanning(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isClient, selectedIds, nodes, clipboard, commit, removeSelected, undo, redo, duplicateSelected]);

  // (continúa en Segmento 3/5)
  /* ------------------------------ Helpers -------------------------------- */

  const getPointerDocPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const p = stage.getPointerPosition();
    if (!p) return { x: 0, y: 0 };
    const x = (p.x - view.x) / view.scale;
    const y = (p.y - view.y) / view.scale;
    return { x, y };
  }, [view]);

  const deselectIfEmpty = useCallback(
    (e) => {
      const stage = e.target?.getStage?.();
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty && tool === TOOL.SELECT) setSelectedIds([]);
    },
    [tool]
  );

  /* ------------------------------ Snapping -------------------------------- */

  const calcSnap = useCallback(
    (nodeRect) => {
      const snapDist = 10;

      const guides = [
        { type: "v", x: 0 },
        { type: "v", x: width / 2 },
        { type: "v", x: width },
        { type: "h", y: 0 },
        { type: "h", y: height / 2 },
        { type: "h", y: height },
      ];

      const lines = [];
      let dx = 0;
      let dy = 0;

      const nV = [
        { x: nodeRect.x },
        { x: nodeRect.x + nodeRect.width / 2 },
        { x: nodeRect.x + nodeRect.width },
      ];
      const nH = [
        { y: nodeRect.y },
        { y: nodeRect.y + nodeRect.height / 2 },
        { y: nodeRect.y + nodeRect.height },
      ];

      let bestVX = null;
      for (const g of guides.filter((g) => g.type === "v")) {
        for (const p of nV) {
          const d = g.x - p.x;
          if (Math.abs(d) <= snapDist) {
            if (!bestVX || Math.abs(d) < Math.abs(bestVX.d)) bestVX = { d, g: g.x };
          }
        }
      }
      if (bestVX) {
        dx = bestVX.d;
        lines.push({ type: "v", x: bestVX.g });
      }

      let bestHY = null;
      for (const g of guides.filter((g) => g.type === "h")) {
        for (const p of nH) {
          const d = g.y - p.y;
          if (Math.abs(d) <= snapDist) {
            if (!bestHY || Math.abs(d) < Math.abs(bestHY.d)) bestHY = { d, g: g.y };
          }
        }
      }
      if (bestHY) {
        dy = bestHY.d;
        lines.push({ type: "h", y: bestHY.g });
      }

      return { dx, dy, lines };
    },
    [width, height]
  );

  const onDragMoveSnap = useCallback(
    (konvaNode, nodeModel) => {
      if (!snapEnabled) return;
      const r = {
        x: konvaNode.x(),
        y: konvaNode.y(),
        width: nodeModel.type === "text" ? (nodeModel.width || konvaNode.width()) : konvaNode.width(),
        height: konvaNode.height(),
      };
      const s = calcSnap(r);
      setGuides(s.lines);
      if (s.dx || s.dy) {
        konvaNode.x(konvaNode.x() + s.dx);
        konvaNode.y(konvaNode.y() + s.dy);
      }
    },
    [snapEnabled, calcSnap]
  );

  const clearGuides = useCallback(() => setGuides([]), []);

  /* ---------------------------- Stage events ----------------------------- */

  const onWheel = useCallback(
    (e) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const isCmd = e.evt.ctrlKey || e.evt.metaKey;

      if (!isCmd) {
        // scroll normal = pan
        const dy = e.evt.deltaY;
        const dx = e.evt.deltaX;
        setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
        return;
      }

      // ctrl/cmd + wheel = zoom
      const oldScale = view.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scaleBy = 1.08;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = clamp(direction > 0 ? oldScale * scaleBy : oldScale / scaleBy, 0.08, 8);

      const mousePointTo = {
        x: (pointer.x - view.x) / oldScale,
        y: (pointer.y - view.y) / oldScale,
      };

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      setView({ scale: newScale, x: newPos.x, y: newPos.y });
    },
    [view]
  );

  const onStageMouseDown = useCallback(
    (e) => {
      const stage = e.target.getStage();
      const p = stage.getPointerPosition();
      if (!p) return;

      // Space + drag = pan
      if (spaceDown) {
        setIsPanning(true);
        stage.draggable(true);
        stage.startDrag();
        return;
      } else {
        stage.draggable(false);
      }

      // Place new items with tools
      if (tool === TOOL.TEXT) {
        pushHistoryNow();
        const pos = getPointerDocPos();
        const id = uid();
        const n = {
          id,
          name: "Texto",
          type: "text",
          x: snapEnabled ? snapVal(pos.x) : pos.x,
          y: snapEnabled ? snapVal(pos.y) : pos.y,
          text: "Texto",
          fontSize: 56,
          fontFamily: "Inter",
          fill: "#ffffff",
          width: 600,
          rotation: 0,
          opacity: 1,
          align: "left",
          draggable: true,
          locked: false,
          hidden: false,
        };
        commit({ nodes: [...nodes, n] });
        setTool(TOOL.SELECT);
        setSelectedIds([id]);
        return;
      }

      if (tool === TOOL.RECT) {
        pushHistoryNow();
        const pos = getPointerDocPos();
        const id = uid();
        const n = {
          id,
          name: "Caja",
          type: "rect",
          x: snapEnabled ? snapVal(pos.x) : pos.x,
          y: snapEnabled ? snapVal(pos.y) : pos.y,
          width: 360,
          height: 160,
          fill: "rgba(255,255,255,0.10)",
          cornerRadius: 18,
          rotation: 0,
          opacity: 1,
          draggable: true,
          locked: false,
          hidden: false,
        };
        commit({ nodes: [...nodes, n] });
        setTool(TOOL.SELECT);
        setSelectedIds([id]);
        return;
      }

      // Marquee selection (drag box)
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty && tool === TOOL.SELECT) {
        setSelectedIds([]);
        const docPos = getPointerDocPos();
        setMarquee({ x: docPos.x, y: docPos.y, w: 0, h: 0 });
      }
    },
    [tool, spaceDown, snapEnabled, nodes, commit, pushHistoryNow, getPointerDocPos]
  );

  const onStageMouseMove = useCallback(() => {
    if (!marquee) return;
    const pos = getPointerDocPos();
    const w = pos.x - marquee.x;
    const h = pos.y - marquee.y;
    setMarquee((m) => (m ? { ...m, w, h } : null));
  }, [marquee, getPointerDocPos]);

  const onStageMouseUp = useCallback(() => {
    // end panning
    if (isPanning) {
      const stage = stageRef.current;
      if (stage) {
        const nx = stage.x();
        const ny = stage.y();
        setView((v) => ({ ...v, x: nx, y: ny }));
        stage.position({ x: 0, y: 0 });
        stage.draggable(false);
      }
      setIsPanning(false);
      return;
    }

    // finalize marquee selection
    if (marquee) {
      const x1 = Math.min(marquee.x, marquee.x + marquee.w);
      const y1 = Math.min(marquee.y, marquee.y + marquee.h);
      const x2 = Math.max(marquee.x, marquee.x + marquee.w);
      const y2 = Math.max(marquee.y, marquee.y + marquee.h);

      const hit = nodes
        .filter((n) => !n.hidden)
        .filter((n) => {
          const r = getNodeRect(n);
          return r.x >= x1 && r.y >= y1 && r.x + r.width <= x2 && r.y + r.height <= y2;
        })
        .map((n) => n.id);

      setSelectedIds(hit);
      setMarquee(null);
    }
  }, [isPanning, marquee, nodes]);

  /* --------------------------- Node selection ---------------------------- */

  const onSelectNode = useCallback(
    (id, e) => {
      if (tool !== TOOL.SELECT) return;
      const shift = e?.evt?.shiftKey;
      setSelectedIds((prev) => {
        if (!shift) return [id];
        const set = new Set(prev);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        return Array.from(set);
      });
    },
    [tool]
  );

  // (continúa en Segmento 4/5)
  /* ------------------------------ Render -------------------------------- */

  if (!isClient) return null;

  return (
    <div style={S.wrap}>
      {/* Top Bar */}
      <div style={S.topbar}>
        <div style={S.brand}>
          <div style={{ fontWeight: 950, letterSpacing: 0.2 }}>AUREA STUDIO</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>
            Canvas • {width}×{height} • Zoom {Math.round(view.scale * 100)}%
          </div>
        </div>

        <div style={S.topActions}>
          <button style={btn(tool === TOOL.SELECT ? "on" : "off")} onClick={() => setTool(TOOL.SELECT)}>
            V Select
          </button>
          <button style={btn(tool === TOOL.TEXT ? "on" : "off")} onClick={() => setTool(TOOL.TEXT)}>
            T Texto
          </button>
          <button style={btn(tool === TOOL.RECT ? "on" : "off")} onClick={() => setTool(TOOL.RECT)}>
            R Caja
          </button>

          <label style={btn("off")}>
            + Imagen
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>

          <div style={S.sep} />

          <button style={btn("off")} onClick={undo}>↶ Undo</button>
          <button style={btn("off")} onClick={redo}>↷ Redo</button>

          <div style={S.sep} />

          <button style={btn("off")} onClick={() => setShowGrid((v) => !v)}>
            {showGrid ? "Grid ON" : "Grid OFF"}
          </button>
          <button style={btn("off")} onClick={() => setSnapEnabled((v) => !v)}>
            {snapEnabled ? "Snap ON" : "Snap OFF"}
          </button>
          <button style={btn("off")} onClick={fitToView}>Fit</button>

          <div style={S.sep} />

          <button style={btnDanger()} onClick={removeSelected} disabled={!selectedIds.length}>
            🗑 Borrar
          </button>

          <button style={btnGold()} onClick={exportPNG}>Export PNG</button>

          <div style={S.more}>
            <button style={btn("off")} onClick={exportJSON}>Export JSON</button>
            <label style={btn("off")}>
              Import JSON
              <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => importJSON(e.target.files?.[0])} />
            </label>
          </div>
        </div>
      </div>

      <div style={S.main}>
        {/* Left Tools */}
        <div style={S.left}>
          <div style={S.panelTitle}>Herramientas</div>

          <button style={toolBtn(tool === TOOL.SELECT)} onClick={() => setTool(TOOL.SELECT)}>Select (V)</button>
          <button style={toolBtn(tool === TOOL.TEXT)} onClick={() => setTool(TOOL.TEXT)}>Texto (T)</button>
          <button style={toolBtn(tool === TOOL.RECT)} onClick={() => setTool(TOOL.RECT)}>Caja (R)</button>

          <div style={{ height: 12 }} />
          <div style={S.panelTitle}>Acciones</div>

          <button style={toolBtn(false)} onClick={addText}>+ Texto</button>
          <button style={toolBtn(false)} onClick={addRect}>+ Caja</button>

          <button style={toolBtn(false)} onClick={duplicateSelected} disabled={!selectedIds.length}>
            Duplicar (⌘/Ctrl D)
          </button>

          <div style={{ height: 12 }} />
          <div style={S.panelTitle}>Proyecto</div>

          <div style={S.smallNote}>• Ctrl/⌘ + Wheel = Zoom</div>
          <div style={S.smallNote}>• Space + drag = Pan</div>
          <div style={S.smallNote}>• Shift = Multi-select</div>
          <div style={S.smallNote}>• Arrastra en vacío = Marquee</div>
        </div>

        {/* Stage */}
        <div style={S.stageShell}>
          <div style={S.stageWrap}>
            <Stage
              ref={stageRef}
              width={stageSize.w}
              height={stageSize.h}
              onWheel={onWheel}
              onMouseDown={(e) => {
                deselectIfEmpty(e);
                onStageMouseDown(e);
              }}
              onMouseMove={onStageMouseMove}
              onMouseUp={onStageMouseUp}
              onTouchStart={(e) => {
                deselectIfEmpty(e);
                onStageMouseDown(e);
              }}
              onTouchMove={onStageMouseMove}
              onTouchEnd={onStageMouseUp}
              style={S.stage}
            >
              {/* World Layer */}
              <Layer x={view.x} y={view.y} scaleX={view.scale} scaleY={view.scale}>
                {/* Background */}
                <Rect x={0} y={0} width={width} height={height} fill={background} listening={false} />

                {/* Grid */}
                {showGrid && <Grid width={width} height={height} step={60} />}

                {/* Guides */}
                {guides.map((g, i) => {
                  if (g.type === "v") {
                    return (
                      <Line
                        key={`gv_${i}`}
                        points={[g.x, 0, g.x, height]}
                        stroke="rgba(247,198,0,0.55)"
                        strokeWidth={1}
                        dash={[6, 6]}
                        listening={false}
                      />
                    );
                  }
                  return (
                    <Line
                      key={`gh_${i}`}
                      points={[0, g.y, width, g.y]}
                      stroke="rgba(247,198,0,0.55)"
                      strokeWidth={1}
                      dash={[6, 6]}
                      listening={false}
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((n) => {
                  if (n.hidden) return null;

                  if (n.type === "rect") {
                    return (
                      <Rect
                        key={n.id}
                        id={n.id}
                        x={n.x}
                        y={n.y}
                        width={n.width}
                        height={n.height}
                        fill={n.fill}
                        cornerRadius={n.cornerRadius || 0}
                        rotation={n.rotation || 0}
                        opacity={safeNum(n.opacity, 1)}
                        draggable={!n.locked && tool === TOOL.SELECT}
                        onClick={(e) => onSelectNode(n.id, e)}
                        onTap={(e) => onSelectNode(n.id, e)}
                        onDragStart={() => pushHistoryNow()}
                        onDragMove={(e) => onDragMoveSnap(e.target, n)}
                        onDragEnd={(e) => {
                          clearGuides();
                          updateNode(n.id, { x: e.target.x(), y: e.target.y() }, { push: true });
                        }}
                        onTransformStart={() => pushHistoryNow()}
                        onTransformEnd={(e) => {
                          clearGuides();
                          const node = e.target;
                          const scaleX = node.scaleX();
                          const scaleY = node.scaleY();
                          node.scaleX(1);
                          node.scaleY(1);
                          updateNode(
                            n.id,
                            {
                              x: node.x(),
                              y: node.y(),
                              width: Math.max(10, node.width() * scaleX),
                              height: Math.max(10, node.height() * scaleY),
                              rotation: node.rotation(),
                            },
                            { push: true }
                          );
                        }}
                      />
                    );
                  }

                  if (n.type === "text") {
                    return (
                      <Text
                        key={n.id}
                        id={n.id}
                        x={n.x}
                        y={n.y}
                        text={n.text}
                        width={n.width || 600}
                        fontSize={n.fontSize || 48}
                        fontFamily={n.fontFamily || "Inter"}
                        fill={n.fill || "#fff"}
                        rotation={n.rotation || 0}
                        opacity={safeNum(n.opacity, 1)}
                        align={n.align || "left"}
                        draggable={!n.locked && tool === TOOL.SELECT}
                        onClick={(e) => onSelectNode(n.id, e)}
                        onTap={(e) => onSelectNode(n.id, e)}
                        onDblClick={() => {
                          const next = prompt("Editar texto:", n.text || "");
                          if (next !== null) updateNode(n.id, { text: next }, { push: true });
                        }}
                        onDragStart={() => pushHistoryNow()}
                        onDragMove={(e) => onDragMoveSnap(e.target, n)}
                        onDragEnd={(e) => {
                          clearGuides();
                          updateNode(n.id, { x: e.target.x(), y: e.target.y() }, { push: true });
                        }}
                        onTransformStart={() => pushHistoryNow()}
                        onTransformEnd={(e) => {
                          clearGuides();
                          const node = e.target;
                          const scaleX = node.scaleX();
                          node.scaleX(1);
                          updateNode(
                            n.id,
                            {
                              x: node.x(),
                              y: node.y(),
                              width: Math.max(40, (node.width() || 600) * scaleX),
                              rotation: node.rotation(),
                              fontSize: Math.max(10, (n.fontSize || 48) * scaleX),
                            },
                            { push: true }
                          );
                        }}
                      />
                    );
                  }

                  if (n.type === "image") {
                    return (
                      <ImageNode
                        key={n.id}
                        node={n}
                        tool={tool}
                        onSelect={onSelectNode}
                        onUpdate={updateNode}
                        onPushHistory={pushHistoryNow}
                        onDragSnap={onDragMoveSnap}
                        onClearGuides={clearGuides}
                      />
                    );
                  }

                  return null;
                })}

                {/* Marquee box */}
                {marquee && (
                  <Rect
                    x={Math.min(marquee.x, marquee.x + marquee.w)}
                    y={Math.min(marquee.y, marquee.y + marquee.h)}
                    width={Math.abs(marquee.w)}
                    height={Math.abs(marquee.h)}
                    fill="rgba(247,198,0,0.10)"
                    stroke="rgba(247,198,0,0.60)"
                    strokeWidth={1}
                    dash={[6, 6]}
                    listening={false}
                  />
                )}

                {/* Transformer */}
                <Transformer
                  ref={trRef}
                  rotateEnabled
                  enabledAnchors={[
                    "top-left",
                    "top-right",
                    "bottom-left",
                    "bottom-right",
                    "middle-left",
                    "middle-right",
                    "top-center",
                    "bottom-center",
                  ]}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 10 || newBox.height < 10) return oldBox;
                    return newBox;
                  }}
                />
              </Layer>
            </Stage>
          </div>

          <div style={S.hint}>
            Tips: doble click texto • Shift multi-select • Space+drag pan • Ctrl/⌘+wheel zoom • Ctrl/⌘ D duplicar
          </div>
        </div>

        {/* Right Panels */}
        <div style={S.right}>
          <div style={S.panelTitle}>Capas</div>
          <LayersPanel
            nodes={nodes}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            onRename={(id, name) => updateNode(id, { name }, { push: true })}
            onToggleLock={(id) => {
              const n = nodes.find((x) => x.id === id);
              updateNode(id, { locked: !n?.locked }, { push: true });
            }}
            onToggleHide={(id) => {
              const n = nodes.find((x) => x.id === id);
              updateNode(id, { hidden: !n?.hidden }, { push: true });
              setSelectedIds((prev) => prev.filter((x) => x !== id));
            }}
            onReorder={reorder}
          />

          <div style={{ height: 12 }} />

          <div style={S.panelTitle}>Propiedades</div>
          <PropertiesPanel
            node={activeNode}
            multi={selectedNodes.length > 1}
            onPatch={(patch) => {
              if (!selectedIds.length) return;
              if (selectedIds.length === 1) updateNode(selectedIds[0], patch, { push: true });
              else updateMany(selectedIds, patch);
            }}
          />
        </div>
      </div>
    </div>
  );

  // (continúa en Segmento 5/5: ImageNode + Grid + Panels + Styles)
}

/* ----------------------------- Subcomponents ---------------------------- */

function ImageNode({ node, tool, onSelect, onUpdate, onPushHistory, onDragSnap, onClearGuides }) {
  const img = useHtmlImage(node.src);
  if (!img) return null;

  return (
    <KonvaImage
      id={node.id}
      image={img}
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      rotation={node.rotation || 0}
      opacity={safeNum(node.opacity, 1)}
      draggable={!node.locked && tool === TOOL.SELECT}
      onClick={(e) => onSelect(node.id, e)}
      onTap={(e) => onSelect(node.id, e)}
      onDragStart={() => onPushHistory?.()}
      onDragMove={(e) => onDragSnap?.(e.target, node)}
      onDragEnd={(e) => {
        onClearGuides?.();
        onUpdate?.(node.id, { x: e.target.x(), y: e.target.y() }, { push: true });
      }}
      onTransformStart={() => onPushHistory?.()}
      onTransformEnd={(e) => {
        onClearGuides?.();
        const k = e.target;
        const scaleX = k.scaleX();
        const scaleY = k.scaleY();
        k.scaleX(1);
        k.scaleY(1);
        onUpdate?.(
          node.id,
          {
            x: k.x(),
            y: k.y(),
            width: Math.max(10, k.width() * scaleX),
            height: Math.max(10, k.height() * scaleY),
            rotation: k.rotation(),
          },
          { push: true }
        );
      }}
    />
  );
}

function Grid({ width, height, step = 60 }) {
  const lines = [];
  for (let x = 0; x <= width; x += step) {
    lines.push(
      <Line
        key={`gx_${x}`}
        points={[x, 0, x, height]}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1}
        listening={false}
      />
    );
  }
  for (let y = 0; y <= height; y += step) {
    lines.push(
      <Line
        key={`gy_${y}`}
        points={[0, y, width, y]}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1}
        listening={false}
      />
    );
  }
  return <>{lines}</>;
}

/* ------------------------------ Right Panels ---------------------------- */

function LayersPanel({ nodes, selectedIds, onSelect, onRename, onToggleLock, onToggleHide, onReorder }) {
  const selectedSet = new Set(selectedIds || []);

  const clickRow = (id, e) => {
    const shift = e?.shiftKey;
    if (!shift) onSelect([id]);
    else {
      const next = new Set(selectedIds || []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelect(Array.from(next));
    }
  };

  return (
    <div style={S.panel}>
      {nodes.length === 0 && <div style={S.empty}>No hay capas todavía. Agrega texto/caja/imagen ✨</div>}

      {[...nodes]
        .map((n, idx) => ({ n, idx }))
        .reverse()
        .map(({ n }) => {
          const isSel = selectedSet.has(n.id);
          return (
            <div
              key={n.id}
              style={{ ...S.layerRow, ...(isSel ? S.layerRowOn : {}) }}
              onClick={(e) => clickRow(n.id, e)}
              title={n.id}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                <div style={S.badge}>{n.type === "text" ? "T" : n.type === "rect" ? "R" : "I"}</div>
                <input
                  style={S.layerName}
                  value={n.name || n.type}
                  onChange={(e) => onRename?.(n.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div style={S.layerBtns}>
                <button style={miniBtn()} onClick={(e) => { e.stopPropagation(); onToggleHide?.(n.id); }}>
                  {n.hidden ? "🙈" : "👁️"}
                </button>
                <button style={miniBtn()} onClick={(e) => { e.stopPropagation(); onToggleLock?.(n.id); }}>
                  {n.locked ? "🔒" : "🔓"}
                </button>

                <div style={S.dot} />

                <button style={miniBtn()} onClick={(e) => { e.stopPropagation(); onReorder?.(n.id, "front"); }}>
                  ⬆⬆
                </button>
                <button style={miniBtn()} onClick={(e) => { e.stopPropagation(); onReorder?.(n.id, "back"); }}>
                  ⬇⬇
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}

function PropertiesPanel({ node, multi, onPatch }) {
  if (!node) return <div style={S.panel}><div style={S.empty}>Selecciona una capa para editar sus propiedades.</div></div>;

  const isText = node.type === "text";
  const isRect = node.type === "rect";
  const isImage = node.type === "image";

  const set = (k, v) => onPatch?.({ [k]: v });

  return (
    <div style={S.panel}>
      {multi && <div style={S.warn}>Editando múltiples capas (se aplica a todas) ⚡</div>}

      <div style={S.kvRow}>
        <div style={S.k}>Tipo</div>
        <div style={S.v}>{node.type}</div>
      </div>

      <div style={S.hr} />

      <div style={S.grid2}>
        <Field label="X" value={node.x} onChange={(v) => set("x", safeNum(v, 0))} />
        <Field label="Y" value={node.y} onChange={(v) => set("y", safeNum(v, 0))} />
        <Field label="W" value={node.width} onChange={(v) => set("width", Math.max(10, safeNum(v, 10)))} />
        <Field
          label={isText ? "H (auto)" : "H"}
          disabled={isText}
          value={node.height || ""}
          onChange={(v) => set("height", Math.max(10, safeNum(v, 10)))}
        />
        <Field label="Rot" value={node.rotation || 0} onChange={(v) => set("rotation", safeNum(v, 0))} />
        <Field label="Opacity" value={Math.round((safeNum(node.opacity, 1)) * 100)} onChange={(v) => set("opacity", clamp(safeNum(v, 100) / 100, 0, 1))} />
      </div>

      <div style={S.hr} />

      {isRect && (
        <>
          <div style={S.sectionTitle}>Caja</div>
          <Field label="Radio" value={node.cornerRadius || 0} onChange={(v) => set("cornerRadius", Math.max(0, safeNum(v, 0)))} />
          <ColorField label="Fill" value={rgbaToHexOrRaw(node.fill)} onChange={(v) => set("fill", v)} />
        </>
      )}

      {isText && (
        <>
          <div style={S.sectionTitle}>Texto</div>
          <Field label="Contenido" value={node.text || ""} onChange={(v) => set("text", String(v))} wide />
          <div style={S.grid2}>
            <Field label="Size" value={node.fontSize || 48} onChange={(v) => set("fontSize", Math.max(8, safeNum(v, 48)))} />
            <SelectField label="Align" value={node.align || "left"} options={ALIGN} onChange={(v) => set("align", v)} />
          </div>

          <SelectField label="Font" value={node.fontFamily || "Inter"} options={FONTS} onChange={(v) => set("fontFamily", v)} />
          <ColorField label="Color" value={node.fill || "#ffffff"} onChange={(v) => set("fill", v)} />
        </>
      )}

      {isImage && (
        <>
          <div style={S.sectionTitle}>Imagen</div>
          <div style={S.smallNote}>Tip: usa “Duplicar” para hacer composiciones rápidas.</div>
        </>
      )}

      <div style={S.hr} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={chipBtn()} onClick={() => set("locked", !node.locked)}>
          {node.locked ? "🔒 Locked" : "🔓 Unlocked"}
        </button>
        <button style={chipBtn()} onClick={() => set("hidden", !node.hidden)}>
          {node.hidden ? "🙈 Hidden" : "👁️ Visible"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, disabled, wide }) {
  return (
    <div style={{ ...S.field, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <div style={S.fieldLabel}>{label}</div>
      <input
        style={{ ...S.input, ...(disabled ? S.inputDisabled : {}) }}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div style={S.field}>
      <div style={S.fieldLabel}>{label}</div>
      <select style={S.select} value={value} onChange={(e) => onChange?.(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div style={S.field}>
      <div style={S.fieldLabel}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={S.color} type="color" value={String(value || "#ffffff").startsWith("#") ? value : "#ffffff"} onChange={(e) => onChange?.(e.target.value)} />
        <input style={S.input} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} />
      </div>
    </div>
  );
}

/* -------------------------------- Styles -------------------------------- */

function btn(state = "off") {
  const on = state === "on";
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: on ? "1px solid rgba(247,198,0,0.35)" : "1px solid rgba(255,255,255,0.12)",
    background: on ? "rgba(247,198,0,0.10)" : "rgba(0,0,0,0.20)",
    color: on ? "#f7c600" : "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}

function btnDanger() {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,80,80,0.28)",
    background: "rgba(255,80,80,0.12)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    opacity: 0.95,
  };
}

function btnGold() {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(247,198,0,0.25)",
    background: "rgba(247,198,0,0.10)",
    color: "#f7c600",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  };
}

function toolBtn(active) {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: active ? "1px solid rgba(247,198,0,0.35)" : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(247,198,0,0.10)" : "rgba(0,0,0,0.25)",
    color: active ? "#f7c600" : "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    textAlign: "left",
  };
}

function miniBtn() {
  return {
    padding: "6px 8px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.25)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  };
}

function chipBtn() {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.25)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  };
}

const S = {
  wrap: { height: "100%", display: "flex", flexDirection: "column", gap: 10 },

  topbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
  },

  brand: { display: "flex", flexDirection: "column", gap: 2 },

  topActions: {
    marginLeft: "auto",
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  sep: { width: 1, height: 18, background: "rgba(255,255,255,0.10)" },

  more: { display: "flex", gap: 10, flexWrap: "wrap" },

  main: {
    flex: 1,
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "220px 1fr 320px",
    gap: 10,
  },

  left: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.22)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflow: "auto",
  },

  right: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.22)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflow: "auto",
  },

  panelTitle: {
    fontSize: 12,
    fontWeight: 950,
    opacity: 0.9,
    letterSpacing: 0.2,
  },

  stageShell: { display: "flex", flexDirection: "column", minHeight: 0, gap: 10 },

  stageWrap: {
    flex: 1,
    minHeight: 0,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.22)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    padding: 10,
  },

  stage: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.25)",
  },

  hint: {
    fontSize: 11,
    opacity: 0.7,
    padding: "8px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
  },

  panel: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  empty: { fontSize: 12, opacity: 0.7, padding: 8 },

  warn: {
    fontSize: 12,
    padding: 8,
    borderRadius: 12,
    border: "1px solid rgba(247,198,0,0.20)",
    background: "rgba(247,198,0,0.08)",
    color: "#f7c600",
    fontWeight: 900,
  },

  hr: { height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" },

  smallNote: { fontSize: 11, opacity: 0.7 },

  layerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.18)",
    cursor: "pointer",
  },

  layerRowOn: {
    border: "1px solid rgba(247,198,0,0.22)",
    background: "rgba(247,198,0,0.06)",
  },

  badge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.10)",
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    fontSize: 12,
    opacity: 0.9,
  },

  layerName: {
    width: "100%",
    minWidth: 0,
    padding: "6px 8px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.25)",
    color: "#fff",
    outline: "none",
    fontWeight: 800,
  },

  layerBtns: { display: "flex", alignItems: "center", gap: 6 },

  dot: { width: 1, height: 16, background: "rgba(255,255,255,0.10)", margin: "0 2px" },

  kvRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  k: { fontSize: 12, opacity: 0.7, fontWeight: 900 },
  v: { fontSize: 12, fontWeight: 950, opacity: 0.92 },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },

  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, opacity: 0.7, fontWeight: 900 },

  input: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.25)",
    color: "#fff",
    outline: "none",
    fontWeight: 900,
  },

  inputDisabled: { opacity: 0.45, cursor: "not-allowed" },

  select: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.25)",
    color: "#fff",
    outline: "none",
    fontWeight: 900,
  },

  color: { width: 44, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", background: "transparent" },

  sectionTitle: { fontSize: 12, fontWeight: 950, opacity: 0.9, marginTop: 4 },
};
