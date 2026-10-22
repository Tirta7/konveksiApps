#!/usr/bin/env bash
# ============================================================
#   SISTEM MANAJEMEN KONVEKSI - WIZARD BUKA CABANG BARU (macOS)
#   Klik 2x langsung dari Finder untuk membuka cabang baru
#   Subdomain Terintegrasi: [namacabang].vocpos.id
# ============================================================

set -e

# Pindah ke direktori tempat script ini berada
cd "$(dirname "$0")"

# Warna Terminal
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}============================================================${NC}"
echo -e "${BOLD}  SISTEM MANAJEMEN KONVEKSI - WIZARD BUKA CABANG BARU (macOS)${NC}"
echo -e "  Subdomain Terintegrasi: [namacabang].vocpos.id"
echo -e "${CYAN}============================================================${NC}"
echo ""

# 1. Cek Apakah Docker Desktop Aktif
echo -e "${BOLD}[1/4] Memeriksa status Docker Desktop...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker belum terinstall pada Mac ini!${NC}"
    echo "Silakan unduh dan install Docker Desktop untuk Mac dari:"
    echo "  https://www.docker.com/products/docker-desktop/"
    echo ""
    read -p "Tekan [Enter] untuk keluar..."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${YELLOW}[WARNING] Docker Desktop belum aktif. Mencoba membuka Docker...${NC}"
    open -a Docker || true
    echo "Menunggu Docker Desktop siap (maksimal 45 detik)..."
    attempt=0
    until docker info &> /dev/null || [ $attempt -ge 9 ]; do
        sleep 5
        attempt=$((attempt+1))
        echo "  ...menunggu Docker siap ($attempt/9)..."
    done

    if ! docker info &> /dev/null; then
        echo -e "${RED}[ERROR] Docker Desktop belum siap. Pastikan icon paus di menu bar atas sudah aktif/running.${NC}"
        read -p "Tekan [Enter] untuk keluar..."
        exit 1
    fi
fi
echo -e "${GREEN}[OK] Docker Desktop aktif dan siap.${NC}"
echo ""

# 2. Input Subdomain Cabang
echo -e "${BOLD}1. Masukkan nama subdomain cabang yang diinginkan:${NC}"
echo "   (Contoh: ketik 'konveksibali' atau 'konveksisolo')"
read -p "   Subdomain (tanpa .vocpos.id): " SUB_INPUT

if [ -z "$SUB_INPUT" ]; then
    echo -e "${RED}[ERROR] Subdomain tidak boleh kosong!${NC}"
    read -p "Tekan [Enter] untuk keluar..."
    exit 1
fi

# Bersihkan input jika user mengetik .vocpos.id atau ada spasi
SUB_CLEAN=$(echo "$SUB_INPUT" | sed 's/\.vocpos\.id//g' | tr -d '[:space:]')
FULL_DOMAIN="${SUB_CLEAN}.vocpos.id"

echo -e "${GREEN}[OK] Domain online cabang: https://${FULL_DOMAIN}${NC}"
echo ""

# 3. Input Nama Toko / Outlet Cabang
echo -e "${BOLD}2. Masukkan Nama Resmi Cabang ini:${NC}"
echo "   (Contoh: Konveksi Cabang Bali / Garment Solo)"
read -p "   Nama Cabang: " STORE_INPUT
if [ -z "$STORE_INPUT" ]; then
    STORE_INPUT="Konveksi Cabang ${SUB_CLEAN}"
fi

# 4. Input Port Lokal
echo ""
echo -e "${BOLD}3. Masukkan Port Lokal di Mac ini:${NC}"
echo "   (Default: 3002. Cabang 1: 3001, Cabang 2: 3002, Cabang 3: 3003, dst)"
read -p "   Port lokal [3002]: " PORT_INPUT
if [ -z "$PORT_INPUT" ]; then
    PORT_INPUT="3002"
fi

# 5. Input Token Cloudflare Tunnel (Opsional)
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${BOLD}PENGATURAN AKSES ONLINE (CLOUDFLARE TUNNEL):${NC}"
echo -e "Agar https://${FULL_DOMAIN} langsung aktif tanpa buka port modem/router:"
echo "Masukkan TUNNEL_TOKEN dari Cloudflare Zero Trust (atau kosongkan jika hanya akses lokal):"
echo -e "${CYAN}============================================================${NC}"
read -p "Token Cloudflare (opsional): " TUNNEL_INPUT

# 6. Deteksi Hardware Machine ID Mac
echo ""
echo -e "${BOLD}[2/4] Membaca Machine ID hardware Mac...${NC}"
MACHINE_ID=""
if [ -f "client-sdk/get-machine-id.ps1" ]; then
    # Jika powershell tersedia di mac, atau fallback ke ioreg
    if command -v pwsh &> /dev/null; then
        MACHINE_ID=$(pwsh -NoProfile -File client-sdk/get-machine-id.ps1 2>/dev/null || true)
    fi
