#!/bin/bash
# ============================================================
#   KONVEKSI APPS | Stop Server (macOS)
#   Port: 3001
# ============================================================

cd "$(dirname "$0")"

PORT="${PORT:-3001}"

echo ""
echo "============================================================"
echo "  Menghentikan Server KonveksiApps di port ${PORT}..."
echo "============================================================"
echo ""

OLD_PID=$(lsof -ti:${PORT} 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
    kill -9 $OLD_PID 2>/dev/null || true
    echo "  [OK] Server KonveksiApps (PID: $OLD_PID) berhasil dihentikan!"
else
    echo "  [INFO] Tidak ada server KonveksiApps yang sedang berjalan."
fi

echo ""
echo "Jendela ini akan tertutup otomatis dalam 3 detik..."
sleep 3
exit 0
