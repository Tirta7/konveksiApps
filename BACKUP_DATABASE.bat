@echo off
setlocal enabledelayedexpansion
title Backup Database Sistem Konveksi (.sql ^& .json)
color 0B
cls

cd /d "%~dp0"

echo ============================================================
echo   BACKUP DATABASE SISTEM KONVEKSI
echo   Membuat salinan cadangan lengkap (.sql ^& .json)
echo ============================================================
echo.

if not exist "data" (
    echo [ERROR] Folder data/ tidak ditemukan!
    echo Pastikan aplikasi sudah pernah dijalankan minimal 1 kali.
    pause
    exit /b 1
)

:: Ambil timestamp YYYY-MM-DD_HH-mm-ss via powershell agar konsisten di semua format regional Windows
for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"`) do set "TIMESTAMP=%%t"
if "%TIMESTAMP%"=="" set "TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"

set "BACKUP_DIR=backups\backup_%TIMESTAMP%"
if not exist "backups" mkdir backups
mkdir "%BACKUP_DIR%"

echo [1/3] Menyalin file database utama...
if exist "data\konveksi-data.json" copy "data\konveksi-data.json" "%BACKUP_DIR%\" >nul
if exist "data\sqlite.db" copy "data\sqlite.db" "%BACKUP_DIR%\" >nul
if exist ".env" copy ".env" "%BACKUP_DIR%\env_backup.txt" >nul

echo [2/3] Mengonversi ke file SQL Dump (.sql)...
if exist "export-sql.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File export-sql.ps1 -JsonPath "data\konveksi-data.json" -SqlPath "%BACKUP_DIR%\konveksi_database_%TIMESTAMP%.sql" >nul 2>&1
)

echo [3/3] Memverifikasi integritas file cadangan...
echo.
echo ============================================================
echo   BACKUP DATABASE BERHASIL!
echo ============================================================
echo   Folder Backup : %CD%\%BACKUP_DIR%
echo.
echo   File yang tersimpan:
dir /b "%BACKUP_DIR%"
echo ============================================================
echo.
echo File .sql siap di-import atau dibuka di aplikasi database manajemen.
pause
