@echo off
title Hard Restart - KonveksiApps
color 0A

echo ============================================
echo    HARD RESTART - KonveksiApps
echo ============================================
echo.

echo [1/4] Menghentikan semua proses Node.js...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul
echo        OK - Semua proses Node dihentikan
echo.

echo [2/4] Mengosongkan database (konveksi-data.json)...
node -e "const fs=require('fs');const empty={vendors:[],tukang_potong:[],pemotongan_kain:[],data_kain:[],hutang:[],batches:[],bundles:[],spk:[],spk_progres:[],gaji_cmt:[],tracking_logs:[],stock:[],stock_movements:[],purchase_orders:[],retail_sales:[],retur_produksi:[],retur_online:[],kategori_produk:[],data_barang:[],data_supplier:[],po_produksi:[],po_pengambilan:[],barcode_item:[],cmt_requests:[],cmt_progres:[],vendor_types:[],produksi_transfers:[],po_ledgers:[],_counters:{}};fs.writeFileSync('konveksi-data.json',JSON.stringify(empty,null,2));console.log('Database kosong!');"
echo        OK - Database berhasil dikosongkan
echo.

echo [3/4] Membersihkan cache Next.js...
if exist ".next" (
    rmdir /s /q ".next" >nul 2>&1
    echo        OK - Cache Next.js dihapus
) else (
    echo        INFO - Tidak ada cache untuk dihapus
)
echo.

echo [4/4] Menjalankan server Next.js...
echo.
echo ============================================
echo    Server berjalan di http://localhost:3000
echo    Jaringan: http://192.168.1.19:3000
echo ============================================
echo.
npm run dev
