const { spawn, spawnSync } = require('node:child_process');
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
  console.error('No Python environment found. Run npm run setup after creating .venv or 1 environment.');
  process.exit(1);
}

const backend = spawn(python, ['-m', 'uvicorn', 'main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'], {
  cwd: path.join(root, 'backend'),
  stdio: 'inherit',
});

const frontend = process.platform === 'win32'
  ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev -- --host localhost --port 5173'], {
      cwd: path.join(root, 'frontend'),
      stdio: 'inherit',
    })
  : spawn('npm', ['run', 'dev', '--', '--host', 'localhost', '--port', '5173'], {
      cwd: path.join(root, 'frontend'),
      stdio: 'inherit',
    });

function shutdown() {
  if (!backend.killed) backend.kill();
  if (!frontend.killed) frontend.kill();
}

backend.on('exit', (code) => {
  if (code && code !== 0) {
    console.error(`Backend exited with code ${code}`);
  }
  shutdown();
});

frontend.on('exit', (code) => {
  if (code && code !== 0) {
    console.error(`Frontend exited with code ${code}`);
  }
  shutdown();
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Development services started:');
console.log('- Frontend: http://localhost:5173');
console.log('- Backend:  http://127.0.0.1:8000');
console.log('- Docs:     http://127.0.0.1:8000/docs');
