import type { HexColor } from './appearance.js';

/** Derive each effective color from its stored base, avoiding cumulative rounding. */
export function frontierColor(base: HexColor, scale: number): HexColor {
  if (scale === 1) return base;
  const r = parseInt(base.slice(1, 3), 16) / 255;
  const g = parseInt(base.slice(3, 5), 16) / 255;
  const b = parseInt(base.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const light = (max + min) / 2;
  let hue = 0;
  if (delta) {
    hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue = (hue + 6) % 6;
  }
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  const chroma = (1 - Math.abs(2 * light - 1)) * Math.min(1, Math.max(0, saturation * scale));
  const x = chroma * (1 - Math.abs(hue % 2 - 1)), m = light - chroma / 2;
  const channels = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return ('#' + channels.map(c => Math.round((c + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()) as HexColor;
}
