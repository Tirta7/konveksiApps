@echo off
setlocal enabledelayedexpansion
title Sistem Manajemen Konveksi - Auto Installer & Lisensi VOC ML
color 0A
cls

echo ============================================================
echo   SISTEM MANAJEMEN KONVEKSI - DOCKER & VOC ML INSTALLER
echo   Auto Installer v3.0 - Deteksi & Setup Otomatis (Windows 10/11)
echo ============================================================
echo.

:: ============================================================
:: 1. SELF-ELEVATION - Hak Akses Administrator
:: ============================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Meminta hak administrator...
    echo Klik YES pada popup UAC yang muncul.
    echo [INFO] Meminta hak Administrator - klik YES pada popup UAC & powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

cd /d "%~dp0"
set "INSTALL_DIR=%~dp0"

:: ============================================================
:: 2. CEK SISTEM OPERASI (Windows 10/11 64-bit)
:: ============================================================
echo [1/7] Mengecek sistem operasi...
ver | find "10." >nul 2>&1
if not errorlevel 1 goto WIN_OK
ver | find "11." >nul 2>&1
if not errorlevel 1 goto WIN_OK
echo  [WARNING] Disarankan menggunakan Windows 10 atau Windows 11 (64-bit).
:WIN_OK
echo  [OK] Windows kompatibel.

:: ============================================================
:: 3. DETEKSI & AUTO-INSTALL DOCKER DESKTOP
:: ============================================================
echo.
echo [2/7] Memeriksa status Docker Desktop...
docker --version >nul 2>&1
if not errorlevel 1 goto DOCKER_FOUND

echo.
echo  ============================================================
echo   [!] DOCKER DESKTOP BELUM TERPASANG DI KOMPUTER INI
echo   Memulai instalasi otomatis Docker Desktop...
echo   Proses ini membutuhkan waktu sekitar 5 - 15 menit.
echo  ============================================================
echo.

where winget >nul 2>&1
if not errorlevel 1 (
    echo  [..] Menginstall Docker Desktop via Windows Package Manager (winget)...
    winget install -e --id Docker.DockerDesktop --exact --source winget --silent --accept-package-agreements --accept-source-agreements
    if !errorlevel! equ 0 goto DOCKER_INSTALLED
    echo  [!] winget gagal atau butuh persetujuan manual, beralih ke download langsung...
)

echo  [..] Mengunduh Docker Desktop Installer resmi...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -UserAgent 'Mozilla/5.0' -Uri 'https://desktop.docker.com/win/main/amd64/Docker%%20Desktop%%20Installer.exe' -OutFile '%TEMP%\DockerInstaller.exe'"

if not exist "%TEMP%\DockerInstaller.exe" (
    echo.
    echo  [ERROR] Gagal mengunduh Docker Desktop.
    echo  Pastikan koneksi internet lancar, atau unduh manual dari:
    echo  https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

echo  [..] Memasang Docker Desktop (Silent Installation)...
start /wait "" "%TEMP%\DockerInstaller.exe" install --quiet --accept-license --backend=wsl-2
del /q "%TEMP%\DockerInstaller.exe" >nul 2>&1

:DOCKER_INSTALLED
echo.
echo  ============================================================
echo   [BERHASIL] DOCKER DESKTOP SELESAI DIINSTALL!
echo   ----------------------------------------------------------
echo   Sistem Windows WAJIB di-RESTART (Reboot) agar fitur
echo   virtualisasi & WSL2 aktif sepenuhnya.
echo.
echo   Langkah selanjutnya:
echo   1. Klik Restart komputer Anda sekarang.
echo   2. Setelah menyala, jalankan kembali INSTALL.bat ini!
echo  ============================================================
echo.
pause
exit /b 0

:DOCKER_FOUND
echo  [OK] Docker Desktop terpasang.

:: ============================================================
:: 4. MEMASTIKAN DOCKER ENGINE BERJALAN
:: ============================================================
echo  [..] Memastikan Docker Engine aktif...
docker info >nul 2>&1
if not errorlevel 1 goto DOCKER_RUNNING

echo  [!] Docker Engine belum aktif. Membuka Docker Desktop...
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    start "" "Docker Desktop" >nul 2>&1
)

echo  Menunggu Docker Engine siap (maksimal 120 detik)...
set "DOCKER_WAIT=0"
:WAIT_DOCKER
timeout /t 5 /nobreak >nul
set /a "DOCKER_WAIT+=5"
docker info >nul 2>&1
if not errorlevel 1 goto DOCKER_RUNNING
echo   ...menunggu Docker siap (!DOCKER_WAIT!/120 detik)...
if !DOCKER_WAIT! LSS 120 goto WAIT_DOCKER

echo.
echo  [ERROR] Docker Engine belum siap setelah 120 detik.
echo  Solusi:
echo   1. Buka aplikasi 'Docker Desktop' dari Start Menu / Desktop.
echo   2. Tunggu hingga ikon di pojok kanan bawah berwarna hijau.
echo   3. Jalankan kembali INSTALL.bat ini.
echo.
pause
exit /b 1

:DOCKER_RUNNING
echo  [OK] Docker Engine aktif dan siap digunakan.

:: ============================================================
:: 5. BACA ATAU INPUT GITHUB TOKEN (UNTUK PRIVATE IMAGE / GHCR)
:: ============================================================
echo.
echo [3/7] Memeriksa kredensial GitHub Container Registry (ghcr.io)...
set "GH_USER=tirta7"
set "GH_PAT="

