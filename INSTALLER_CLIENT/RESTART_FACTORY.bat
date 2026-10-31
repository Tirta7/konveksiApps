@echo off
setlocal enabledelayedexpansion
title Reset Factory - Kembalikan Sistem Konveksi ke Kondisi Bersih
color 0C
cls

cd /d "%~dp0"

echo ============================================================
echo   RESTART / RESET FACTORY (KEMBALI KE PENGATURAN AWAL)
echo ============================================================
echo.
echo  PERINGATAN KERAS:
echo  Proses ini akan MENGOSONGKAN seluruh data operasional:
echo  - Seluruh riwayat Potong Kain, SPK, dan PO
echo  - Seluruh stok barang dan pergerakan kain
echo  - Seluruh data barcode scan, retur, dan penjualan
echo.
echo  Konfigurasi lisensi, domain, dan koneksi tunnel TIDAK AKAN HILANG.
echo ============================================================
echo.

set /p "CONFIRM=Ketik kata 'RESET' (huruf besar) untuk melanjutkan: "
if not "!CONFIRM!"=="RESET" (
    echo.
    echo [BATAL] Konfirmasi tidak sesuai. Proses Reset Factory dibatalkan.
    pause
    exit /b 0
)

echo.
echo [1/4] Mengamankan data lama ke folder cadangan otomatis...
if not exist "backups_sebelum_reset" mkdir backups_sebelum_reset
for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"`) do set "TIMESTAMP=%%t"
if exist "data" (
    xcopy /E /I /Y "data" "backups_sebelum_reset\backup_sebelum_reset_%TIMESTAMP%" >nul
    echo  [OK] Data lama berhasil diamankan ke: backups_sebelum_reset\backup_sebelum_reset_%TIMESTAMP%
)

echo.
echo [2/4] Menghentikan server kontainer aplikasi...
docker compose down >nul 2>&1

echo.
echo [3/4] Membersihkan database lama (Reset to Factory Clean)...
if exist "data\konveksi-data.json" del /q /f "data\konveksi-data.json"
if exist "data\konveksi-data.json.bak" del /q /f "data\konveksi-data.json.bak"
if exist "data\konveksi-data.json.tmp" del /q /f "data\konveksi-data.json.tmp"
if exist "data\sqlite.db" del /q /f "data\sqlite.db"
echo  [OK] Database telah dikosongkan ke kondisi awal pabrik.

echo.
echo [4/4] Memulai ulang kontainer dengan database baru yang bersih...
docker compose up -d

echo.
echo Menunggu inisialisasi server (10 detik)...
timeout /t 10 /nobreak >nul

set "TARGET_PORT=3001"
if exist ".env" (
    for /f "tokens=2 delims==" %%p in ('findstr /i "^PORT=" ".env"') do set "TARGET_PORT=%%p"
)

echo ============================================================
echo   RESET FACTORY SELESAI!
echo   Sistem Konveksi siap digunakan seperti baru dipasang.
echo ============================================================
echo.

start http://localhost:%TARGET_PORT%
pause

