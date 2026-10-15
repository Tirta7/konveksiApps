#!/bin/bash
# ============================================================
#   KONVEKSI APPS | Double-Click Launcher (macOS)
#   Port: 3001 (Billiard aman di port 3000)
# ============================================================

# Pastikan direktori kerja berada di folder proyek saat di-double click
cd "$(dirname "$0")"

# Muat environment PATH agar node, npm, redis, brew terdeteksi di macOS Terminal
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$HOME/.local/node/bin:/usr/local/bin:$PATH"
if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc" 2>/dev/null || true
fi

PORT="${PORT:-3001}"

echo ""
echo "============================================================"
echo "  KONVEKSI APPS | Sistem Tracking Produksi Jeans"
echo "  Port: ${PORT} (Billiard aman di port 3000)"
echo "============================================================"
echo ""

# 1. Bersihkan port jika ada proses sebelumnya yang masih menggantung
echo " [1/4] Memeriksa port ${PORT}..."
OLD_PID=$(lsof -ti:${PORT} 2>/dev/null || true)
if [ -n "$OLD_PID" ]; then
    kill -9 $OLD_PID 2>/dev/null || true
    echo "       Proses lama KonveksiApps (PID: $OLD_PID) dihentikan."
else
    echo "       Port ${PORT} bersih & siap."
fi

# 2. Cek & Jalankan Redis
echo " [2/4] Memeriksa Redis Cache..."
if redis-cli ping 2>/dev/null | grep -qi "PONG"; then
    echo "       Redis aktif (port 6379)."
else
    echo "       Menjalankan Redis..."
    brew services start redis 2>/dev/null || redis-server --daemonize yes 2>/dev/null || true
    sleep 1
    if redis-cli ping 2>/dev/null | grep -qi "PONG"; then
        echo "       Redis berhasil dijalankan."
    else
        echo "       [INFO] Berjalan tanpa Redis (menggunakan penyimpanan lokal)."
    fi
fi

# 3. Cek Database
echo " [3/4] Memeriksa database..."
if [ ! -f "sqlite.db" ]; then
    echo "       Menyiapkan database awal..."
    node migrate.js
fi
echo "       Database siap."

# 4. Deteksi IP Jaringan Lokal (WiFi/LAN)
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")

echo " [4/4] Memulai Next.js Server di port ${PORT}..."
echo ""
echo "============================================================"
echo "  Akses Aplikasi:"
echo "  - Di Komputer ini : http://localhost:${PORT}"
echo "  - Dari HP / LAN   : http://${LOCAL_IP}:${PORT}"
echo ""
echo "  Browser akan terbuka otomatis dalam 2 detik..."
echo "  Untuk menghentikan server, tekan: CTRL + C"
echo "============================================================"
echo ""

# Buka browser otomatis
(sleep 2 && open "http://localhost:${PORT}") &

export REDIS_URL="redis://127.0.0.1:6379"
export PORT="${PORT}"

# Jalankan server Next.js
npm run dev
