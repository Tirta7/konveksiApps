# Panduan Deployment: Konveksi Apps via Docker & Cloudflare Tunnel

Panduan ini untuk menjalankan aplikasi pada **komputer / server kantor** dan dapat diakses dari mana saja secara online lewat domain **`vr.vocpos.id`** menggunakan **Cloudflare Tunnel (cloudflared)** tanpa perlu membuka port router (NAT/Port Forwarding) dan tanpa perlu IP Publik Statis.

---

## 1. Persiapan Komputer / Server Kantor

Pastikan pada komputer/server sudah terpasang:
1. **Docker Desktop** (atau Docker Engine + Docker Compose di Linux):
   - Cek dengan menjalankan perintah di terminal:
     ```bash
     docker --version
     docker compose version
     ```
2. Koneksi internet kantor aktif.

---

## 2. Pengaturan Cloudflare Tunnel (vr.vocpos.id)

1. Buka dashboard Cloudflare: [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Buka menu **Zero Trust** (di bilah kiri).
3. Masuk ke **Networks** → **Tunnels**.
4. Klik **Create a Tunnel** (atau *Add a tunnel*):
   - Beri nama tunnel, misalnya: `konveksi-kantor`.
   - Klik **Save Tunnel**.
5. Pada pilihan *Choose your environment*, pilih **Docker**.
6. Cloudflare akan menampilkan perintah yang berisi token panjang:
   `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token EY...`
   **Salin token tersebut** (teks setelah `--token`). Token ini akan dimasukkan ke file `.env` sebagai `TUNNEL_TOKEN`.
7. Masuk ke tab **Public Hostname** pada tunnel tersebut:
   - Klik **Add a public hostname**.
   - Subdomain: `vr`
   - Domain: `vocpos.id`
   - Type: `HTTP`
   - URL: `app:3001` *(karena container cloudflared dan app berada di jaringan docker yang sama)*
   - Di bagian *Additional application settings* → *HTTP Settings*, pastikan opsi WebSocket aktif.
   - Klik **Save hostname**.

---

## 3. Konfigurasi File Lingkungan (.env)

Di dalam folder proyek:
1. Salin template `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
2. Buka `.env` dan isi variabelnya:
   ```env
   # Alamat domain publik
   APP_URL=https://vr.vocpos.id

   # Buat kunci acak (minimal 32 karakter)
   # Contoh perintah buat di Mac/Linux: openssl rand -hex 32
   AUTH_SECRET=isi_dengan_string_acak_panjang_minimal_32_karakter

   # Token Cloudflare Tunnel yang didapat dari langkah 2
   TUNNEL_TOKEN=eyJh...token_cloudflare_anda...

   # ── Kredensial TikTok Shop / Tokopedia ──
   TIKTOK_APP_KEY=isi_app_key_dari_partner_center
   TIKTOK_APP_SECRET=isi_app_secret
   TIKTOK_SERVICE_ID=isi_service_id

   # ── Kredensial Shopee Open Platform ──
   SHOPEE_PARTNER_ID=isi_partner_id
   SHOPEE_PARTNER_KEY=isi_partner_key
   # Isi true jika masih uji coba di Sandbox, kosongkan jika Live
   SHOPEE_SANDBOX=
   ```

> [!CAUTION]
> **JANGAN PERNAH** membagikan atau mengunggah (commit) file `.env` ke GitHub atau chat publik.

---

## 4. Menyiapkan Data Aplikasi

Agar database JSON, sesi, dan backup otomatis tersimpan di komputer lokal dan tidak hilang saat container diperbarui:
1. Buat folder `data`:
   ```bash
   mkdir -p data
   ```
2. Salin data produksi Anda ke folder tersebut:
   ```bash
   cp konveksi-data.json data/konveksi-data.json
   ```

---

## 5. Menjalankan Aplikasi via Docker

Jalankan perintah berikut di terminal folder aplikasi:

```bash
docker compose up -d --build
```

Container akan otomatis:
1. Membangun image Next.js produksi dan mengaktifkan custom server WebSocket di port 3001.
2. Menghubungkan tunnel Cloudflare secara otomatis ke `vr.vocpos.id`.
3. Menjalankan backup harian otomatis di `./data/backups/`.

Untuk melihat status atau log aplikasi:
```bash
docker compose logs -f app
```

Untuk menghentikan:
```bash
docker compose down
```

---

## 6. Login Pertama Kali (Setup Akun Owner)

1. Buka browser dan akses: **`https://vr.vocpos.id`** (atau `http://localhost:3001` dari komputer server).
2. Sistem akan mendeteksi belum adanya akun dan langsung menampilkan layar **"Setup Akun Owner Pertama"**.
3. Buat Nama Lengkap, Username, dan Password Owner Anda.
4. Setelah masuk, Anda dapat mengelola akun staf (role Admin/Gudang) di menu **Pengaturan → Pengguna & Hak Akses**.

---

## 7. Menghubungkan Toko Marketplace

### A. TikTok Shop & Tokopedia
1. Daftar di [TikTok Shop Partner Center](https://partner.tiktokshop.com/).
2. Buat aplikasi jenis **Seller In-House Service**.
3. Masukkan URL berikut:
   - **Redirect URL**: `https://vr.vocpos.id/api/marketplace/tiktok/callback`
   - **Webhook URL**: `https://vr.vocpos.id/api/marketplace/tiktok/webhook`
4. Masukkan `App Key`, `App Secret`, dan `Service ID` ke file `.env`.
5. Buka menu **Pengaturan → Integrasi Marketplace Langsung**, klik tombol **"Hubungkan Toko TikTok / Tokopedia"**.

### B. Shopee
1. Daftar di [Shopee Open Platform](https://open.shopee.com/).
2. Buat App jenis **Seller In House System**.
3. Masukkan URL berikut:
   - **Redirect URL**: `https://vr.vocpos.id/api/marketplace/shopee/callback`
   - **Push URL (Webhook)**: `https://vr.vocpos.id/api/marketplace/shopee/webhook`
4. Masukkan `Partner ID` dan `Partner Key` ke file `.env`.
5. Buka menu **Pengaturan → Integrasi Marketplace Langsung**, klik tombol **"Hubungkan Toko Shopee"**.

---

## 8. Login Portal Vendor (CMT, Washing, Finishing)

1. Vendor **tidak** perlu akun Google / email rumit.
2. Owner / Admin membuka menu **Atur Vendor**.
3. Pada masing-masing vendor, klik tombol **"Login Portal"** untuk mengaktifkan akses dan menyetel password awal.
4. Klik tombol **"Kirim Info Login via WhatsApp"** untuk mengirimkan link portal dan kode vendor ke nomor WA vendor.
