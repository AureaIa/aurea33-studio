"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Stage, Layer, Rect, Text, Transformer } from "react-konva";

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

/* ----------------------------- Component ----------------------------- */

export default function StudioCanvas({ doc, onChange, compact = false }) {
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const containerRef = useRef(null);

  // Runtime state
  const [containerSize, setContainerSize] = useState({ w: 1200, h: 800 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Text editing overlay (Paso 1)
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingBox, setEditingBox] = useState(null); // { x,y,w,h, rotation, fill, fontFamily, fontSizePx }
  const textareaRef = useRef(null);

  // Doc data (with safe defaults)
  const meta = doc?.meta || { w: 1080, h: 1080, bg: "#0B1220", zoom: 0.8, panX: 0, panY: 0 };
  const nodes = doc?.nodes || [];
  const selectedId = doc?.selectedId || null;

  const zoom = typeof meta.zoom === "number" ? meta.zoom : 0.8;
  const panX = typeof meta.panX === "number" ? meta.panX : 0;
  const panY = typeof meta.panY === "number" ? meta.panY : 0;

  // Commit helpers
  const commit = useCallback(
    (patch) => {
      if (!onChange) return;
      onChange({ ...(doc || {}), ...patch });
    },
    [doc, onChange]
  );

  const commitMeta = useCallback(
    (metaPatch) => {
      commit({ meta: { ...meta, ...metaPatch } });
    },
    [commit, meta]
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

  /* ----------------------------- Frame math (fit + zoom + pan) ----------------------------- */

  const frame = useMemo(() => {
    const padding = 40;
    const maxW = Math.max(1, containerSize.w - padding * 2);
    const maxH = Math.max(1, containerSize.h - padding * 2);

    const fitScale = Math.min(maxW / meta.w, maxH / meta.h);
    const baseFit = clamp(fitScale, 0.05, 1.5);
    const scale = baseFit * clamp(zoom, 0.1, 4);

    const w = meta.w * scale;
    const h = meta.h * scale;

    const x = (containerSize.w - w) / 2 + panX;
    const y = (containerSize.h - h) / 2 + panY;

    return { x, y, w, h, scale, baseFit };
  }, [containerSize.w, containerSize.h, meta.w, meta.h, zoom, panX, panY]);

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

      // If editing text and user clicks anywhere, commit/cancel handled by textarea handlers.
      // We don't force close here to avoid weirdness.

      // Panning: SPACE + drag anywhere
      if (isSpaceDown) {
        setIsPanning(true);
        const pos = stage.getPointerPosition() || { x: 0, y: 0 };
        panStartRef.current = { x: pos.x, y: pos.y, panX, panY };
        return;
      }

      // Click on empty area => deselect
      if (isEmpty) setSelected(null);
    },
    [isSpaceDown, panX, panY, setSelected]
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

  /* ----------------------------- Wheel zoom (keep cursor anchored) ----------------------------- */

  const onWheel = useCallback(
    (e) => {
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

      const oldW = meta.w * oldScale;
      const oldH = meta.h * oldScale;
      const oldFrameX = (containerSize.w - oldW) / 2 + panX;
      const oldFrameY = (containerSize.h - oldH) / 2 + panY;

      const docX = (pointer.x - oldFrameX) / oldScale;
      const docY = (pointer.y - oldFrameY) / oldScale;

      const newW = meta.w * newScale;
      const newH = meta.h * newScale;

      const newFrameX = pointer.x - docX * newScale;
      const newFrameY = pointer.y - docY * newScale;

      const nextPanX = newFrameX - (containerSize.w - newW) / 2;
      const nextPanY = newFrameY - (containerSize.h - newH) / 2;

      commitMeta({ zoom: nextZoom, panX: nextPanX, panY: nextPanY });
    },
    [zoom, frame.baseFit, meta.w, containerSize.w, meta.h, containerSize.h, panX, panY, commitMeta]
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

  /* ----------------------------- Text Editing (Paso 1) ----------------------------- */

  const openTextEditor = useCallback(
    (textNodeModel) => {
      const stage = stageRef.current;
      if (!stage) return;

      const konvaNode = stage.findOne(`#${textNodeModel.id}`);
      if (!konvaNode) return;

      // Get bounding box in stage coordinates
      const box = konvaNode.getClientRect({ skipStroke: true });

      // Put textarea over it
      const padding = 6;
      const w = Math.max(120, box.width + padding * 2);
      const h = Math.max(32, box.height + padding * 2);

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

      // Select it too (Canva-style)
      setSelected(textNodeModel.id);

      // Focus next tick
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
      const nextText = editingValue;

      setEditingId(null);
      setEditingBox(null);

      if (mode === "commit") {
        updateNode(id, { text: nextText });
      }
      // cancel => do nothing
    },
    [editingId, editingValue, updateNode]
  );

  // Close editor if canvas size/zoom/pan changes drastically (avoid misalignment)
  useEffect(() => {
    if (!editingId) return;
    // We do a soft close commit to prevent "floating textarea"
    closeTextEditor("commit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.w, meta.h, zoom, panX, panY]);

  /* ----------------------------- Keyboard shortcuts ----------------------------- */

  useEffect(() => {
    const onKeyDown = (ev) => {
      // If editing text: special handling
      if (editingId) {
        if (ev.key === "Escape") {
          ev.preventDefault();
          closeTextEditor("cancel");
        }
        // Enter to commit (Shift+Enter = newline)
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
  }, [deleteSelected, duplicateSelected, nudgeSelected, selectedId, setSelected, editingId, closeTextEditor]);

  /* ----------------------------- UI actions ----------------------------- */

  const zoomIn = () => commitMeta({ zoom: clamp(zoom + 0.1, 0.1, 4) });
  const zoomOut = () => commitMeta({ zoom: clamp(zoom - 0.1, 0.1, 4) });
  const fit = () => commitMeta({ panX: 0, panY: 0, zoom: 0.75 });

  const applyPreset = (presetKey) => {
    const p = CANVAS_PRESETS.find((x) => x.key === presetKey);
    if (!p) return;
    // Keep bg & reset view for clean feel
    commitMeta({ w: p.w, h: p.h, panX: 0, panY: 0, zoom: 0.75 });
    setSelected(null);
  };

  const exportPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;

    // Export only the frame (cropped), pixelRatio for sharpness
    const uri = stage.toDataURL({
      x: frame.x,
      y: frame.y,
      width: frame.w,
      height: frame.h,
      pixelRatio: 2,
      mimeType: "image/png",
    });

    const a = document.createElement("a");
    a.href = uri;
    a.download = `aurea33_${meta.w}x${meta.h}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Cursor: show grab when space
  const cursorStyle = isSpaceDown || isPanning ? "grab" : selectedId ? "default" : "default";

  /* ----------------------------- Render ----------------------------- */

  return (
    <div ref={containerRef} className="w-full h-full relative select-none">
      {/* Top bar */}
      {!compact && (
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-auto">
          <div className="flex gap-2 items-center">
            <button
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
              onClick={zoomIn}
              title="Zoom In (wheel also works)"
            >
              Zoom +
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
              onClick={zoomOut}
              title="Zoom Out"
            >
              Zoom -
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs"
              onClick={fit}
              title="Fit"
            >
              Fit
            </button>

            {/* Presets (Paso 1) */}
            <select
              className="ml-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs outline-none"
              defaultValue="ig_post"
              onChange={(e) => applyPreset(e.target.value)}
              title="Tamaño del diseño"
            >
              {CANVAS_PRESETS.map((p) => (
                <option key={p.key} value={p.key} className="bg-[#0B1220] text-white">
                  {p.label}
                </option>
              ))}
            </select>

            {/* Export (Paso 1) */}
            <button
              className="ml-2 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 text-xs"
              onClick={exportPNG}
              title="Export PNG"
            >
              Export PNG
            </button>

            <div className="ml-2 text-white/50 text-[11px] hidden md:block">
              <span className="text-white/70">Tips:</span> Wheel=Zoom • Space+Drag=Pan • Del=Delete • ⌘/Ctrl+D=Duplicate • Arrows=Nudge (Shift=fast) • DblClick Text=Edit (Enter=Save / Esc=Cancel)
            </div>
          </div>

          <div className="text-white/60 text-xs">
            {meta.w}×{meta.h} • zoom {zoom.toFixed(2)}
          </div>
        </div>
      )}

      {/* Text Editor Overlay (Paso 1) */}
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
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.18)",
            outline: "none",
            background: "rgba(6,10,18,0.75)",
            color: editingBox.fill,
            fontFamily: editingBox.fontFamily,
            fontSize: `${Math.max(10, editingBox.fontSizePx)}px`,
            lineHeight: `${editingBox.lineHeight}`,
            resize: "none",
            transformOrigin: "top left",
            transform: `rotate(${editingBox.rotation}deg)`,
            boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
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
          <Rect x={0} y={0} width={containerSize.w} height={containerSize.h} fill="#060A12" />

          {/* canvas frame */}
          <Rect
            x={frame.x}
            y={frame.y}
            width={frame.w}
            height={frame.h}
            fill={meta.bg || "#0B1220"}
            cornerRadius={22}
            shadowColor="black"
            shadowBlur={18}
            shadowOpacity={0.35}
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

          {/* transformer */}
          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio={false}
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
