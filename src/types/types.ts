export type FractalParams = {
  width: number;
  height: number;
  c: Complex;
  zoom: number;
  center: Complex;
  maxIterations: number;
  coloring: number;
  lod: number;
};

export type Complex = {
  real: number;
  imag: number;
};

export type Tile = {
  x: number;
  y: number;
  lod: number;
  image: HTMLImageElement;
};
