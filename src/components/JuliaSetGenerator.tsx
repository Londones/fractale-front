import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texCoord = (a_position + 1.0) / 2.0;
  }
`;

const fragmentShaderSource = `
  precision highp float;
  uniform sampler2D u_texture;
  varying vec2 v_texCoord;

  void main() {
    gl_FragColor = texture2D(u_texture, v_texCoord);
  }
`;

const JuliaSetGenerator = () => {
  const [params, setParams] = useState({
    c: { real: 0.285, imag: -0.01 },
    center: { real: 0, imag: 0 },
    zoom: 250,
    maxIterations: 200,
    width: 1200,
    height: 600,
    coloring: Math.floor(Math.random() * 12) + 1,
    lod: 1,
  });
  const [isSlowUpdate, setIsSlowUpdate] = useState(false);

  const quickDebouncedParams = useDebounce(params, 0);
const slowDebouncedParams = useDebounce(params, 1000);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    glRef.current = gl;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) {
      console.error('Failed to create shaders');
      return;
    }

    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.shaderSource(fragmentShader, fragmentShaderSource);

    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    if (!program) {
      console.error('Failed to create program');
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Failed to link program:', gl.getProgramInfoLog(program));
      return;
    }

    programRef.current = program;

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    textureRef.current = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  }, []);

  const renderFractal = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, []);

  const handleBinaryData = useCallback((pixelData: Uint8Array) => {
    const gl = glRef.current;
    if (gl && textureRef.current) {
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
      const { width, height } = params;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
      renderFractal();
    }
  }, [params, renderFractal]);

  useEffect(() => {
    initWebGL();
  }, [initWebGL]);

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    wsRef.current = new WebSocket('ws://localhost:8080/ws');
    
    wsRef.current.onopen = () => {
      wsRef.current?.send(JSON.stringify({ params: isSlowUpdate ? slowDebouncedParams : quickDebouncedParams }));
    };

    wsRef.current.onmessage = (event) => {
      if (event.data instanceof Blob) {
        // Handle Blob data
        event.data.arrayBuffer().then(buffer => {
          handleBinaryData(new Uint8Array(buffer));
        });
      } else if (event.data instanceof ArrayBuffer) {
        // Handle ArrayBuffer data directly
        handleBinaryData(new Uint8Array(event.data));
      }
    };
  

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [quickDebouncedParams, slowDebouncedParams, params.height, params.width, renderFractal, params, handleBinaryData, isSlowUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

      setParams((prev) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const centerX = prev.center.real + (mouseX - prev.width / 2) / prev.zoom;
        const centerY = prev.center.imag - (mouseY - prev.height / 2) / prev.zoom;

        const newZoom = prev.zoom * zoomFactor;

        return {
          ...prev,
          zoom: newZoom,
          center: {
            real: centerX - (mouseX - prev.width / 2) / newZoom,
            imag: centerY + (mouseY - prev.height / 2) / newZoom,
          },
        };
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);
  

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, isSlowUpdate = true) => {
    const { name, value } = e.target;
    const numericValue = parseFloat(value);
  
    setParams((prev) => {
      if (name.includes(".")) {
        const [parent, child] = name.split(".") as [keyof typeof prev, string];
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

    setIsSlowUpdate(isSlowUpdate);
  };

  const handleColoringChange = (value: string) => {
    setParams((prev) => ({
      ...prev,
      coloring: parseInt(value),
    }));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;

    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;

    setParams((prev) => ({
      ...prev,
      center: {
        real: prev.center.real - deltaX / prev.zoom,
        imag: prev.center.imag + deltaY / prev.zoom,
      },
    }));

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
  //   e.preventDefault();
  //   const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

  //   setParams((prev) => {
  //     const rect = canvasRef.current?.getBoundingClientRect();
  //     if (!rect) return prev;

  //     const mouseX = e.clientX - rect.left;
  //     const mouseY = e.clientY - rect.top;

  //     const centerX = prev.center.real + (mouseX - prev.width / 2) / prev.zoom;
  //     const centerY = prev.center.imag - (mouseY - prev.height / 2) / prev.zoom;

  //     const newZoom = prev.zoom * zoomFactor;

  //     return {
  //       ...prev,
  //       zoom: newZoom,
  //       center: {
  //         real: centerX - (mouseX - prev.width / 2) / newZoom,
  //         imag: centerY + (mouseY - prev.height / 2) / newZoom,
  //       },
  //     };
  //   });
  // };

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full h-full">
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
                  onValueChange={(value) => setParams((prev) => ({ ...prev, zoom: value[0] }))}
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
            </DropdownMenuContent>
          </DropdownMenu>
          <canvas
            style={{
              cursor: isDragging.current ? "grabbing" : "grab",
              borderRadius: "0.5rem",
              imageRendering: "pixelated",
            }}
            ref={canvasRef}
            width={params.width}
            height={params.height}
            className="w-full h-full rounded-lg"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            //onWheel={handleWheel}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default JuliaSetGenerator;