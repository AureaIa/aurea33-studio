// components/studio/StudioCanvas.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from "react-konva";

// Hook: cargar imagen desde dataURL
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

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function StudioCanvas({
  doc,
  onChange,
  compact,
}) {
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);

  // SSR guard (por si acaso)
  const isClient = typeof window !== "undefined";

  const width = doc?.width || 1080;
  const height = doc?.height || 1080;
  const background = doc?.background || "#0b0b0c";
  const nodes = doc?.nodes || [];

  // tamaño visible (no el real del export)
  const viewport = useMemo(() => {
    // canvas visible cómodo en tu UI
    const w = compact ? 720 : 860;
    const h = compact ? 520 : 620;
    // mantenemos aspect ratio del doc
    const r = width / height;
    let vw = w, vh = Math.round(w / r);
    if (vh > h) {
      vh = h;
      vw = Math.round(h * r);
    }
    return { vw, vh, scale: vw / width };
  }, [width, height, compact]);

  // aplicar transformer al seleccionar
  useEffect(() => {
    if (!isClient) return;
    const stage = stageRef.current;
    const tr = trRef.current;
    if (!stage || !tr) return;

    const sel = selectedId ? stage.findOne(`#${selectedId}`) : null;
    if (sel) {
      tr.nodes([sel]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, isClient, nodes]);

  const commit = (patch) => {
    onChange?.({
      ...doc,
      ...patch,
      updatedAt: Date.now(),
    });
  };

  const updateNode = (id, next) => {
    const nextNodes = nodes.map((n) => (n.id === id ? { ...n, ...next } : n));
    commit({ nodes: nextNodes });
  };

  const addText = () => {
    const id = uid();
    const n = {
      id,
      type: "text",
      x: 120,
      y: 140,
      text: "Título aquí",
      fontSize: 72,
      fontFamily: "Arial",
      fill: "#f7c600",
      width: 840,
      rotation: 0,
      draggable: true,
    };
    commit({ nodes: [...nodes, n] });
    setSelectedId(id);
  };

  const addRect = () => {
    const id = uid();
    const n = {
      id,
      type: "rect",
      x: 90,
      y: 780,
      width: 900,
      height: 160,
      fill: "rgba(0,0,0,0.35)",
      cornerRadius: 22,
      rotation: 0,
      draggable: true,
    };
    commit({ nodes: [...nodes, n] });
    setSelectedId(id);
  };

  const onUpload = async (file) => {
    if (!file) return;
    const id = uid();
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || "");
      const n = {
        id,
        type: "image",
        x: 120,
        y: 220,
        width: 840,
        height: 520,
        src,
        rotation: 0,
        draggable: true,
      };
      commit({ nodes: [...nodes, n] });
      setSelectedId(id);
    };
    reader.readAsDataURL(file);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    commit({ nodes: nodes.filter((n) => n.id !== selectedId) });
    setSelectedId(null);
  };

  const exportPNG = async () => {
    const stage = stageRef.current;
    if (!stage) return;

    // export a tamaño real del doc
    const uri = stage.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = uri;
    a.download = `aurea_studio_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const deselect = (e) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) setSelectedId(null);
  };

  if (!isClient) return null;

  return (
    <div style={wrap()}>
      <div style={toolbar()}>
        <div style={{ fontWeight: 900, opacity: 0.92 }}>
          AUREA STUDIO • Canvas
          <span style={{ marginLeft: 10, fontSize: 11, opacity: 0.65 }}>
            {width}×{height}
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={btn()} onClick={addText}>+ Texto</button>
          <button style={btn()} onClick={addRect}>+ Caja</button>

          <label style={btnLabel()}>
            Subir imagen
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
          </label>

          <button style={btnDanger()} onClick={removeSelected} disabled={!selectedId}>
            Borrar
          </button>
          <button style={btnGold()} onClick={exportPNG}>Export PNG</button>
        </div>
      </div>

      <div style={stageWrap()}>
        <Stage
          ref={stageRef}
          width={viewport.vw}
          height={viewport.vh}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          onMouseDown={deselect}
          onTouchStart={deselect}
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(0,0,0,0.25)",
          }}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              fill={background}
              listening={false}
            />

            {nodes.map((n) => {
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
                    draggable
                    onClick={() => setSelectedId(n.id)}
                    onTap={() => setSelectedId(n.id)}
                    onDragEnd={(e) => updateNode(n.id, { x: e.target.x(), y: e.target.y() })}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      updateNode(n.id, {
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(10, node.width() * scaleX),
                        height: Math.max(10, node.height() * scaleY),
                        rotation: node.rotation(),
                      });
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
                    width={n.width || 800}
                    fontSize={n.fontSize || 48}
                    fontFamily={n.fontFamily || "Arial"}
                    fill={n.fill || "#fff"}
                    rotation={n.rotation || 0}
                    draggable
                    onClick={() => setSelectedId(n.id)}
                    onTap={() => setSelectedId(n.id)}
                    onDblClick={() => {
                      const next = prompt("Editar texto:", n.text || "");
                      if (next !== null) updateNode(n.id, { text: next });
                    }}
                    onDragEnd={(e) => updateNode(n.id, { x: e.target.x(), y: e.target.y() })}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      node.scaleX(1);
                      updateNode(n.id, {
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(40, (node.width() || 800) * scaleX),
                        rotation: node.rotation(),
                        fontSize: Math.max(10, (n.fontSize || 48) * scaleX),
                      });
                    }}
                  />
                );
              }

              if (n.type === "image") {
                return <ImageNode key={n.id} node={n} onSelect={() => setSelectedId(n.id)} onUpdate={updateNode} />;
              }

              return null;
            })}

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

      <div style={hint()}>
        Tips: doble click en texto para editar • arrastra para mover • usa handles para escalar/rotar
      </div>
    </div>
  );
}

function ImageNode({ node, onSelect, onUpdate }) {
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
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onUpdate(node.id, { x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const k = e.target;
        const scaleX = k.scaleX();
        const scaleY = k.scaleY();
        k.scaleX(1);
        k.scaleY(1);
        onUpdate(node.id, {
          x: k.x(),
          y: k.y(),
          width: Math.max(10, k.width() * scaleX),
          height: Math.max(10, k.height() * scaleY),
          rotation: k.rotation(),
        });
      }}
    />
  );
}

/* --------- inline styles (minimal, match tu estética) --------- */
function wrap() {
  return { height: "100%", display: "flex", flexDirection: "column", gap: 10 };
}
function toolbar() {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
  };
}
function stageWrap() {
  return {
    flex: 1,
    minHeight: 0,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(0,0,0,0.22)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    padding: 10,
  };
}
function btn() {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.20)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  };
}
function btnLabel() {
  return { ...btn(), display: "inline-flex", alignItems: "center", gap: 8 };
}
function btnDanger() {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,80,80,0.25)",
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
function hint() {
  return {
    fontSize: 11,
    opacity: 0.7,
    padding: "8px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
  };
}
