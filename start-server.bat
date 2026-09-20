@echo off
title KonveksiApps - Starting...
color 0A
cls

echo.
echo  ============================================================
echo    KONVEKSI APPS  ^|  Sistem Tracking Produksi Jeans
echo  ============================================================
echo.

:: === STEP 1: Stop existing node processes ===
echo  [1/4] Menghentikan proses lama...
taskkill /F /IM node.exe /T 2>nul
ping -n 2 127.0.0.1 >nul
echo        Done.

:: === STEP 2: Start WSL ===
echo  [2/4] Memulai WSL Ubuntu...
wsl -d Ubuntu -u root -- bash -c "exit 0" >nul 2>&1
ping -n 3 127.0.0.1 >nul
echo        Done.

:: === STEP 3: Start Redis inside WSL ===
echo  [3/4] Memulai Redis Cache Server (WSL)...
wsl -d Ubuntu -u root -- bash -c "pkill redis-server 2>/dev/null; sleep 1; redis-server --daemonize yes --bind 0.0.0.0 --protected-mode no --loglevel warning --save ''" >nul 2>&1
ping -n 3 127.0.0.1 >nul

:: Verify Redis is running
wsl -d Ubuntu -u root -- bash -c "redis-cli ping 2>/dev/null" | findstr /i "PONG" >nul
if %ERRORLEVEL% EQU 0 (
    set REDIS_STATUS=AKTIF
    set REDIS_URL=redis://127.0.0.1:6379
    echo        Redis v8.0.5 berjalan di port 6379 [AKTIF]
) else (
    set REDIS_STATUS=NONAKTIF
    set REDIS_URL=
    echo        WARN: Redis tidak bisa dijalankan, mode fallback aktif
)

:: === STEP 4: Start Next.js ===
echo  [4/4] Memulai Next.js Server...
echo.
echo  ============================================================
echo    Akses Aplikasi:
echo    - Komputer ini  : http://localhost:3000
echo    - Jaringan LAN  : http://192.168.1.19:3000
if defined REDIS_URL (
echo    - Redis Cache   : redis://127.0.0.1:6379 [%REDIS_STATUS%]
)
echo.
echo    Tekan CTRL+C untuk menghentikan server
echo  ============================================================
echo.

:: Auto-open browser after 5 seconds
start /b cmd /c "ping -n 6 127.0.0.1 >nul && start http://localhost:3000"

:: Run the dev server with Redis URL
set REDIS_URL=%REDIS_URL%
npm run dev
