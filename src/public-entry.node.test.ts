// @vitest-environment node
import { expect, it } from 'vitest';
import { cellOf, checkPath, generate, getSolver, solve } from './index';

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
