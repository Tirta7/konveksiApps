#!/usr/bin/env bash
# ============================================================
# Hentikan Sistem Konveksi (macOS)
# ============================================================
cd "$(dirname "$0")"

echo "Menghentikan kontainer aplikasi konveksi..."
docker compose down

echo ""
echo "============================================================"
echo "  Aplikasi Konveksi berhasil dimatikan secara aman."
echo "============================================================"
echo ""
read -p "Tekan [Enter] untuk menutup..."
