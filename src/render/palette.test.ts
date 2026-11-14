import { expect, it } from 'vitest';
import { palette } from './palette.js';

type RGB = readonly [number, number, number];
function rgb(hex: string): RGB {
  return [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as unknown as RGB;
}
function luminance(color: RGB): number {
  const linear = color.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
}
function composite(band: string, overlay: string): RGB {
  const channels = overlay.match(/[\d.]+/g)?.map(Number);
  if (channels?.length !== 4) throw new Error('Expected rgba overlay');
  const alpha = channels[3] ?? 0;
  return rgb(band).map((value, index) => value * (1 - alpha) + (channels[index] ?? 0) / 255 * alpha) as unknown as RGB;
}
function contrast(a: RGB, b: RGB): number {
  const first = luminance(a); const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

interface LuminanceInterval { readonly min: number; readonly max: number }
function permittedBackgrounds(markers: readonly string[]): readonly LuminanceInterval[] {
  return markers.reduce<readonly LuminanceInterval[]>((intervals, marker) => {
    const level = luminance(rgb(marker));
    const permitted = [{ min: 0, max: (level + 0.05) / 3 - 0.05 }, { min: 3 * (level + 0.05) - 0.05, max: 1 }];
    return intervals.flatMap(interval => permitted.map(candidate => ({
      min: Math.max(interval.min, candidate.min), max: Math.min(interval.max, candidate.max),
    })).filter(candidate => candidate.min <= candidate.max));
  }, [{ min: 0, max: 1 }]);
}

it('confirms the existing marker colours cannot share any 3:1 background', () => {
  expect(permittedBackgrounds([palette.path, palette.frontier, palette.start, palette.goal, palette.current])).toEqual([]);
  const wallsMin = 3 * (luminance(rgb(palette.walls)) + 0.05) - 0.05;
  expect(wallsMin).toBeCloseTo(0.148, 3);
  expect(contrast(rgb(palette.current), composite('#FFFFFF', 'rgba(0, 0, 0, 0)'))).toBe(21);
});

interface TerrainContrastPalette {
  readonly terrain: readonly string[];
  readonly visitedOverlay: string;
  readonly walls: string;
  readonly path: string;
  readonly frontier: string;
  readonly start: string;
  readonly goal: string;
  readonly current: string;
}

function assertTerrainContrast(colors: TerrainContrastPalette): void {
  colors.terrain.forEach((band, index) => {
    expect(contrast(rgb(colors.walls), rgb(band)), `walls / band ${index}`).toBeGreaterThanOrEqual(3);
    for (const marker of ['path', 'frontier', 'start', 'goal', 'current'] as const) {
      expect(contrast(rgb(colors[marker]), composite(band, colors.visitedOverlay)), `${marker} / explored band ${index}`).toBeGreaterThanOrEqual(3);
    }
    const previous = colors.terrain[index - 1];
    if (previous) expect(luminance(rgb(previous))).toBeGreaterThan(luminance(rgb(band)));
  });
}

it('keeps the approved terrain-only markers at 3:1 on every explored band', () => {
  assertTerrainContrast({ ...palette, ...palette.terrainMarkers });
});

it('also keeps terrain markers legible on raw, failed and cancelled bands', () => {
  for (const overlay of ['rgba(0, 0, 0, 0)', palette.failureVisitedOverlay, palette.cancelledOverlay]) {
    assertTerrainContrast({ ...palette, ...palette.terrainMarkers, visitedOverlay: overlay });
  }
  for (const band of palette.terrain) {
    expect(contrast(rgb(palette.terrainMarkers.error), composite(band, palette.failureVisitedOverlay))).toBeGreaterThanOrEqual(3);
  }
});
