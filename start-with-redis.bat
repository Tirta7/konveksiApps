@echo off
title KonveksiApps + Redis
color 0A

echo ============================================
echo   KonveksiApps  Server + Redis Cache
echo ============================================
echo.

echo [1/3] Menghentikan proses lama...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul
echo        OK

echo [2/3] Menjalankan Redis via WSL...
wsl -d Ubuntu bash -c "pkill redis-server 2>/dev/null; sleep 1; redis-server --daemonize yes --bind 0.0.0.0 --protected-mode no --loglevel warning"
timeout /t 2 /nobreak >nul

for /f "delims=" %%i in ('wsl -d Ubuntu bash -c "redis-cli ping 2>/dev/null"') do set REDIS_PING=%%i
if /i "%REDIS_PING%"=="PONG" (
    echo        OK - Redis aktif di port 6379
    set REDIS_URL=redis://127.0.0.1:6379
) else (
    echo        WARN - Redis tidak tersedia, menggunakan mode tanpa cache
    set REDIS_URL=
)
echo.

echo [3/3] Menjalankan server Next.js...
echo.
echo ============================================
echo   App   : http://localhost:3000
echo   Jaringan: http://192.168.1.19:3000
if /i "%REDIS_PING%"=="PONG" echo   Redis : redis://127.0.0.1:6379 [AKTIF]
echo ============================================
echo.
npm run dev
