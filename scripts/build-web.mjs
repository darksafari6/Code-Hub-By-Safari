// Runs the Vite production build with a larger V8 heap.
//
// Monaco is a large dependency; the default Node heap (~2 GB) is not always
// enough to minify it on machines with limited RAM. Setting the flag here keeps
// `npm run build` working everywhere without shell-specific syntax.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');

const existing = process.env.NODE_OPTIONS ?? '';
const nodeOptions = `${existing} --max-old-space-size=3072`.trim();

const result = spawnSync(process.execPath, [viteBin, 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

if (result.error) {
  console.error('Failed to start the Vite build:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
