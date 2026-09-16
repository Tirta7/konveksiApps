@echo off
title KonveksiApps — Start Server
color 0A
cls

echo ================================================
echo   KONVEKSIAPPS — Sistem Tracking Produksi Jeans
echo ================================================
echo.

:: Deteksi IP otomatis (ambil IP lokal pertama yang bukan 127.0.0.1)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0"') do (
    set RAW_IP=%%a
    goto :found_ip
)
:found_ip
:: Bersihkan spasi di depan
for /f "tokens=* delims= " %%b in ("%RAW_IP%") do set LOCAL_IP=%%b

echo [INFO] IP Address Terdeteksi : %LOCAL_IP%
echo [INFO] URL Akses             : http://%LOCAL_IP%:3000
echo [INFO] URL Lokal             : http://localhost:3000
echo.
echo ------------------------------------------------
echo  Menjalankan server Next.js...
echo  Tekan CTRL+C untuk menghentikan server
echo ------------------------------------------------
echo.

:: Pindah ke direktori project
cd /d "%~dp0"

:: Jalankan server dengan host 0.0.0.0 agar bisa diakses dari HP/device lain
npm run dev -- --hostname 0.0.0.0

pause
