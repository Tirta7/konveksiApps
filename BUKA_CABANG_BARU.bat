@echo off
setlocal enabledelayedexpansion
title Setup Cabang Baru - Sistem Konveksi (vocpos.id)
color 0B
cls

echo ============================================================
echo   SISTEM MANAJEMEN KONVEKSI - WIZARD BUKA CABANG BARU
echo   Subdomain Terintegrasi: [namacabang].vocpos.id
echo ============================================================
echo.

:: 1. Self-Elevation Admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Meminta hak administrator...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c cd /d \"%~dp0\" && \"%~f0\"' -Verb RunAs"
    exit /b 0
)

cd /d "%~dp0"

:: 2. Input Nama Subdomain
echo Masukkan nama subdomain cabang yang diinginkan:
echo (Contoh: ketik 'konveksibali' atau 'konveksisolo')
set /p "SUB_INPUT=Subdomain (tanpa .vocpos.id): "

if "%SUB_INPUT%"=="" (
    echo [ERROR] Subdomain tidak boleh kosong!
    pause
    exit /b 1
)

:: Bersihkan input jika user tidak sengaja mengetik .vocpos.id
set "SUB_CLEAN=%SUB_INPUT:.vocpos.id=%"
set "SUB_CLEAN=%SUB_CLEAN: =%"
set "FULL_DOMAIN=%SUB_CLEAN%.vocpos.id"

echo.
echo [OK] Domain cabang akan diset ke: https://%FULL_DOMAIN%
echo.

:: 3. Input Nama Toko / Outlet Cabang
echo Masukkan Nama Resmi Cabang ini:
echo (Contoh: Konveksi Cabang Bali / Garment Outlet Solo)
set /p "STORE_INPUT=Nama Cabang: "
if "%STORE_INPUT%"=="" set "STORE_INPUT=Konveksi Cabang %SUB_CLEAN%"

:: 4. Input Port Lokal (Untuk jika dijalankan dalam 1 PC bersama cabang lain)
echo.
echo Masukkan Port Lokal di komputer ini:
echo (Default: 3002. Cabang 1: 3001, Cabang 2: 3002, Cabang 3: 3003, dst)
set /p "PORT_INPUT=Port lokal [3002]: "
if "%PORT_INPUT%"=="" set "PORT_INPUT=3002"

:: 5. Input Token Cloudflare Tunnel (Opsional)
echo.
echo ============================================================
echo PENGATURAN AKSES ONLINE (CLOUDFLARE TUNNEL):
echo Agar https://%FULL_DOMAIN% langsung aktif tanpa buka port router:
echo Masukkan TUNNEL_TOKEN dari Cloudflare Zero Trust (atau kosongkan jika lokal):
echo ============================================================
set /p "TUNNEL_INPUT=Token Cloudflare (opsional): "

:: 6. Deteksi Machine ID Hardware
set "MACHINE_ID="
if exist "client-sdk\get-machine-id.ps1" (
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File client-sdk\get-machine-id.ps1`) do set "MACHINE_ID=%%i"
) else if exist "get-machine-id.ps1" (
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File get-machine-id.ps1`) do set "MACHINE_ID=%%i"
)
if "%MACHINE_ID%"=="" (
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Get-CimInstance Win32_ComputerSystemProduct).UUID } catch { (Get-WmiObject Win32_ComputerSystemProduct).UUID }"`) do set "MACHINE_ID=%%i"
)
if "%MACHINE_ID%"=="" set "MACHINE_ID=MID-%RANDOM%-%RANDOM%-%RANDOM%"

:: 7. Buat Folder Khusus Cabang Baru
set "BRANCH_DIR=CABANG_%SUB_CLEAN%"
echo.
echo [1/4] Membuat folder lingkungan cabang: %BRANCH_DIR%...
if not exist "%BRANCH_DIR%" mkdir "%BRANCH_DIR%"
if not exist "%BRANCH_DIR%\data" mkdir "%BRANCH_DIR%\data"

:: 8. Buat File .env Cabang Baru
echo [2/4] Membuat konfigurasi .env untuk %STORE_INPUT%...
(
  echo # ============================================================
  echo # Konfigurasi Cabang: %STORE_INPUT%
  echo # ============================================================
  echo PORT=%PORT_INPUT%
  echo STORE_NAME=%STORE_INPUT%
  echo SUBDOMAIN=%SUB_CLEAN%
  echo APP_URL=https://%FULL_DOMAIN%
  echo.
  echo # Kunci Sesi \^& Keamanan
  echo AUTH_SECRET=konveksi_%SUB_CLEAN%_secret_session_2026
  echo.
  echo # Sistem Lisensi VOC ML
  echo VOCML_SERVER_URL=https://vocml.vocpos.id
  echo VOCML_PRODUCT=pos
  echo VOCML_MACHINE_ID=%MACHINE_ID%
  echo VOCML_DISABLED=false
  echo.
  echo # Cloudflare Tunnel
  echo TUNNEL_TOKEN=%TUNNEL_INPUT%
) > "%BRANCH_DIR%\.env"

