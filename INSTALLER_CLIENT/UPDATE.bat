@echo off
setlocal enabledelayedexpansion
title Update Sistem Manajemen Konveksi
color 0B
cls

cd /d "%~dp0"

echo ============================================================
echo   PEMBARUAN FITUR SISTEM KONVEKSI
echo ============================================================
echo.

:: Login bila ada .token
if exist ".token" (
    for /f "usebackq tokens=1,* delims==" %%a in (".token") do (
        if /i "%%a"=="GITHUB_USERNAME" set "GH_USER=%%b"
        if /i "%%a"=="GITHUB_TOKEN"    set "GH_PAT=%%b"
    )
    if defined GH_PAT (
        echo !GH_PAT! | docker login ghcr.io -u !GH_USER! --password-stdin >nul 2>&1
    )
)

echo [1/3] Mengambil pembaruan sistem dari cloud server...
docker compose pull

echo.
echo [2/3] Memperbarui dan merestart kontainer aplikasi...
docker compose up -d

echo.
echo [3/3] Selesai! Server berjalan dengan versi terbaru.
timeout /t 3 /nobreak >nul
start http://localhost:3001
echo Jendela ini dapat ditutup.
timeout /t 5 >nul
