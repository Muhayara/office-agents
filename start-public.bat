@echo off
setlocal
title Office Agents - Publik (Tailscale Funnel)
cd /d "P:\gemini-lab\office"
echo ======================================================
echo     OFFICE AGENTS - KANTOR 3D PUBLIK (Tailscale Funnel)
echo ======================================================

where tailscale >nul 2>nul
if errorlevel 1 (
  echo Tailscale belum terpasang. Pasang dari https://tailscale.com/download lalu login.
  echo Panduan: workspace\office-next\docs\deployment-and-hosting-guide.md bagian 3B.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "try { ((tailscale status --json | ConvertFrom-Json).Self.DNSName).TrimEnd('.') } catch { '' }"`) do set "TS_HOST=%%i"
if "%TS_HOST%"=="" (
  echo Tailscale belum login. Jalankan: tailscale up
  pause
  exit /b 1
)
echo Nama publik: https://%TS_HOST%/

echo [1/4] Build UI kantor 3D (workspace\office-next\dist)...
if not exist .esbuild-tmp mkdir .esbuild-tmp
set "TEMP=%CD%\.esbuild-tmp"
set "TMP=%CD%\.esbuild-tmp"
call npm run build:next
if errorlevel 1 (
  echo Build gagal.
  pause
  exit /b 1
)

echo [2/4] Menyalakan 9router Gateway (port 20128)...
start "9router Gateway" cmd /k "9router -n -l --skip-update"
timeout /t 2 /nobreak >nul

echo [3/4] Menyalakan Office Server (UI + API + dunia bersama, port 7420)...
rem Nilai di bawah mengalahkan .env untuk sesi ini saja.
set "OFFICE_SERVE_UI=1"
set "OFFICE_TRUST_PROXY=1"
set "OFFICE_COOKIE_SECURE=1"
set "OFFICE_ALLOWED_HOSTS=%TS_HOST%"
set "OFFICE_ALLOWED_ORIGINS=https://%TS_HOST%"
set "GOOGLE_REDIRECT_URI=http://localhost:5174/api/auth/google/callback,http://localhost:7420/api/auth/google/callback,https://%TS_HOST%/api/auth/google/callback"
start "Office Server (publik)" cmd /k "npm --workspace @office/server run start"
timeout /t 4 /nobreak >nul

echo [4/4] Membuka Tailscale Funnel: https://%TS_HOST%/ -^> http://127.0.0.1:7420
tailscale funnel --bg 7420
if errorlevel 1 (
  echo Funnel gagal. Pastikan HTTPS + Funnel sudah diaktifkan di admin console Tailscale.
  pause
  exit /b 1
)

echo ======================================================
echo KANTOR 3D PUBLIK SUDAH ONLINE
echo - Publik (tanpa login)  : https://%TS_HOST%/
echo - Lokal (CEO, PC ini)   : http://localhost:7420/
echo - Login Google          : daftarkan 3 redirect URI ini di Google Cloud Console:
echo     http://localhost:5174/api/auth/google/callback
echo     http://localhost:7420/api/auth/google/callback
echo     https://%TS_HOST%/api/auth/google/callback
echo - Matikan semuanya      : stop.bat (sekaligus menutup Funnel)
echo ======================================================
start https://%TS_HOST%/
pause
