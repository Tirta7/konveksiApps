#!/usr/bin/env bash
# ============================================================
#   SISTEM MANAJEMEN KONVEKSI - INSTALLER KLIEN BARU (macOS)
#   Klik 2x langsung dari Finder untuk instalasi otomatis Docker
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
echo -e "  Wizard Setup Klien Baru (macOS / Docker)"
echo -e "  Subdomain Terintegrasi: [namaklien].vocpos.id"
echo -e "${CYAN}============================================================${NC}"
echo ""

# 1. Cek Docker Desktop
echo -e "${BOLD}[1/4] Memeriksa status Docker Desktop...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker belum terinstall pada Mac ini!${NC}"
    echo "Silakan download dan install Docker Desktop dari: https://www.docker.com/products/docker-desktop/"
    read -p "Tekan [Enter] untuk keluar..."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${YELLOW}[WARNING] Docker Desktop belum aktif. Membuka Docker...${NC}"
    open -a Docker || true
    echo "Menunggu Docker Desktop siap..."
    attempt=0
    until docker info &> /dev/null || [ $attempt -ge 9 ]; do
        sleep 5
        attempt=$((attempt+1))
        echo "  ...menunggu Docker ($attempt/9)..."
    done
fi
echo -e "${GREEN}[OK] Docker Desktop aktif.${NC}"
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
echo -e "${GREEN}[OK] Alamat website: https://${FULL_DOMAIN}${NC}"
echo ""

echo -e "${BOLD}3. Masukkan Token Cloudflare Tunnel (Opsional):${NC}"
read -p "   Token Cloudflare: " TUNNEL_INPUT

# 3. Deteksi Machine ID
echo ""
echo -e "${BOLD}[2/4] Membaca Machine ID hardware Mac...${NC}"
UUID=$(ioreg -d2 -c IOPlatformExpertDevice | awk -F\" '/IOPlatformUUID/{print $(NF-1)}' || true)
if [ -n "$UUID" ]; then
    HEX=$(echo -n "$UUID" | tr '[:lower:]' '[:upper:]' | shasum -a 256 | awk '{print toupper($1)}')
    MACHINE_ID="MID-${HEX:0:4}-${HEX:4:4}-${HEX:8:4}"
else
    MACHINE_ID="MID-$(date +%s | cut -c6-9)-5521-9928"
fi
echo -e "${GREEN}[OK] Machine ID: ${MACHINE_ID}${NC}"

# 4. Buat folder data & .env
echo ""
echo -e "${BOLD}[3/4] Menyiapkan database dan konfigurasi...${NC}"
mkdir -p data

cat <<EOF > .env
# ============================================================
# Konfigurasi Klien: ${STORE_INPUT}
# ============================================================
PORT=3001
STORE_NAME=${STORE_INPUT}
SUBDOMAIN=${SUB_CLEAN}
APP_URL=https://${FULL_DOMAIN}

# Keamanan Sesi
AUTH_SECRET=konveksi_${SUB_CLEAN}_secret_key_2026

# Sistem Lisensi Pengunci VOC ML
VOCML_SERVER_URL=https://vocml.vocpos.id
VOCML_PRODUCT=pos
VOCML_MACHINE_ID=${MACHINE_ID}
VOCML_DISABLED=false

# Cloudflare Tunnel
TUNNEL_TOKEN=${TUNNEL_INPUT}
EOF

# 5. Jalankan Docker Compose
echo ""
echo -e "${BOLD}[4/4] Menjalankan server aplikasi konveksi...${NC}"
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
