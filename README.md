# Photobooth AI Museum R.A. Kartini

A lightweight, museum-first photobooth web app for a 2 GB VPS. Visitors choose a place, then a historical figure on separate screens, capture and confirm a photo, and receive an AI-generated PNG result with a private QR download link. Visitor count can optionally be selected on the camera screen; names and gender are not requested.

## Stack

- React + Vite: responsive single-page experience with no heavy UI framework.
- Express: small server/API layer that keeps provider secrets off the client.
- SQLite: local metadata and guest book storage, suitable for a single museum kiosk/VPS.
- Sharp: validates photos, keeps generated masters as PNG, and creates lightweight WebP gallery thumbnails.
- OpenRouter image generation: configured with `OPENROUTER_API_KEY` and `AI_INFOGRAPHIC_MODEL`/`OPENROUTER_MODEL`; the Docker default is `openai/gpt-image-2.5-flare`. Gemini remains available as a fallback when configured. Production local fallback is disabled so a branded overlay can never be mistaken for an AI result.

## Run locally

```bash
cp .env.example .env
# Add OPENROUTER_API_KEY in .env (server-side only)
npm install
npm run dev
```

Open `http://localhost:5173`.

## Deploy Docker ke VPS 2 GB

Domain: **https://photobooth-jepara.duckdns.org**. IP VPS yang dituju: **139.190.100.249**.

Panduan lengkap instalasi Docker, deploy, update, backup, dan troubleshooting:
[deploy/README.md](deploy/README.md).

Jika Docker Engine dan plugin Compose sudah terpasang, jalankan di VPS:

```bash
git clone https://github.com/brianwibowo/photobooth-ai-jepara.git
cd photobooth-ai-jepara
cp .env.docker.example .env
chmod 600 .env
nano .env  # Isi GEMINI_API_KEY
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 caddy
```

Port 80 dan 443 VPS sudah dipakai layanan lain. Stack ini memakai HTTP `8080` dan
HTTPS `8443` dengan DNS-01 DuckDNS. URL publik default menjadi
`https://photobooth-jepara.duckdns.org:8443`; QR memakai `PUBLIC_BASE_URL` tersebut.
Isi `DUCKDNS_API_TOKEN` di `.env` agar Caddy dapat menerbitkan sertifikat valid
tanpa membutuhkan port 80/443. Jika service lama bisa menjadi reverse proxy untuk
domain ini, `PUBLIC_BASE_URL` dapat diubah menjadi URL HTTPS standar tanpa `:8443`.
Database dan foto berada di named volume `photobooth-jepara_photobooth_data`,
sehingga tetap ada saat container diperbarui. Jangan jalankan `docker compose down -v`
jika ingin mempertahankan data.

For production on a VPS:

```bash
npm install
npm run build
NODE_ENV=production PORT=8787 PUBLIC_BASE_URL=https://your-domain.example npm start
```

Put Nginx/Caddy in front for HTTPS. The API stores generated files in `data/generated` and SQLite metadata in `data/photobooth.db`. Back up that directory or move the storage adapter to object storage when running multiple instances.

## Kiosk UI dan aset

Alur utama: **Tempat → Tokoh → Foto → Cek foto → Hasil QR**.
Tempat dan tokoh dipilih pada layar terpisah. Nama dan jenis kelamin tidak
diminta. Jumlah pengunjung dapat dipilih secara opsional (1–3) pada layar kamera,
tanpa menghitung tokoh pilihan. Default "Ikuti foto" menyerahkan acuan jumlah ke
model berdasarkan foto; ini bukan deteksi wajah otomatis. Bila jumlah dipilih,
API mengirim angka tersebut sebagai batasan prompt tanpa membutuhkan data tamu. Konfirmasi foto tetap
tersedia sebelum generasi, termasuk opsi ambil ulang. Header terpisah dihapus;
logo ditempatkan di konten utama. Layout mendukung kiosk landscape dan portrait.

Katalog di `src/data.js` memakai folder berikut di `public/assets`:

- `backgrounds`: tiga referensi background untuk input AI.
- `scene-previews`: tiga thumbnail utuh dari PNG sumber untuk kartu pemilihan
  tempat; tidak memakai gambar reference yang memiliki bagian blur.
- `logo`: logo Jawa Tengah, Rembang, museum, dan Museum di Hatiku.
- `tokoh_pahlawan`: tujuh tokoh; `display.webp` untuk ilustrasi pengalaman dan
  `reference.webp` untuk kartu tokoh serta referensi identitas AI. PNG adegan dan
  folder `referensi` tetap menjadi pustaka sumber.

Tempat dan tokoh tidak dipilih otomatis pada sesi baru. Tombol lanjut aktif
setelah pengunjung memilih sendiri. Pilihan yang sudah dibuat tetap tersimpan
ketika kembali ke langkah sebelumnya.

Preview dapat dibangun ulang dengan `npm run assets:previews` dari PNG sumber
yang disimpan di repository. File WebP hasilnya ikut di-commit agar build Docker
tidak perlu membawa pustaka sumber yang besar.

