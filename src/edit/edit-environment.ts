import type { Environment } from '../model/environment.js';
import { TERRAIN_COSTS, type TerrainCost } from '../model/terrain-maze.js';
import { nodeIdOf, type CellCoord, type GridSize, type EnvironmentId, type NodeId } from '../model/wall-maze.js';
import { hashSeed } from '../primitives/prng.js';
import { err, ok, type Result } from '../primitives/result.js';

export interface EditError {
  readonly operation: 'cellsInArea' | 'addObstacles' | 'removeObstacles' | 'setGoal';
  readonly kind: 'outside-grid' | 'invalid-radius' | 'start-cell';
  readonly detail: string;
  readonly cell?: CellCoord;
}

function inGrid(grid: GridSize, cell: CellCoord): boolean {
  return Number.isInteger(cell.row) && Number.isInteger(cell.col)
    && cell.row >= 0 && cell.row < grid.rows && cell.col >= 0 && cell.col < grid.cols;
}

export function cellsInArea(grid: GridSize, center: CellCoord, radius: number): Result<readonly CellCoord[], EditError> {
  if (!inGrid(grid, center)) return err({ operation: 'cellsInArea', kind: 'outside-grid', detail: 'Center must be an integer cell inside the grid', cell: center });
  if (!Number.isInteger(radius) || radius < 0) return err({ operation: 'cellsInArea', kind: 'invalid-radius', detail: 'Radius must be a finite nonnegative integer' });
  const cells: CellCoord[] = [];
  for (let row = Math.max(0, center.row - radius); row <= Math.min(grid.rows - 1, center.row + radius); row += 1) {
    for (let col = Math.max(0, center.col - radius); col <= Math.min(grid.cols - 1, center.col + radius); col += 1) cells.push({ row, col });
  }
  return ok(cells);
}

function editedCopy<E extends Environment>(input: E, operation: EditError['operation'], goal: NodeId, passages: readonly number[], costs?: readonly TerrainCost[]): E {
  const id = `edited-${hashSeed(JSON.stringify([input.id, operation, input.rows, input.cols, input.start, goal, passages, costs]))}` as EnvironmentId;
  const common = { ...input, id, goal, passages: Object.freeze([...passages]) };
  // The discriminator and all kind-specific fields are preserved from E.
  return Object.freeze(input.kind === 'terrain'
    ? { ...common, costs: Object.freeze([...(costs ?? input.costs)]) }
    : common) as E;
}

function obstacles<E extends Environment>(env: E, center: CellCoord, radius: number, operation: 'addObstacles' | 'removeObstacles'): Result<E, EditError> {
  const area = cellsInArea(env, center, radius);
  if (!area.ok) return err({ ...area.error, operation });
  const passages = [...env.passages];
  switch (env.kind) {
    case 'wall-maze': {
      const selected = new Set(area.value.map(cell => nodeIdOf(env, cell)));
      for (let row = 0; row < env.rows; row += 1) {
        for (let col = 0; col < env.cols; col += 1) {
          const a = nodeIdOf(env, { row, col });
          for (const [dr, dc, bit, opposite] of [[0, 1, 2, 8], [1, 0, 4, 1]] as const) {
            const neighbour = { row: row + dr, col: col + dc };
            if (!inGrid(env, neighbour)) continue;
            const b = nodeIdOf(env, neighbour);
            if (!selected.has(a) && !selected.has(b)) continue;
            passages[a] = operation === 'addObstacles' ? (passages[a] ?? 0) & ~bit : (passages[a] ?? 0) | bit;
            passages[b] = operation === 'addObstacles' ? (passages[b] ?? 0) & ~opposite : (passages[b] ?? 0) | opposite;
          }
        }
      }
      return ok(editedCopy(env, operation, env.goal, passages));
    }
    case 'terrain': {
      const costs = [...env.costs];
      for (const cell of area.value) {
        const node = nodeIdOf(env, cell);
        const index = TERRAIN_COSTS.indexOf(costs[node] ?? 1);
        costs[node] = TERRAIN_COSTS[Math.max(0, Math.min(3, index + (operation === 'addObstacles' ? 1 : -1)))] ?? 1;
      }
      return ok(editedCopy(env, operation, env.goal, passages, costs));
    }
    default: {
      const exhaustive: never = env;
      return exhaustive;
    }
  }
}

export function addObstacles<E extends Environment>(env: E, center: CellCoord, radius: number): Result<E, EditError> {
  return obstacles(env, center, radius, 'addObstacles');
}
export function removeObstacles<E extends Environment>(env: E, center: CellCoord, radius: number): Result<E, EditError> {
  return obstacles(env, center, radius, 'removeObstacles');
}
export function setGoal<E extends Environment>(env: E, cell: CellCoord): Result<E, EditError> {
  if (!inGrid(env, cell)) return err({ operation: 'setGoal', kind: 'outside-grid', detail: 'Goal must be an integer cell inside the grid', cell });
  const goal = nodeIdOf(env, cell);
  if (goal === env.start) return err({ operation: 'setGoal', kind: 'start-cell', detail: 'Goal cannot be the start cell', cell });
  return ok(editedCopy(env, 'setGoal', goal, env.passages, env.kind === 'terrain' ? env.costs : undefined));
}