if exist "%INSTALL_DIR%.token" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%INSTALL_DIR%.token") do (
        if /i "%%a"=="GITHUB_USERNAME" set "GH_USER=%%b"
        if /i "%%a"=="GITHUB_TOKEN"    set "GH_PAT=%%b"
    )
)

if defined GH_PAT (
    echo !GH_PAT! | docker login ghcr.io -u !GH_USER! --password-stdin >nul 2>&1
    if !errorlevel! equ 0 (
        echo  [OK] Berhasil login ke ghcr.io dengan token yang tersimpan.
    ) else (
        echo  [WARNING] Token login tidak valid atau kadaluarsa. Mencoba lanjut...
    )
) else (
    echo  [INFO] Menggunakan image public ghcr.io (atau token opsional di .token).
)

:: ============================================================
:: 6. HARDWARE MACHINE ID & LISENSI VOC ML
:: ============================================================
echo.
echo [4/7] Membaca Machine ID hardware komputer...
set "MACHINE_ID="
if exist "get-machine-id.ps1" (
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File get-machine-id.ps1`) do set "MACHINE_ID=%%i"
)
if "%MACHINE_ID%"=="" (
    for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (Get-CimInstance Win32_ComputerSystemProduct).UUID } catch { (Get-WmiObject Win32_ComputerSystemProduct).UUID }"`) do set "MACHINE_ID=%%i"
)
if "%MACHINE_ID%"=="" set "MACHINE_ID=MID-%RANDOM%-%RANDOM%-%RANDOM%"
echo  [OK] Machine ID terdeteksi: %MACHINE_ID%

:: ============================================================
:: 7. PERSIAPAN DATA DAN FILE .ENV
:: ============================================================
echo.
echo [5/7] Menyiapkan folder data dan konfigurasi...
if not exist "data" mkdir data

if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
    ) else (
        echo PORT=3001 > .env
        echo APP_URL=http://localhost:3001 >> .env
    )
    echo.
    echo ============================================================
    echo Masukkan Nama Usaha / Pabrik Konveksi ini:
    set /p "INPUT_STORE=Nama Usaha (contoh: Konveksi Solo / Gudang Pusat): "
    if "!INPUT_STORE!"=="" set "INPUT_STORE=Konveksi Cabang Utama"

    powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-Content .env; $c = $c -replace '^STORE_NAME=.*', ('STORE_NAME=' + $env:INPUT_STORE); $c = $c -replace '^VOCML_MACHINE_ID=.*', ('VOCML_MACHINE_ID=' + $env:MACHINE_ID); Set-Content .env -Value $c"
    echo  [OK] Konfigurasi diset untuk: !INPUT_STORE!
) else (
    if exist "get-machine-id.ps1" (
        powershell -NoProfile -ExecutionPolicy Bypass -File get-machine-id.ps1 -EnvFile ".env" >nul 2>&1
    )
    echo  [OK] File .env siap digunakan.
)

:: ============================================================
:: 8. PULL IMAGE & JALANKAN CONTAINER
:: ============================================================
echo.
echo [6/7] Mengunduh aplikasi konveksi versi terbaru dari cloud server...
echo       (Proses ini memakan waktu beberapa menit tergantung internet)

set "TRY_COUNT=0"
:PULL_LOOP
set /a "TRY_COUNT+=1"
echo  [PULL] Mengunduh komponen (Percobaan !TRY_COUNT! dari 3)...
docker compose pull
if not errorlevel 1 goto START_CONTAINER

if !TRY_COUNT! LSS 3 (
    echo  [!] Jaringan terputus/lambat, mencoba kembali dalam 10 detik...
    timeout /t 10 /nobreak >nul
    goto PULL_LOOP
)
echo  [WARNING] Gagal mengunduh image terbaru. Mencoba menjalankan image lokal jika ada...

:START_CONTAINER
echo.
echo [7/7] Menjalankan kontainer sistem konveksi...
docker compose down >nul 2>&1
docker compose up -d
if errorlevel 1 (
    echo  [ERROR] Gagal menjalankan kontainer!
    echo  Ketik 'docker compose logs' untuk melihat detail masalah.
    pause
    exit /b 1
)

echo.
echo Menunggu inisialisasi server (10 detik)...
timeout /t 10 /nobreak >nul

:: Buat Shortcut di Desktop
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Aplikasi Konveksi.lnk'); $s.TargetPath='http://localhost:3001'; $s.Description='Sistem Manajemen Produksi Konveksi'; $s.Save()" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\UPDATE Aplikasi Konveksi.lnk'); $s.TargetPath='%~dp0UPDATE.bat'; $s.Description='Update Sistem Konveksi'; $s.Save()" >nul 2>&1

:: ============================================================
:: SELESAI
:: ============================================================
cls
echo.
echo ============================================================
echo   INSTALASI SELESAI! APLIKASI KONVEKSI SIAP DIGUNAKAN
echo ============================================================
echo.
echo   Akses Aplikasi Lokal : http://localhost:3001
echo   Serial Machine ID    : %MACHINE_ID%
echo   Shortcut Desktop     : 'Aplikasi Konveksi' & 'UPDATE Aplikasi Konveksi'
echo.
echo   PANDUAN PEMBARUAN (UPDATE):
echo   - Kapan pun developer melakukan update fitur di GitHub,
echo     klien cukup mengklik 'UPDATE.bat' (atau shortcut di Desktop)
echo     maka sistem otomatis terupdate tanpa menghilangkan data.
echo.
echo   PANDUAN LISENSI:
echo   - Machine ID di atas SUDAH otomatis terdaftar di server lisensi.
echo   - Segera hubungi penyedia sistem untuk aktivasi.
echo ============================================================
echo.

start http://localhost:3001
pause
exit /b 0
