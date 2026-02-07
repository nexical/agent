import { spawnSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const targets = [
  'bun-linux-x64',
  'bun-linux-arm64',
  'bun-macos-x64',
  'bun-macos-arm64',
  'bun-windows-x64',
];

const projectRoot = path.resolve(import.meta.dirname, '..');
const binDir = path.join(projectRoot, 'bin');

// 1. Ensure bin directory exists
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

console.info(`🚀 Starting cross-platform build for @nexical/agent...`);
console.info(`📂 Output directory: ${binDir}\n`);

// Use the explicit path to bun since it might not be in the initial PATH
const bunPath = path.join(os.homedir(), '.bun', 'bin', 'bun');

for (const target of targets) {
  const isWin = target.includes('windows');
  const outfile = path.join(
    binDir,
    `agent-${target.split('-').slice(1).join('-')}${isWin ? '.exe' : ''}`,
  );

  console.info(`📦 Building for ${target}...`);

  const result = spawnSync(
    bunPath,
    ['build', './src/main.ts', '--compile', '--target', target, '--outfile', outfile],
    {
      cwd: projectRoot,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    console.error(`❌ Failed to build for ${target}`);
    process.exit(1);
  }
}

console.info(`\n✅ All binaries built successfully in ${binDir}`);
