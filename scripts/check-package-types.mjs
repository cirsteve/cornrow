import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const consumer = mkdtempSync(join(tmpdir(), 'cornrow-type-consumer-'));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  // The caller builds first. Pack only dist/ and install it in an isolated consumer
  // so source resolution and the repository's skipLibCheck cannot mask failures.
  const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', consumer], root));
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run('npm', ['install', join(consumer, packed.filename), '--ignore-scripts', '--offline', '--package-lock=false', '--no-audit', '--no-fund'], consumer);
  writeFileSync(join(consumer, 'index.ts'), `
import { generate, getSolver, solve, mountCornrow, type MountOptions } from '@cirsteve/cornrow';

const generated = generate({ seed: 'cornrow', rows: 10, cols: 10 });
for (const solver of ['bfs', 'astar']) {
  const descriptor = getSolver(solver);
  if (!descriptor.ok) throw new Error(descriptor.error.detail);
  const trace = solve(generated.environment, descriptor.value.id);
  if (trace.result.outcome === 'found') {
    const path: readonly number[] = trace.result.path;
    console.log(path.length);
  }
}
const options: MountOptions = { mode: 'background', rows: 10, cols: 10 };
const handle = mountCornrow(document.createElement('div'), options);
handle.pause(); handle.resume(); handle.destroy();
// Ensure broken declarations cannot silently turn this API into any.
// @ts-expect-error rows must be a number
generate({ seed: 'cornrow', rows: 'ten', cols: 10 });
// @ts-expect-error unknown mount mode
mountCornrow(document.createElement('div'), { mode: 'other' });
`);
  writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', lib: ['ES2022', 'DOM'], strict: true,
      skipLibCheck: false, noEmit: true, types: [],
    },
    files: ['index.ts'],
  }));
  const tsc = join(root, 'node_modules/typescript/bin/tsc');
  for (const mode of ['Node16', 'NodeNext']) {
    run(process.execPath, [tsc, '--project', join(consumer, 'tsconfig.json'), '--module', mode, '--moduleResolution', mode], consumer);
    console.log(`Packed package consumer: ${mode}, skipLibCheck=false passed`);
  }
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