Semua tokoh tersedia pada ketiga latar. Mengganti latar mempertahankan tokoh yang
sudah dipilih. Soesalit mengikuti referensi anak, termasuk pada prompt generasi.
Jalankan `npm run check` untuk mengecek keberadaan aset, relasi katalog, dan build.

## Email foto dari VPS

Halaman hasil/QR menyediakan email opsional. Pengunjung mengisi satu alamat
penerima dan menekan **Kirim**. Permintaan masuk ke antrean SQLite di volume VPS,
lalu worker mengirim JPG 1600 px (maksimum 5 MiB) sebagai lampiran. PNG asli tetap
tersimpan dan dapat diunduh lewat QR. Google Drive tidak diperlukan.

Satu foto dapat diminta dikirim ke satu alamat email. Permintaan berulang ke
alamat yang sama mengembalikan job yang sama. Status di layar membedakan
antrean, proses kirim, dan penerimaan oleh SMTP; penerimaan SMTP tidak menjamin
email sudah masuk inbox. Alamat email tidak masuk galeri atau buku tamu dan
record pengirimannya ikut dibersihkan saat retensi foto berakhir.

Yang perlu disiapkan:

1. Akun SMTP aktif dan alamat pengirim yang diizinkan/terverifikasi.
2. Host, port (587/STARTTLS atau 465/TLS), username, dan password/app password.
3. Jika memakai domain sendiri: akses DNS untuk SPF/DKIM sesuai petunjuk provider.
4. Akses keluar dari VPS ke port SMTP provider. Tidak perlu membuka port SMTP
   masuk atau memasang mail server sendiri.

Isi `.env` di VPS, bukan variabel `VITE_*` atau source frontend:

```dotenv
EMAIL_ENABLED=true
EMAIL_FROM=photobooth@example.com
EMAIL_FROM_NAME="Museum R.A. Kartini"
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=isi_username_smtp
SMTP_PASS=isi_password_smtp
EMAIL_DAILY_LIMIT=200
```

Untuk port 465, ganti `SMTP_PORT=465` dan `SMTP_SECURE=true`. Provider dapat
menggunakan username yang berbeda dari alamat pengirim. Jangan mengganti
konfigurasi/key lain yang sudah ada. Contoh lengkap ada di `.env.docker.example`.

Setelah deploy ulang, cek autentikasi tanpa mengirim email:

```bash
docker compose up -d --build
docker compose exec app npm run email:verify
```

Untuk Node lokal, jalankan `npm run email:verify`. Verifikasi koneksi belum
membuktikan izin alamat From atau inbox delivery; lakukan satu sesi foto dan
kirim ke alamat milik operator untuk uji akhir setelah konfigurasi tersedia.

Worker memproses satu email pada satu waktu, mencoba ulang penolakan SMTP
sementara/kegagalan koneksi hingga tiga percobaan, dan memulihkan antrean setelah
restart. Bila SMTP timeout setelah pengiriman dimulai atau server berhenti di
tengah proses, status menjadi belum pasti dan tidak otomatis dikirim ulang untuk
menghindari salinan ganda. `sent` berarti SMTP menerima pesan. Permintaan baru
dibatasi 20 per IP per jam dan `EMAIL_DAILY_LIMIT` (default 200) dalam 24 jam.

Permintaan harus masuk sebelum sesi/QR berakhir (default 60 detik). Job yang
sudah diterima tetap diproses setelah sesi selesai selama file berada dalam masa
retensi. Lampiran yang diterima tidak bergantung pada tautan QR. SMTP kosong atau
`EMAIL_ENABLED=false` menonaktifkan opsi email; unduh/QR tetap berjalan.

Sumber pengaturan: [Nodemailer SMTP](https://nodemailer.com/smtp),
[lampiran](https://nodemailer.com/message/attachments). Jika memakai Gmail dan
akun mendukungnya, [app password memerlukan 2-Step Verification](https://support.google.com/mail/answer/185833).

## Main API

- `GET /api/health`: readiness and provider mode.
- `GET /api/gallery?limit=12`: newest public thumbnails only (max 20).
- `POST /api/generate`: internal multipart camera capture with `photo`, `sceneId`, and `characterId`; optional `people` (1–3) is accepted independently; legacy `guests` data is validated when supplied; the kiosk does not expose a file-upload control.
- `POST /api/results/:token/email`: token sesi aktif + JSON `{ "email": "..." }`; membuat job pengiriman lampiran.
- `GET /api/results/:token/email`: status job tanpa menampilkan alamat penerima.
- `GET /api/download/:token`: token-based private result access used by the QR.

The gallery response intentionally contains only image URLs. The current kiosk does not collect names or gender and creates no guest-book rows. Existing guest-book records remain available to the authenticated admin export. A QR/download token is valid for 60 seconds, while the PNG master, WebP thumbnail, and database record remain on the VPS for the seven-day retention window used by the gallery and cleanup job. Set `RESULT_RETENTION_MS=0` when the museum wants indefinite retention and will perform manual storage cleanup.
