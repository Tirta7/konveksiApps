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

# 1. Cek Status Docker Desktop (Opsional - Tidak Wajib jika hanya membuat file installer)
echo -e "${BOLD}[1/4] Memeriksa status lingkungan...${NC}"
DOCKER_AVAILABLE=false

if command -v docker &> /dev/null && docker info &> /dev/null; then
    DOCKER_AVAILABLE=true
    echo -e "${GREEN}[OK] Docker Desktop aktif di Mac ini.${NC}"
else
    echo -e "${YELLOW}[INFO] Docker tidak terdeteksi aktif di Mac ini.${NC}"
    echo -e "${CYAN}Mode Pembuat Installer Aktif:${NC}"
    echo "  Anda tetap dapat membuat seluruh file cabang baru (.env, docker-compose, dan script Windows .bat)"
    echo "  tanpa perlu menginstall Docker di Mac ini."
fi
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
echo -e "${BOLD}3. Masukkan Port Lokal Cabang ini:${NC}"
echo "   (Default: 3002. Cabang 1: 3001, Cabang 2: 3002, Cabang 3: 3003, dst)"
read -p "   Port lokal [3002]: " PORT_INPUT
if [ -z "$PORT_INPUT" ]; then
    PORT_INPUT="3002"
fi

# 5. Pengaturan Akses Online (Cloudflare Tunnel Otomatis via cloudflared CLI)
echo ""
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
        echo -e "${GREEN}[OK] Subdomain https://${FULL_DOMAIN} & Token Tunnel berhasil dibuat 100% otomatis!${NC}"
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
            if [ -n "$TUNNEL_INPUT" ]; then
                echo -e "${GREEN}[OK] Subdomain https://${FULL_DOMAIN} & Token Tunnel aktif otomatis!${NC}"
            fi
        fi
    fi
fi

if [ -z "$TUNNEL_INPUT" ]; then
    echo "Masukkan TUNNEL_TOKEN manual dari Cloudflare Zero Trust (atau tekan Enter untuk lewati):"
    read -p "Token Cloudflare (opsional): " TUNNEL_INPUT
fi

# 6. Deteksi Hardware Machine ID (Fallback cerdas jika di Mac)
echo ""
echo -e "${BOLD}[2/4] Menyiapkan identitas Machine ID...${NC}"
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

# Sistem Lisensi Pengunci
VOCML_SERVER_URL=https://vocml.vocpos.id
VOCML_PRODUCT=pos
VOCML_MACHINE_ID=
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
      VOCML_MACHINE_ID: "\${VOCML_MACHINE_ID:-}"
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
    command: tunnel --no-autoupdate run --url http://app:3001
    environment:
      TUNNEL_TOKEN: "${TUNNEL_INPUT}"
    depends_on:
      - app
EOF
fi

# 10. Buat Script Kontrol di dalam folder cabang (Mendukung macOS & Windows)
# --- Script macOS (.command) ---
cat <<EOF > "${BRANCH_DIR}/START_CABANG.command"
#!/usr/bin/env bash
cd "\$(dirname "\$0")"
docker compose pull || true
docker compose up -d
sleep 3
open "http://localhost:${PORT_INPUT}"
EOF
chmod +x "${BRANCH_DIR}/START_CABANG.command"

cat <<EOF > "${BRANCH_DIR}/STOP_CABANG.command"
#!/usr/bin/env bash
cd "\$(dirname "\$0")"
docker compose down
echo "Cabang ${STORE_INPUT} telah dimatikan."
read -p "Tekan [Enter] untuk keluar..."
EOF
chmod +x "${BRANCH_DIR}/STOP_CABANG.command"

cat <<EOF > "${BRANCH_DIR}/BUKA_APLIKASI.command"
#!/usr/bin/env bash
EOF
if [ -n "$TUNNEL_INPUT" ]; then
    echo "open \"https://${FULL_DOMAIN}\"" >> "${BRANCH_DIR}/BUKA_APLIKASI.command"
else
    echo "open \"http://localhost:${PORT_INPUT}\"" >> "${BRANCH_DIR}/BUKA_APLIKASI.command"
fi
chmod +x "${BRANCH_DIR}/BUKA_APLIKASI.command"

# --- Script Windows (.bat) agar folder cabang ini bisa langsung dipakai di Windows ---
cat <<'EOF_BAT' > "${BRANCH_DIR}/START_CABANG.bat"
@echo off
setlocal enabledelayedexpansion
title Menjalankan Cabang
color 0A
cls

:: 1. Self-Elevation Admin jika diperlukan
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Meminta hak Administrator - klik YES pada popup UAC & powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

cd /d "%~dp0"

echo ============================================================
echo   SISTEM MANAJEMEN KONVEKSI - MEMULAI APLIKASI
echo ============================================================
echo.

