@echo off
echo ==========================================
echo   GhostAudit - Starting All Services
echo ==========================================
echo.

echo [1/3] Starting Backend (Node.js - port 3001)...
start "GhostAudit Backend" cmd /k "cd /d "%~dp0backend" && node src/index.js"

timeout /t 2 >nul

echo [2/3] Starting AI Service (Python/FastAPI - port 8000)...
start "GhostAudit AI Service" cmd /k "cd /d "%~dp0ai-service" && uvicorn main:app --reload --port 8000"

timeout /t 2 >nul

echo [3/3] Starting Frontend (React/Vite - port 5173)...
start "GhostAudit Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ==========================================
echo   All services started!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3001
echo   AI Svc:   http://localhost:8000
echo ==========================================
echo.
echo Login: admin@ghostaudit.ai / ghostaudit123
pause
