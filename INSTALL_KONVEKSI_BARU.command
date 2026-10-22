#!/usr/bin/env bash
# ============================================================
#   SISTEM MANAJEMEN KONVEKSI - INSTALLER KLIEN BARU (macOS)
#   Klik 2x langsung dari Finder untuk instalasi / persiapan konfigurasi
#   Subdomain Terintegrasi: [namaklien].vocpos.id
# ============================================================

set -e
cd "$(dirname "$0")"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${CYAN}============================================================${NC}"
echo -e "${BOLD}  SISTEM MANAJEMEN PRODUKSI KONVEKSI (GARMENT ERP)${NC}"
echo -e "  Wizard Setup Klien Baru"
echo -e "  Subdomain Terintegrasi: [namaklien].vocpos.id"
echo -e "${CYAN}============================================================${NC}"
echo ""

# 1. Cek Docker Desktop (Opsional)
echo -e "${BOLD}[1/4] Memeriksa status lingkungan...${NC}"
DOCKER_AVAILABLE=false
if command -v docker &> /dev/null && docker info &> /dev/null; then
    DOCKER_AVAILABLE=true
    echo -e "${GREEN}[OK] Docker Desktop aktif di Mac ini.${NC}"
else
    echo -e "${YELLOW}[INFO] Docker Desktop tidak terdeteksi aktif di Mac ini.${NC}"
    echo -e "${CYAN}Mode Pembuat Konfigurasi Aktif:${NC}"
    echo "  Anda tetap dapat mengatur nama toko, subdomain, dan token tanpa perlu Docker di Mac ini."
fi
echo ""

# 2. Input Klien
echo -e "${BOLD}1. Masukkan Nama Usaha / Pabrik Konveksi Klien:${NC}"
echo "   (Contoh: Rani Jeans Bali / CV Sumber Rejeki / Konveksi Mandiri)"
read -p "   Nama Usaha: " STORE_INPUT
if [ -z "$STORE_INPUT" ]; then
    STORE_INPUT="Konveksi Baru"
fi

echo ""
echo -e "${BOLD}2. Masukkan Subdomain untuk akses online di vocpos.id:${NC}"
echo "   (Contoh: ketik 'ranijeans' -> menjadi 'https://ranijeans.vocpos.id')"
read -p "   Subdomain: " SUB_INPUT

if [ -z "$SUB_INPUT" ]; then
    echo -e "${RED}[ERROR] Subdomain tidak boleh kosong!${NC}"
    read -p "Tekan [Enter] untuk keluar..."
    exit 1
fi

SUB_CLEAN=$(echo "$SUB_INPUT" | sed 's/\.vocpos\.id//g' | tr -d '[:space:]')
FULL_DOMAIN="${SUB_CLEAN}.vocpos.id"

echo -e "${GREEN}[OK] Domain online yang akan aktif: https://${FULL_DOMAIN}${NC}"
echo ""

# 3. Pengaturan Akses Online (Cloudflare Tunnel Otomatis)
echo -e "${CYAN}============================================================${NC}"
echo -e "${BOLD}PENGATURAN AKSES ONLINE (CLOUDFLARE TUNNEL OTOMATIS):${NC}"
echo -e "${CYAN}============================================================${NC}"

TUNNEL_INPUT=""

if command -v cloudflared &> /dev/null && [ -f "$HOME/.cloudflared/cert.pem" ]; then
    echo -e "${GREEN}[OK] Cloudflare CLI terhubung ke akun Anda!${NC}"
    echo -e "Membuat Tunnel & DNS https://${FULL_DOMAIN} secara otomatis..."
    cloudflared tunnel create "konveksi-${SUB_CLEAN}" >/dev/null 2>&1 || true
    cloudflared tunnel route dns "konveksi-${SUB_CLEAN}" "${FULL_DOMAIN}" >/dev/null 2>&1 || true
    TUNNEL_INPUT=$(cloudflared tunnel token "konveksi-${SUB_CLEAN}" 2>/dev/null || true)
    if [ -n "$TUNNEL_INPUT" ]; then
        echo -e "${GREEN}[OK] Subdomain https://${FULL_DOMAIN} & Token Tunnel berhasil dibuat otomatis!${NC}"
    fi
