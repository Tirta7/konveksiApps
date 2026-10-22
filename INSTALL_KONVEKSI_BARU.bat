@echo off
setlocal enabledelayedexpansion
title Setup Aplikasi Konveksi Baru - [Klien].vocpos.id
color 0B
cls

echo ============================================================
echo   SISTEM MANAJEMEN PRODUKSI KONVEKSI (GARMENT ERP)
echo   Wizard Instalasi Klien Baru & Aktivasi Lisensi VOC ML
echo   Subdomain Terintegrasi: [namakonveksi].vocpos.id
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

:: 2. Cek Apakah Docker Desktop Aktif
echo [1/5] Memeriksa status Docker Desktop...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Docker belum terinstall pada komputer ini!
    echo Silakan install Docker Desktop dari: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Docker Desktop belum aktif. Membuka Docker...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" >nul 2>&1
    echo Menunggu Docker aktif (maksimal 45 detik)...
    set /a attempt=0
    :WAIT_DOCKER
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% equ 0 goto DOCKER_READY
    set /a attempt+=1
    if !attempt! lss 9 goto WAIT_DOCKER
    echo.
    echo [ERROR] Docker Desktop belum siap. Pastikan Docker sudah running lalu ulangi.
    pause
    exit /b 1
)

:DOCKER_READY
echo [OK] Docker Desktop aktif.

:: 3. Input Data Pembeli / Klien Konveksi Baru
echo.
echo ============================================================
echo   DATA USAHA KONVEKSI / KLIEN BARU
echo ============================================================
echo.

echo 1. Masukkan Nama Usaha / Pabrik Konveksi Pembeli:
echo    (Contoh: Rani Jeans Bali / CV Sumber Rejeki / Konveksi Mandiri)
set /p "STORE_INPUT=Nama Usaha: "
if "%STORE_INPUT%"=="" set "STORE_INPUT=Konveksi Baru"

echo.
echo 2. Masukkan Subdomain untuk akses online di vocpos.id:
echo    (Contoh: ketik 'ranijeans' -> maka menjadi 'https://ranijeans.vocpos.id')
echo    (Contoh: ketik 'konveksibali' -> maka menjadi 'https://konveksibali.vocpos.id')
set /p "SUB_INPUT=Subdomain (tanpa .vocpos.id): "
if "%SUB_INPUT%"=="" (
    echo [ERROR] Subdomain tidak boleh kosong!
    pause
    exit /b 1
)

:: Bersihkan subdomain
set "SUB_CLEAN=%SUB_INPUT:.vocpos.id=%"
set "SUB_CLEAN=%SUB_CLEAN: =%"
set "FULL_DOMAIN=%SUB_CLEAN%.vocpos.id"

echo.
echo [OK] Alamat website klien: https://%FULL_DOMAIN%
echo.

echo 3. Masukkan Token Cloudflare Tunnel untuk https://%FULL_DOMAIN%:
echo    (Dapatkan token dari dashboard Cloudflare Zero Trust akun vocpos.id Anda)
echo    (Atau kosongkan jika klien saat ini hanya menggunakan akses LAN/lokal)
set /p "TUNNEL_INPUT=Token Cloudflare Tunnel: "

:: 4. Deteksi Hardware Machine ID Komputer Pembeli (Kunci Anti-Bajak)
echo.
echo [2/5] Membaca Machine ID hardware komputer pembeli...
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
echo [OK] Machine ID terkunci pada hardware ini: %MACHINE_ID%

:: 5. Buat Folder Data & File Konfigurasi .env
echo.
echo [3/5] Menyiapkan database dan konfigurasi khusus %STORE_INPUT%...
if not exist "data" mkdir data

(
  echo # ============================================================
  echo # Konfigurasi Klien: %STORE_INPUT%
  echo # ============================================================
  echo PORT=3001
  echo STORE_NAME=%STORE_INPUT%
  echo SUBDOMAIN=%SUB_CLEAN%
  echo APP_URL=https://%FULL_DOMAIN%
  echo.
  echo # Keamanan Sesi
  echo AUTH_SECRET=konveksi_%SUB_CLEAN%_secret_key_2026
  echo.
  echo # Sistem Lisensi Pengunci VOC ML
  echo VOCML_SERVER_URL=https://vocml.vocpos.id
  echo VOCML_PRODUCT=pos
  echo VOCML_MACHINE_ID=%MACHINE_ID%
  echo VOCML_DISABLED=false
  echo.
  echo # Cloudflare Tunnel
  echo TUNNEL_TOKEN=%TUNNEL_INPUT%
) > .env

:: 6. Buat/Update docker-compose.yml untuk menyertakan cloudflared jika ada token
(
  echo services:
  echo   app:
  echo     image: ghcr.io/tirta7/konveksi-app:latest
  echo     container_name: konveksi_app_%SUB_CLEAN%
  echo     restart: unless-stopped
  echo     ports:
  echo       - "3001:3001"
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
) > docker-compose.yml

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
  ) >> docker-compose.yml
)

:: 7. Unduh Image Terbaru & Jalankan Kontainer
echo.
echo [4/5] Mengunduh aplikasi Konveksi dari cloud registry...
docker compose pull
if %errorlevel% neq 0 (
    echo [WARNING] Tidak dapat mengunduh image dari cloud. Memeriksa ketersediaan lokal...
)

echo.
echo [5/5] Menjalankan server aplikasi untuk %STORE_INPUT%...
docker compose down >nul 2>&1
docker compose up -d

echo Menunggu server siap (10 detik)...
timeout /t 10 /nobreak >nul

:: 8. Selesai & Ringkasan Lisensi
echo.
echo ============================================================
echo   INSTALASI APLIKASI KONVEKSI BERHASIL!
echo ============================================================
echo   Nama Klien / Usaha : %STORE_INPUT%
echo   Domain Online Resmi: https://%FULL_DOMAIN%
echo   Akses Komputer ini : http://localhost:3001
echo   Machine ID Klien   : %MACHINE_ID%
echo ============================================================
echo.
echo   PETUNJUK AKTIVASI LISENSI:
echo   1. Salin Machine ID di atas: %MACHINE_ID%
echo   2. Buka Dashboard VOC ML Anda di menu "Machine ID Masuk".
echo   3. Setujui / Aktifkan lisensi untuk toko "%STORE_INPUT%".
echo   4. Layar merah di komputer pembeli akan otomatis terbuka
echo      dalam 5 detik begitu diaktifkan!
echo ============================================================
echo.

if not "%TUNNEL_INPUT%"=="" (
    start https://%FULL_DOMAIN%
)
start http://localhost:3001

echo Tekan tombol apa saja untuk keluar...
pause >nul
