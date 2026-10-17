@echo off
setlocal EnableExtensions
rem ---------------------------------------------------------------------------
rem  Neest development server launcher (Windows)
rem  - Installs dependencies on first run (or when package.json changed)
rem  - Starts the Vite dev server with hot reload and opens the browser
rem  - Code edits and changes to project files in .\projects\ appear live
rem  Usage:  start-neest.bat          (this computer only)
rem          start-neest.bat --lan    (also reachable from phones/PCs on your network)
rem ---------------------------------------------------------------------------
cd /d "%~dp0"
title Neest dev server

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js 20 or newer is required. Install it from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=v." %%v in ('node -v') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo  Node.js %NODE_MAJOR% detected; Neest needs Node.js 20 or newer.
  pause
  exit /b 1
)

set NEED_INSTALL=0
if not exist "node_modules\" set NEED_INSTALL=1
if "%NEED_INSTALL%"=="0" (
  rem Reinstall when package.json changed (e.g. after git pull): npm ls fails on missing packages.
  call npm ls --depth=0 >nul 2>nul
  if errorlevel 1 set NEED_INSTALL=1
)
if "%NEED_INSTALL%"=="1" (
  echo  Installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo  npm install failed. Check your network connection and try again.
    pause
    exit /b 1
  )
)

set HOST_ARGS=
if /i "%~1"=="--lan" (
  set HOST_ARGS=--host
  echo  LAN mode: other devices can open the address printed below. The projects/ folder is writable by them.
)

echo.
echo  Starting Neest on http://localhost:5173  (press Ctrl+C to stop)
echo.
call npm run dev -- --port 5173 --open %HOST_ARGS%
echo.
echo  Neest dev server stopped.
pause
