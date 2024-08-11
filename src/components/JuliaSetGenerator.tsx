import React, { useState, useEffect, useRef, useCallback } from "react";
import type { FractalParams, Tile } from "@/types/types";
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
import useDebounce from "@/hooks/useDebounce";

const TILE_SIZE = 128;

const JuliaSetGenerator = () => {
  const [params, setParams] = useState<FractalParams>({
    c: { real: -0.7, imag: 0.27015 },
    center: { real: 0, imag: 0 },
    zoom: 250,
    maxIterations: 200,
    width: 1200,
    height: 600,
    coloring: Math.floor(Math.random() * 12) + 1,
    lod: 1,
  });

  const debouncedParams = useDebounce(params, 300);
  const [tiles, setTiles] = useState<Record<string, Tile>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isDragging = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const connectWebSocket = useCallback(() => {
    wsRef.current = new WebSocket("ws://localhost:8080/ws");

    wsRef.current.onopen = () => {
      requestNewTiles();
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "tile") {
        const img = new Image();
        img.onload = () => {
          setTiles((prevTiles) => ({
            ...prevTiles,
            [`${data.x},${data.y},${data.lod}`]: {
              x: data.x,
              y: data.y,
              lod: data.lod,
              image: img,
            },
          }));
        };
        img.src = `data:image/png;base64,${data.image}`;
      }
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error", error);
    };

    wsRef.current.onclose = () => {
      wsRef.current = null;
      console.log("WebSocket closed. Reconnecting...");
      setTimeout(connectWebSocket, 1000);
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    requestNewTiles();
  }, [debouncedParams]);

  useEffect(() => {
    renderTiles();
  }, [tiles, params.width, params.height]);

  const renderTiles = useCallback(() => {
    if (canvasRef.current) {
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvasRef.current.width = params.width * devicePixelRatio;
      canvasRef.current.height = params.height * devicePixelRatio;
      canvasRef.current.style.width = `${params.width}px`;
      canvasRef.current.style.height = `${params.height}px`;

      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.scale(devicePixelRatio, devicePixelRatio);
        ctx.clearRect(0, 0, params.width, params.height);

        // Render low-res tiles first
        Object.values(tiles)
          .sort((a, b) => b.lod - a.lod)
          .forEach((tile) => {
            ctx.drawImage(
              tile.image,
              tile.x + offsetRef.current.x,
              tile.y + offsetRef.current.y
            );
          });

        // Then render high-res tiles
        Object.values(tiles)
          .filter((tile) => tile.lod === 1)
          .forEach((tile) => {
            ctx.drawImage(
              tile.image,
              tile.x + offsetRef.current.x,
              tile.y + offsetRef.current.y
            );
          });
      }
    }
  }, [tiles, params.width, params.height]);

  const requestNewTiles = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const visibleTiles = getVisibleTiles();
      const newTiles = visibleTiles.filter((tile) => !tiles[`${tile},1`]);

      wsRef.current.send(
        JSON.stringify({
          params: { ...params, lod: 4 },
          tiles: newTiles,
          offset: offsetRef.current,
        })
      );

      setTimeout(() => {
        wsRef.current?.send(
          JSON.stringify({
            params: { ...params, lod: 1 },
            tiles: visibleTiles,
            offset: offsetRef.current,
          })
        );
      }, 100);
    }
  }, [params, tiles]);

  const getVisibleTiles = useCallback(() => {
    const tilesX = Math.ceil(params.width / TILE_SIZE) + 1; // Add 1 to cover edge cases
    const tilesY = Math.ceil(params.height / TILE_SIZE) + 1;
    const visibleTiles = [];
    const startX = Math.floor(-offsetRef.current.x / TILE_SIZE) - 1;
    const startY = Math.floor(-offsetRef.current.y / TILE_SIZE) - 1;
    for (let y = startY; y < startY + tilesY; y++) {
      for (let x = startX; x < startX + tilesX; x++) {
        visibleTiles.push(`${x * TILE_SIZE},${y * TILE_SIZE}`);
      }
    }
    return visibleTiles;
  }, [params.width, params.height]);

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
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      const dx = e.clientX - lastMousePosition.current.x;
      const dy = e.clientY - lastMousePosition.current.y;

      offsetRef.current.x += dx;
      offsetRef.current.y += dy;

      // If offset is larger than a tile, update the center and reset offset
      if (
        Math.abs(offsetRef.current.x) >= TILE_SIZE ||
        Math.abs(offsetRef.current.y) >= TILE_SIZE
      ) {
        const tileOffsetX = Math.floor(offsetRef.current.x / TILE_SIZE);
        const tileOffsetY = Math.floor(offsetRef.current.y / TILE_SIZE);

        setParams((prev) => ({
          ...prev,
          center: {
            real: prev.center.real - (tileOffsetX * TILE_SIZE) / prev.zoom,
            imag: prev.center.imag - (tileOffsetY * TILE_SIZE) / prev.zoom,
          },
        }));

        offsetRef.current.x -= tileOffsetX * TILE_SIZE;
        offsetRef.current.y -= tileOffsetY * TILE_SIZE;

        requestNewTiles();
      }

      lastMousePosition.current = { x: e.clientX, y: e.clientY };

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(renderTiles);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setParams((prev) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const centerX =
          prev.center.real + (mouseX - prev.width / 2) / prev.zoom;
        const centerY =
          prev.center.imag + (mouseY - prev.height / 2) / prev.zoom;
        const newZoom = prev.zoom * zoomFactor;
        return {
          ...prev,
          zoom: newZoom,
          center: {
            real: centerX + (prev.center.real - centerX) / zoomFactor,
            imag: centerY + (prev.center.imag - centerY) / zoomFactor,
          },
        };
      }
      return prev;
    });

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      renderTiles();
      requestNewTiles();
    });
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
                      <SelectItem value="10">Grey</SelectItem>
                      <SelectItem value="11">Alternate Colorings</SelectItem>
                      <SelectItem value="12">Coloring Mix</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={requestNewTiles}>
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
