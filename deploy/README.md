# Deploy ke VPS dengan Docker

Konfigurasi ini untuk satu VPS dengan RAM 2 GB, satu instance aplikasi, dan domain
`photobooth-jepara.duckdns.org` yang diarahkan ke `139.190.100.249`. Port 80 dan
443 pada VPS ini sudah dipakai service lain, sehingga stack ini memakai host port
**8080** untuk HTTP dan **8443** untuk HTTPS.

## 1. Persiapan VPS

Login melalui SSH dengan akun VPS milik Anda. Gunakan `sudo` untuk perintah Docker
jika akun tersebut belum memiliki akses ke Docker daemon. Node/npm tidak perlu
diinstal di host karena build dilakukan di Docker.

```bash
docker --version
docker compose version
```

Jika Docker belum terpasang, berikut instalasi dari repository resmi untuk Ubuntu
atau Debian. Jalankan hanya bagian ini jika OS VPS adalah salah satu distro tersebut.
Untuk OS lain, ikuti [panduan Docker Engine](https://docs.docker.com/engine/install/).

```bash
# Ubuntu / Debian; akun dengan sudo.
. /etc/os-release
docker_distro="$ID"
docker_codename="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
case "$docker_distro" in
  ubuntu|debian) ;;
  *) echo "Gunakan panduan Docker untuk distro ini"; exit 1 ;;
esac
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL "https://download.docker.com/linux/$docker_distro/gpg" -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
  "$(dpkg --print-architecture)" "$docker_distro" "$docker_codename" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker compose version
```

Sumber: [Docker Ubuntu](https://docs.docker.com/engine/install/ubuntu/) dan
[Docker Debian](https://docs.docker.com/engine/install/debian/). Bila ada instalasi
Docker/containerd lain sebelumnya, ikuti bagian konflik paket di panduan resmi
sebelum mengganti instalasi yang sedang dipakai layanan lain.

Periksa DNS dari komputer lokal atau VPS:

```bash
getent ahostsv4 photobooth-jepara.duckdns.org
```

Hasil IPv4 harus mengarah ke `139.190.100.249`. Jika ada record AAAA, record itu
harus menuju IPv6 VPS yang benar atau dihapus dari konfigurasi DuckDNS.
Izinkan TCP **8443** di firewall provider dan firewall VPS. Port 8080 hanya perlu
dibuka jika ingin mengakses HTTP alternatif secara langsung. Pertahankan akses port
SSH yang saat ini dipakai. Bila UFW sudah aktif:

```bash
sudo ufw allow 8443/tcp
sudo ufw allow 8080/tcp
sudo ss -ltnp '( sport = :80 or sport = :443 or sport = :8080 or sport = :8443 )'
```

Port 80/443 boleh tetap dipakai service lama. Caddy memakai DNS-01 DuckDNS, jadi
validasi sertifikat tidak membutuhkan kedua port standar. Jangan menghentikan
layanan lama tanpa memeriksa penggunaannya. VPS juga memerlukan akses keluar
HTTPS ke registry image, npm, layanan sertifikat, dan API Gemini.

## 2. Clone dan isi konfigurasi

```bash
git clone https://github.com/brianwibowo/photobooth-ai-jepara.git
cd photobooth-ai-jepara
cp .env.docker.example .env
chmod 600 .env
nano .env
```

Isi `OPENROUTER_API_KEY` dengan key OpenRouter yang memiliki saldo untuk image generation.
Biarkan `DOMAIN=photobooth-jepara.duckdns.org`, `HTTP_PORT=8080`,
`HTTPS_PORT=8443`, `PUBLIC_BASE_URL=https://photobooth-jepara.duckdns.org:8443`,
dan `ALLOW_LOCAL_FALLBACK=false`. Isi `DUCKDNS_API_TOKEN` dengan token yang terlihat
di akun DuckDNS. Default Docker menggunakan `openai/gpt-image-2.5-flare` melalui
OpenRouter. Anda bisa mengganti `AI_INFOGRAPHIC_MODEL` atau `OPENROUTER_MODEL`
dengan model image lain yang aktif pada akun Anda.
API key hanya masuk ke environment backend saat runtime; tidak disalin ke image
atau JavaScript frontend. `.dockerignore` juga mengecualikan foto pengunjung,
SQLite lokal, serta seluruh folder referensi asli yang besar dari build context.

Jika folder repo sudah ada, gunakan `git pull --ff-only` dari folder tersebut dan
edit `.env` yang ada; jangan menimpa key yang sudah diisi. `PUBLIC_BASE_URL` adalah
sumber URL QR. Pastikan nilainya adalah URL yang benar-benar
bisa dibuka pengunjung, termasuk `:8443` pada konfigurasi ini; Compose tidak dapat
menebak URL publik dari `DOMAIN` bila ada port alternatif atau reverse proxy.
Jika museum memerlukan ekspor buku tamu, isi `ADMIN_TOKEN` dengan nilai acak yang
panjang (contoh: `openssl rand -hex 32`). Endpoint itu tidak dibuka oleh frontend;
gunakan header `Authorization: Bearer <token>` atau `X-Admin-Token` dari kanal admin
yang aman. Biarkan kosong bila ekspor belum diperlukan.

### Email foto opsional

Siapkan akun SMTP dan alamat pengirim yang diizinkan provider. Tambahkan variabel
`EMAIL_ENABLED`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, dan `EMAIL_DAILY_LIMIT` dari
[contoh konfigurasi](../.env.docker.example) ke `.env` yang sudah ada. Akses keluar
TCP 587 (STARTTLS) atau 465 (TLS) harus tersedia; tidak perlu membuka port SMTP
masuk. Bila memakai domain sendiri, pasang SPF/DKIM sesuai provider SMTP.

Kredensial tidak dikirim ke browser. Foto dan antrean SQLite memakai volume
`photobooth_data` yang sama. Setelah build/restart, jalankan
`docker compose exec app npm run email:verify` untuk mengecek koneksi dan
login SMTP tanpa mengirim email. Lanjutkan dengan satu uji foto → email ke alamat
operator untuk memeriksa attachment dan inbox/spam. Detail mekanisme dan batas
pengiriman ada di [README](../README.md#email-foto-dari-vps).

## 3. Build dan jalankan

Perintah berikut mengasumsikan akses Docker tersedia. Tambahkan `sudo` bila perlu.

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=80 app caddy
```

Build pertama perlu waktu untuk mengunduh base image dan dependency native.
Build dilakukan sesuai arsitektur VPS; jangan menyalin `node_modules` dari Mac.
Container aplikasi memakai user non-root, filesystem read-only kecuali volume
data dan `/tmp`, serta memory limit 1 GB. Caddy dibatasi 128 MB. Batas ini memberi
ruang untuk OS pada VPS 2 GB, tetapi bukan jaminan kapasitas untuk banyak generasi
bersamaan. Gunakan satu instance aplikasi untuk SQLite lokal.

Setelah aplikasi `healthy`, Caddy mulai mengurus HTTPS dan memperbarui sertifikat
otomatis lewat DNS-01 DuckDNS. Buka **https://photobooth-jepara.duckdns.org:8443**.
Browser tetap menganggapnya HTTPS sehingga izin kamera dapat digunakan. Lihat
[modul DuckDNS Caddy](https://github.com/caddy-dns/duckdns) dan
[persyaratan HTTPS Caddy](https://caddyserver.com/docs/automatic-https).

```bash
curl -fsS https://photobooth-jepara.duckdns.org:8443/api/health
# Optional: verify that the alternate HTTP listener points to this stack's port.
curl -sSI http://photobooth-jepara.duckdns.org:8080/api/health | grep -i '^location:'
```

Buka **https://photobooth-jepara.duckdns.org:8443**. Gunakan URL HTTPS ini pada kiosk
agar browser dapat meminta izin kamera. QR hasil mengarah ke domain yang sama dan
dapat dibuka dari ponsel lewat jaringan lain.

Healthcheck memeriksa server, bukan kevalidan key atau akses model. QR/download token berlaku 60 detik; hasil PNG dan record database tetap disimpan
selama masa retensi default tujuh hari agar galeri dan arsip operasional tidak ikut
hilang saat QR habis. Set `RESULT_RETENTION_MS=0` jika hasil harus disimpan sampai
operator melakukan pembersihan manual. Saat production, fallback lokal sengaja dimatikan agar hasil overlay tidak dianggap sebagai hasil AI.
Jika Gemini gagal, UI menampilkan error dan tombol coba lagi; periksa log
`Gemini generation failed` dan response `/api/generate` (`provider: gemini`) ketika
menguji hasil AI. Lakukan satu sesi lengkap sampai QR dibuka di ponsel, lalu mulai
sesi baru.

## 4. Operasional dan update

```bash
docker compose logs -f --tail=100 app caddy
docker compose ps
docker stats --no-stream

# Deploy kode terbaru; data dan sertifikat tetap di volume.
git pull --ff-only
docker compose up -d --build

# Setelah mengganti .env, recreate untuk menerapkan environment baru.
docker compose up -d

# Hentikan atau jalankan kembali stack.
docker compose down
docker compose up -d
```

`restart: unless-stopped` menghidupkan kembali layanan yang crash atau ikut boot
Docker setelah restart VPS. Container yang sengaja dihentikan perlu dijalankan
kembali secara manual. Healthcheck tidak otomatis merestart proses yang hang.
Log Docker dirotasi maksimal 3 × 10 MB per container. Master dan thumbnail hasil
yang melewati retensi tujuh hari dibersihkan otomatis setiap enam jam; tetap
pantau ruang disk dan buat backup bila arsip perlu dipertahankan.

Jangan gunakan **`docker compose down -v`** kecuali memang ingin menghapus volume,
termasuk seluruh buku tamu, foto, dan sertifikat. Nama project tetap
`photobooth-jepara` agar nama volume konsisten:

- `photobooth-jepara_photobooth_data`: SQLite, foto WebP, thumbnail.
- `photobooth-jepara_caddy_data`: sertifikat TLS dan state ACME.
- `photobooth-jepara_caddy_config`: konfigurasi runtime Caddy.

## 5. Backup data

Saat tidak ada sesi pengunjung aktif, hentikan aplikasi sebentar supaya backup
SQLite beserta file WAL konsisten. Caddy dapat menampilkan 502 selama proses ini.

```bash
mkdir -p backups
chmod 700 backups
docker compose stop app
backup_file="backups/photobooth-$(date +%Y%m%d-%H%M%S).tar.gz"
if docker compose run --rm --no-deps -T --entrypoint tar app -C /app/data -czf - . > "$backup_file"; then
  chmod 600 "$backup_file"
  echo "Backup selesai: $backup_file"
else
  echo "Backup gagal; jangan gunakan file parsial: $backup_file"
fi
docker compose start app
```

Simpan salinan backup di luar VPS. Backup ini berisi data pengunjung; folder
`backups/` diabaikan oleh Git dan Docker build. Simpan `.env` secara terpisah di
tempat privat. Volume sertifikat tetap dipertahankan saat update normal.

## Troubleshooting

- **Caddy gagal bind:** cek proses pada port 8443/8080 dengan `ss`; port 80/443
  memang boleh dipakai service lama.
- **Caddy gagal menerbitkan sertifikat:** cek `DUCKDNS_API_TOKEN`, domain DuckDNS,
  dan log `docker compose logs --tail=100 caddy`. Token DuckDNS diperlukan untuk
  DNS-01; port alternatif saja tidak cukup untuk membuat sertifikat publik.
- **HTTPS belum tersedia:** cek DNS A/AAAA, firewall provider/VPS, dan log Caddy.
  Hindari menghapus volume sertifikat berulang kali karena penerbit menerapkan
  batas permintaan sertifikat.
- **Aplikasi unhealthy:** lihat `docker compose logs --tail=100 app`; pastikan
  volume dapat ditulis oleh UID 1000. Named volume baru mengambil ownership dari
  direktori image; bind mount buatan sendiri memerlukan izin yang sesuai.
- **Foto AI gagal dibuat:** cek `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, saldo
  OpenRouter, dan koneksi keluar. Jalankan `docker compose logs --tail=100 app`.
  Error `402` berarti saldo OpenRouter belum memenuhi syarat image generation;
  error `429` berarti rate limit. Status health `ok` hanya membuktikan server hidup,
  bukan generation berhasil.
- **Build exit 137 / kehabisan RAM:** hentikan proses berat saat build, tambahkan
  swap sesuai kebijakan VPS, atau build image di mesin lain untuk arsitektur VPS.
