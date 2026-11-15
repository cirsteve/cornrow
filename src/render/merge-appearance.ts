import { ok, err, type Result } from '../primitives/result.js';
import { freezeAppearance, type AppearanceError, type HexColor, type RenderAppearance } from './appearance.js';

export function normaliseHex(value: unknown): Result<HexColor, AppearanceError> {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
    ? ok(value.toUpperCase() as HexColor)
    : err({ kind: 'invalid-patch', operation: 'normaliseHex', path: 'value', detail: "Expected '#RRGGBB'." });
}
function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
/** Validate against the closed default shape; build an owned tree without modifying inputs. */
export function mergeRenderAppearance(current: RenderAppearance, patch: unknown): Result<RenderAppearance, AppearanceError> {
  const invalid = (path: string, detail: string): Result<never, AppearanceError> =>
    err({ kind: 'invalid-patch', operation: 'mergeRenderAppearance', path, detail });
  function merge(base: unknown, input: unknown, path: string): Result<unknown, AppearanceError> {
    if (typeof base === 'string') {
      if (path === 'frontier.shape') return input === 'square' || input === 'circle' ? ok(input) : invalid(path, 'Expected square or circle.');
      const color = normaliseHex(input);
      return color.ok ? color : invalid(path, "Expected '#RRGGBB'.");
    }
    if (typeof base === 'number') {
      const max = path === 'frontier.saturationScale' ? 2 : 1;
      return typeof input === 'number' && Number.isFinite(input) && input >= 0 && input <= max
        ? ok(input) : invalid(path, `Expected a finite number in [0, ${max}].`);
    }
    if (Array.isArray(base)) {
      if (Array.isArray(input) && input.length !== 4) return invalid(path, 'Expected four terrain colors.');
      if (!Array.isArray(input) && !plain(input)) return invalid(path, 'Expected terrain bands.');
      const result = [...base] as unknown[];
      for (const key of Object.keys(input)) {
        if (!/^[0-3]$/.test(key)) return invalid(path + '.' + key, 'Unknown terrain band.');
        const child = merge(base[Number(key)], (input as Record<string, unknown>)[key], path + '.' + key);
        if (!child.ok) return child;
        result[Number(key)] = child.value;
      }
      // Sparse tuples are not complete terrain arrays.
      if (Array.isArray(input) && Object.keys(input).length !== 4) return invalid(path, 'Expected four terrain colors.');
      return ok(result);
    }
    if (!plain(input) || !plain(base)) return invalid(path, 'Expected a plain object.');
    const result = { ...base };
    for (const key of Object.keys(input)) {
      const childPath = path ? path + '.' + key : key;
      if (!Object.hasOwn(base, key)) return invalid(childPath, 'Unknown key.');
      const child = merge(base[key], input[key], childPath);
      if (!child.ok) return child;
      result[key] = child.value;
    }
    return ok(result);
  }
  const merged = merge(current, patch, '');
  return merged.ok ? ok(freezeAppearance(merged.value as RenderAppearance)) : merged;
}