:: 2. Cek Apakah Docker Terinstall
echo [1/4] Memeriksa status Docker Desktop...
docker --version >nul 2>&1
if not errorlevel 1 goto DOCKER_FOUND

echo.
echo  ============================================================
echo   [!] DOCKER DESKTOP BELUM TERPASANG DI KOMPUTER INI
echo   Memulai instalasi otomatis Docker Desktop...
echo   Proses ini membutuhkan waktu sekitar 5 - 15 menit.
echo  ============================================================
echo.

where winget >nul 2>&1
if not errorlevel 1 (
    echo  [..] Menginstall Docker via Windows Package Manager - winget...
    winget install -e --id Docker.DockerDesktop --exact --source winget --silent --accept-package-agreements --accept-source-agreements
    if !errorlevel! equ 0 goto DOCKER_INSTALLED
    echo  [!] winget gagal, mencoba download langsung...
)

echo  [..] Mengunduh Docker Desktop Installer resmi...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -UserAgent 'Mozilla/5.0' -Uri 'https://desktop.docker.com/win/main/amd64/Docker%%20Desktop%%20Installer.exe' -OutFile '%TEMP%\DockerInstaller.exe'"

if not exist "%TEMP%\DockerInstaller.exe" (
    echo.
    echo  [ERROR] Gagal mengunduh Docker Desktop. Periksa koneksi internet Anda.
    pause
    exit /b 1
)

echo  [..] Memasang Docker Desktop (Silent Install)...
start /wait "" "%TEMP%\DockerInstaller.exe" install --quiet --accept-license --backend=wsl-2
del /q "%TEMP%\DockerInstaller.exe" >nul 2>&1

:DOCKER_INSTALLED
echo.
echo  ============================================================
echo   [BERHASIL] DOCKER DESKTOP TELAH DIINSTALL!
echo   ----------------------------------------------------------
echo   Komputer WAJIB di-RESTART sekarang agar WSL2 aktif.
echo   Setelah restart, silakan klik kembali file START_CABANG.bat!
echo  ============================================================
echo.
pause
exit /b 0

:DOCKER_FOUND
echo  [OK] Docker Desktop terpasang.

:: 3. Memastikan Docker Engine Berjalan
echo  [..] Memeriksa apakah Docker Engine aktif...
docker info >nul 2>&1
if not errorlevel 1 goto DOCKER_READY

echo  [!] Docker belum aktif. Membuka Docker Desktop otomatis...
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" >nul 2>&1
) else (
    start "" "Docker Desktop" >nul 2>&1
)

echo  Menunggu Docker Engine aktif (maksimal 90 detik)...
set /a attempt=0
:WAIT_DOCKER
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if %errorlevel% equ 0 goto DOCKER_READY
set /a attempt+=1
if !attempt! lss 18 (
    echo   ...menunggu Docker siap - !attempt!/18...
    goto WAIT_DOCKER
)
echo.
echo  [ERROR] Docker Desktop belum aktif. Buka Docker Desktop secara manual
echo  hingga status 'Engine Running', lalu klik kembali file ini.
pause
exit /b 1

:DOCKER_READY
echo  [OK] Docker Engine aktif dan siap.

:: 4. Deteksi Hardware Machine ID
echo.
echo [2/4] Menyesuaikan Machine ID hardware komputer...
if exist "get-machine-id.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File get-machine-id.ps1 -EnvFile ".env" >nul 2>&1
)

:: 5. Login GHCR jika ada token
echo.
echo [3/4] Memeriksa kredensial update...
if exist ".token" (
    for /f "usebackq tokens=1,* delims==" %%a in (".token") do (
        if /i "%%a"=="GITHUB_USERNAME" set "GH_USER=%%b"
        if /i "%%a"=="GITHUB_TOKEN"    set "GH_PAT=%%b"
    )
    if defined GH_PAT (
        echo !GH_PAT! | docker login ghcr.io -u !GH_USER! --password-stdin >nul 2>&1
    )
)

:: 6. Jalankan Layanan
echo.
echo [4/4] Menjalankan server aplikasi...
docker compose pull
docker compose up -d

echo Menunggu inisialisasi server (5 detik)...
timeout /t 5 /nobreak >nul
EOF_BAT

cat <<EOF >> "${BRANCH_DIR}/START_CABANG.bat"
start http://localhost:${PORT_INPUT}
EOF

cat <<'EOF_UPDATE' > "${BRANCH_DIR}/UPDATE_CABANG.bat"
@echo off
setlocal enabledelayedexpansion
title Update Versi Terbaru Cabang
color 0E
cls

:: Self-Elevation Admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Meminta hak Administrator - klik YES pada popup UAC & powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

