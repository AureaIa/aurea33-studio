// components/studio/StudioCanvas.jsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Stage, Layer, Rect, Text, Transformer, Line, Image as KonvaImage } from "react-konva";

/* ----------------------------- Utils ----------------------------- */

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const isInputLike = (el) => {
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
};

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeNum(x, fallback) {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

function safeStr(x, fallback) {
  return typeof x === "string" && x.length ? x : fallback;
}

/** Normaliza rutas de assets para Konva/Next (templates marketplace) */
function normalizeAssetSrc(src) {
  if (!src || typeof src !== "string") return null;

  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  if (src.startsWith("/")) return src;

  let s = src.replace(/^\.\//, "");

  if (s.startsWith("templates/")) return `/${s}`;
  if (s.startsWith("assets/")) return `/templates/${s}`;
  if (!s.includes("/")) return `/templates/assets/${s}`;

  return `/templates/${s}`;
}

function getImageSrc(n) {
  const raw = n?.src || n?.imageSrc || n?.url || n?.dataURL || n?.dataUrl || n?.href || null;
  return normalizeAssetSrc(raw);
}

/** Hook: carga HTMLImageElement desde src */
function useHtmlImage(src) {
  const [img, setImg] = useState(null);

  useEffect(() => {
    if (!src || typeof window === "undefined") {
      setImg(null);
      return;
    }

    let alive = true;
    const image = new window.Image();
    image.crossOrigin = "anonymous";

    image.onload = async () => {
      if (!alive) return;
      try {
        if (image.decode) await image.decode();
      } catch (_) {}
      if (alive) setImg(image);
    };

    image.onerror = () => alive && setImg(null);
    image.src = src;

    return () => {
      alive = false;
    };
  }, [src]);

  return img;
}

/* ----------------------------- Background Fit (cover/contain) ----------------------------- */

function computeFitRect(imgW, imgH, frameW, frameH, fit = "cover") {
  if (!imgW || !imgH || !frameW || !frameH) {
    return { x: 0, y: 0, width: frameW || 0, height: frameH || 0 };
  }

  const sCover = Math.max(frameW / imgW, frameH / imgH);
  const sContain = Math.min(frameW / imgW, frameH / imgH);
  const s = fit === "contain" ? sContain : sCover;

  const w = imgW * s;
  const h = imgH * s;

  return {
    x: (frameW - w) / 2,
    y: (frameH - h) / 2,
    width: w,
    height: h,
  };
}

/* ----------------------------- Presets ----------------------------- */

const CANVAS_PRESETS = [
  { key: "ig_post", label: "Instagram Post 1:1 (1080×1080)", w: 1080, h: 1080 },
  { key: "ig_story", label: "Instagram Story 9:16 (1080×1920)", w: 1080, h: 1920 },
  { key: "ig_reel", label: "Reel Cover 9:16 (1080×1920)", w: 1080, h: 1920 },
  { key: "fb_post", label: "Facebook Post 1:1 (1080×1080)", w: 1080, h: 1080 },
  { key: "fb_cover", label: "Facebook Cover (1640×624)", w: 1640, h: 624 },
  { key: "portrait_4_5", label: "Vertical 4:5 (1080×1350)", w: 1080, h: 1350 },
  { key: "yt_thumb", label: "YouTube Thumb 16:9 (1280×720)", w: 1280, h: 720 },
  { key: "hd_16_9", label: "HD 16:9 (1920×1080)", w: 1920, h: 1080 },
  { key: "a4", label: "A4 (2480×3508)", w: 2480, h: 3508 },
];

const presetByWH = (w, h) => {
  const hit = CANVAS_PRESETS.find((p) => p.w === w && p.h === h);
  return hit?.key || "ig_post";
};

/* ----------------------------- Layer helpers (no hooks here) ----------------------------- */

function moveLayer(nodes, selectedId, dir) {
  // dir: -1 sendBackward, +1 bringForward
  const idx = nodes.findIndex((n) => n.id === selectedId);
  if (idx < 0) return nodes;

  if (nodes[idx]?.isBackground) return nodes;

  const swapWith = idx + dir;
  if (swapWith < 0 || swapWith >= nodes.length) return nodes;

  if (nodes[swapWith]?.isBackground) return nodes;

  const copy = nodes.slice();
  const tmp = copy[idx];
  copy[idx] = copy[swapWith];
  copy[swapWith] = tmp;
  return copy;
}

function moveToEdge(nodes, selectedId, edge) {
  // edge: "back" | "front"
  const idx = nodes.findIndex((n) => n.id === selectedId);
  if (idx < 0) return nodes;
  const item = nodes[idx];
  if (item?.isBackground) return nodes;

  const bgCount = nodes.filter((n) => n?.isBackground).length;
  const rest = nodes.filter((n) => n.id !== selectedId);

  if (edge === "back") {
    const head = rest.slice(0, bgCount);
    const tail = rest.slice(bgCount);
    return [...head, item, ...tail];
  }

  return [...rest, item];
}

/* ----------------------------- Background Node (PRO) ----------------------------- */

const BackgroundImageNode = React.memo(function BackgroundImageNode({ n, frame, canvasW, canvasH }) {
  const src = getImageSrc(n);
  const img = useHtmlImage(src);

  const fit = n?.fit === "contain" ? "contain" : "cover";
  const opacity = clamp(safeNum(n?.opacity, 1), 0, 1);

  const rectDoc = useMemo(() => {
    if (!img) return { x: 0, y: 0, width: canvasW, height: canvasH };
    return computeFitRect(img.width, img.height, canvasW, canvasH, fit);
  }, [img, canvasW, canvasH, fit]);

  const x = frame.x + rectDoc.x * frame.scale;
  const y = frame.y + rectDoc.y * frame.scale;
  const w = rectDoc.width * frame.scale;
  const h = rectDoc.height * frame.scale;

  return (
    <KonvaImage
      id={n.id}
      x={x}
      y={y}
      width={w}
      height={h}
      image={img || undefined}
      opacity={opacity}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
});

/* ----------------------------- Image Node (memo) ----------------------------- */

const ImageNode = React.memo(function ImageNode({
  n,
  frame,
  isSpaceDown,
  editingId,
  setSelected,
  setShowProps,
  screenToDoc,
  updateNode,
  onTransformEnd,
}) {
  const src = getImageSrc(n);
  const img = useHtmlImage(src);

  const p = useMemo(() => {
    const x = frame.x + (n.x || 0) * frame.scale;
    const y = frame.y + (n.y || 0) * frame.scale;
    return { x, y };
  }, [frame.x, frame.y, frame.scale, n.x, n.y]);

  const w = Math.max(10, (n.width || 600) * frame.scale);
  const h = Math.max(10, (n.height || 600) * frame.scale);

  const opacity = clamp(safeNum(n.opacity, 1), 0, 1);
  const rotation = safeNum(n.rotation, 0);

  const crop = n.crop && typeof n.crop === "object" ? n.crop : null;

  const locked = !!n.locked;
  const listening = locked ? false : typeof n.listening === "boolean" ? n.listening : true;
  const draggable = !locked && !isSpaceDown && !editingId && listening;

  return (
    <KonvaImage
      id={n.id}
      x={p.x}
      y={p.y}
      image={img || undefined}
      width={w}
      height={h}
      rotation={rotation}
      opacity={opacity}
      crop={crop || undefined}
      draggable={draggable}
      hitStrokeWidth={12}
      perfectDrawEnabled={false}
      listening={listening}
      onClick={() => {
        if (!listening) return;
        setSelected(n.id);
        setShowProps(true);
      }}
      onTap={() => {
        if (!listening) return;
        setSelected(n.id);
        setShowProps(true);
      }}
      onDragEnd={(e) => {
        if (locked) return;
        const docPos = screenToDoc(e.target.x(), e.target.y());
        updateNode(n.id, { x: docPos.x, y: docPos.y });
      }}
      onTransformEnd={(e) => {
        if (locked) return;
        onTransformEnd(e, n);
      }}
    />
  );
});

/* ----------------------------- Component ----------------------------- */

export default function StudioCanvas({ doc, onChange, compact = false }) {
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const containerRef = useRef(null);

  const [containerSize, setContainerSize] = useState({ w: 1200, h: 800 });

  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // floating toolbar box
  const [toolbarBox, setToolbarBox] = useState(null); // {x,y,w,h}

  // Text editing overlay
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingBox, setEditingBox] = useState(null);
  const textareaRef = useRef(null);

  // Panels
  const [showProps, setShowProps] = useState(true);
  const [propsMin, setPropsMin] = useState(false);

  /* ----------------------------- Doc safe ----------------------------- */

  const metaSafe = useMemo(() => {
    const m = doc?.meta || {};
    const w = typeof m.w === "number" && m.w > 0 ? m.w : 1080;
    const h = typeof m.h === "number" && m.h > 0 ? m.h : 1080;
    return {
      w,
      h,
      bg: typeof m.bg === "string" ? m.bg : "#0B1220",
      zoom: typeof m.zoom === "number" ? m.zoom : 0.8,
      panX: typeof m.panX === "number" ? m.panX : 0,
      panY: typeof m.panY === "number" ? m.panY : 0,
      presetKey: typeof m.presetKey === "string" ? m.presetKey : presetByWH(w, h),
    };
  }, [
    doc?.meta?.w,
    doc?.meta?.h,
    doc?.meta?.bg,
    doc?.meta?.zoom,
    doc?.meta?.panX,
    doc?.meta?.panY,
    doc?.meta?.presetKey,
  ]);

  const nodes = doc?.nodes || [];
  const selectedId = doc?.selectedId || null;

  const zoom = metaSafe.zoom;
  const panX = metaSafe.panX;
  const panY = metaSafe.panY;

  const bgNode = useMemo(() => nodes.find((n) => n?.type === "image" && n?.isBackground), [nodes]);
  const fgNodes = useMemo(() => nodes.filter((n) => !(n?.type === "image" && n?.isBackground)), [nodes]);

  const selectedNodeModel = useMemo(() => nodes.find((n) => n.id === selectedId) || null, [nodes, selectedId]);
  const selectedLocked = !!selectedNodeModel?.locked;

  /* ----------------------------- Commit helpers ----------------------------- */

  const commit = useCallback(
    (patch) => {
      if (!onChange) return;
      const base = doc || {};
      onChange({ ...base, ...patch });
    },
    [doc, onChange]
  );

  const commitMeta = useCallback(
    (metaPatch) => {
      commit({ meta: { ...metaSafe, ...metaPatch } });
    },
    [commit, metaSafe]
  );

  const setSelected = useCallback((id) => commit({ selectedId: id }), [commit]);

  const updateNode = useCallback(
    (id, patch) => {
      commit({ nodes: nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
    },
    [commit, nodes]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const n = nodes.find((x) => x.id === selectedId);
    if (!n) return;
    if (n.isBackground) return;
    if (n.locked) return;
    const next = nodes.filter((x) => x.id !== selectedId);
    commit({ nodes: next, selectedId: null });
  }, [commit, nodes, selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    const n = nodes.find((x) => x.id === selectedId);
    if (!n) return;
    if (n.isBackground) return;
    if (n.locked) return;

    const copy = { ...n, id: uid() };

    if (n.type === "line" && Array.isArray(n.points)) {
      const pts = n.points.slice();
      for (let i = 0; i < pts.length; i += 2) {
        pts[i] += 24;
        pts[i + 1] += 24;
      }
      copy.points = pts;
      delete copy.x;
      delete copy.y;
    } else {
      copy.x = (n.x || 0) + 24;
      copy.y = (n.y || 0) + 24;
    }

    commit({ nodes: [...nodes, copy], selectedId: copy.id });
  }, [commit, nodes, selectedId]);

  const nudgeSelected = useCallback(
    (dx, dy) => {
      if (!selectedId) return;
      const n = nodes.find((x) => x.id === selectedId);
      if (!n) return;
      if (n.isBackground) return;
      if (n.locked) return;

      if (n.type === "line" && Array.isArray(n.points)) {
        const pts = n.points.slice();
        for (let i = 0; i < pts.length; i += 2) {
          pts[i] += dx;
          pts[i + 1] += dy;
        }
        updateNode(selectedId, { points: pts });
        return;
      }

      updateNode(selectedId, { x: (n.x || 0) + dx, y: (n.y || 0) + dy });
    },
    [nodes, selectedId, updateNode]
  );

  /* ----------------------------- Resize observer ----------------------------- */

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ w: Math.max(320, rect.width), h: Math.max(320, rect.height) });
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      ro.disconnect();
    };
  }, []);

  /* ----------------------------- Frame math ----------------------------- */

  const frame = useMemo(() => {
    const padding = 44;
    const maxW = Math.max(1, containerSize.w - padding * 2);
    const maxH = Math.max(1, containerSize.h - padding * 2);

    const fitScale = Math.min(maxW / metaSafe.w, maxH / metaSafe.h);
    const baseFit = clamp(fitScale, 0.05, 1.75);
    const scale = baseFit * clamp(zoom, 0.1, 4);

    const w = metaSafe.w * scale;
    const h = metaSafe.h * scale;

    const x = (containerSize.w - w) / 2 + panX;
    const y = (containerSize.h - h) / 2 + panY;

    return { x, y, w, h, scale, baseFit };
  }, [containerSize.w, containerSize.h, metaSafe.w, metaSafe.h, zoom, panX, panY]);

  /* ----------------------------- Pointer helpers ----------------------------- */

  const screenToDoc = useCallback(
    (sx, sy) => {
      const dx = (sx - frame.x) / frame.scale;
      const dy = (sy - frame.y) / frame.scale;
      return { x: dx, y: dy };
    },
    [frame.x, frame.y, frame.scale]
  );

  const docToScreen = useCallback(
    (dx, dy) => {
      const sx = frame.x + dx * frame.scale;
      const sy = frame.y + dy * frame.scale;
      return { x: sx, y: sy };
    },
    [frame.x, frame.y, frame.scale]
  );

  const pointsDocToScreen = useCallback(
    (pts) => {
      if (!Array.isArray(pts)) return [];
      const out = [];
      for (let i = 0; i < pts.length; i += 2) {
        const p = docToScreen(pts[i], pts[i + 1]);
        out.push(p.x, p.y);
      }
      return out;
    },
    [docToScreen]
  );

  /* ----------------------------- Transformer attach (FIX + lock + bg) ----------------------------- */

  useEffect(() => {
    const stage = stageRef.current;
    const tr = trRef.current;
    if (!stage || !tr) return;

    const model = selectedId ? nodes.find((x) => x.id === selectedId) : null;

    if (!selectedId || !model || model.isBackground || model.locked) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const selectedKonva = stage.findOne((node) => node.id() === selectedId) || null;

    if (selectedKonva) {
      tr.nodes([selectedKonva]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, nodes]);

  /* ----------------------------- Floating toolbar box (selected bounds) ----------------------------- */

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !selectedId) {
      setToolbarBox(null);
      return;
    }

    const model = nodes.find((x) => x.id === selectedId);
    if (!model || model.isBackground) {
      setToolbarBox(null);
      return;
    }

    const node = stage.findOne((n) => n.id() === selectedId);
    if (!node) {
      setToolbarBox(null);
      return;
    }

    const rect = node.getClientRect({ skipStroke: true });
    setToolbarBox({ x: rect.x, y: rect.y, w: rect.width, h: rect.height });
  }, [selectedId, nodes, frame.x, frame.y, frame.scale, metaSafe.w, metaSafe.h, zoom, panX, panY]);

  /* ----------------------------- Stage interactions ----------------------------- */

  const onStageMouseDown = useCallback(
    (e) => {
      const stage = e.target.getStage();
      const isEmpty = e.target === stage;

      if (isSpaceDown && !editingId) {
        setIsPanning(true);
        const pos = stage.getPointerPosition() || { x: 0, y: 0 };
        panStartRef.current = { x: pos.x, y: pos.y, panX, panY };
        return;
      }

      if (isEmpty && !editingId) setSelected(null);
    },
    [isSpaceDown, panX, panY, setSelected, editingId]
  );

  const onStageMouseMove = useCallback(() => {
    if (!isPanning) return;
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition() || { x: 0, y: 0 };
    const start = panStartRef.current;

    const dx = pos.x - start.x;
    const dy = pos.y - start.y;

    commitMeta({ panX: start.panX + dx, panY: start.panY + dy });
  }, [isPanning, commitMeta]);

  const onStageMouseUp = useCallback(() => {
    if (isPanning) setIsPanning(false);
  }, [isPanning]);

  /* ----------------------------- Wheel zoom (cursor anchored) ----------------------------- */

  const onWheel = useCallback(
    (e) => {
      if (editingId) return;
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const oldZoom = clamp(zoom, 0.1, 4);
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = direction > 0 ? 1.08 : 1 / 1.08;
      const nextZoom = clamp(oldZoom * factor, 0.1, 4);

      const oldScale = frame.baseFit * oldZoom;
      const newScale = frame.baseFit * nextZoom;

      const oldW = metaSafe.w * oldScale;
      const oldH = metaSafe.h * oldScale;
      const oldFrameX = (containerSize.w - oldW) / 2 + panX;
      const oldFrameY = (containerSize.h - oldH) / 2 + panY;

      const docX = (pointer.x - oldFrameX) / oldScale;
      const docY = (pointer.y - oldFrameY) / oldScale;

      const newW = metaSafe.w * newScale;
      const newH = metaSafe.h * newScale;

      const newFrameX = pointer.x - docX * newScale;
      const newFrameY = pointer.y - docY * newScale;

      const nextPanX = newFrameX - (containerSize.w - newW) / 2;
      const nextPanY = newFrameY - (containerSize.h - newH) / 2;

      commitMeta({ zoom: nextZoom, panX: nextPanX, panY: nextPanY });
    },
    [editingId, zoom, frame.baseFit, metaSafe.w, metaSafe.h, containerSize.w, containerSize.h, panX, panY, commitMeta]
  );

  /* ----------------------------- Transform correctness ----------------------------- */

  const onTransformEnd = useCallback(
    (e, nodeModel) => {
      if (!nodeModel || nodeModel.locked || nodeModel.isBackground) return;

      const node = e.target;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      node.scaleX(1);
      node.scaleY(1);

      const docPos = screenToDoc(node.x(), node.y());

      if (nodeModel.type === "rect" || nodeModel.type === "image") {
        const newW = Math.max(10, (node.width() * scaleX) / frame.scale);
        const newH = Math.max(10, (node.height() * scaleY) / frame.scale);

        updateNode(nodeModel.id, {
          x: docPos.x,
          y: docPos.y,
          width: newW,
          height: newH,
          rotation: node.rotation(),
        });
        return;
      }

      if (nodeModel.type === "text") {
        const baseFont = nodeModel.fontSize || 32;
        const nextFont = clamp(baseFont * scaleY, 8, 512);

        updateNode(nodeModel.id, {
          x: docPos.x,
          y: docPos.y,
          rotation: node.rotation(),
          fontSize: nextFont,
        });
        return;
      }

      if (nodeModel.type === "line") {
        updateNode(nodeModel.id, { rotation: node.rotation() });
      }
    },
    [frame.scale, screenToDoc, updateNode]
  );

  /* ----------------------------- Text editing overlay ----------------------------- */

  const openTextEditor = useCallback(
    (textNodeModel) => {
      if (!textNodeModel || textNodeModel.locked) return;

      const stage = stageRef.current;
      if (!stage) return;

      const konvaNode = stage.findOne((node) => node.id() === textNodeModel.id);
      if (!konvaNode) return;

      const box = konvaNode.getClientRect({ skipStroke: true });

      const padding = 6;
      const w = Math.max(140, box.width + padding * 2);
      const h = Math.max(38, box.height + padding * 2);

      setEditingId(textNodeModel.id);
      setEditingValue(textNodeModel.text || "");

      setEditingBox({
        x: box.x - padding,
        y: box.y - padding,
        w,
        h,
        rotation: textNodeModel.rotation || 0,
        fill: textNodeModel.fill || "#E9EEF9",
        fontFamily: textNodeModel.fontFamily || "Inter, system-ui",
        fontSizePx: (textNodeModel.fontSize || 32) * frame.scale,
        lineHeight: textNodeModel.lineHeight || 1.2,
      });

      setSelected(textNodeModel.id);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select?.();
        }
      }, 0);
    },
    [frame.scale, setSelected]
  );

  const closeTextEditor = useCallback(
    (mode) => {
      if (!editingId) return;
      const id = editingId;

      setEditingId(null);
      setEditingBox(null);

      if (mode === "commit") updateNode(id, { text: editingValue });
    },
    [editingId, editingValue, updateNode]
  );

  useEffect(() => {
    if (!editingId) return;
    closeTextEditor("commit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaSafe.w, metaSafe.h, zoom, panX, panY]);

  /* ----------------------------- Layer ops + Lock + Rotate (for toolbar) ----------------------------- */

  const bringForward = useCallback(() => {
    if (!selectedId) return;
    if (selectedLocked) return;
    commit({ nodes: moveLayer(nodes, selectedId, +1) });
  }, [commit, nodes, selectedId, selectedLocked]);

  const sendBackward = useCallback(() => {
    if (!selectedId) return;
    if (selectedLocked) return;
    commit({ nodes: moveLayer(nodes, selectedId, -1) });
  }, [commit, nodes, selectedId, selectedLocked]);

  const bringToFront = useCallback(() => {
    if (!selectedId) return;
    if (selectedLocked) return;
    commit({ nodes: moveToEdge(nodes, selectedId, "front") });
  }, [commit, nodes, selectedId, selectedLocked]);

  const sendToBack = useCallback(() => {
    if (!selectedId) return;
    if (selectedLocked) return;
    commit({ nodes: moveToEdge(nodes, selectedId, "back") });
  }, [commit, nodes, selectedId, selectedLocked]);

  const toggleLockSelected = useCallback(() => {
    if (!selectedId) return;
    const n = nodes.find((x) => x.id === selectedId);
    if (!n) return;
    if (n.isBackground) return;
    updateNode(selectedId, { locked: !n.locked, listening: n.locked ? true : false });
  }, [nodes, selectedId, updateNode]);

  const rotateSelected = useCallback(
    (deg) => {
      if (!selectedId) return;
      const n = nodes.find((x) => x.id === selectedId);
      if (!n || n.isBackground || n.locked) return;
      const rot = safeNum(n.rotation, 0);
      updateNode(selectedId, { rotation: rot + deg });
    },
    [nodes, selectedId, updateNode]
  );

  /* ----------------------------- Drag & Drop images ----------------------------- */

  const addImageAt = useCallback(
    async ({ dataUrl, xDoc, yDoc }) => {
      const img = await new Promise((resolve) => {
        const im = new window.Image();
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = dataUrl;
      });

      const maxW = metaSafe.w * 0.55;
      const maxH = metaSafe.h * 0.55;

      let w = img?.width || 900;
      let h = img?.height || 900;

      const s = Math.min(maxW / w, maxH / h, 1);
      w = Math.max(40, w * s);
      h = Math.max(40, h * s);

      const node = {
        id: uid(),
        type: "image",
        src: dataUrl,
        x: xDoc - w / 2,
        y: yDoc - h / 2,
        width: w,
        height: h,
        rotation: 0,
        opacity: 1,
        locked: false,
        listening: true,
      };

      const bg = nodes.find((x) => x.isBackground);
      const fg = nodes.filter((x) => !x.isBackground);
      const next = bg ? [bg, ...fg, node] : [...fg, node];

      commit({ nodes: next, selectedId: node.id });
    },
    [commit, metaSafe.w, metaSafe.h, nodes]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };

    const onDrop = async (e) => {
      e.preventDefault();
      if (!stageRef.current) return;

      const files = Array.from(e.dataTransfer?.files || []);
      const imgFiles = files.filter((f) => /^image\//.test(f.type));
      if (!imgFiles.length) return;

      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const p = screenToDoc(sx, sy);
      const xDoc = clamp(p.x, 0, metaSafe.w);
      const yDoc = clamp(p.y, 0, metaSafe.h);

      for (const f of imgFiles) {
        const dataUrl = await new Promise((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result || ""));
          fr.onerror = () => resolve("");
          fr.readAsDataURL(f);
        });
        if (!dataUrl) continue;
        await addImageAt({ dataUrl, xDoc, yDoc });
      }
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
    };
  }, [addImageAt, metaSafe.w, metaSafe.h, screenToDoc]);

  /* ----------------------------- UI actions ----------------------------- */

  const fitSmart = useCallback(() => commitMeta({ panX: 0, panY: 0, zoom: 1 }), [commitMeta]);
  const zoomIn = () => commitMeta({ zoom: clamp(zoom + 0.1, 0.1, 4) });
  const zoomOut = () => commitMeta({ zoom: clamp(zoom - 0.1, 0.1, 4) });

  const applyPreset = (presetKey) => {
    const p = CANVAS_PRESETS.find((x) => x.key === presetKey);
    if (!p) return;
    commitMeta({ presetKey: p.key, w: p.w, h: p.h, panX: 0, panY: 0, zoom: 1 });
    setSelected(null);
  };

  const exportPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const pixelRatio = 2;
    const uri = stage.toDataURL({
      x: frame.x,
      y: frame.y,
      width: frame.w,
      height: frame.h,
      pixelRatio,
      mimeType: "image/png",
    });

    const a = document.createElement("a");
    a.href = uri;
    a.download = `aurea33_${metaSafe.w}x${metaSafe.h}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  /* ----------------------------- Keyboard shortcuts (optional keep) ----------------------------- */

  useEffect(() => {
    const onKeyDown = (ev) => {
      if (editingId) {
        if (ev.key === "Escape") {
          ev.preventDefault();
          closeTextEditor("cancel");
        }
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          closeTextEditor("commit");
        }
        return;
      }

      if (isInputLike(document.activeElement)) return;

      if (ev.code === "Space") {
        setIsSpaceDown(true);
        ev.preventDefault();
      }

      if (ev.key === "Escape") setSelected(null);

      if (ev.key === "Delete" || ev.key === "Backspace") {
        if (selectedId) {
          ev.preventDefault();
          deleteSelected();
        }
      }

      const isMod = ev.metaKey || ev.ctrlKey;

      if (isMod && (ev.key === "d" || ev.key === "D")) {
        ev.preventDefault();
        duplicateSelected();
      }

      if (isMod && ev.key === "0") {
        ev.preventDefault();
        fitSmart();
      }

      const step = ev.shiftKey ? 10 : 1;
      if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        nudgeSelected(-step, 0);
      }
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        nudgeSelected(step, 0);
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        nudgeSelected(0, -step);
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        nudgeSelected(0, step);
      }
    };

    const onKeyUp = (ev) => {
      if (ev.code === "Space") setIsSpaceDown(false);
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [editingId, closeTextEditor, deleteSelected, duplicateSelected, nudgeSelected, selectedId, setSelected, fitSmart]);

  const cursorStyle = isSpaceDown || isPanning ? "grabbing" : "default";
  const presetValue = metaSafe.presetKey || presetByWH(metaSafe.w, metaSafe.h);

  /* ----------------------------- Render ----------------------------- */

  return (
    <div ref={containerRef} className="w-full h-full relative select-none">
      {/* Top HUD */}
      {!compact && (
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-auto">
          <div className="flex gap-2 items-center">
            <div className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 shadow-[0_14px_40px_rgba(0,0,0,.35)] backdrop-blur-md flex items-center gap-2">
              <button className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs" onClick={zoomIn}>
                Zoom +
              </button>
              <button className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs" onClick={zoomOut}>
                Zoom -
              </button>
              <button className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs" onClick={fitSmart}>
                Fit
              </button>

              <div className="w-px h-7 bg-white/10 mx-1" />

              <select
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs outline-none"
                value={presetValue}
                onChange={(e) => applyPreset(e.target.value)}
              >
                {CANVAS_PRESETS.map((p) => (
                  <option key={p.key} value={p.key} className="bg-[#0B1220] text-white">
                    {p.label}
                  </option>
                ))}
              </select>

              <button className="ml-1 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/20 hover:bg-emerald-500/25 text-emerald-100 text-xs" onClick={exportPNG}>
                Export PNG
              </button>

              <button
                className={`ml-1 px-3 py-2 rounded-xl border text-xs backdrop-blur-md ${
                  showProps ? "bg-amber-500/15 border-amber-400/25 text-amber-100 hover:bg-amber-500/25" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                }`}
                onClick={() => setShowProps((v) => !v)}
              >
                Capas
              </button>
            </div>
          </div>

          <div className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-white/70 text-xs">
            {metaSafe.w}×{metaSafe.h} • zoom {zoom.toFixed(2)} • drop imágenes aquí ✨
          </div>
        </div>
      )}

      {/* Floating toolbar (Canva-like) */}
      {toolbarBox && selectedNodeModel && !selectedNodeModel.isBackground && (
        <div
          className="absolute z-40"
          style={{
            left: `${Math.round(toolbarBox.x + toolbarBox.w / 2)}px`,
            top: `${Math.round(toolbarBox.y - 12)}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "auto",
          }}
        >
          <div className="flex items-center gap-2 px-2 py-2 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,.6)]">
            <button
              onClick={toggleLockSelected}
              className={`px-3 py-2 rounded-xl border text-xs ${
                selectedLocked ? "bg-amber-500/20 border-amber-400/30 text-amber-100" : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
              }`}
              title="Bloquear / Desbloquear"
            >
              {selectedLocked ? "🔒 Locked" : "🔓 Lock"}
            </button>

            <button onClick={sendToBack} disabled={!selectedId || selectedLocked} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-xs disabled:opacity-40" title="Al fondo">
              ⏮️
            </button>
            <button onClick={sendBackward} disabled={!selectedId || selectedLocked} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-xs disabled:opacity-40" title="Enviar atrás">
              ⬇️
            </button>
            <button onClick={bringForward} disabled={!selectedId || selectedLocked} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-xs disabled:opacity-40" title="Traer al frente">
              ⬆️
            </button>
            <button onClick={bringToFront} disabled={!selectedId || selectedLocked} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-xs disabled:opacity-40" title="Al frente">
              ⏭️
            </button>

            <div className="w-px h-7 bg-white/10 mx-1" />

            <button onClick={() => rotateSelected(-15)} disabled={!selectedId || selectedLocked} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-xs disabled:opacity-40" title="Rotar -15°">
              ↺
            </button>
            <button onClick={() => rotateSelected(+15)} disabled={!selectedId || selectedLocked} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 text-xs disabled:opacity-40" title="Rotar +15°">
              ↻
            </button>
          </div>
        </div>
      )}

      {/* Text overlay */}
      {editingId && editingBox && (
        <textarea
          ref={textareaRef}
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => closeTextEditor("commit")}
          spellCheck={false}
          style={{
            position: "absolute",
            left: `${editingBox.x}px`,
            top: `${editingBox.y}px`,
            width: `${editingBox.w}px`,
            height: `${editingBox.h}px`,
            padding: "8px 10px",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.18)",
            outline: "none",
            background: "rgba(6,10,18,0.78)",
            color: editingBox.fill,
            fontFamily: editingBox.fontFamily,
            fontSize: `${Math.max(10, editingBox.fontSizePx)}px`,
            lineHeight: `${editingBox.lineHeight}`,
            resize: "none",
            transformOrigin: "top left",
            transform: `rotate(${editingBox.rotation}deg)`,
            boxShadow: "0 18px 45px rgba(0,0,0,0.50)",
            zIndex: 50,
          }}
        />
      )}

      <Stage
        ref={stageRef}
        width={containerSize.w}
        height={containerSize.h}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        onMouseUp={onStageMouseUp}
        onTouchStart={onStageMouseDown}
        onTouchMove={onStageMouseMove}
        onTouchEnd={onStageMouseUp}
        onWheel={onWheel}
        style={{ cursor: cursorStyle }}
      >
        <Layer>
          {/* background */}
          <Rect x={0} y={0} width={containerSize.w} height={containerSize.h} fill="#060A12" listening={false} />

          {/* grid */}
          {Array.from({ length: Math.ceil(containerSize.w / 80) }).map((_, i) => {
            const x = i * 80;
            return <Line key={`gv_${i}`} points={[x, 0, x, containerSize.h]} stroke="rgba(255,255,255,0.04)" strokeWidth={1} listening={false} />;
          })}
          {Array.from({ length: Math.ceil(containerSize.h / 80) }).map((_, i) => {
            const y = i * 80;
            return <Line key={`gh_${i}`} points={[0, y, containerSize.w, y]} stroke="rgba(255,255,255,0.04)" strokeWidth={1} listening={false} />;
          })}

          {/* canvas frame */}
          <Rect
            x={frame.x}
            y={frame.y}
            width={frame.w}
            height={frame.h}
            fill={metaSafe.bg}
            cornerRadius={22}
            shadowColor="black"
            shadowBlur={22}
            shadowOpacity={0.38}
            listening={false}
          />

          {/* Background slot */}
          {bgNode ? <BackgroundImageNode n={bgNode} frame={frame} canvasW={metaSafe.w} canvasH={metaSafe.h} /> : null}

          {/* nodes */}
          {fgNodes.map((n) => {
            if (n.type === "image") {
              return (
                <ImageNode
                  key={n.id}
                  n={n}
                  frame={frame}
                  isSpaceDown={isSpaceDown}
                  editingId={editingId}
                  setSelected={setSelected}
                  setShowProps={setShowProps}
                  screenToDoc={screenToDoc}
                  updateNode={updateNode}
                  onTransformEnd={onTransformEnd}
                />
              );
            }

            if (n.type === "rect") {
              const p = docToScreen(n.x || 0, n.y || 0);
              const locked = !!n.locked;
              const listening = locked ? false : typeof n.listening === "boolean" ? n.listening : true;
              const draggable = !locked && !isSpaceDown && !editingId && listening;

              return (
                <Rect
                  key={n.id}
                  id={n.id}
                  x={p.x}
                  y={p.y}
                  width={(n.width || 100) * frame.scale}
                  height={(n.height || 100) * frame.scale}
                  fill={n.fill || "#2B3A67"}
                  cornerRadius={(n.cornerRadius || 0) * frame.scale}
                  rotation={safeNum(n.rotation, 0)}
                  opacity={clamp(safeNum(n.opacity, 1), 0, 1)}
                  stroke={n.stroke || undefined}
                  strokeWidth={n.strokeWidth ? n.strokeWidth * frame.scale : undefined}
                  draggable={draggable}
                  hitStrokeWidth={12}
                  perfectDrawEnabled={false}
                  listening={listening}
                  onClick={() => listening && setSelected(n.id)}
                  onTap={() => listening && setSelected(n.id)}
                  onDragEnd={(e) => {
                    if (locked) return;
                    const docPos = screenToDoc(e.target.x(), e.target.y());
                    updateNode(n.id, { x: docPos.x, y: docPos.y });
                  }}
                  onTransformEnd={(e) => {
                    if (locked) return;
                    onTransformEnd(e, n);
                  }}
                />
              );
            }

            if (n.type === "text") {
              const p = docToScreen(n.x || 0, n.y || 0);
              const locked = !!n.locked;
              const listening = locked ? false : typeof n.listening === "boolean" ? n.listening : true;
              const draggable = !locked && !isSpaceDown && !editingId && listening;

              return (
                <Text
                  key={n.id}
                  id={n.id}
                  x={p.x}
                  y={p.y}
                  text={safeStr(n.text, "")}
                  fontSize={safeNum(n.fontSize, 32) * frame.scale}
                  fontFamily={safeStr(n.fontFamily, "Inter, system-ui")}
                  fill={safeStr(n.fill, "#E9EEF9")}
                  rotation={safeNum(n.rotation, 0)}
                  opacity={clamp(safeNum(n.opacity, 1), 0, 1)}
                  lineHeight={safeNum(n.lineHeight, 1.2)}
                  draggable={draggable}
                  hitStrokeWidth={12}
                  perfectDrawEnabled={false}
                  listening={listening}
                  onClick={() => listening && setSelected(n.id)}
                  onTap={() => listening && setSelected(n.id)}
                  onDblClick={() => !locked && listening && openTextEditor(n)}
                  onDblTap={() => !locked && listening && openTextEditor(n)}
                  onDragEnd={(e) => {
                    if (locked) return;
                    const docPos = screenToDoc(e.target.x(), e.target.y());
                    updateNode(n.id, { x: docPos.x, y: docPos.y });
                  }}
                  onTransformEnd={(e) => {
                    if (locked) return;
                    onTransformEnd(e, n);
                  }}
                />
              );
            }

            if (n.type === "line") {
              const pts = pointsDocToScreen(n.points || []);
              const locked = !!n.locked;
              const listening = locked ? false : typeof n.listening === "boolean" ? n.listening : true;
              const draggable = !locked && !isSpaceDown && !editingId && listening;

              return (
                <Line
                  key={n.id}
                  id={n.id}
                  points={pts}
                  stroke={n.stroke || "rgba(255,255,255,0.20)"}
                  strokeWidth={(n.strokeWidth || 2) * frame.scale}
                  lineCap={n.lineCap || "round"}
                  lineJoin={n.lineJoin || "round"}
                  opacity={clamp(safeNum(n.opacity, 1), 0, 1)}
                  draggable={draggable}
                  hitStrokeWidth={12}
                  perfectDrawEnabled={false}
                  listening={listening}
                  onClick={() => listening && setSelected(n.id)}
                  onTap={() => listening && setSelected(n.id)}
                  onDragEnd={(e) => {
                    if (locked) return;
                    const node = e.target;

                    const dxScreen = node.x();
                    const dyScreen = node.y();
                    node.x(0);
                    node.y(0);

                    const dxDoc = dxScreen / frame.scale;
                    const dyDoc = dyScreen / frame.scale;

                    const ptsDoc = Array.isArray(n.points) ? n.points.slice() : [];
                    for (let i = 0; i < ptsDoc.length; i += 2) {
                      ptsDoc[i] += dxDoc;
                      ptsDoc[i + 1] += dyDoc;
                    }
                    updateNode(n.id, { points: ptsDoc });
                  }}
                  onTransformEnd={(e) => {
                    if (locked) return;
                    onTransformEnd(e, n);
                  }}
                />
              );
            }

            return null;
          })}

          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio={false}
            borderStroke="rgba(96,165,250,0.9)"
            borderStrokeWidth={2}
            anchorStroke="rgba(96,165,250,0.95)"
            anchorFill="rgba(6,10,18,0.95)"
            anchorSize={10}
            anchorCornerRadius={6}
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
              if (newBox.width < 20 || newBox.height < 20) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>

      {/* Layers panel */}
      {showProps && !compact && (
        <div className="absolute right-3 bottom-3 z-20 w-[320px] rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,.55)] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="text-white/80 text-sm font-semibold">Capas</div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[11px]" onClick={() => setPropsMin((v) => !v)}>
                {propsMin ? "Expandir" : "Min"}
              </button>
              <button className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[11px]" onClick={() => setShowProps(false)}>
                ✕
              </button>
            </div>
          </div>

          {!propsMin && (
            <div className="p-3 space-y-3">
              <div className="text-white/60 text-xs">Tip: usa la barra flotante sobre el objeto para Lock / Capas / Rotar.</div>

              <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                {[...fgNodes].map((n) => {
                  const isSel = n.id === selectedId;
                  const locked = !!n.locked;
                  const label =
                    n.type === "image" ? "Imagen" : n.type === "text" ? "Texto" : n.type === "rect" ? "Forma" : n.type === "line" ? "Línea" : "Nodo";

                  return (
                    <div key={n.id} className={`flex items-center justify-between gap-2 rounded-xl border px-2 py-2 ${isSel ? "border-sky-400/40 bg-sky-500/10" : "border-white/10 bg-white/5"}`}>
                      <button className="flex-1 text-left text-white/80 text-xs truncate" onClick={() => setSelected(n.id)} title={n.id}>
                        {label} {locked ? "🔒" : ""}
                      </button>

                      <div className="flex items-center gap-1">
                        <button className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[11px]" onClick={() => updateNode(n.id, { locked: !locked, listening: locked ? true : false })} title="Lock/Unlock">
                          {locked ? "Unlock" : "Lock"}
                        </button>
                        <button className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[11px]" onClick={() => commit({ nodes: moveLayer(nodes, n.id, -1) })} title="Step back">
                          ◀
                        </button>
                        <button className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[11px]" onClick={() => commit({ nodes: moveLayer(nodes, n.id, +1) })} title="Step forward">
                          ▶
                        </button>
                        <button className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[11px]" onClick={() => commit({ nodes: moveToEdge(nodes, n.id, "back") })} title="Send to back">
                          Back
                        </button>
                        <button className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[11px]" onClick={() => commit({ nodes: moveToEdge(nodes, n.id, "front") })} title="Send to front">
                          Front
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
