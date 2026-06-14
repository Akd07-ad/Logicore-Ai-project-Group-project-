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

function runOrFail(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const python = findPython();
if (!python) {
  console.error('No Python environment found. Expected .venv or 1 virtual environment.');
  process.exit(1);
}

console.log(`Using Python: ${python}`);
runOrFail(python, ['-m', 'pip', 'install', '-r', 'requirements.txt'], path.join(root, 'backend'));
if (process.platform === 'win32') {
  runOrFail('cmd.exe', ['/d', '/s', '/c', 'npm install'], path.join(root, 'frontend'));
} else {
  runOrFail('npm', ['install'], path.join(root, 'frontend'));
}

console.log('Setup complete.');
