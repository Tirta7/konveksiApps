#!/usr/bin/env bash
# ============================================================
# Pembaruan Fitur Sistem Konveksi (macOS)
# ============================================================
cd "$(dirname "$0")"

echo "============================================================"
echo "  PEMBARUAN FITUR SISTEM KONVEKSI"
echo "============================================================"
echo ""

if [ -f ".token" ]; then
    GH_USER=$(grep -i '^GITHUB_USERNAME=' .token | cut -d '=' -f2- | tr -d '\r')
    GH_PAT=$(grep -i '^GITHUB_TOKEN=' .token | cut -d '=' -f2- | tr -d '\r')
    if [ -n "$GH_PAT" ]; then
        echo "$GH_PAT" | docker login ghcr.io -u "$GH_USER" --password-stdin >/dev/null 2>&1 || true
    fi
fi

echo "[1/3] Mengambil pembaruan sistem dari cloud server..."
docker compose pull

echo ""
echo "[2/3] Memperbarui dan merestart kontainer aplikasi..."
docker compose up -d

echo ""
echo "[3/3] Selesai! Server berjalan dengan versi terbaru."
sleep 3
open "http://localhost:3001" || true

echo "Jendela ini dapat ditutup."
read -p "Tekan [Enter] untuk keluar..."
