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

    // Prefer ResizeObserver (more accurate than window resize only)
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
    const baseFit = clamp(fitScale, 0.05, 1.5); // base fit to view
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
      // Convert screen coords (stage space) to doc-space
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

      // Smooth zoom factor
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = direction > 0 ? 1.08 : 1 / 1.08;

      const nextZoom = clamp(oldZoom * factor, 0.1, 4);

      // Keep doc point under cursor fixed
      // world (doc) coords under cursor with old scale
      const oldScale = frame.baseFit * oldZoom;
      const newScale = frame.baseFit * nextZoom;

      // Compute doc coordinate under cursor using old scale + current pan
      const oldW = meta.w * oldScale;
      const oldH = meta.h * oldScale;
      const oldFrameX = (containerSize.w - oldW) / 2 + panX;
      const oldFrameY = (containerSize.h - oldH) / 2 + panY;

      const docX = (pointer.x - oldFrameX) / oldScale;
      const docY = (pointer.y - oldFrameY) / oldScale;

      // Now compute required pan so that cursor stays on same doc point
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

      // Konva gives us final screen-space props (already including our frame scaling),
      // so we must convert back to doc-space.
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // reset scale for clean values on Konva node
      node.scaleX(1);
      node.scaleY(1);

      // Screen position -> doc position
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
        // For Text: treat vertical scale as font-size multiplier (doc-space)
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

  /* ----------------------------- Keyboard shortcuts ----------------------------- */

  useEffect(() => {
    const onKeyDown = (ev) => {
      if (isInputLike(document.activeElement)) return;

      if (ev.code === "Space") {
        setIsSpaceDown(true);
        // prevent page scroll
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

      // Nudge with arrows
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
  }, [deleteSelected, duplicateSelected, nudgeSelected, selectedId, setSelected]);

  /* ----------------------------- UI actions ----------------------------- */

  const zoomIn = () => commitMeta({ zoom: clamp(zoom + 0.1, 0.1, 4) });
  const zoomOut = () => commitMeta({ zoom: clamp(zoom - 0.1, 0.1, 4) });
  const fit = () => commitMeta({ panX: 0, panY: 0, zoom: 0.75 });

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

            <div className="ml-2 text-white/50 text-[11px] hidden md:block">
              <span className="text-white/70">Tips:</span> Wheel=Zoom • Space+Drag=Pan • Del=Delete • ⌘/Ctrl+D=Duplicate • Arrows=Nudge (Shift=fast)
            </div>
          </div>

          <div className="text-white/60 text-xs">
            {meta.w}×{meta.h} • zoom {zoom.toFixed(2)}
          </div>
        </div>
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

          {/* subtle grid */}
          <Rect
            x={0}
            y={0}
            width={containerSize.w}
            height={containerSize.h}
            fillPatternRepeat="repeat"
            opacity={0.18}
          />

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
                  draggable={!isSpaceDown} // don't drag nodes while panning
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
                  draggable={!isSpaceDown}
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
              // prevent too small (screen space)
              if (newBox.width < 20 || newBox.height < 20) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}
