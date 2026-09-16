@echo off
title KonveksiApps — Kill Server
color 0C
cls

echo ================================================
echo   KONVEKSIAPPS — Matikan Server
echo ================================================
echo.
echo [INFO] Mencari proses yang berjalan di port 3000...
echo.

:: Cari dan kill proses di port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do (
    echo [KILL] Mematikan proses PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [INFO] Mencari semua proses node.exe...
tasklist | findstr "node.exe" >nul 2>&1
if %errorlevel%==0 (
    echo [KILL] Mematikan semua node.exe...
    taskkill /F /IM node.exe >nul 2>&1
    echo [OK]   Semua proses node.exe dihentikan.
) else (
    echo [OK]   Tidak ada proses node.exe yang berjalan.
)

echo.
echo ------------------------------------------------
echo  Semua server berhasil dihentikan!
echo ------------------------------------------------
echo.
pause
