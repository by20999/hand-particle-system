@echo off
setlocal

cd /d "%~dp0"
set PORT=5173
set URL=http://localhost:%PORT%

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies, first run only...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 1 > $null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "Hand Particle System Server" cmd /k "cd /d ""%~dp0"" && npm run dev -- --port %PORT%"
  timeout /t 3 /nobreak >nul
)

start "" "%URL%"
endlocal