:: 9. Buat docker-compose.yml Cabang Baru
echo [3/4] Menyiapkan docker-compose.yml khusus cabang...
(
  echo services:
  echo   app:
  echo     image: ghcr.io/tirta7/konveksi-app:latest
  echo     container_name: konveksi_app_%SUB_CLEAN%
  echo     restart: unless-stopped
  echo     ports:
  echo       - "%PORT_INPUT%:3001"
  echo     env_file:
  echo       - .env
  echo     environment:
  echo       NODE_ENV: production
  echo       PORT: "3001"
  echo       DATA_DIR: /data
  echo       TZ: Asia/Jakarta
  echo       STORE_NAME: "%STORE_INPUT%"
  echo       VOCML_MACHINE_ID: "%MACHINE_ID%"
  echo       VOCML_SERVER_URL: "${VOCML_SERVER_URL:-https://vocml.vocpos.id}"
  echo       VOCML_PRODUCT: "pos"
  echo     volumes:
  echo       - ./data:/data
  echo     healthcheck:
  echo       test: ["CMD", "curl", "-fsS", "http://127.0.0.1:3001/api/auth/me"]
  echo       interval: 20s
  echo       timeout: 5s
  echo       retries: 3
  echo       start_period: 30s
) > "%BRANCH_DIR%\docker-compose.yml"

:: Tambahkan service tunnel jika token diisi
if not "%TUNNEL_INPUT%"=="" (
  (
    echo.
    echo   cloudflared:
    echo     image: cloudflare/cloudflared:latest
    echo     container_name: konveksi_tunnel_%SUB_CLEAN%
    echo     restart: unless-stopped
    echo     command: tunnel --no-autoupdate run
    echo     environment:
    echo       TUNNEL_TOKEN: "%TUNNEL_INPUT%"
    echo     depends_on:
    echo       - app
  ) >> "%BRANCH_DIR%\docker-compose.yml"
)

:: 10. Buat Script Kontrol di dalam folder cabang
(
  echo @echo off
  echo title Menjalankan Cabang %STORE_INPUT%
  echo cd /d "%%~dp0"
  echo docker compose pull
  echo docker compose up -d
  echo timeout /t 5 /nobreak ^>nul
  echo start http://localhost:%PORT_INPUT%
) > "%BRANCH_DIR%\START_CABANG.bat"

(
  echo @echo off
  echo title Hentikan Cabang %STORE_INPUT%
  echo cd /d "%%~dp0"
  echo docker compose down
  echo echo Cabang %STORE_INPUT% telah dihentikan.
  echo pause
) > "%BRANCH_DIR%\STOP_CABANG.bat"

(
  echo @echo off
  if not "%TUNNEL_INPUT%"=="" (
    echo start https://%FULL_DOMAIN%
  ) else (
    echo start http://localhost:%PORT_INPUT%
  )
) > "%BRANCH_DIR%\BUKA_APLIKASI.bat"

echo [4/4] Skrip dan konfigurasi cabang selesai dibuat!
echo.
echo ============================================================
echo   CABANG BARU BERHASIL DIKONFIGURASI!
echo ============================================================
echo   Nama Cabang      : %STORE_INPUT%
echo   Domain Online    : https://%FULL_DOMAIN%
echo   Akses Lokal      : http://localhost:%PORT_INPUT%
echo   Machine ID       : %MACHINE_ID%
echo   Folder Cabang    : %CD%\%BRANCH_DIR%
echo ============================================================
echo.

set /p "START_NOW=Apakah Anda ingin langsung menjalankan cabang ini sekarang? (Y/T) [Y]: "
if /i "%START_NOW%"=="T" (
    echo Cabang dapat dijalankan nanti dengan membuka folder %BRANCH_DIR% dan mengklik START_CABANG.bat.
    pause
    exit /b 0
)

echo.
echo Memulai server kontainer cabang %STORE_INPUT%...
cd /d "%BRANCH_DIR%"
docker compose pull
docker compose up -d

echo Menunggu inisialisasi server (10 detik)...
timeout /t 10 /nobreak >nul

if not "%TUNNEL_INPUT%"=="" (
    start https://%FULL_DOMAIN%
)
start http://localhost:%PORT_INPUT%

echo.
echo ============================================================
echo   CABANG TELAH AKTIF!
echo   Bila muncul Layar Merah (Terkunci), aktifkan Machine ID:
echo   %MACHINE_ID%
echo   pada Dashboard VOC ML Anda untuk cabang "%STORE_INPUT%".
echo ============================================================
echo.
pause
