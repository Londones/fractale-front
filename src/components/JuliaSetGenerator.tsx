import React, { useState, useEffect, useRef } from "react";
import type { FractalParams } from "../types/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const JuliaSetGenerator = () => {
  const [params, setParams] = useState<FractalParams>({
    c: { real: -0.7, imag: 0.27015 },
    center: { real: 0, imag: 0 },
    zoom: 250,
    maxIterations: 200,
    width: 1200,
    height: 600,
    coloring: Math.floor(Math.random() * 11) + 1,
  });
  const [image, setImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isDragging = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const connectWebSocket = () => {
      wsRef.current = new WebSocket("ws://localhost:8080/ws");

      wsRef.current.onopen = () => {
        updateJuliaSet();
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setImage(data.image);
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error", error);
      };

      wsRef.current.onclose = () => {
        wsRef.current = null;
        console.log("WebSocket closed. Reconnecting...");
        setTimeout(connectWebSocket, 1000);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (canvasRef.current && image) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, params.width, params.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = `data:image/png;base64,${image}`;
      }
    }
  }, [image, params]);

  const updateJuliaSet = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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

  const handleColoringChange = (value: string) => {
    setParams((prev) => ({
      ...prev,
      coloring: parseInt(value),
    }));
    updateJuliaSet();
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
      updateJuliaSet();
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    updateJuliaSet();
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setParams((prev) => {
      const newZoom = prev.zoom * zoomFactor;
      return {
        ...prev,
        zoom: newZoom < 250 ? 250 : newZoom,
      };
    });
    updateJuliaSet();
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardContent className="p-0 relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="absolute top-4 left-4 z-10">Controls</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-4 flex flex-col gap-2">
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
              <div className="space-y-2">
                <Label htmlFor="coloring">Coloring</Label>
                <Select
                  name="coloring"
                  value={params.coloring.toString()}
                  onValueChange={handleColoringChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a coloring" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="1">Smooth Color</SelectItem>
                      <SelectItem value="2">Stripe Pattern</SelectItem>
                      <SelectItem value="3">Electric Plasma</SelectItem>
                      <SelectItem value="4">Psychedelic Swirl</SelectItem>
                      <SelectItem value="5">Metallic Sheen</SelectItem>
                      <SelectItem value="6">Rainbow Spiral</SelectItem>
                      <SelectItem value="7">Autumn Leaves</SelectItem>
                      <SelectItem value="8">Ocean Depths</SelectItem>
                      <SelectItem value="9">Molten Lava</SelectItem>
                      <SelectItem value="10">Alternate Colorings</SelectItem>
                      <SelectItem value="11">Coloring Mix</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={updateJuliaSet}>
                Generate Julia Set
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
          <canvas
            style={{
              cursor: isDragging.current ? "grabbing" : "grab",
              borderRadius: "0.5rem",
            }}
            ref={canvasRef}
            width={params.width}
            height={params.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-auto"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default JuliaSetGenerator;
