#!/bin/bash
# ============================================================
#   KONVEKSI APPS | Launcher MODE PRODUKSI (banyak client)
#   Lebih cepat & ringan dibanding mode dev (start.command).
#   Port: 3001
# ============================================================

cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$HOME/.local/node/bin:/usr/local/bin:$PATH"
if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc" 2>/dev/null || true
fi

PORT="${PORT:-3001}"

echo ""
echo "============================================================"
echo "  KONVEKSI APPS | MODE PRODUKSI"
echo "============================================================"

# 1. Hentikan server lama (dev/prod) secara halus agar data sempat tersimpan
echo " [1/4] Memeriksa port ${PORT}..."
OLD_PID=$(lsof -ti:${PORT} 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
    kill $OLD_PID 2>/dev/null || true
    sleep 2
    kill -9 $OLD_PID 2>/dev/null || true
    echo "       Server lama dihentikan."
fi

# 2. Redis (opsional)
echo " [2/4] Memeriksa Redis..."
if ! redis-cli ping 2>/dev/null | grep -qi "PONG"; then
    brew services start redis 2>/dev/null || redis-server --daemonize yes 2>/dev/null || true
    sleep 1
fi

# 3. Build produksi
echo " [3/4] Build aplikasi (sekali, ±1-2 menit)..."
npm run build || { echo "Build gagal. Gunakan start.command (mode dev)."; read -n 1; exit 1; }

LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")
echo " [4/4] Menjalankan server produksi..."
echo "  - Komputer ini : http://localhost:${PORT}"
echo "  - HP / LAN     : http://${LOCAL_IP}:${PORT}"
echo "  Hentikan: CTRL + C"
(sleep 3 && open "http://localhost:${PORT}") &

export REDIS_URL="redis://127.0.0.1:6379"
export PORT="${PORT}"
npm run start
