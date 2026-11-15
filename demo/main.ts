import { mountCornrow } from '../src/index';
import { createAppearanceEditor } from './appearance-editor';

const container = document.querySelector<HTMLElement>('#maze');
if (container) {
  const handle = mountCornrow(container, { environment: 'terrain', seed: 'cornrow', rows: 20, cols: 20, label: 'Cornrow demo' });
  const appearanceContainer = document.querySelector<HTMLElement>('#appearance');
  if (appearanceContainer) createAppearanceEditor({ container: appearanceContainer, handle, initialEnvironment: 'terrain' });
}
