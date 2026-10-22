#!/usr/bin/env bash
# ============================================================
# Backup Data Konveksi (macOS)
# ============================================================
cd "$(dirname "$0")"

DATETIME=$(date +"%Y-%m-%d_%H-%M")

echo "============================================================"
echo "  BACKUP DATA LOKAL SISTEM KONVEKSI"
echo "============================================================"
echo ""

if [ ! -d "data" ]; then
    echo "[ERROR] Folder data tidak ditemukan."
    read -p "Tekan [Enter] untuk keluar..."
    exit 1
fi

mkdir -p backups_manual
TARGET_DIR="backups_manual/backup_${DATETIME}"
mkdir -p "${TARGET_DIR}"

cp -R data/ "${TARGET_DIR}/"

echo "[OK] Seluruh data berhasil dicadangkan ke:"
echo "     ${TARGET_DIR}"
echo ""
read -p "Tekan [Enter] untuk menutup..."
