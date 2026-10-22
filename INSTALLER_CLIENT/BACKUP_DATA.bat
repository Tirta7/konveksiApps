@echo off
setlocal enabledelayedexpansion
title Backup Data Konveksi
color 0E
cls

cd /d "%~dp0"

set "DATETIME=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%"
set "DATETIME=%DATETIME: =0%"

echo ============================================================
echo   BACKUP DATA LOKAL SISTEM KONVEKSI
echo ============================================================
echo.

if not exist "data" (
    echo [ERROR] Folder data tidak ditemukan.
    pause
    exit /b 1
)

if not exist "backups_manual" mkdir backups_manual

set "TARGET_DIR=backups_manual\backup_%DATETIME%"
mkdir "%TARGET_DIR%"
xcopy /E /I /Y "data" "%TARGET_DIR%" >nul

echo [OK] Seluruh data berhasil dicadangkan ke:
echo      %TARGET_DIR%
echo.
pause
