import React, { useState, useEffect, useRef } from "react";
import type { FractalParams } from "../types/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const JuliaSetGenerator = () => {
  const [params, setParams] = useState<FractalParams>({
    c: { real: -0.7, imag: 0.27015 },
    center: { real: 0, imag: 0 },
    zoom: 100,
    maxIterations: 100,
    width: 800,
    height: 600,
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
    const numericValue = parseFloat(value);

    setParams((prev) => {
      if (name.includes(".")) {
        const [parent, child] = name.split(".") as [
          keyof FractalParams,
          string
        ];
        if (parent === "c" || parent === "center") {
          return {
            ...prev,
            [parent]: {
              ...prev[parent],
              [child]: numericValue,
            },
          };
        }
      } else if (name in prev) {
        return {
          ...prev,
          [name]: numericValue,
        };
      }
      return prev;
    });
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
        center: {
          real: prev.center.real - dx / prev.zoom,
          imag: prev.center.imag + dy / prev.zoom,
        },
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
    <div className="container mx-auto p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Julia Set Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="c-real">C (Real)</Label>
                <Input
                  id="c-real"
                  type="number"
                  name="c.real"
                  value={params.c.real}
                  onChange={handleInputChange}
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-imag">C (Imaginary)</Label>
                <Input
                  id="c-imag"
                  type="number"
                  name="c.imag"
                  value={params.c.imag}
                  onChange={handleInputChange}
                  step="0.01"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="zoom">Zoom</Label>
                <Slider
                  id="zoom"
                  min={100}
                  max={10000}
                  step={100}
                  value={[params.zoom]}
                  onValueChange={(value) =>
                    setParams((prev) => ({ ...prev, zoom: value[0] }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-iterations">Max Iterations</Label>
                <Input
                  id="max-iterations"
                  type="number"
                  name="maxIterations"
                  value={params.maxIterations}
                  onChange={handleInputChange}
                  min="1"
                />
              </div>
            </div>
          </div>
          <Button className="mt-4" onClick={updateJuliaSet}>
            Generate Julia Set
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <canvas
            ref={canvasRef}
            width={params.width}
            height={params.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-auto cursor-move"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default JuliaSetGenerator;
