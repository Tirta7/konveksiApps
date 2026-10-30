@echo off
setlocal enabledelayedexpansion
title Update Sistem Manajemen Konveksi ke Versi Terbaru
color 0E
cls

:: ============================================================
:: 1. SELF-ELEVATION - Hak Administrator
:: ============================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c cd /d \"%~dp0\" && \"%~f0\" & pause' -Verb RunAs -Wait"
    exit /b 0
)

cd /d "%~dp0"
set "INSTALL_DIR=%~dp0"

echo.
echo ============================================================
echo   SISTEM MANAJEMEN KONVEKSI - UPDATE VERSI TERBARU
echo   Mengunduh fitur & perbaikan terbaru dari cloud server...
echo ============================================================
echo.

:: ============================================================
:: 2. PASTIKAN DOCKER ENGINE AKTIF
:: ============================================================
echo [1/4] Memeriksa status Docker Engine...
docker info >nul 2>&1
if not errorlevel 1 goto DOCKER_RUNNING

echo  [!] Docker belum aktif. Membuka Docker Desktop otomatis...
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    start "" "Docker Desktop" >nul 2>&1
)

echo  Menunggu Docker Engine aktif (maksimal 90 detik)...
set "WAIT_SEC=0"
:WAIT_LOOP
timeout /t 5 /nobreak >nul
set /a "WAIT_SEC+=5"
docker info >nul 2>&1
if not errorlevel 1 goto DOCKER_RUNNING
echo   ...menunggu Docker siap (!WAIT_SEC!/90 detik)...
if !WAIT_SEC! LSS 90 goto WAIT_LOOP

echo.
echo  [ERROR] Docker Engine belum aktif. Buka Docker Desktop secara manual
echo  dan pastikan statusnya 'Engine Running', lalu ulangi file ini.
pause
exit /b 1

:DOCKER_RUNNING
echo  [OK] Docker Engine aktif.

:: ============================================================
:: 3. AUTENTIKASI REGISTRY GITHUB (Bila ada token)
:: ============================================================
echo.
echo [2/4] Memeriksa kredensial update...
set "GITHUB_USERNAME=tirta7"
set "GITHUB_TOKEN="

if exist "%INSTALL_DIR%.token" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%INSTALL_DIR%.token") do (
        if /i "%%a"=="GITHUB_USERNAME" set "GITHUB_USERNAME=%%b"
        if /i "%%a"=="GITHUB_TOKEN"    set "GITHUB_TOKEN=%%b"
    )
)
if "!GITHUB_TOKEN!"=="" (
    if exist "%INSTALL_DIR%.env" (
        for /f "tokens=2 delims==" %%v in ('findstr /i "GITHUB_TOKEN" "%INSTALL_DIR%.env"') do set "GITHUB_TOKEN=%%v"
    )
)

if defined GITHUB_TOKEN (
    echo !GITHUB_TOKEN! | docker login ghcr.io -u !GITHUB_USERNAME! --password-stdin >nul 2>&1
    if !errorlevel! equ 0 (
        echo  [OK] Terhubung ke ghcr.io sebagai !GITHUB_USERNAME!.
    )
) else (
    echo  [INFO] Mengunduh langsung dari repository publik.
)

:: ============================================================
:: 4. PULL IMAGE TERBARU DARI CLOUD (Auto-Retry 3x)
:: ============================================================
echo.
echo [3/4] Mengunduh pembaruan aplikasi dari cloud...
set "TRY_COUNT=0"
:PULL_RETRY
set /a "TRY_COUNT+=1"
echo  [PULL] Percobaan !TRY_COUNT! dari 3...
docker compose pull
if not errorlevel 1 goto PULL_SUCCESS

if !TRY_COUNT! LSS 3 (
    echo  [!] Gangguan jaringan, mencoba kembali dalam 10 detik...
    timeout /t 10 /nobreak >nul
    goto PULL_RETRY
)

echo.
echo  [ERROR] Gagal mengunduh pembaruan setelah 3x percobaan.
echo  Periksa koneksi internet Anda atau coba beberapa saat lagi.
pause
exit /b 1

:PULL_SUCCESS
echo  [OK] Seluruh pembaruan berhasil diunduh!

:: ============================================================
:: 5. RESTART KONTAINER DENGAN VERSI TERBARU
:: ============================================================
echo.
echo [4/4] Menerapkan pembaruan sistem...
docker compose up -d --remove-orphans
if errorlevel 1 (
    echo.
    echo  [ERROR] Gagal merestart layanan aplikasi.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo   [SUKSES] APLIKASI TELAH DIPERBARUI KE VERSI TERBARU!
echo   Semua database dan data riwayat aman (tidak hilang).
echo  ============================================================
echo.

:: Ambil port atau domain dari .env jika ada
set "TARGET_URL=http://localhost:3001"
if exist "%INSTALL_DIR%.env" (
    for /f "tokens=2 delims==" %%v in ('findstr /i "^PORT=" "%INSTALL_DIR%.env"') do (
        set "TARGET_URL=http://localhost:%%v"
    )
)

timeout /t 5 /nobreak >nul
start %TARGET_URL%
echo Browser telah dibuka ke: %TARGET_URL%
echo Tekan sembarang tombol untuk menutup jendela ini...
pause >nul
exit /b 0
