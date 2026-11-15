import { describe, it, expect } from 'vitest';
import { defaultAppearance, mergeAppearance } from '../src/index';
import { appearanceFields, pageDefaults } from './appearance-fields';
import { parseHexDraft, parsePercent, formatAlpha, colorPatch, alphaPatch, saturationPatch, shapePatch, baseFrontier, frontierBasePath } from './appearance-drafts';

describe('appearance drafts and descriptor coverage', () => {
  it('covers every published leaf exactly once', () => {
    const expected = [
      ...Object.entries(defaultAppearance.render.palette).flatMap(([key, value]) =>
        key === 'terrain' ? [0, 1, 2, 3].map(index => `terrain:${index}`) :
        key === 'terrainMarkers' ? Object.keys(value).map(marker => `marker:${marker}`) :
        [`${typeof value === 'string' ? 'palette' : 'overlay'}:${key}`]),
      ...Object.keys(defaultAppearance.ui).map(key => `ui:${key}`),
      ...Object.keys(pageDefaults).map(key => `page:${key}`),
    ];
    expect(appearanceFields.map(f => f.path.kind + ':' + ('index' in f.path ? f.path.index : f.path.key)).sort()).toEqual(expected.sort());
    expect(new Set(appearanceFields.map(f => f.label)).size).toBe(appearanceFields.length);
    expect(appearanceFields.filter(f => f.has_alpha).map(f => f.path.kind)).toEqual(['overlay', 'overlay', 'overlay']);
  });
  it('normalises valid hex and rejects incomplete drafts', () => {
    expect(parseHexDraft('#abcdef')).toEqual({ ok: true, value: '#ABCDEF' });
    for (const draft of ['#abc', 'abcdef', '#GGGGGG', '']) expect(parseHexDraft(draft).ok).toBe(false);
  });
  it('parses finite bounded percentages', () => {
    for (const [text, value] of [['16', .16], ['0', 0], ['100', 1]] as const) expect(parsePercent(text)).toEqual({ ok: true, value });
    for (const text of ['101', '-1', 'x', '', 'Infinity']) expect(parsePercent(text).ok).toBe(false);
    expect([.16, .16, .12].map(formatAlpha)).toEqual(['16', '16', '12']);
  });
  it('builds accepted patches with isolated band and overlay channels', () => {
    const path = { kind: 'overlay', key: 'visitedOverlay' } as const;
    expect(colorPatch(defaultAppearance, path, '#ABCDEF')).toEqual({ render: { palette: { visitedOverlay: { rgb: '#ABCDEF', alpha: .16 } } } });
    expect(alphaPatch(defaultAppearance, path, .5)).toEqual({ render: { palette: { visitedOverlay: { ...defaultAppearance.render.palette.visitedOverlay, alpha: .5 } } } });
    expect(colorPatch(defaultAppearance, { kind: 'terrain', index: 1 }, '#ABCDEF')).toEqual({ render: { palette: { terrain: { 1: '#ABCDEF' } } } });
    for (const field of appearanceFields) {
      const patch = colorPatch(defaultAppearance, field.path, '#ABCDEF');
      if (patch) expect(mergeAppearance(defaultAppearance, patch).ok).toBe(true);
    }
    for (const patch of [alphaPatch(defaultAppearance, path, .5), shapePatch('circle'), saturationPatch(200), saturationPatch(100)]) expect(mergeAppearance(defaultAppearance, patch).ok).toBe(true);
    expect(saturationPatch(200)).toEqual({ render: { frontier: { saturationScale: 2 } } });
    expect(baseFrontier(defaultAppearance, 'terrain')).toBe('#684500');
    expect(baseFrontier(defaultAppearance, 'wall-maze')).toBe('#E69F00');
  });
});

it('maps active environments to frontier token patches', () => {
  expect(frontierBasePath('terrain')).toEqual({ kind: 'marker', key: 'frontier' });
  expect(frontierBasePath('wall-maze')).toEqual({ kind: 'palette', key: 'frontier' });
  expect(colorPatch(defaultAppearance, frontierBasePath('terrain'), '#123456')).toEqual({ render: { palette: { terrainMarkers: { frontier: '#123456' } } } });
  expect(colorPatch(defaultAppearance, frontierBasePath('wall-maze'), '#123456')).toEqual({ render: { palette: { frontier: '#123456' } } });
});
