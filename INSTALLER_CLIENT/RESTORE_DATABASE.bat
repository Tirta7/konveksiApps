@echo off
setlocal enabledelayedexpansion
title Restore Database Sistem Konveksi
color 0E
cls

cd /d "%~dp0"

echo ============================================================
echo   RESTORE DATABASE SISTEM KONVEKSI
echo   Memulihkan data dari salinan cadangan (Backup)
echo ============================================================
echo.

if not exist "backups" (
    echo [ERROR] Folder 'backups/' belum ada atau belum ada riwayat backup!
    pause
    exit /b 1
)

echo Daftar Cadangan Database yang Tersedia:
echo ------------------------------------------------------------
set /a count=0
for /f "tokens=*" %%D in ('dir /b /ad /o-d "backups\backup_*" 2^>nul') do (
    set /a count+=1
    set "FOLDER_!count!=%%D"
    echo   [!count!] %%D
)

if %count% equ 0 (
    echo [!] Tidak ditemukan folder backup di dalam folder 'backups/'.
    pause
    exit /b 1
)

echo ------------------------------------------------------------
echo.
set /p "CHOICE=Pilih nomor cadangan yang ingin dipulihkan (1-%count%): "

if not defined FOLDER_%CHOICE% (
    echo [ERROR] Pilihan nomor tidak valid! Pemulihan dibatalkan.
    pause
    exit /b 1
)

set "SELECTED_BACKUP=!FOLDER_%CHOICE%!"
echo.
echo Anda memilih: !SELECTED_BACKUP!
echo PERINGATAN: Data yang aktif saat ini akan digantikan dengan data cadangan ini.
set /p "CONFIRM=Apakah Anda yakin ingin memulihkan database ini? (Y/T): "
if /i not "!CONFIRM!"=="Y" (
    echo Pemulihan dibatalkan.
    pause
    exit /b 0
)

echo.
echo [1/4] Membuat snapshot pengaman dari data saat ini...
if not exist "backups_safety" mkdir backups_safety
for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"`) do set "NOW=%%t"
if exist "data" xcopy /E /I /Y "data" "backups_safety\before_restore_%NOW%" >nul

echo [2/4] Menghentikan sementara kontainer aplikasi...
docker compose down >nul 2>&1

echo [3/4] Memulihkan file database...
if exist "backups\!SELECTED_BACKUP!\konveksi-data.json" (
    copy /Y "backups\!SELECTED_BACKUP!\konveksi-data.json" "data\konveksi-data.json" >nul
    echo  [OK] File konveksi-data.json berhasil dipulihkan.
)
if exist "backups\!SELECTED_BACKUP!\sqlite.db" (
    copy /Y "backups\!SELECTED_BACKUP!\sqlite.db" "data\sqlite.db" >nul
    echo  [OK] File sqlite.db berhasil dipulihkan.
)

echo [4/4] Menyalakan kembali kontainer aplikasi...
docker compose up -d

echo.
echo ============================================================
echo   RESTORE DATABASE SELESAI DENGAN SUKSES!
echo ============================================================
echo   Database telah dipulihkan dari: !SELECTED_BACKUP!
echo   Membuka kembali aplikasi di browser...
echo ============================================================
echo.

set "TARGET_PORT=3001"
if exist ".env" (
    for /f "tokens=2 delims==" %%p in ('findstr /i "^PORT=" ".env"') do set "TARGET_PORT=%%p"
)

timeout /t 5 /nobreak >nul
start http://localhost:%TARGET_PORT%
pause

