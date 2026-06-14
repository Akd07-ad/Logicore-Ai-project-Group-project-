const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function findPython() {
  const candidates = [
    path.join(root, '.venv', 'Scripts', 'python.exe'),
    path.join(root, '1', 'Scripts', 'python.exe'),
    path.join(root, '.venv', 'bin', 'python'),
    path.join(root, '1', 'bin', 'python'),
  ];

  function isUsablePython(executable) {
    if (!existsSync(executable)) return false;
    const probe = spawnSync(executable, ['--version'], { stdio: 'ignore' });
    return probe.status === 0;
  }

  return candidates.find((item) => isUsablePython(item));
}

const python = findPython();
if (!python) {
  console.error('No Python environment found.');
  process.exit(1);
}

const result = spawnSync(python, ['scripts/seed.py'], {
  cwd: path.join(root, 'backend'),
  stdio: 'inherit',
});

if (result.status !== 0) process.exit(result.status || 1);
