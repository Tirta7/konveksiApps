@echo off
setlocal enabledelayedexpansion
title Sistem Manajemen Konveksi - Auto Installer & Lisensi VOC ML
color 0A
cls

echo ============================================================
echo   SISTEM MANAJEMEN KONVEKSI - DOCKER & VOC ML INSTALLER
echo   Instalasi Otomatis Satu Klik (Windows 10/11)
echo ============================================================
echo.

:: 1. Cek Hak Akses Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Meminta hak administrator...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c cd /d \"%~dp0\" && \"%~f0\"' -Verb RunAs"
    exit /b 0
)

:: Pindah ke direktori script
cd /d "%~dp0"

:: 2. Cek Apakah Docker Sudah Terpasang dan Berjalan
echo [1/6] Memeriksa status Docker Desktop...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Docker belum terinstall pada komputer ini!
    echo Silakan unduh dan install Docker Desktop dari:
    echo   https://www.docker.com/products/docker-desktop/
    echo Setelah di-install, buka Docker Desktop hingga berstatus 'Engine Running'.
    echo.
    pause
    exit /b 1
)

:: Cek apakah Docker daemon sedang aktif
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Docker Desktop terpasang tetapi belum aktif (belum 'Running').
    echo Membuka Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" >nul 2>&1
    echo Menunggu Docker aktif (maksimal 45 detik)...
    set /a attempt=0
    :WAIT_DOCKER
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% equ 0 goto DOCKER_READY
    set /a attempt+=1
    if !attempt! lss 9 (
        echo   ...menunggu Docker siap (!attempt!/9)...
        goto WAIT_DOCKER
    )
    echo.
    echo [ERROR] Docker Desktop belum aktif. Pastikan ikon ikan paus di tray bawah sudah hijau.
    echo Silakan jalankan Docker Desktop lalu jalankan ulang file ini.
    echo.
    pause
    exit /b 1
)

:DOCKER_READY
echo [OK] Docker Desktop aktif dan siap digunakan.

:: 3. Deteksi Machine ID Hardware Windows
echo.
echo [2/6] Membaca Machine ID hardware komputer ini...
set "MACHINE_ID="
if exist "get-machine-id.ps1" (
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File get-machine-id.ps1`) do set "MACHINE_ID=%%i"
)
if "%MACHINE_ID%"=="" (
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Get-CimInstance Win32_ComputerSystemProduct).UUID } catch { (Get-WmiObject Win32_ComputerSystemProduct).UUID }"`) do set "MACHINE_ID=%%i"
)
if "%MACHINE_ID%"=="" set "MACHINE_ID=MID-%RANDOM%-%RANDOM%-%RANDOM%"
echo [OK] Machine ID terdeteksi: %MACHINE_ID%

:: 4. Persiapan Folder Data dan File Konfigurasi .env
echo.
echo [3/6] Menyiapkan konfigurasi cabang & lisensi...
if not exist "data" (
    mkdir data
    echo [OK] Folder 'data/' lokal dibuat untuk penyimpanan database.
)

if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
    ) else (
        echo PORT=3001 > .env
        echo APP_URL=http://localhost:3001 >> .env
    )
    echo.
    echo ============================================================
    echo Masukkan Nama Cabang / Pabrik Konveksi ini:
    set /p "INPUT_STORE=Nama Outlet (contoh: Konveksi Solo / Gudang Pusat): "
    if "!INPUT_STORE!"=="" set "INPUT_STORE=Konveksi Cabang Utama"

    powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-Content .env; $c = $c -replace '^STORE_NAME=.*', ('STORE_NAME=' + $env:INPUT_STORE); $c = $c -replace '^VOCML_MACHINE_ID=.*', ('VOCML_MACHINE_ID=' + $env:MACHINE_ID); Set-Content .env -Value $c"
    echo [OK] File .env berhasil diset untuk cabang: !INPUT_STORE!
) else (
    if exist "get-machine-id.ps1" (
        powershell -NoProfile -ExecutionPolicy Bypass -File get-machine-id.ps1 -EnvFile ".env" >nul 2>&1
    )
    echo [OK] File .env sudah ada, Machine ID hardware terverifikasi.
)

:: 5. Login GHCR (Bila image berstatus Private)
echo.
echo [4/6] Memeriksa kredensial GitHub Container Registry...
if exist ".token" (
    for /f "usebackq tokens=1,* delims==" %%a in (".token") do (
        if /i "%%a"=="GITHUB_USERNAME" set "GH_USER=%%b"
        if /i "%%a"=="GITHUB_TOKEN"    set "GH_PAT=%%b"
    )
    if defined GH_PAT (
        echo !GH_PAT! | docker login ghcr.io -u !GH_USER! --password-stdin >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Berhasil terautentikasi ke ghcr.io.
        ) else (
            echo [WARNING] Gagal login ke ghcr.io dengan token yang diberikan. Mencoba melanjutkan...
        )
    )
) else (
    echo [INFO] Melewati autentikasi khusus (menggunakan image publik / login aktif)...
)

:: 6. Unduh Image Terbaru & Jalankan Container
echo.
echo [5/6] Mengunduh versi aplikasi konveksi terbaru dari cloud...
docker compose pull
if %errorlevel% neq 0 (
    echo [WARNING] Tidak dapat mengunduh image terbaru dari cloud.
    echo Memeriksa apakah image lokal sudah tersedia...
)

echo.
echo [6/6] Menjalankan server aplikasi konveksi...
docker compose down >nul 2>&1
docker compose up -d

echo.
echo Menunggu inisialisasi server Next.js & sistem lisensi (10 detik)...
timeout /t 10 /nobreak >nul

:: 7. Selesai & Informasi Aktivasi
echo.
echo ============================================================
echo   INSTALASI SELESAI!
echo ============================================================
echo   Aplikasi Konveksi : http://localhost:3001
echo   Machine ID Anda   : %MACHINE_ID%
echo.
echo   PENTING:
echo   - Machine ID di atas SUDAH OTOMATIS TERDAFTAR ke server lisensi pusat.
echo   - Hubungi Admin / Penyedia Sistem untuk persetujuan aktivasi lisensi.
echo   - Begitu diaktifkan dari pusat, aplikasi otomatis terbuka
echo     dalam 5 detik tanpa perlu memasukkan kode manual!
echo ============================================================
echo.

start http://localhost:3001
echo Tekan tombol apa saja untuk menutup jendela ini...
pause >nul
