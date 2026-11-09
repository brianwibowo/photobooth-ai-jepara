# Photobooth AI Museum R.A. Kartini

A lightweight, museum-first photobooth web app for a 2 GB VPS. Visitors choose a historical figure, then an activity/place on separate screens, capture and confirm a photo, and receive an AI-generated PNG result with a private QR download link. Visitor count can optionally be selected on the camera screen; names and gender are not requested.

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

Alur utama: **Tokoh → Tempat → Foto → Cek foto → Hasil QR**.
Tempat dan tokoh dipilih pada layar terpisah. Nama dan jenis kelamin tidak
diminta. Jumlah pengunjung dapat dipilih secara opsional (1–4) pada layar kamera,
tanpa menghitung tokoh pilihan. Default "Ikuti foto" menyerahkan acuan jumlah ke
model berdasarkan foto; ini bukan deteksi wajah otomatis. Bila jumlah dipilih,
API mengirim angka tersebut sebagai batasan prompt tanpa membutuhkan data tamu. Konfirmasi foto tetap
tersedia sebelum generasi, termasuk opsi ambil ulang. Header terpisah dihapus;
logo ditempatkan di konten utama. Layout mendukung kiosk landscape dan portrait.
Hitung mundur pengambilan foto berlangsung tujuh detik; ambil ulang memulai
hitung mundur baru dan keluar dari kamera membatalkan pengambilan.

Pada beranda landscape, teks dan gerbang vintage museum mengisi sisi kiri,
sedangkan foto berjalan mengisi sisi kanan. Foto hasil galeri publik terbaru
diselingi kesembilan lokasi vintage. Foto ketujuh tokoh pilihan melengkapi
galeri yang masih sedikit atau kosong. Pratinjau galeri hanya memakai
thumbnail publik, tanpa token unduh privat. Putaran menampilkan semua gambar
dan berhenti pada preferensi reduced motion. Tombol utama bertuliskan **Mulai Foto**.
Tombol **Lihat galeri** tetap tersedia di beranda dan hasil untuk membuka
delapan hasil AI terbaru.
Teks loading berganti setiap lima detik selama permintaan AI masih berjalan,
tanpa mengklaim persentase atau tahap internal provider. Hitung mundur QR
ditampilkan dengan hijau tebal.

Katalog di `src/data.js` memakai folder berikut di `public/assets`:

- `tokoh_pahlawan`: acuan lima tokoh revisi berada dalam folder tokoh masing-masing
  sebagai `reference-2026-11.webp` (wajah) dan `body-2026-11.webp` (tubuh/pakaian).
  Kartini, Sosrokartono, Kardinah, Roekmini, dan Sosroningrat masing-masing memakai
  satu wajah utama serta satu foto tubuh terpilih. Adhiningrat dan Soesalit tetap
  memakai `display.webp` dan `reference.webp` sebelumnya.
- `backgrounds/vintage` dan `backgrounds/warna`: sembilan lokasi dengan dua
  varian masing-masing. Kartu tempat memakai varian yang sama dengan input AI.
  Foto ruangan terbaru dipakai utuh, termasuk patung/diorama sebagai koleksi
  museum; figur koleksi tidak diminta menjadi orang tambahan.
- `logo`: logo Jawa Tengah, Rembang, museum, dan Museum di Hatiku.

Set produksi aktif berisi 36 berkas: sepuluh acuan wajah/tubuh baru, 18 varian
latar, empat logo, dan empat gambar dua tokoh yang tidak direvisi. `src/backgrounds.js`
menyimpan ID lokasi, ID aset, dimensi sumber, dan SHA-256 sumber/produksi;
`src/data.js` memetakan aktivitas ke lokasi. Thumbnail lama, PNG adegan lama,
dan versi tokoh yang sudah diganti tidak digunakan.

Pada layar tempat, pilihan **Nuansa foto** menyediakan **Vintage** (default)
dan **Warna**. Mengubah nuansa mengganti preview serta referensi generasi tanpa
mengubah tokoh atau aktivitas terpilih. Nuansa tersimpan saat refresh dan
ditampilkan di konfirmasi serta hasil. Beranda memakai sembilan lokasi versi
Vintage sebagai ilustrasi statis.

Tempat dan tokoh tidak dipilih otomatis pada sesi baru. Tombol lanjut aktif
setelah pengunjung memilih sendiri. Pilihan yang sudah dibuat tetap tersimpan
ketika kembali ke langkah sebelumnya.

