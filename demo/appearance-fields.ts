import { defaultAppearance, type RenderAppearance, type MountedUiTokens } from '../src/index';

type Palette = RenderAppearance['palette'];
type OverlayKey = { [K in keyof Palette]: Palette[K] extends { rgb: string } ? K : never }[keyof Palette];
type PaletteKey = { [K in keyof Palette]: Palette[K] extends string ? K : never }[keyof Palette];
export const pageDefaults = {
  pageBackground: '#F8F6EF', pageText: '#172B21', mutedText: '#526358',
  panelBackground: '#FFFFFF', panelBorder: '#767676',
} as const;
export type TokenPath =
  | { kind: 'palette'; key: PaletteKey }
  | { kind: 'terrain'; index: 0 | 1 | 2 | 3 }
  | { kind: 'marker'; key: keyof Palette['terrainMarkers'] }
  | { kind: 'overlay'; key: OverlayKey }
  | { kind: 'ui'; key: keyof MountedUiTokens }
  | { kind: 'page'; key: keyof typeof pageDefaults };
export interface AppearanceField {
  readonly label: string;
  readonly group: 'maze' | 'terrain' | 'page-and-controls';
  readonly path: TokenPath;
  readonly has_alpha: boolean;
}
const words = (key: string) => key.replace(/[A-Z]/g, c => ' ' + c.toLowerCase());
export const appearanceFields: readonly AppearanceField[] = [
  ...(['background', 'walls', 'visited', 'frontier', 'path', 'start', 'goal', 'current', 'error', 'failureVisited', 'cancelled'] as const)
    .map(key => ({ label: 'Wall-maze ' + words(key), group: 'maze' as const, path: { kind: 'palette' as const, key }, has_alpha: false })),
  ...([0, 1, 2, 3] as const).map(index => ({ label: `Cost ${[1, 2, 4, 8][index]}`, group: 'terrain' as const, path: { kind: 'terrain' as const, index }, has_alpha: false })),
  ...(['path', 'frontier', 'start', 'goal', 'current', 'error'] as const).map(key => ({ label: `Terrain ${key} marker`, group: 'terrain' as const, path: { kind: 'marker' as const, key }, has_alpha: false })),
  ...(['visitedOverlay', 'failureVisitedOverlay', 'cancelledOverlay'] as const).map(key => ({ label: words(key), group: 'terrain' as const, path: { kind: 'overlay' as const, key }, has_alpha: true })),
  { label: 'Terrain pip', group: 'terrain', path: { kind: 'palette', key: 'terrainPip' }, has_alpha: false },
  ...(Object.keys(defaultAppearance.ui) as (keyof MountedUiTokens)[]).map(key => ({ label: words(key), group: key === 'legendBorder' ? 'terrain' as const : 'page-and-controls' as const, path: { kind: 'ui' as const, key }, has_alpha: false })),
  ...(Object.keys(pageDefaults) as (keyof typeof pageDefaults)[]).map(key => ({ label: words(key), group: 'page-and-controls' as const, path: { kind: 'page' as const, key }, has_alpha: false })),
];
export const cssVariable = (key: string) => '--demo-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
