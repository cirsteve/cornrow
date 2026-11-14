export const mountStyles = `
:host { display: block; color: #172b21; font: 1rem/1.5 system-ui, sans-serif; }
:host([data-mode=background]) { opacity: 0.35; }
* { box-sizing: border-box; }
canvas { display: block; max-width: 100%; border-radius: .5rem; }
form { display: flex; flex-wrap: wrap; align-items: end; gap: .65rem; margin-top: .8rem; }
.terrain-legend { display: flex; flex-wrap: wrap; gap: .5rem 1rem; margin-top: .8rem; }
.terrain-legend-item { display: inline-flex; align-items: center; gap: .4rem; }
.terrain-swatch { display: inline-block; position: relative; width: 2rem; height: 2rem; border: 1px solid #222222; }
.terrain-pip { position: absolute; border-radius: 50%; background: #222222; }
label { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
button, input, select { font: inherit; max-width: 100%; }
button, select, input[type=text] { min-height: 2.75rem; padding: .4rem .65rem; }
button { cursor: pointer; }
button:disabled { cursor: default; }
input[type=range] { min-height: 2.75rem; width: 8rem; }
input[type=text] { width: 12rem; }
:focus-visible { outline: 3px solid #2865c1; outline-offset: 3px; }
[hidden] { display: none !important; }
.status { margin: .8rem 0 0; }
dl { display: grid; grid-template-columns: auto 1fr; gap: .35rem 1rem; overflow-wrap: anywhere; }
dt { font-weight: 600; } dd { margin: 0; }
`;
