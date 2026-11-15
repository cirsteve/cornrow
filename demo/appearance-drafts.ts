import { normaliseHex, ok, err, type Result, type AppearanceError, type AppearancePatch, type CornrowAppearance, type RenderAppearance } from '../src/index';
import { type TokenPath, pageDefaults } from './appearance-fields';
export const parseHexDraft = normaliseHex;
export function parsePercent(text: string, max = 100): Result<number, AppearanceError> {
  const n = Number(text);
  return text.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= max
    ? ok(n / 100) : err({ kind: 'invalid-patch', operation: 'parsePercent', path: 'percent', detail: `Enter a percentage from 0 to ${max}.` });
}
export const formatAlpha = (alpha: number) => String(Number((alpha * 100).toFixed(8)));
export function colorValue(a: CornrowAppearance, path: TokenPath, pages: Readonly<Record<keyof typeof pageDefaults, string>>): string {
  switch (path.kind) {
    case 'page': return pages[path.key];
    case 'ui': return a.ui[path.key];
    case 'palette': return a.render.palette[path.key];
    case 'terrain': return a.render.palette.terrain[path.index];
    case 'marker': return a.render.palette.terrainMarkers[path.key];
    case 'overlay': return a.render.palette[path.key].rgb;
  }
}
export function colorPatch(a: CornrowAppearance, path: TokenPath, value: string): AppearancePatch | null {
  switch (path.kind) {
    case 'page': return null;
    case 'ui': return { ui: { [path.key]: value } };
    case 'palette': return { render: { palette: { [path.key]: value } } };
    case 'terrain': return { render: { palette: { terrain: { [path.index]: value } } } };
    case 'marker': return { render: { palette: { terrainMarkers: { [path.key]: value } } } };
    case 'overlay': return { render: { palette: { [path.key]: { ...a.render.palette[path.key], rgb: value } } } };
  }
}
export function alphaPatch(a: CornrowAppearance, path: Extract<TokenPath, { kind: 'overlay' }>, alpha: number): AppearancePatch {
  return { render: { palette: { [path.key]: { ...a.render.palette[path.key], alpha } } } };
}
export const shapePatch = (shape: RenderAppearance['frontier']['shape']): AppearancePatch => ({ render: { frontier: { shape } } });
export const saturationPatch = (percent: number): AppearancePatch => ({ render: { frontier: { saturationScale: percent / 100 } } });
export function frontierBasePath(environment: 'terrain' | 'wall-maze'): Extract<TokenPath, { kind: 'marker' | 'palette' }> {
  return environment === 'terrain' ? { kind: 'marker', key: 'frontier' } : { kind: 'palette', key: 'frontier' };
}
export function baseFrontier(a: CornrowAppearance, environment: 'terrain' | 'wall-maze') {
  const path = frontierBasePath(environment);
  return path.kind === 'marker' ? a.render.palette.terrainMarkers[path.key] : a.render.palette[path.key];
}
