import type { GridSize } from '../model/wall-maze.js';
import type { Prng } from '../primitives/prng.js';

interface ValueNoiseOptions {
  readonly lattice: 4;
  readonly octaves: 2;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function octave(grid: GridSize, prng: Prng, spacing: number): Float64Array {
  const rows = -Math.floor(-grid.rows / spacing) + 1;
  const cols = -Math.floor(-grid.cols / spacing) + 1;
  const lattice = Float64Array.from({ length: rows * cols }, () => prng.next());
  const values = new Float64Array(grid.rows * grid.cols);
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const y = Math.floor(row / spacing);
      const x = Math.floor(col / spacing);
      const vertical = smoothstep(row / spacing - y);
      const horizontal = smoothstep(col / spacing - x);
      // The extra lattice point on each axis guarantees all four samples exist.
      const a = lattice[y * cols + x]!;
      const b = lattice[y * cols + x + 1]!;
      const c = lattice[(y + 1) * cols + x]!;
      const d = lattice[(y + 1) * cols + x + 1]!;
      const top = a + (b - a) * horizontal;
      const bottom = c + (d - c) * horizontal;
      values[row * grid.cols + col] = top + (bottom - top) * vertical;
    }
  }
  return values;
}

export function valueNoise(grid: GridSize, prng: Prng, options: ValueNoiseOptions): Float64Array {
  // Finish every coarse lattice draw before drawing the fine lattice.
  const coarse = octave(grid, prng, options.lattice);
  const fine = octave(grid, prng, options.lattice / options.octaves);
  return coarse.map((value, index) => (value + 0.5 * (fine[index] ?? 0)) / 1.5);
}
