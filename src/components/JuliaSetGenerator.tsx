import React, { useState, useEffect, useRef } from "react";
import type { FractalParams } from "../lib/types";

const JuliaSetGenerator = () => {
  const [params, setParams] = useState<FractalParams>({
    c: { real: -0.7, imag: 0.27015 },
    center: { real: 0, imag: 0 },
    zoom: 100,
    maxIterations: 100,
    width: 800,
    height: 600,
    offsetX: 0,
    offsetY: 0,
  });
  const [tiles, setTiles] = useState({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isDragging = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    wsRef.current = new WebSocket("ws://localhost:8080/ws");
    wsRef.current.onmessage = (event) => {
      const tileMsg = JSON.parse(event.data);
      setTiles((prevTiles) => ({
        ...prevTiles,
        [`${tileMsg.x},${tileMsg.y},${tileMsg.zoom}`]: tileMsg.data,
      }));
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");

      if (ctx) {
        ctx.clearRect(0, 0, params.width, params.height);

        Object.entries(tiles).forEach(([key, data]) => {
          const [x, y, zoom] = key.split(",").map(Number);
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, x * 256, y * 256);
          };
          img.src = `data:image/png;base64,${data}`;
        });
      }
    }
  }, [tiles, params.width, params.height]);

  const updateJuliaSet = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setTiles({});
      wsRef.current.send(JSON.stringify(params));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setParams((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: parseFloat(value) },
      }));
    } else {
      setParams((prev) => ({ ...prev, [name]: parseFloat(value) }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      const dx = e.clientX - lastMousePosition.current.x;
      const dy = e.clientY - lastMousePosition.current.y;
      setParams((prev) => ({
        ...prev,
        offsetX: prev.offsetX - dx,
        offsetY: prev.offsetY - dy,
      }));
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    updateJuliaSet();
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    setParams((prev) => {
      const newZoom = prev.zoom * zoomFactor;
      return {
        ...prev,
        zoom: newZoom < 100 ? 100 : newZoom,
      };
    });
    updateJuliaSet();
  };

  return (
    <div>
      <div>
        <label>
          C (Real):
          <input
            type="number"
            name="c.real"
            value={params.c.real}
            onChange={handleInputChange}
            step="0.01"
          />
        </label>
        <label>
          C (Imaginary):
          <input
            type="number"
            name="c.imag"
            value={params.c.imag}
            onChange={handleInputChange}
            step="0.01"
          />
        </label>
        <label>
          Zoom:
          <input
            type="number"
            name="zoom"
            value={params.zoom}
            onChange={handleInputChange}
            min="0.1"
            step="0.1"
          />
        </label>
        <label>
          Max Iterations:
          <input
            type="number"
            name="maxIterations"
            value={params.maxIterations}
            onChange={handleInputChange}
            min="1"
          />
        </label>
        <button onClick={updateJuliaSet}>Generate Julia Set</button>
      </div>
      <canvas
        ref={canvasRef}
        width={params.width}
        height={params.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: "move" }}
      />
    </div>
  );
};

export default JuliaSetGenerator;
