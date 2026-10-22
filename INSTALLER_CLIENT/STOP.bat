@echo off
title Hentikan Sistem Konveksi
color 0C
cls

cd /d "%~dp0"

echo Menghentikan kontainer aplikasi konveksi...
docker compose down
echo.
echo ============================================================
echo   Aplikasi Konveksi berhasil dimatikan secara aman.
echo ============================================================
echo.
pause
