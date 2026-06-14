#!/bin/bash

# Kill all background processes on exit
trap "kill 0" EXIT

echo "Starting EduPredict AI..."

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$ROOT_DIR/.venv/Scripts/python.exe" ]; then
	VENV_PYTHON="$ROOT_DIR/.venv/Scripts/python.exe"
elif [ -f "$ROOT_DIR/1/Scripts/python.exe" ]; then
	VENV_PYTHON="$ROOT_DIR/1/Scripts/python.exe"
elif [ -f "$ROOT_DIR/.venv/bin/python" ]; then
	VENV_PYTHON="$ROOT_DIR/.venv/bin/python"
elif [ -f "$ROOT_DIR/1/bin/python" ]; then
	VENV_PYTHON="$ROOT_DIR/1/bin/python"
else
	echo "Error: Python interpreter not found in .venv or 1 virtual environments."
	exit 1
fi

# Start Backend
echo "Starting Backend..."
cd "$ROOT_DIR/backend" || exit 1
"$VENV_PYTHON" -m uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Start Frontend
echo "Starting Frontend..."
cd "$ROOT_DIR/frontend" || exit 1
npm run dev -- --port 5173 &
FRONTEND_PID=$!

echo "EduPredict AI is running!"
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:8000"

wait