fi

if [ -z "$MACHINE_ID" ]; then
    UUID=$(ioreg -d2 -c IOPlatformExpertDevice | awk -F\" '/IOPlatformUUID/{print $(NF-1)}' || true)
    if [ -n "$UUID" ]; then
        HEX=$(echo -n "$UUID" | tr '[:lower:]' '[:upper:]' | shasum -a 256 | awk '{print toupper($1)}')
        MACHINE_ID="MID-${HEX:0:4}-${HEX:4:4}-${HEX:8:4}"
    else
        MACHINE_ID="MID-$(date +%s | cut -c6-9)-$(jot -r 1 1000 9999 2>/dev/null || echo 5521)-$(jot -r 1 1000 9999 2>/dev/null || echo 9928)"
    fi
fi
echo -e "${GREEN}[OK] Machine ID terdeteksi: ${MACHINE_ID}${NC}"

# 7. Buat Folder Khusus Cabang Baru
BRANCH_DIR="CABANG_${SUB_CLEAN}"
echo ""
echo -e "${BOLD}[3/4] Menyiapkan lingkungan cabang: ${BRANCH_DIR}...${NC}"
mkdir -p "${BRANCH_DIR}/data"

# 8. Buat File .env Cabang Baru
cat <<EOF > "${BRANCH_DIR}/.env"
# ============================================================
# Konfigurasi Cabang: ${STORE_INPUT}
# ============================================================
PORT=${PORT_INPUT}
STORE_NAME=${STORE_INPUT}
SUBDOMAIN=${SUB_CLEAN}
APP_URL=https://${FULL_DOMAIN}

# Kunci Sesi & Keamanan
AUTH_SECRET=konveksi_${SUB_CLEAN}_secret_session_2026

# Sistem Lisensi Pengunci VOC ML
VOCML_SERVER_URL=https://vocml.vocpos.id
VOCML_PRODUCT=pos
VOCML_MACHINE_ID=${MACHINE_ID}
VOCML_DISABLED=false

# Cloudflare Tunnel
TUNNEL_TOKEN=${TUNNEL_INPUT}
EOF

# 9. Buat docker-compose.yml Khusus Cabang
cat <<EOF > "${BRANCH_DIR}/docker-compose.yml"
services:
  app:
    image: ghcr.io/tirta7/konveksi-app:latest
    container_name: konveksi_app_${SUB_CLEAN}
    restart: unless-stopped
    ports:
      - "${PORT_INPUT}:3001"
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: "3001"
      DATA_DIR: /data
      TZ: Asia/Jakarta
      STORE_NAME: "${STORE_INPUT}"
      VOCML_MACHINE_ID: "${MACHINE_ID}"
      VOCML_SERVER_URL: "\${VOCML_SERVER_URL:-https://vocml.vocpos.id}"
      VOCML_PRODUCT: "pos"
    volumes:
      - ./data:/data
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:3001/api/auth/me"]
      interval: 20s
      timeout: 5s
      retries: 3
      start_period: 30s
EOF

# Tambahkan service cloudflared jika token diisi
if [ -n "$TUNNEL_INPUT" ]; then
cat <<EOF >> "${BRANCH_DIR}/docker-compose.yml"

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: konveksi_tunnel_${SUB_CLEAN}
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: "${TUNNEL_INPUT}"
    depends_on:
      - app
EOF
fi

# 10. Jalankan Kontainer Cabang
echo ""
echo -e "${BOLD}[4/4] Menjalankan server cabang ${STORE_INPUT}...${NC}"
(
    cd "${BRANCH_DIR}"
    docker compose pull || true
    docker compose down 2>/dev/null || true
    docker compose up -d
)

echo "Menunggu inisialisasi server (10 detik)..."
sleep 10

# 11. Selesai
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${BOLD}  CABANG BARU BERHASIL DIBUAT & BERJALAN!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "  Nama Cabang  : ${BOLD}${STORE_INPUT}${NC}"
echo -e "  Akses Lokal  : ${CYAN}http://localhost:${PORT_INPUT}${NC}"
echo -e "  Akses Online : ${CYAN}https://${FULL_DOMAIN}${NC}"
echo -e "  Machine ID   : ${YELLOW}${MACHINE_ID}${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "${BOLD}INFO AKTIVASI LISENSI:${NC}"
echo -e "1. Cabang ini SUDAH OTOMATIS TERDAFTAR ke server lisensi pusat."
echo -e "2. Hubungi administrator / penyedia software Anda untuk aktivasi lisensi."
echo -e "3. Begitu disetujui, cabang ini otomatis terbuka dalam 5 detik!"
echo ""

# Buka browser
if [ -n "$TUNNEL_INPUT" ]; then
    open "https://${FULL_DOMAIN}" || true
fi
open "http://localhost:${PORT_INPUT}" || true

echo "Selesai. Anda dapat menutup jendela terminal ini."
read -p "Tekan [Enter] untuk keluar..."
