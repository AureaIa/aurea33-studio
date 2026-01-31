// components/studio/CanvasEditor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from "react-konva";

/* ----------------------------- utils ----------------------------- */

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// Hook: cargar imagen desde URL/dataURL
function useHtmlImage(src) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!src) return setImg(null);
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setImg(image);
    image.onerror = () => setImg(null);
    image.src = src;
  }, [src]);
  return img;
}

/* ----------------------------- component ----------------------------- */

export default function CanvasEditor({ doc, onChange, compact }) {
  const stageRef = useRef(null);
  const trRef = useRef(null);

  const [selectedId, setSelectedId] = useState(null);

  // seguridad
  const safeDoc = useMemo(() => {
    const d = doc || {};
    return {
      id: d.id || uid(),
      title: d.title || "Diseño",
      width: Number(d.width || 1080),
      height: Number(d.height || 1080),
      background: d.background || "#0b0b0c",
      nodes: Array.isArray(d.nodes) ? d.nodes : [],
      createdAt: d.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
  }, [doc]);

  const nodes = safeDoc.nodes;

  // Conectar transformer al nodo seleccionado
  useEffect(() => {
    if (!trRef.current) return;
    const stage = stageRef.current;
    if (!stage) return;

    const selectedNode = selectedId ? stage.findOne(`#${selectedId}`) : null;

    if (selectedNode) {
      trRef.current.nodes([selectedNode]);
      trRef.current.getLayer()?.batchDraw();
    } else {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, nodes.length]);

  function emit(nextDoc) {
    onChange?.({
      ...nextDoc,
      updatedAt: Date.now(),
    });
  }

  function patchNode(id, patch) {
    const nextNodes = nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    emit({ ...safeDoc, nodes: nextNodes });
  }

  function addText() {
    const id = uid();
    const next = {
      id,
      name: "Texto",
      type: "text",
      x: 120,
      y: 120,
      text: "Nuevo texto",
      fontSize: 64,
      fontFamily: "Inter",
      fill: "#ffffff",
      width: Math.max(300, safeDoc.width - 240),
      align: "left",
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
    };
    emit({ ...safeDoc, nodes: [next, ...nodes] });
    setSelectedId(id);
  }

  function addRect() {
    const id = uid();
    const next = {
      id,
      name: "Caja",
      type: "rect",
      x: 140,
      y: 240,
      width: 520,
      height: 220,
      fill: "rgba(0,0,0,0.35)",
      cornerRadius: 24,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
    };
    emit({ ...safeDoc, nodes: [next, ...nodes] });
    setSelectedId(id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    const nextNodes = nodes.filter((n) => n.id !== selectedId);
    emit({ ...safeDoc, nodes: nextNodes });
    setSelectedId(null);
  }

  // Hotkeys básicos
  useEffect(() => {
    const onKey = (e) => {
      const isInput =
        e.target?.tagName === "INPUT" ||
        e.target?.tagName === "TEXTAREA" ||
        e.target?.isContentEditable;

      if (isInput) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        addText();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        addRect();
      }
      if (e.key === "Escape") {
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, nodes]);

  function deselectOnEmpty(e) {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) setSelectedId(null);
  }

  // Render de node por tipo
  function NodeRenderer({ node }) {
    if (node.hidden) return null;

    const commonProps = {
      id: node.id, // importantísimo para findOne
      key: node.id,
      x: node.x || 0,
      y: node.y || 0,
      rotation: node.rotation || 0,
      opacity: node.opacity ?? 1,
      draggable: !node.locked,
      onClick: () => setSelectedId(node.id),
      onTap: () => setSelectedId(node.id),
      onDragEnd: (e) => patchNode(node.id, { x: e.target.x(), y: e.target.y() }),
      onTransformEnd: (e) => {
        const n = e.target;
        const scaleX = n.scaleX();
        const scaleY = n.scaleY();
        n.scaleX(1);
        n.scaleY(1);

        // default patch
        const patch = {
          x: n.x(),
          y: n.y(),
          rotation: n.rotation(),
        };

        if (node.type === "rect") {
          patch.width = Math.max(10, (node.width || 10) * scaleX);
          patch.height = Math.max(10, (node.height || 10) * scaleY);
        }

        if (node.type === "text") {
          // Para text, Konva escala visual; convertimos escala a fontSize/width aproximado
          patch.fontSize = Math.max(8, (node.fontSize || 16) * scaleY);
          patch.width = Math.max(40, (node.width || 200) * scaleX);
        }

        if (node.type === "image") {
          patch.width = Math.max(10, (node.width || 100) * scaleX);
          patch.height = Math.max(10, (node.height || 100) * scaleY);
        }

        patchNode(node.id, patch);
      },
    };

    if (node.type === "rect") {
      return (
        <Rect
          {...commonProps}
          width={node.width || 100}
          height={node.height || 100}
          fill={node.fill || "#222"}
          cornerRadius={node.cornerRadius || 0}
        />
      );
    }

    if (node.type === "text") {
      return (
        <Text
          {...commonProps}
          text={node.text || ""}
          fontSize={node.fontSize || 24}
          fontFamily={node.fontFamily || "Inter"}
          fill={node.fill || "#fff"}
          width={node.width || 300}
          align={node.align || "left"}
          lineHeight={node.lineHeight || 1.15}
        />
      );
    }

    if (node.type === "image") {
      const img = useHtmlImage(node.src);
      return (
        <KonvaImage
          {...commonProps}
          image={img}
          width={node.width || 300}
          height={node.height || 300}
        />
      );
    }

    return null;
  }

  const topBarStyle = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: compact ? 8 : 10,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    background: "rgba(20,20,22,0.6)",
    backdropFilter: "blur(12px)",
    marginBottom: 10,
  };

  const btnStyle = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Top bar */}
      <div style={topBarStyle}>
        <div style={{ fontWeight: 900, letterSpacing: 0.3 }}>
          {safeDoc.title} • {safeDoc.width}×{safeDoc.height}
        </div>

        <div style={{ flex: 1 }} />

        <button style={btnStyle} onClick={addText} title="Ctrl/Cmd + T">
          + Texto
        </button>
        <button style={btnStyle} onClick={addRect} title="Ctrl/Cmd + R">
          + Caja
        </button>
        <button
          style={{
            ...btnStyle,
            opacity: selectedId ? 1 : 0.5,
            cursor: selectedId ? "pointer" : "not-allowed",
          }}
          onClick={deleteSelected}
          disabled={!selectedId}
          title="Delete / Backspace"
        >
          Eliminar
        </button>
      </div>

      {/* Canvas container */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        <Stage
          ref={stageRef}
          width={safeDoc.width}
          height={safeDoc.height}
          onMouseDown={deselectOnEmpty}
          onTouchStart={deselectOnEmpty}
          style={{ display: "block", margin: "0 auto" }}
        >
          <Layer>
            {/* Background */}
            <Rect x={0} y={0} width={safeDoc.width} height={safeDoc.height} fill={safeDoc.background} />

            {/* Nodes */}
            {nodes.map((node) => (
              <NodeRenderer key={node.id} node={node} />
            ))}

            {/* Transformer */}
            <Transformer
              ref={trRef}
              rotateEnabled
              enabledAnchors={[
                "top-left",
                "top-center",
                "top-right",
                "middle-left",
                "middle-right",
                "bottom-left",
                "bottom-center",
                "bottom-right",
              ]}
              boundBoxFunc={(oldBox, newBox) => {
                // evita tamaños negativos/cero
                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
