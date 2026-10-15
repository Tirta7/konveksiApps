#!/bin/bash
# ============================================================
#   Stop KonveksiApps Server (macOS)
#   Port: 3001 (Tidak mengganggu port 3000 milik Billiard)
# ============================================================

cd "$(dirname "$0")"

PORT="${PORT:-3001}"

echo "Menghentikan server KonveksiApps di port ${PORT}..."
OLD_PID=$(lsof -ti:${PORT} 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
    kill -9 $OLD_PID 2>/dev/null || true
    echo "Server KonveksiApps (PID: $OLD_PID) berhasil dihentikan."
else
    echo "Tidak ada server KonveksiApps yang berjalan di port ${PORT}."
fi
