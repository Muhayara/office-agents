@echo off
title Office Agents Launcher
echo ======================================================
echo           MENYALAKAN OFFICE AGENTS AI
echo ======================================================
cd /d "P:\gemini-lab\office"

echo [1/3] Menyalakan 9router Gateway (port 20128)...
start "9router Gateway" cmd /k "9router -n -l --skip-update"

timeout /t 2 /nobreak >nul

echo [2/3] Menyalakan Office Server (port 7420 & 7421)...
start "Office Server" cmd /k "cd /d P:\gemini-lab\office && npm --workspace @office/server run start"

timeout /t 2 /nobreak >nul

echo [3/3] Menyalakan Web Command Center (port 5173)...
start "Office Web" cmd /k "cd /d P:\gemini-lab\office && npm --workspace @office/web run dev"

timeout /t 2 /nobreak >nul

echo Membuka browser Command Center...
start http://localhost:5173

echo ======================================================
echo SEMUA LAYANAN SUDAH BERJALAN!
echo - Web UI     : http://localhost:5173
echo - Server     : http://127.0.0.1:7420
echo - MCP Server : http://127.0.0.1:7421/mcp
echo - 9router    : http://127.0.0.1:20128
echo Untuk mematikan, jalankan stop.bat
echo ======================================================
pause