cd /d "%~dp0"
echo ============================================================
echo   UPDATE APLIKASI KONVEKSI KE VERSI TERBARU
echo ============================================================
echo.

:: Cek Docker
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Membuka Docker Desktop...
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    timeout /t 15 /nobreak >nul
)

:: Login jika ada token
if exist ".token" (
    for /f "usebackq tokens=1,* delims==" %%a in (".token") do (
        if /i "%%a"=="GITHUB_USERNAME" set "GH_USER=%%b"
        if /i "%%a"=="GITHUB_TOKEN"    set "GH_PAT=%%b"
    )
    if defined GH_PAT echo !GH_PAT! | docker login ghcr.io -u !GH_USER! --password-stdin >nul 2>&1
)

echo [1/2] Mengunduh pembaruan dari cloud server...
docker compose pull

echo.
echo [2/2] Merestart aplikasi dengan versi baru...
docker compose up -d --remove-orphans

echo.
echo [OK] Update selesai! Membuka aplikasi...
timeout /t 5 /nobreak >nul
EOF_UPDATE

cat <<EOF >> "${BRANCH_DIR}/UPDATE_CABANG.bat"
start http://localhost:${PORT_INPUT}
EOF

cat <<EOF > "${BRANCH_DIR}/STOP_CABANG.bat"
@echo off
title Hentikan Cabang ${STORE_INPUT}
cd /d "%~dp0"
docker compose down
echo Cabang ${STORE_INPUT} telah dihentikan.
pause
EOF

cat <<EOF > "${BRANCH_DIR}/BUKA_APLIKASI.bat"
@echo off
EOF
if [ -n "$TUNNEL_INPUT" ]; then
    echo "start https://${FULL_DOMAIN}" >> "${BRANCH_DIR}/BUKA_APLIKASI.bat"
else
    echo "start http://localhost:${PORT_INPUT}" >> "${BRANCH_DIR}/BUKA_APLIKASI.bat"
fi

if [ -f "get-machine-id.ps1" ]; then
    cp "get-machine-id.ps1" "${BRANCH_DIR}/" 2>/dev/null || true
fi
if [ -f "INSTALLER_CLIENT/.token.example" ]; then
    cp "INSTALLER_CLIENT/.token.example" "${BRANCH_DIR}/" 2>/dev/null || true
fi

# Windows wajib memakai akhir baris CRLF agar label/goto di file .bat berfungsi
for f in "${BRANCH_DIR}"/*.bat; do
    perl -pi -e 's/\r?\n/\r\n/' "$f" 2>/dev/null || true
done

# 11. Cek Eksekusi Kontainer
if [ "$DOCKER_AVAILABLE" = false ]; then
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${BOLD}  FOLDER CABANG BERHASIL DIBUAT! (SIAP UNTUK CLIENT WINDOWS)${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo -e "  Nama Cabang       : ${BOLD}${STORE_INPUT}${NC}"
    echo -e "  Folder Siap Kirim : ${CYAN}${BRANCH_DIR}/${NC}"
    echo -e "  Port Lokal        : ${BOLD}${PORT_INPUT}${NC}"
    echo -e "  Domain Online     : ${CYAN}https://${FULL_DOMAIN}${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo -e "${BOLD}PETUNJUK DISTRIBUSI KE KLIEN WINDOWS:${NC}"
    echo -e "1. Salin atau Zip folder '${BOLD}${BRANCH_DIR}${NC}' ini ke komputer Windows klien."
    echo "2. Pastikan Docker Desktop sudah terpasang dan aktif di komputer Windows klien."
    echo -e "3. Klien cukup mengklik 2x file: ${CYAN}START_CABANG.bat${NC}"
    echo ""
    read -p "Tekan [Enter] untuk selesai..."
    exit 0
fi

# Jika Docker tersedia di Mac, tawarkan opsi menjalankan lokal
echo ""
echo -e "${YELLOW}Folder cabang '${BRANCH_DIR}' berhasil disiapkan.${NC}"
read -p "Apakah Anda ingin langsung menjalankan kontainer cabang ini di Mac sekarang? (y/t) [y]: " START_NOW
START_NOW=${START_NOW:-y}

if [[ "$START_NOW" =~ ^[TtNn]$ ]]; then
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${BOLD}  FOLDER CABANG BERHASIL DISIAPKAN!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo -e "  Folder Siap Pakai : ${CYAN}${BRANCH_DIR}/${NC}"
    echo -e "  Untuk Windows     : Kirim folder ini ke komputer Windows klien (klik START_CABANG.bat)."
    echo -e "  Untuk Mac         : Jalankan START_CABANG.command jika ingin dibuka nanti."
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    read -p "Tekan [Enter] untuk selesai..."
    exit 0
fi

# 12. Jalankan Kontainer Cabang di Mac
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

# 13. Selesai
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
