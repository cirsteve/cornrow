import { expect, it } from 'vitest';
import { defaultRenderAppearance as defaults } from './appearance.js';
import { mergeRenderAppearance, normaliseHex } from './merge-appearance.js';
it('normalises only full hexadecimal colors', () => {
  expect(normaliseHex('#abcdef')).toEqual({ ok: true, value: '#ABCDEF' });
  for (const input of ['#abc', 'abcdef', '#GGGGGG', 'red', 'rgb(0,0,0)', 7])
    expect(normaliseHex(input)).toMatchObject({ ok: false, error: { operation: 'normaliseHex' } });
});
it('merges nested values atomically without mutation', () => {
  const before = structuredClone(defaults);
  const patch = { palette: { walls: '#010203', terrain: { 1: '#00ff00' }, terrainMarkers: { frontier: '#111111' }, visitedOverlay: { alpha: 0.5 } } };
  const snapshot = structuredClone(patch);
  const result = mergeRenderAppearance(defaults, patch);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.palette.walls).toBe('#010203');
  expect(result.value.palette.terrain).toEqual([defaults.palette.terrain[0], '#00FF00', ...defaults.palette.terrain.slice(2)]);
  expect(result.value.palette.visitedOverlay).toEqual({ ...defaults.palette.visitedOverlay, alpha: 0.5 });
  expect(result.value.palette.terrainMarkers).toEqual({ ...defaults.palette.terrainMarkers, frontier: '#111111' });
  expect(Object.isFrozen(result.value.palette.visitedOverlay)).toBe(true);
  expect(defaults).toEqual(before); expect(patch).toEqual(snapshot);
  expect(mergeRenderAppearance(defaults, {})).toEqual({ ok: true, value: defaults });
});
const invalidCases: [unknown, string][] = [
  [{ palette: { walls: 'red' } }, 'palette.walls'],
  [{ palette: { terrain: ['#000000'] } }, 'palette.terrain'],
  [{ palette: { terrain: { 4: '#000000' } } }, 'palette.terrain.4'],
  ...[-0.1, 1.1, NaN].map(alpha => [{ palette: { cancelledOverlay: { alpha } } }, 'palette.cancelledOverlay.alpha'] as [unknown, string]),
  ...[-0.01, 2.01, Infinity].map(saturationScale => [{ frontier: { saturationScale } }, 'frontier.saturationScale'] as [unknown, string]),
  [{ frontier: { shape: 'triangle' } }, 'frontier.shape'],
  [{ palette: { terrainMarkers: { frontier: 'x' } } }, 'palette.terrainMarkers.frontier'],
  [{ palette: null }, 'palette'], [{ unknown: 1 }, 'unknown'], [null, ''],
];
it.each(invalidCases)('rejects %j at %s', (patch, path) => {
  expect(mergeRenderAppearance(defaults, patch)).toMatchObject({ ok: false, error: { kind: 'invalid-patch', operation: 'mergeRenderAppearance', path } });
});
