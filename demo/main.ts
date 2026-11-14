import { mountCornrow } from '../src/index';

const container = document.querySelector<HTMLElement>('#maze');
if (container) mountCornrow(container, { environment: 'terrain', seed: 'cornrow', rows: 20, cols: 20, label: 'Cornrow demo' });
