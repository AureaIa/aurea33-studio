"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Stage, Layer, Rect, Text, Transformer, Line } from "react-konva";

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

/* ----------------------------- Presets (Paso 1) ----------------------------- */

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

/* ----------------------------- Component ----------------------------- */

export default function StudioCanvas({ doc, onChange, compact = false }) {
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const containerRef = useRef(null);

  /* ----------------------------- Runtime state ----------------------------- */

  const [containerSize, setContainerSize] = useState({ w: 1200, h: 800 });

  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Text editing overlay
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingBox, setEditingBox] = useState(null);
  const textareaRef = useRef(null);

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

  /* ----------------------------- Commit helpers ----------------------------- */

  const commit = useCallback(
    (patch) => {
      if (!onChange) return;
      onChange({ ...(doc || {}), ...patch });
    },
    [doc, onChange]
  );

  const commitMeta = useCallback(
    (metaPatch) => {
      commit({ meta: { ...metaSafe, ...metaPatch } });
    },
    [commit, metaSafe]
  );

  const setSelected = useCallback(
    (id) => {
      commit({ selectedId: id });
    },
    [commit]
  );

  const updateNode = useCallback(
    (id, patch) => {
      commit({
        nodes: nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      });
    },
    [commit, nodes]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const next = nodes.filter((n) => n.id !== selectedId);
    commit({ nodes: next, selectedId: null });
  }, [commit, nodes, selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    const n = nodes.find((x) => x.id === selectedId);
    if (!n) return;
    const copy = { ...n, id: uid(), x: (n.x || 0) + 24, y: (n.y || 0) + 24 };
    commit({ nodes: [...nodes, copy], selectedId: copy.id });
  }, [commit, nodes, selectedId]);

  const nudgeSelected = useCallback(
    (dx, dy) => {
      if (!selectedId) return;
      const n = nodes.find((x) => x.id === selectedId);
      if (!n) return;
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

  /* ----------------------------- Transformer attach ----------------------------- */

  useEffect(() => {
    const stage = stageRef.current;
    const tr = trRef.current;
    if (!stage || !tr) return;

    const selectedNode = selectedId ? stage.findOne(`#${selectedId}`) : null;
    if (selectedNode) {
      tr.nodes([selectedNode]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, nodes]);

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
      if (editingId) return; // prevent misalign while editing
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

  /* ----------------------------- Node transform correctness ----------------------------- */

  const onTransformEnd = useCallback(
    (e, nodeModel) => {
      const node = e.target;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      node.scaleX(1);
      node.scaleY(1);

      const docPos = screenToDoc(node.x(), node.y());

      if (nodeModel.type === "rect") {
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
      }
    },
    [frame.scale, screenToDoc, updateNode]
  );

  /* ----------------------------- Text editing overlay ----------------------------- */

  const openTextEditor = useCallback(
    (textNodeModel) => {
      const stage = stageRef.current;
      if (!stage) return;

      const konvaNode = stage.findOne(`#${textNodeModel.id}`);
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

      if (mode === "commit") {
        updateNode(id, { text: editingValue });
      }
    },
    [editingId, editingValue, updateNode]
  );

  // If view changes while editing: commit and close (prevents floating textarea)
  useEffect(() => {
    if (!editingId) return;
    closeTextEditor("commit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaSafe.w, metaSafe.h, zoom, panX, panY]);

  /* ----------------------------- UI actions ----------------------------- */

  const fitSmart = useCallback(() => {
    // Perfect fit: zoom=1 (relative), reset pan
    commitMeta({ panX: 0, panY: 0, zoom: 1 });
  }, [commitMeta]);

  const zoomIn = () => commitMeta({ zoom: clamp(zoom + 0.1, 0.1, 4) });
  const zoomOut = () => commitMeta({ zoom: clamp(zoom - 0.1, 0.1, 4) });

  const applyPreset = (presetKey) => {
    const p = CANVAS_PRESETS.find((x) => x.key === presetKey);
    if (!p) return;

    // Persist presetKey so select stays controlled and you can detect parent resets
    commitMeta({ presetKey: p.key, w: p.w, h: p.h, panX: 0, panY: 0, zoom: 1 });
    setSelected(null);

    console.log("APPLY PRESET", presetKey, p.w, p.h);
    // Helps catch parent overwriting meta:
    setTimeout(() => {
      console.log("META AFTER PRESET", doc?.meta?.w, doc?.meta?.h, doc?.meta?.presetKey);
    }, 0);
  };

  const exportPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;

    // For large sizes, keep pixelRatio reasonable
    const maxSide = Math.max(metaSafe.w, metaSafe.h);
    const pixelRatio = maxSide > 2200 ? 1.5 : 2;

    const uri = stage.toDataURL({
  x: Math.round(frame.x),
  y: Math.round(frame.y),
  width: Math.round(frame.w),
  height: Math.round(frame.h),
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

  /* ----------------------------- Keyboard shortcuts ----------------------------- */

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

      if (isMod && (ev.key === "0")) {
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

  /* ----------------------------- Visual: Futuristic UI helpers ----------------------------- */

const cursorStyle = isSpaceDown || isPanning ? "grabbing" : "default";

  const presetValue = metaSafe.presetKey || presetByWH(metaSafe.w, metaSafe.h);

  /* ----------------------------- Render ----------------------------- */

  return (
    <div ref={containerRef} className="w-full h-full relative select-none">
      {/* Futuristic top bar */}
      {!compact && (
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-auto">
          <div className="flex gap-2 items-center">
            <div className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 shadow-[0_14px_40px_rgba(0,0,0,.35)] backdrop-blur-md flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={zoomIn}
                title="Zoom In (wheel)"
              >
                Zoom +
              </button>
              <button
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={zoomOut}
                title="Zoom Out"
              >
                Zoom -
              </button>
              <button
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs"
                onClick={fitSmart}
                title="Fit (Ctrl/Cmd+0)"
              >
                Fit
              </button>

              <div className="w-px h-7 bg-white/10 mx-1" />

              {/* Presets */}
              <select
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs outline-none"
                value={presetValue}
                onChange={(e) => applyPreset(e.target.value)}
                title="Tamaño del diseño"
              >
                {CANVAS_PRESETS.map((p) => (
                  <option key={p.key} value={p.key} className="bg-[#0B1220] text-white">
                    {p.label}
                  </option>
                ))}
              </select>

              {/* Export */}
              <button
                className="ml-1 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/20 hover:bg-emerald-500/25 text-emerald-100 text-xs shadow-[0_0_0_1px_rgba(16,185,129,.10)]"
                onClick={exportPNG}
                title="Export PNG"
              >
                Export PNG
              </button>
            </div>

            <div className="ml-3 hidden md:flex items-center gap-2 text-[11px] text-white/50">
              <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                Wheel=Zoom
              </span>
              <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                Space+Drag=Pan
              </span>
              <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                DblClick Text=Edit
              </span>
              <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                Ctrl/Cmd+0=Fit
              </span>
            </div>
          </div>

          <div className="px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-white/70 text-xs">
            {metaSafe.w}×{metaSafe.h} • zoom {zoom.toFixed(2)}
          </div>
        </div>
      )}

      {/* Text Editor Overlay */}
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

          {/* futuristic grid (lightweight) */}
          {/* vertical lines */}
          {Array.from({ length: Math.ceil(containerSize.w / 80) }).map((_, i) => {
            const x = i * 80;
            return (
              <Line
                key={`gv_${i}`}
                points={[x, 0, x, containerSize.h]}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
                  listening={false}

              />
            );
          })}
          {/* horizontal lines */}
          {Array.from({ length: Math.ceil(containerSize.h / 80) }).map((_, i) => {
            const y = i * 80;
            return (
              <Line
                key={`gh_${i}`}
                points={[0, y, containerSize.w, y]}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
              />
            );
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


          {/* nodes */}
          {nodes.map((n) => {
            if (n.type === "rect") {
              const p = docToScreen(n.x || 0, n.y || 0);
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
                  rotation={n.rotation || 0}
                  draggable={!isSpaceDown && !editingId}
                  hitStrokeWidth={12}
                  perfectDrawEnabled={false}
                  onClick={() => setSelected(n.id)}
                  onTap={() => setSelected(n.id)}
                  onDragEnd={(e) => {
                    const docPos = screenToDoc(e.target.x(), e.target.y());
                    updateNode(n.id, { x: docPos.x, y: docPos.y });
                  }}
                  onTransformEnd={(e) => onTransformEnd(e, n)}
                />
              );
            }

            if (n.type === "text") {
              const p = docToScreen(n.x || 0, n.y || 0);
              return (
                <Text
                  key={n.id}
                  id={n.id}
                  x={p.x}
                  y={p.y}
                  text={n.text || ""}
                  fontSize={(n.fontSize || 32) * frame.scale}
                  fontFamily={n.fontFamily || "Inter, system-ui"}
                  fill={n.fill || "#E9EEF9"}
                  rotation={n.rotation || 0}
                  draggable={!isSpaceDown && !editingId}
                  hitStrokeWidth={12}
                  perfectDrawEnabled={false}
                  onClick={() => setSelected(n.id)}
                  onTap={() => setSelected(n.id)}
                  onDblClick={() => openTextEditor(n)}
                  onDblTap={() => openTextEditor(n)}
                  onDragEnd={(e) => {
                    const docPos = screenToDoc(e.target.x(), e.target.y());
                    updateNode(n.id, { x: docPos.x, y: docPos.y });
                  }}
                  onTransformEnd={(e) => onTransformEnd(e, n)}
                />
              );
            }

            return null;
          })}

          {/* transformer (canva-ish) */}
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
    </div>
  );
}
