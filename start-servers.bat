@echo off
echo ===================================================
echo     Starting Pharmacy ERP System
echo ===================================================

echo [1/2] Starting Backend API on port 3001...
start "Pharmacy Backend" cmd /k "cd backend && node ../node_modules/tsx/dist/cli.mjs watch src/server.ts"

echo [2/2] Starting Frontend UI on port 3000...
start "Pharmacy Frontend" cmd /k "cd frontend && node ../node_modules/vite/bin/vite.js --port=3000 --host=0.0.0.0"

echo.
echo Both servers are starting up in separate windows!
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:3001
echo.
pause