Turunan revisi dapat dibangun ulang dengan `npm run assets:revisions` dari
`assets/sources/characters/{id}/face.jpg` dan `body.jpg`, serta 18 JPG di
`assets/sources/backgrounds/{vintage,warna}/{id}.jpg`. Sumber JPG tidak diubah;
WebP latar dibatasi lebar 1920 tanpa memperbesar, memotong, atau meregangkan
gambar. Script tidak meregenerasi wajah atau mengedit diorama. Rebuild juga
memperbarui manifest hash `src/backgrounds.js`. Seluruh sumber berada di direktori
utama; aplikasi tidak bergantung pada folder kiriman atau output sementara.
File WebP produksi ikut di `public/assets`, sehingga Docker tidak membawa sumber
atau menjalankan generasi gambar saat build.

Empat dokumen panduan asli dipertahankan di
[docs/asset-guidance](docs/asset-guidance/README.md), dengan hash provenance.
Implementasi saat ini memakai manifest, prioritas referensi wajah, pemilihan
nuansa, dan instruksi menjaga koleksi museum. Pemrosesan foto masih berupa
generasi/edit seluruh adegan; segmentasi per orang, mask, komposit deterministik,
detektor jumlah pengunjung, validasi kurator, kontrol consent/penghapusan khusus,
dan efek pinggir kertas belum diterapkan. Hash aset membuktikan file referensi
yang dipilih, bukan jaminan piksel background atau wajah hasil AI identik.

Kartu tempat memakai katalog aktivitas per tokoh, sehingga urutan interaksi
selalu tokoh lalu tempat. Ada 16 aktivitas dengan 1–3 pilihan per tokoh;
tiga ID tempat versi lama tetap dikenali untuk sesi/hasil tersimpan.
Mengganti tokoh mengosongkan tempat sebelumnya.
Soesalit mengikuti referensi anak, termasuk pada prompt generasi.
Jalankan `npm run check` untuk mengecek keberadaan aset, relasi katalog, dan build.

Referensi generasi selalu berurutan: foto pengunjung, wajah tokoh pilihan,
acuan tubuh/pakaian tokoh yang sama jika tersedia, lalu latar dengan nuansa terpilih.
Lima tokoh revisi memakai empat gambar; Adhiningrat dan Soesalit tetap memakai
tiga. Acuan wajah menjadi prioritas identitas; tubuh bukan orang tambahan.
Model diminta mempertahankan semua pengunjung dari
foto, ditambah tepat satu tokoh; nama museum tidak berarti menambah Kartini.
Saat jumlah tidak diisi, tidak ada default satu orang. Referensi wajib yang
hilang menghasilkan error, bukan fallback ke ilustrasi berisi orang contoh.
Prompt aset, sumber, dan batas verifikasi ada di [docs/reference-backgrounds.md](docs/reference-backgrounds.md).
Provider diminta menghasilkan komposisi 16:9 agar mendekati rasio foto latar
terbaru (sekitar 1,79:1). Ukuran A5 tetap 1240×874 dari panduan belum menjadi
kontrak output; master PNG mempertahankan proporsi hasil provider tanpa stretching.

Pada loading, foto tampil utuh dalam bingkai persegi panjang tanpa crop,
termasuk orang di ujung foto grup. Ini hanya pratinjau; input AI adalah foto utuh.

Galeri menampilkan maksimal delapan hasil terbaru. Sentuh thumbnail untuk
membuka foto utuh dalam pop-up detail; tombol **×**, Escape, atau sentuhan di
luar detail menutupnya dan mengembalikan ke daftar galeri. Pratinjau detail
memakai WebP galeri publik; token unduh PNG tetap privat pada sesi hasil.

Refresh memulihkan sesi aktif pada tab yang sama: pilihan tempat/tokoh/nuansa,
jumlah, foto konfirmasi, generasi yang berjalan, hasil, serta galeri/detail.
Metadata disimpan di sessionStorage; foto sumber sebagai Blob di IndexedDB,
bukan base64 di localStorage. Countdown kamera dimulai ulang dan tidak otomatis
mengambil foto setelah refresh. Waktu QR dan galeri tetap mengikuti deadline,
bukan dihitung ulang dari awal. Keluar/sesi baru membersihkan metadata dan
menjadwalkan penghapusan foto cache. Sesi persiapan yang idle dua menit berakhir;
cache foto tidak dipulihkan setelah dua puluh menit dan dibersihkan saat app dibuka.
Jika cache foto hilang/diblokir, kembali ke kamera untuk ambil ulang. Jika seluruh
sessionStorage diblokir, refresh memulai dari beranda. Tab baru memulai sesi baru.

