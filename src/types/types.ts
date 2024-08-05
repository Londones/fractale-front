export type FractalParams = {
  width: number;
  height: number;
  c: Complex;
  zoom: number;
  center: Complex;
  maxIterations: number;
};

export type Complex = {
  real: number;
  imag: number;
};
