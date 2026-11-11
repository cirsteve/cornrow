import type { PlaybackState } from '../controller/playback-state';
import { solverRegistry } from '../search/registry';
import type { NormalisedMountOptions } from './options';

export function createControls(document: Document, options: NormalisedMountOptions) {
  const form = document.createElement('form');
  form.setAttribute('aria-label', 'Maze controls');
  function button(text: string): HTMLButtonElement {
    const element = document.createElement('button'); element.type = 'button'; element.textContent = text;
    form.append(element); return element;
  }
  const generate = button('Generate'); const solve = button('Solve');
  const pause = button('Pause'); const reset = button('Reset');
  function labelled<T extends HTMLElement>(text: string, element: T): T {
    const label = document.createElement('label');
    label.append(document.createTextNode(text), element); form.append(label); return element;
  }
  const speed = labelled('Speed', document.createElement('input'));
  speed.type = 'range'; speed.min = '1'; speed.max = '500'; speed.step = '1'; speed.value = String(options.stepsPerSecond);
  const size = labelled('Size', document.createElement('select'));
  const sizePresets = [10, 20, 30, 40, 60, 80];
  for (const value of sizePresets) {
    const option = document.createElement('option'); option.value = String(value); option.textContent = `${value} × ${value}`;
    size.append(option);
  }
  const currentSize = document.createElement('option');
  currentSize.value = ''; currentSize.disabled = true;
  function setSize(rows: number, cols: number): void {
    currentSize.remove();
    if (rows === cols && sizePresets.includes(rows)) size.value = String(rows);
    else {
      currentSize.textContent = `${rows} × ${cols} (current)`;
      size.prepend(currentSize); size.value = currentSize.value;
    }
  }
  setSize(options.rows, options.cols);
  const algorithm = labelled('Algorithm', document.createElement('select'));
  for (const descriptor of solverRegistry) {
    const option = document.createElement('option'); option.value = descriptor.id; option.textContent = descriptor.label;
    algorithm.append(option);
  }
  algorithm.value = options.solver;
  const seed = labelled('Seed', document.createElement('input')); seed.type = 'text'; seed.value = String(options.seed);
  const step = button('Step'); step.hidden = true;
  return {
    form, generate, solve, pause, reset, speed, size, algorithm, seed, step, setSize,
    update(playback: PlaybackState, reduced: boolean): void {
      const paused = playback.kind === 'paused';
      pause.textContent = paused ? 'Resume' : 'Pause';
      pause.setAttribute('aria-pressed', String(paused));
      pause.disabled = playback.kind !== 'running' && !paused;
      solve.disabled = playback.kind === 'running';
      reset.disabled = playback.kind === 'idle';
      step.hidden = !reduced;
    },
  };
}
