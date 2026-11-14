import { clampGridSize, type SolverId } from '../model/wall-maze.js';
import { getSolver } from '../search/registry.js';

export interface MountOptions {
  readonly environment?: 'wall-maze' | 'terrain';
  readonly openness?: number;
  readonly mode?: 'interactive' | 'background';
  readonly seed?: string | number;
  readonly rows?: number;
  readonly cols?: number;
  readonly solver?: SolverId;
  readonly stepsPerSecond?: number;
  readonly label?: string;
}
export interface NormalisedMountOptions {
  readonly environment: 'wall-maze' | 'terrain';
  readonly openness: number;
  readonly mode: 'interactive' | 'background';
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
  const mode = options.mode === 'background' ? 'background' : 'interactive';
  const defaultSpeed = mode === 'background' ? 30 : 60;
  const speed = options.stepsPerSecond ?? defaultSpeed;
  return {
    mode,
    environment: options.environment === 'terrain' ? 'terrain' : 'wall-maze',
    openness: Number.isFinite(options.openness ?? 0.5) ? Math.min(1, Math.max(0, options.openness ?? 0.5)) : 0.5,
    // Native text fields must replay the same seed type used for the first maze.
    seed: String(options.seed ?? freshSeed),
    rows: clampGridSize(options.rows ?? 20), cols: clampGridSize(options.cols ?? 20),
    solver: solver.ok ? solver.value.id : 'bfs' as SolverId,
    stepsPerSecond: Number.isFinite(speed) ? Math.min(500, Math.max(1, speed)) : defaultSpeed,
    label: options.label ?? 'Cornrow maze',
  };
}