Setiap permintaan kiosk membawa header `x-generation-id`. Status SQLite dan
fingerprint foto/pilihan/nuansa memastikan pengulangan ID yang sama tidak membuat job
baru. Refresh selama generasi memeriksa `GET /api/generations/:id` dan tidak
mengirim ulang POST otomatis. Restart server menandai job terputus sebagai gagal;
operator/pengunjung memilih retry secara eksplisit. Ini tidak menjamin billing
exactly-once dari provider yang mengalami timeout atau fallback.
SQLite juga menyimpan snapshot pilihan tokoh, lokasi, nuansa, ID/hash aset latar,
dan jumlah opsional bersama hasil agar pemulihan hasil memakai metadata sesi itu.

Setelah QR habis, pop-up memberikan 10 detik untuk memilih **Lanjutkan (15 detik)**
atau **Keluar**. Tanpa tindakan, kembali ke beranda. Lanjutkan mengaktifkan
tautan yang sama selama 15 detik lewat server, **hanya sekali**; klik ganda tidak menumpuk waktu.
Setelah tambahan 15 detik habis, langsung kembali ke beranda tanpa pop-up kedua,
termasuk setelah refresh. Hasil menampilkan tokoh dan tempat yang benar-benar
dipilih. Nama unduhan adalah `photobooth_kartini_{nomor_unik}.png`, misalnya
`photobooth_kartini_000021.png`; lampiran email memakai nomor yang sama dengan ekstensi JPG.
Sesi yang lewat jendela 10 detik atau melewati retensi tidak dapat diperpanjang.

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
- `GET /api/gallery?limit=8`: newest public thumbnails only (default and maximum 8).
- `POST /api/generate`: internal multipart camera capture with `photo`, `sceneId`, and `characterId`; optional `backgroundStyle` is `vintage` (default) or `warna`, and invalid values return `400 BACKGROUND_STYLE_INVALID`; optional `people` (1–4) is accepted independently; legacy `guests` data is validated when supplied; the kiosk does not expose a file-upload control.
- `GET /api/generations/:id`: status privat running/complete/failed; hasil kedaluwarsa tidak dipulihkan.
- `POST /api/results/:token/email`: token sesi aktif + JSON `{ "email": "..." }`; membuat job pengiriman lampiran.
- `GET /api/results/:token/email`: status job tanpa menampilkan alamat penerima.
- `POST /api/results/:token/extend`: memperpanjang QR satu kali selama 15 detik dalam grace awal 10 detik;
  respons berisi `downloadExpiresAt` yang baru, tanpa mengubah retensi foto.
- `GET /api/download/:token`: token-based private result access used by the QR.

The gallery response intentionally contains only image URLs. The current kiosk does not collect names or gender and creates no guest-book rows. Existing guest-book records remain available to the authenticated admin export. A QR/download token is valid for 60 seconds, while the PNG master, WebP thumbnail, and database record remain on the VPS for the seven-day retention window used by the gallery and cleanup job. Set `RESULT_RETENTION_MS=0` when the museum wants indefinite retention and will perform manual storage cleanup.

Gallery supports real Gemini and OpenRouter results. On first startup after the
gallery fix, a one-time database migration repairs older OpenRouter rows that
were incorrectly excluded. Retention and subsequent visibility changes remain
respected; local fallback images are excluded.

## Audit yang dapat diulang

```bash
npm run check
npm test
npm run audit:ui
npm run audit:revisions
```

Audit UI memerlukan modul `playwright` dan browser Chromium yang tersedia di
lingkungan pengujian. Jika modul berada di runtime terpisah, isi
`PLAYWRIGHT_MODULE_PATH` dengan direktori modul; `BROWSER_EXECUTABLE` dapat
menunjuk executable Chrome yang sudah terpasang. Audit memakai server/temp DB,
foto sintetis, kamera simulasi, provider simulasi, dan SMTP simulasi. Tidak
mengirim generasi berbayar atau email nyata. JSON dan screenshot keluar ke
`audit-results/` (diabaikan Git). Laporan terperinci dan batas verifikasi ada di
[docs/AUDIT_2026-10-23.md](docs/AUDIT_2026-10-23.md).

Audit revisi memeriksa ketujuh tokoh, 16 kartu aktivitas dan pilihan nuansa pada
landscape, portrait, dan mobile, termasuk refresh, tombol kembali, gambar, dan
alur foto hingga hasil simulasi. Screenshot/JSON berada di `output/playwright/revisions/`.
Audit otomatis tidak mengukur kemiripan hasil AI nyata; penilaian visual tetap
memerlukan foto nyata 1–4 pengunjung dan referensi wajah yang disepakati klien,
termasuk pemeriksaan jumlah orang, pakaian, arsitektur, koleksi dan diorama.