elif command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}[INFO] Cloudflare CLI terpasang, tetapi belum login ke domain vocpos.id.${NC}"
    echo "Apakah Anda ingin menghubungkan akun Cloudflare sekarang agar pembuatan subdomain otomatis?"
    read -p "Hubungkan sekarang? (y/t) [y]: " DO_LOGIN
    DO_LOGIN=${DO_LOGIN:-y}
    if [[ "$DO_LOGIN" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Membuka browser... Silakan pilih domain 'vocpos.id' dan klik 'Authorize'."
        cloudflared tunnel login
        if [ -f "$HOME/.cloudflared/cert.pem" ]; then
            echo -e "${GREEN}[OK] Berhasil terhubung! Membuat Tunnel & DNS otomatis...${NC}"
            cloudflared tunnel create "konveksi-${SUB_CLEAN}" >/dev/null 2>&1 || true
            cloudflared tunnel route dns "konveksi-${SUB_CLEAN}" "${FULL_DOMAIN}" >/dev/null 2>&1 || true
            TUNNEL_INPUT=$(cloudflared tunnel token "konveksi-${SUB_CLEAN}" 2>/dev/null || true)
        fi
    fi
fi

if [ -z "$TUNNEL_INPUT" ]; then
    echo "Masukkan TUNNEL_TOKEN manual dari Cloudflare Zero Trust (atau tekan Enter untuk lewati):"
    read -p "Token Cloudflare (opsional): " TUNNEL_INPUT
fi

# 4. Deteksi Hardware Machine ID Mac
echo ""
echo -e "${BOLD}[2/4] Menyiapkan Machine ID...${NC}"
MACHINE_ID=""
UUID=$(ioreg -d2 -c IOPlatformExpertDevice | awk -F\" '/IOPlatformUUID/{print $(NF-1)}' || true)
if [ -n "$UUID" ]; then
    HEX=$(echo -n "$UUID" | tr '[:lower:]' '[:upper:]' | shasum -a 256 | awk '{print toupper($1)}')
    MACHINE_ID="MID-${HEX:0:4}-${HEX:4:4}-${HEX:8:4}"
else
    RAND_HEX=$(date +%s%N | shasum -a 256 | awk '{print toupper($1)}')
    MACHINE_ID="MID-${RAND_HEX:0:4}-${RAND_HEX:4:4}-${RAND_HEX:8:4}"
fi
echo -e "${GREEN}[OK] Machine ID terdaftar: ${MACHINE_ID}${NC}"

# Buat direktori data bila belum ada
mkdir -p data

# 5. Tulis .env
echo ""
echo -e "${BOLD}[3/4] Menulis file konfigurasi .env...${NC}"
cat <<EOF > .env
# ============================================================
# KONFIGURASI SISTEM APLIKASI KONVEKSI
# ============================================================
PORT=3001
STORE_NAME=${STORE_INPUT}
SUBDOMAIN=${SUB_CLEAN}
APP_URL=https://${FULL_DOMAIN}

# Kunci Sesi & Keamanan
AUTH_SECRET=konveksi_${SUB_CLEAN}_secret_session_2026

# Sistem Lisensi Pengunci
VOCML_SERVER_URL=https://vocml.vocpos.id
VOCML_PRODUCT=pos
VOCML_MACHINE_ID=${MACHINE_ID}
VOCML_DISABLED=false

# Cloudflare Tunnel
TUNNEL_TOKEN=${TUNNEL_INPUT}
EOF

# 6. Selesai / Jalankan Docker
if [ "$DOCKER_AVAILABLE" = false ]; then
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${BOLD}  KONFIGURASI KLIEN BERHASIL DISIAPKAN!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo -e "  Nama Klien   : ${BOLD}${STORE_INPUT}${NC}"
    echo -e "  Domain Web   : ${CYAN}https://${FULL_DOMAIN}${NC}"
    echo -e "  Machine ID   : ${YELLOW}${MACHINE_ID}${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo -e "${BOLD}PETUNJUK DISTRIBUSI KE KLIEN WINDOWS:${NC}"
    echo "1. Salin seluruh folder ini (atau jadikan ZIP) ke komputer Windows klien."
    echo "2. Pastikan Docker Desktop sudah terpasang di komputer Windows klien."
    echo "3. Klien cukup mengklik 2x: START_CABANG.bat / BUKA_APLIKASI.bat."
    echo ""
    read -p "Tekan [Enter] untuk selesai..."
    exit 0
fi

echo ""
echo -e "${BOLD}[4/4] Menjalankan server aplikasi konveksi di Mac...${NC}"
docker compose pull || true
docker compose down 2>/dev/null || true
docker compose up -d

echo "Menunggu server siap (10 detik)..."
sleep 10

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${BOLD}  INSTALASI APLIKASI KONVEKSI BERHASIL!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "  Nama Klien   : ${BOLD}${STORE_INPUT}${NC}"
echo -e "  Akses Lokal  : ${CYAN}http://localhost:3001${NC}"
echo -e "  Akses Online : ${CYAN}https://${FULL_DOMAIN}${NC}"
echo -e "  Machine ID   : ${YELLOW}${MACHINE_ID}${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${BOLD}PETUNJUK AKTIVASI LISENSI:${NC}"
echo "1. Komputer ini SUDAH OTOMATIS TERDAFTAR ke Server Pusat."
echo "2. Hubungi Admin / Penyedia Sistem untuk persetujuan aktivasi '${STORE_INPUT}'."
echo "3. Begitu lisensi disetujui dari pusat, aplikasi otomatis terbuka dalam 5 detik!"
echo ""

if [ -n "$TUNNEL_INPUT" ]; then
    open "https://${FULL_DOMAIN}" || true
fi
open "http://localhost:3001" || true

read -p "Tekan [Enter] untuk selesai..."
