#!/bin/bash
# ============================================================
#   KONVEKSI APPS | Sistem Tracking Produksi Jeans (macOS)
#   Port: 3001 (Aman, tidak bentrok dengan Billiard di port 3000)
# ============================================================

set -e

# Change directory to script folder
cd "$(dirname "$0")"

PORT="${PORT:-3001}"

echo ""
echo "============================================================"
echo "  KONVEKSI APPS | Sistem Tracking Produksi Jeans"
echo "  Port: ${PORT} (Billiard aman di port 3000)"
echo "============================================================"
echo ""

# Step 1: Free up port 3001 if already in use
echo " [1/4] Memeriksa proses di port ${PORT}..."
OLD_PID=$(lsof -ti:${PORT} 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
    kill -9 $OLD_PID 2>/dev/null || true
    echo "       Proses lama KonveksiApps (PID: $OLD_PID) dihentikan."
else
    echo "       Port ${PORT} bersih & siap."
fi

# Step 2: Check & start Redis
echo " [2/4] Memeriksa Redis Cache Server..."
if redis-cli ping 2>/dev/null | grep -qi "PONG"; then
    echo "       Redis aktif (port 6379)."
else
    echo "       Memulai Redis..."
    brew services start redis 2>/dev/null || redis-server --daemonize yes 2>/dev/null || true
    sleep 1
    if redis-cli ping 2>/dev/null | grep -qi "PONG"; then
        echo "       Redis berhasil dijalankan."
    else
        echo "       [WARN] Redis tidak aktif, mode fallback disk aktif."
    fi
fi

# Step 3: Check database
echo " [3/4] Memeriksa database..."
if [ ! -f "sqlite.db" ]; then
    echo "       Menjalankan migrasi database..."
    node migrate.js
fi
echo "       Database siap."

# Step 4: Detect Local IP & Launch
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")

echo " [4/4] Memulai Next.js Server di port ${PORT}..."
echo ""
echo "============================================================"
echo "  Akses Aplikasi:"
echo "  - Komputer ini  : http://localhost:${PORT}"
echo "  - Jaringan LAN  : http://${LOCAL_IP}:${PORT}"
echo "  - Redis Cache   : redis://127.0.0.1:6379"
echo ""
echo "  Catatan: Port 3000 tetap bebas untuk aplikasi Billiard Anda!"
echo "  Tekan CTRL+C untuk menghentikan server"
echo "============================================================"
echo ""

# Auto open browser in background after 2 seconds
(sleep 2 && open "http://localhost:${PORT}") &

export REDIS_URL="redis://127.0.0.1:6379"
export PORT="${PORT}"
exec npm run dev
