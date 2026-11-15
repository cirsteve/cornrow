import type { Brand } from '../primitives/brand.js';
import { palette } from './palette.js';

export type HexColor = Brand<string, 'HexColor'>;
export interface OverlayColor { readonly rgb: HexColor; readonly alpha: number }
type Marker = 'path' | 'frontier' | 'start' | 'goal' | 'current' | 'error';
type Color = Marker | 'background' | 'walls' | 'visited' | 'failureVisited' | 'cancelled' | 'terrainPip';
export type RenderPalette = Readonly<Record<Color, HexColor>> & {
  readonly terrain: readonly [HexColor, HexColor, HexColor, HexColor];
  readonly terrainMarkers: Readonly<Record<Marker, HexColor>>;
  readonly visitedOverlay: OverlayColor;
  readonly failureVisitedOverlay: OverlayColor;
  readonly cancelledOverlay: OverlayColor;
};
export interface FrontierAppearance { readonly shape: 'square' | 'circle'; readonly saturationScale: number }
export interface RenderAppearance { readonly palette: RenderPalette; readonly frontier: FrontierAppearance }
export interface RenderAppearancePatch {
  readonly palette?: Readonly<Partial<Record<Color, string>>> & {
    readonly terrain?: readonly [string, string, string, string] | { readonly 0?: string; readonly 1?: string; readonly 2?: string; readonly 3?: string };
    readonly terrainMarkers?: Readonly<Partial<Record<Marker, string>>>;
    readonly visitedOverlay?: Readonly<Partial<{ rgb: string; alpha: number }>>;
    readonly failureVisitedOverlay?: Readonly<Partial<{ rgb: string; alpha: number }>>;
    readonly cancelledOverlay?: Readonly<Partial<{ rgb: string; alpha: number }>>;
  };
  readonly frontier?: Partial<FrontierAppearance>;
}
export type AppearanceError =
  | { readonly kind: 'invalid-patch'; readonly operation: string; readonly path: string; readonly detail: string }
  | { readonly kind: 'destroyed'; readonly operation: 'setAppearance'; readonly detail: string };

export function formatOverlay({ rgb, alpha }: OverlayColor): string {
  return `rgba(${parseInt(rgb.slice(1, 3), 16)}, ${parseInt(rgb.slice(3, 5), 16)}, ${parseInt(rgb.slice(5, 7), 16)}, ${String(alpha)})`;
}

/** Own and freeze every nested value, including branches retained from the current appearance. */
export function freezeAppearance<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(child => freezeAppearance(child))) as T;
  if (value !== null && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) =>
      [key, freezeAppearance(child)]))) as T;
  }
  return value;
}
function parseOverlay(value: string): OverlayColor {
  const channels = value.slice(5, -1).split(', ').map(Number);
  return { rgb: ('#' + channels.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()) as HexColor, alpha: channels[3] ?? 0 };
}
export const defaultRenderAppearance: RenderAppearance = freezeAppearance({
  palette: {
    ...palette, terrain: [...palette.terrain], terrainMarkers: { ...palette.terrainMarkers },
    terrainPip: palette.walls,
    visitedOverlay: parseOverlay(palette.visitedOverlay),
    failureVisitedOverlay: parseOverlay(palette.failureVisitedOverlay),
    cancelledOverlay: parseOverlay(palette.cancelledOverlay),
  } as unknown as RenderPalette,
  frontier: { shape: 'square', saturationScale: 1 },
});
