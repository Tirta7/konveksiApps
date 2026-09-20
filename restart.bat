@echo off
title Restart - KonveksiApps
color 0B

echo ============================================
echo    RESTART SERVER - KonveksiApps
echo ============================================
echo.

echo [1/2] Menghentikan semua proses Node.js...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul
echo        OK

echo [2/2] Menjalankan ulang server...
echo.
echo ============================================
echo    Server berjalan di http://localhost:3000
echo    Jaringan: http://192.168.1.19:3000
echo ============================================
echo.
npm run dev
