# Start-EduPredict.ps1 - Windows launch script for EduPredict AI
# Usage: .\Start-EduPredict.ps1

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  EduPredict AI - Starting Services   " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Backend
$backendPath = Join-Path $root "backend"
$backendPython = Join-Path $root ".venv\Scripts\python.exe"
if (-Not (Test-Path $backendPython)) {
    $backendPython = Join-Path $root "1\Scripts\python.exe"
}

if (-Not (Test-Path $backendPython)) {
    Write-Host "Python interpreter not found at $backendPython" -ForegroundColor Red
    Write-Host "Create the venv at .\.venv or .\1, or update Start-EduPredict.ps1 to the correct interpreter path." -ForegroundColor Red
    exit 1
}

Write-Host "Starting Backend at http://127.0.0.1:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; & '$backendPython' -m uvicorn main:app --reload --port 8000" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Frontend
$frontendPath = Join-Path $root "frontend"

Write-Host "Starting Frontend at http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Both services are starting in separate windows." -ForegroundColor Cyan
Write-Host "Frontend : http://localhost:5173" -ForegroundColor Green
Write-Host "Backend  : http://localhost:8000" -ForegroundColor Yellow
Write-Host "API Docs : http://localhost:8000/docs" -ForegroundColor Magenta
Write-Host ""
