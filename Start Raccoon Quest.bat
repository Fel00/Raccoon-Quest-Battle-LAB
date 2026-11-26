@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then try again.
  pause
  exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm, then try again.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Project dependencies are missing. Run "npm.cmd install" in this folder first.
  pause
  exit /b 1
)

echo Starting Raccoon Quest and opening it in your browser...
call npm.cmd run dev --workspace @raccoon/web -- --open
if errorlevel 1 (
  echo.
  echo The development server stopped with an error.
  pause
)
