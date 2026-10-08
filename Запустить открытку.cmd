@echo off
setlocal
title Concert Night
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies...
  call npm install --no-package-lock
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting the site...
echo Local: http://127.0.0.1:5173
echo LAN:   http://192.168.1.130:5173
echo Keep this window open while the site is online.
echo.
node "node_modules\vite\bin\vite.js" --host 0.0.0.0 --open
