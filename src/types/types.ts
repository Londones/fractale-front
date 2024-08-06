export type FractalParams = {
  width: number;
  height: number;
  c: Complex;
  zoom: number;
  center: Complex;
  maxIterations: number;
  coloring: number;
};

export type Complex = {
  real: number;
  imag: number;
};

export type Tile = {
  x: number;
  y: number;
  zoom: number;
  lod: number;
  data: string;
};
