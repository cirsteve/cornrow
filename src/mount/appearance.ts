import { ok, err, type Result } from '../primitives/result.js';
import { defaultRenderAppearance, freezeAppearance, type RenderAppearance, type RenderAppearancePatch, type AppearanceError, type HexColor } from '../render/appearance.js';
import { mergeRenderAppearance, normaliseHex } from '../render/merge-appearance.js';

export interface MountedUiTokens {
  readonly text: HexColor; readonly statusText: HexColor; readonly fallbackText: HexColor;
  readonly controlBackground: HexColor; readonly controlText: HexColor; readonly controlBorder: HexColor;
  readonly controlHoverBackground: HexColor; readonly controlDisabledBackground: HexColor;
  readonly controlDisabledText: HexColor; readonly focusRing: HexColor; readonly controlAccent: HexColor;
  readonly validationText: HexColor; readonly legendBorder: HexColor;
}
export interface CornrowAppearance { readonly render: RenderAppearance; readonly ui: MountedUiTokens }
export interface AppearancePatch {
  readonly render?: RenderAppearancePatch;
  readonly ui?: Readonly<Partial<Record<keyof MountedUiTokens, string>>>;
}
export const defaultAppearance: CornrowAppearance = freezeAppearance({
  render: defaultRenderAppearance,
  ui: {
    text: '#172B21', statusText: '#172B21', fallbackText: '#172B21',
    controlBackground: '#FFFFFF', controlText: '#172B21', controlBorder: '#767676',
    controlHoverBackground: '#EEF2EF', controlDisabledBackground: '#F0F0F0', controlDisabledText: '#6B6B6B',
    focusRing: '#2865C1', controlAccent: '#2865C1', validationText: '#B00020', legendBorder: '#222222',
  } as MountedUiTokens,
});
export function uiVariables(ui: MountedUiTokens): readonly (readonly [string, HexColor])[] {
  return (Object.keys(ui) as (keyof MountedUiTokens)[]).map(key =>
    [`--cornrow-${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`, ui[key]] as const);
}
function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
export function mergeAppearance(current: CornrowAppearance, patch: unknown): Result<CornrowAppearance, AppearanceError> {
  const invalid = (path: string, detail: string): Result<never, AppearanceError> =>
    err({ kind: 'invalid-patch', operation: 'mergeAppearance', path, detail });
  if (!plain(patch)) return invalid('', 'Expected a plain object.');
  for (const key of Object.keys(patch)) if (key !== 'render' && key !== 'ui') return invalid(key, 'Unknown key.');
  let render = current.render;
  if (Object.hasOwn(patch, 'render')) {
    const result = mergeRenderAppearance(current.render, patch.render);
    if (!result.ok) return result.error.kind === 'invalid-patch'
      ? invalid('render' + (result.error.path ? '.' + result.error.path : ''), result.error.detail) : result;
    render = result.value;
  }
  const ui = { ...current.ui };
  if (Object.hasOwn(patch, 'ui')) {
    if (!plain(patch.ui)) return invalid('ui', 'Expected a plain object.');
    for (const key of Object.keys(patch.ui)) {
      if (!Object.hasOwn(ui, key)) return invalid('ui.' + key, 'Unknown token.');
      const color = normaliseHex(patch.ui[key]);
      if (!color.ok) return invalid('ui.' + key, "Expected '#RRGGBB'.");
      ui[key as keyof MountedUiTokens] = color.value;
    }
  }
  return ok(freezeAppearance({ render, ui }));
}
