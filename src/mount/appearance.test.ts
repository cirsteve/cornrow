import { expect, it } from 'vitest';
import { defaultAppearance, mergeAppearance, uiVariables } from './appearance.js';
import { mountStyles } from './styles.js';
it('has frozen defaults and thirteen scoped CSS tokens', () => {
  expect(Object.isFrozen(defaultAppearance.ui)).toBe(true);
  expect(uiVariables(defaultAppearance.ui)).toHaveLength(13);
  for (const [name, value] of uiVariables(defaultAppearance.ui)) {
    if (name !== '--cornrow-validation-text') expect(mountStyles).toContain(`var(${name}, ${value})`);
  }
  expect(mountStyles.replace(/var\(--cornrow-[a-z-]+, #[A-F0-9]{6}\)/g, '')).not.toContain('#');
});
it('validates combined patches and supports complete reset', () => {
  expect(mergeAppearance(defaultAppearance, defaultAppearance)).toEqual({ ok: true, value: defaultAppearance });
  const result = mergeAppearance(defaultAppearance, { ui: { controlAccent: '#00ff00' } });
  expect(result).toMatchObject({ ok: true, value: { ui: { controlAccent: '#00FF00' } } });
  for (const [patch, path] of [
    [{ ui: { controlAccent: 'blue' } }, 'ui.controlAccent'],
    [{ ui: { unknown: '#000000' } }, 'ui.unknown'],
    [{ render: { palette: { walls: 'x' } }, ui: { text: '#000000' } }, 'render.palette.walls'],
  ] as const) expect(mergeAppearance(defaultAppearance, patch)).toMatchObject({ ok: false, error: { operation: 'mergeAppearance', path } });
});
