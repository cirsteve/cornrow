import { clampGridSize, type SolverId } from '../model/wall-maze';
import { getSolver } from '../search/registry';

export interface MountOptions {
  readonly seed?: string | number;
  readonly rows?: number;
  readonly cols?: number;
  readonly solver?: SolverId;
  readonly stepsPerSecond?: number;
  readonly label?: string;
}
export interface NormalisedMountOptions {
  readonly seed: string;
  readonly rows: number;
  readonly cols: number;
  readonly solver: SolverId;
  readonly stepsPerSecond: number;
  readonly label: string;
}

/** Entropy is supplied by the mount boundary, keeping normalisation pure. */
export function normaliseMountOptions(options: MountOptions, freshSeed: string | number): NormalisedMountOptions {
  const solver = getSolver(options.solver ?? 'bfs');
  const speed = options.stepsPerSecond ?? 60;
  return {
    // Native text fields must replay the same seed type used for the first maze.
    seed: String(options.seed ?? freshSeed),
    rows: clampGridSize(options.rows ?? 20), cols: clampGridSize(options.cols ?? 20),
    solver: solver.ok ? solver.value.id : 'bfs' as SolverId,
    stepsPerSecond: Number.isFinite(speed) ? Math.min(500, Math.max(1, speed)) : 60,
    label: options.label ?? 'Cornrow maze',
  };
}
