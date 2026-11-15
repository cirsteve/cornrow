// @vitest-environment node
import { expect, expectTypeOf, it } from 'vitest';
import {
  cellOf, checkPath, generate, getSolver, solve,
  TERRAIN_COSTS, buildTerrainMaze, stepCost, pathCost, braidedTerrain,
  terrainGeneratorId, terrainGeneratorVersion, validateTerrainMaze, dijkstra,
} from './index.js';
import type {
  TerrainMaze, TerrainCost, Environment, PassageGrid, TerrainBuildError,
  TerrainOptions, TerrainGenerator, EnvironmentOptions, TerrainValidationError, WallMaze,
} from './index.js';

it('imports the public entry and generates and solves without a DOM', () => {
  expect(typeof document).toBe('undefined');
  expect(typeof window).toBe('undefined');
  const { environment } = generate({ seed: 'cornrow', rows: 10, cols: 10 });
  for (const id of ['bfs', 'astar']) {
    const descriptor = getSolver(id);
    if (!descriptor.ok) throw new Error(descriptor.error.detail);
    const { result } = solve(environment, descriptor.value.id);
    expect(result.outcome).toBe('found');
    if (result.outcome !== 'found') throw new Error('Expected a solved maze');
    expect(cellOf(environment, result.path[0] ?? environment.goal)).toEqual({ row: 0, col: 0 });
    expect(cellOf(environment, result.path.at(-1) ?? environment.start)).toEqual({ row: 9, col: 9 });
    expect(checkPath(environment, result.path, environment).ok).toBe(true);
  }
});

it('exports the terrain core and preserves precise generation types without a DOM', () => {
  const terrain = generate({ kind: 'terrain', seed: 'x', rows: 10, cols: 10 });
  const wall = generate({ seed: 'x', rows: 10, cols: 10 });
  const explicitWall = generate({ kind: 'wall-maze', seed: 'x', rows: 10, cols: 10 });
  expectTypeOf(terrain.environment).toEqualTypeOf<TerrainMaze>();
  expectTypeOf(terrain.options).toEqualTypeOf<Readonly<Required<TerrainOptions>>>();
  expectTypeOf(wall.environment).toEqualTypeOf<WallMaze>();
  expectTypeOf(explicitWall.environment).toEqualTypeOf<WallMaze>();
  expectTypeOf<TerrainMaze>().toMatchTypeOf<Environment>();
  expectTypeOf<TerrainMaze>().toMatchTypeOf<PassageGrid>();
  expectTypeOf<WallMaze>().toMatchTypeOf<Environment>();
  expectTypeOf(braidedTerrain).toEqualTypeOf<TerrainGenerator>();
  expectTypeOf<TerrainCost>().toEqualTypeOf<1 | 2 | 4 | 8>();
  expectTypeOf<TerrainBuildError['operation']>().toEqualTypeOf<'buildTerrainMaze'>();
  expectTypeOf<TerrainValidationError['operation']>().toEqualTypeOf<'validateTerrainMaze'>();
  const dispatch = (options: EnvironmentOptions): Environment => generate(options).environment;
  expect(dispatch({ kind: 'terrain', seed: 'x', rows: 10, cols: 10 })).toEqual(terrain.environment);
  expect(TERRAIN_COSTS).toEqual([1, 2, 4, 8]);
  expect(typeof buildTerrainMaze).toBe('function');
  expect(stepCost(terrain.environment, terrain.environment.goal)).toBe(terrain.environment.costs[terrain.environment.goal]);
  expect(pathCost(terrain.environment, [terrain.environment.start])).toBe(0);
  expect(terrain.generatorId).toBe(terrainGeneratorId);
  expect(terrain.generatorVersion).toBe(terrainGeneratorVersion);
  expect(validateTerrainMaze(terrain.environment).ok).toBe(true);
  expect(getSolver('dijkstra')).toMatchObject({ ok: true, value: { solver: dijkstra } });
  const descriptor = getSolver('dijkstra');
  if (!descriptor.ok) throw new Error(descriptor.error.detail);
  const run = solve(terrain.environment, descriptor.value.id);
  expect(run.result.cost).toBe(pathCost(terrain.environment, run.result.path));
});

import { defaultAppearance, mergeAppearance, normaliseHex, frontierColor, formatOverlay } from './index.js';
import type { RenderAppearance, RenderPalette, FrontierAppearance, AppearanceError, AppearancePatch, CornrowAppearance, MountedUiTokens } from './index.js';
it('exports appearance values and precise types without a DOM', () => {
  expect(typeof document).toBe('undefined');
  expect(Object.isFrozen(defaultAppearance.render.palette)).toBe(true);
  expect(mergeAppearance(defaultAppearance, { render: { frontier: { shape: 'circle' } } }).ok).toBe(true);
  const color = normaliseHex('#abcdef');
  expect(color).toEqual({ ok: true, value: '#ABCDEF' });
  expect(frontierColor(defaultAppearance.render.palette.frontier, 1)).toBe('#E69F00');
  expect(formatOverlay(defaultAppearance.render.palette.visitedOverlay)).toBe('rgba(0, 70, 110, 0.16)');
  expectTypeOf(defaultAppearance).toEqualTypeOf<CornrowAppearance>();
  expectTypeOf(defaultAppearance.ui).toEqualTypeOf<MountedUiTokens>();
  expectTypeOf(defaultAppearance.render).toEqualTypeOf<RenderAppearance>();
  expectTypeOf(defaultAppearance.render.palette).toEqualTypeOf<RenderPalette>();
  expectTypeOf(defaultAppearance.render.frontier).toEqualTypeOf<FrontierAppearance>();
  expectTypeOf<AppearancePatch>().toMatchTypeOf<object>();
  expectTypeOf<AppearanceError['kind']>().toEqualTypeOf<'invalid-patch' | 'destroyed'>();
});
