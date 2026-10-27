# QA report — Photobooth AI Museum R.A. Kartini

Tanggal pemeriksaan awal: 22 Oktober 2026.

## Beranda, urutan pilihan, dan batas grup — 27 Oktober 2026

- Beranda dirapikan menjadi dua kolom: teks, empat logo dengan urutan yang sama,
  dan ilustrasi gerbang di kiri; galeri hasil terbaru di kanan.
- Galeri beranda menampilkan maksimal delapan foto dan bergulir otomatis secara
  looping. Reduced motion menghentikan pengguliran otomatis.
- Alur kiosk sekarang **Tokoh → Tempat → Foto → Cek foto → Hasil QR**. Pilihan
  tempat memakai metadata `sceneIds` dari tokoh yang dipilih, dan tidak ada
  pilihan otomatis pada sesi baru.
- Jumlah pengunjung bersifat opsional, tidak menghitung tokoh, dan dibatasi
  maksimal empat pilihan manual: 1, 2, 3, atau 4. Opsi `Ikuti foto` tetap
  tersedia untuk menyerahkan acuan jumlah kepada model.
- Validasi terakhir: build produksi lulus, 29 tes Node lulus, serta 18 skenario
  browser lulus dengan 22 screenshot pada desktop dan perangkat portrait.

## Setup domain dengan perintah pendek — 23 Oktober 2026

`bash deploy/domain.sh` memasang `fotokartinirembang.com` melalui gateway Caddy
yang sudah memiliki host port 443. DNS harus mengarah ke VPS. Setup menemukan
mount/jaringan secara otomatis, mempertahankan site lama, membuat override
Compose persisten untuk jaringan dan URL QR, memvalidasi Caddy sebelum perubahan,
menunggu app healthy, reload, serta memverifikasi HTTPS utama/www. Kegagalan
memicu percobaan rollback. Backup lokal tidak masuk Git.

Sepuluh unit test Python lulus, termasuk idempotensi dan kegagalan validasi,
app, reload, serta HTTPS; dipanggil sebagai satu tes dalam suite Node.
Total **29 tes Node lulus**. Docker Compose CLI memverifikasi hasil merge
override dengan konfigurasi dummy tanpa kredensial. Caddy nyata dan penerbitan
sertifikat belum dijalankan dari Mac; hasil VPS menunggu eksekusi pengguna.

## Perbaikan startup Docker — 23 Oktober 2026

Commit audit sebelumnya menambah import `src/config.js` pada server, tetapi
Docker runtime hanya menyalin `src/data.js`. Build berhasil sementara startup
gagal karena modul hilang. Dockerfile kini menyalin kedua modul dan menjalankan
import server sebagai user `node` pada final image; build gagal bila dependency
runtime belum lengkap. Tes regresi menyusun direktori terisolasi berdasarkan
daftar COPY Dockerfile, memverifikasi import berhasil, lalu mereproduksi
`ERR_MODULE_NOT_FOUND` saat config dihapus. Total **28 tes otomatis lulus**.
Docker daemon lokal tidak berjalan, sehingga build/container Linux dan health
VPS setelah deploy belum diverifikasi. Audit browser sebelumnya tetap terpisah
dari pemeriksaan packaging runtime ini.

## Audit menyeluruh, pemulihan refresh, dan grup besar — 23 Oktober 2026

Laporan lengkap: [docs/AUDIT_2026-10-23.md](docs/AUDIT_2026-10-23.md).
Ringkasan browser: `docs/audit-2026-10-23-results.json`.

- Refresh memulihkan langkah, pilihan, jumlah, foto konfirmasi, proses generasi,
  hasil QR, serta galeri/detail pada tab yang sama. Countdown kamera tidak
  mengambil foto otomatis setelah refresh. Deadline QR/grace tidak dimulai ulang.
- Perpanjangan QR hanya sekali, 15 detik lalu langsung home tanpa pop-up ulang;
  status tersimpan di server dan tetap berlaku setelah refresh. Keterangan hasil
  mengikuti tokoh/tempat terpilih. Unduhan PNG dan lampiran JPG memakai nama
  `photobooth_kartini_{nomor_unik}` yang sama, tanpa token QR.

- Metadata per tab memakai sessionStorage dan foto sumber memakai IndexedDB.
  Sesi baru/timeout membersihkan metadata; cache foto mempunyai cutoff 20 menit.
  Cache hilang/diblokir kembali ke kamera, sedangkan sessionStorage diblokir
  memulai home. Tab baru tidak mengambil alih sesi tab lain.
- Status SQLite + ID/fingerprint generasi memungkinkan recovery tanpa mengulang
  provider pada retry/refresh request yang sama. Restart tidak auto-regenerate.
- Pada audit historis, pilihan manual sempat diperluas dari 1–4 menjadi 1–20.
  Implementasi aktif sekarang dibatasi kembali ke 1–4 sesuai batas konsistensi
  wajah. Semua 21
  kombinasi tokoh/tempat diuji. Konkurensi saat cooldown dan token admin Unicode
  juga diperbaiki. Status email yang sudah antre/sent dipulihkan setelah refresh.
- `npm run check`, syntax server/session/runner, `git diff --check`, dan **27 tes
  otomatis** lulus. Termasuk matriks jumlah, validasi negatif, input provider,
  idempotensi, restart, rate limit, persistence, galeri, QR, email, dan admin.
- **19 skenario browser** lulus, dengan **25 screenshot** pada empat ukuran.
  Grup 1/3/4/6/8 masing-masing diuji manual dan tanpa jumlah; refresh pada setiap
  langkah; hash foto konfirmasi sebelum/sesudah refresh sama. Negatif mencakup
  kamera ditolak/hilang/tidak dijawab/terputus, storage diblokir/rusak, cache
  hilang, provider gagal, respons generasi hilang, jaringan status gagal,
  galeri gagal/JSON invalid/retry, dan penanganan batas waktu.
- VPS dicek read-only: health 200/ok dan galeri maksimal delapan. Patch refresh
  belum dideploy oleh agen. SMTP produksi belum aktif.

**Batas verifikasi:** kamera, provider AI, dan SMTP memakai simulasi. Tidak
menjalankan generasi AI berbayar/email nyata. Belum ada face detector atau
validator jumlah/identitas pada hasil. Foto gelap, wajah tertutup/terpotong,
wajah kecil pada grup besar, dan ketepatan jumlah AI tetap merupakan P1 terbuka
untuk uji generasi nyata, bukan skenario yang dinyatakan lulus di audit ini.

## Galeri delapan foto, detail foto, dan loading persegi panjang — 23 Oktober 2026

Galeri dibatasi delapan hasil terbaru di API dan UI. Thumbnail dapat disentuh
untuk membuka foto utuh pada pop-up detail dengan tombol ×. Detail tetap memakai
thumbnail publik tanpa membocorkan token unduh master PNG. Fokus keyboard kembali
ke thumbnail saat detail ditutup; galeri di belakangnya tidak dapat diinteraksi.
Loading memakai bingkai persegi panjang dengan `object-fit: contain`, tanpa
lingkaran, dan mempertahankan seluruh foto pengunjung.

Verifikasi:

- `npm run check`, syntax server, `git diff --check`, dan enam belas tes otomatis
  lulus. Tes baru membuktikan batas delapan hasil terbaru yang memenuhi syarat,
  permintaan melebihi batas, nilai limit invalid/pecahan, serta pengecualian
  foto privat, fallback, dan kedaluwarsa.
- Dua puluh empat tampilan pada 1920×1080, 1366×768, 1080×1920, dan 390×844 lulus
  memakai kamera/provider simulasi: maksimum delapan meskipun payload berisi
  dua belas, foto detail yang tepat dan utuh, tombol ×, Escape bertahap,
  pemulihan fokus/scroll, foto empat orang pada loading persegi panjang, dan
  akhir sesi QR ketika detail galeri sedang terbuka.
- Tidak ada gambar rusak atau overflow horizontal; kiosk muat tanpa scroll.
  Tidak menjalankan generasi berbayar atau mengirim email nyata.

## Referensi tanpa orang, foto grup pada loading, dan akhir sesi QR — 23 Oktober 2026

Latar generasi membatik dan ruang gagasan kini memakai plate tanpa orang hasil
edit built-in imagegen. Aset asli dan ilustrasi kartu tetap menjadi pustaka;
asal aset dan prompt tersimpan di `docs/reference-backgrounds.md`. Prompt bersama
untuk Gemini/OpenRouter membatasi semua orang pada pengunjung di foto sumber
ditambah tepat satu tokoh yang dipilih. Jumlah kosong tidak diubah menjadi satu.
Referensi wajib yang hilang ditolak tanpa mengganti dengan gambar promosi.

Loading mempertahankan lingkaran, tetapi seluruh foto ditampilkan dengan ukuran
yang mengikuti rasio asli sehingga orang di ujung foto grup tidak terpotong.
Saat QR habis, pop-up memberikan sepuluh detik untuk lanjut atau keluar.
Lanjutkan mengaktifkan token lagi selama lima belas detik lewat server;
permintaan berulang tidak menambah waktu berlipat. Retensi tidak diperpanjang.

Verifikasi:

- Lima belas tes otomatis lulus, termasuk urutan tiga input dan prompt semua
  latar pada Gemini, OpenRouter images, serta OpenRouter chat; referensi wajib
  hilang; masa aktif/grace QR, klik ganda, sesi lama, retensi, dan email setelah
  perpanjangan. Provider generasi dan SMTP memakai simulasi.
- Enam belas tampilan pada 1920×1080, 1366×768, 1080×1920, dan 390×844 lulus:
  foto empat pengunjung utuh pada lingkaran, countdown tujuh detik, pop-up
  sepuluh detik, perpanjangan lima belas detik dengan unduh HTTP kembali 200,
  auto-reset, keluar langsung, fokus keyboard, dan reset pilihan manual.
- Uji tambahan 1366×768 lulus untuk koneksi perpanjangan gagal lalu retry,
  pembatalan request saat keluar, dan pemulihan scroll setelah pop-up ditutup.
- `npm run check`, syntax server, dan `git diff --check` lulus.

Latar kosong telah diperiksa visual. Tidak menjalankan generasi pengunjung
berbayar atau mengirim email nyata. Tidak ada detektor wajah atau validator
jumlah hasil otomatis; konsistensi wajah/jumlah tetap perlu diuji lewat sesi
generasi baru di VPS setelah deploy.

## Hitung mundur kamera tujuh detik — 23 Oktober 2026

Browser dengan kamera simulasi memverifikasi angka awal 7, masih berada di
kamera pada detik ketiga dan keenam, lalu mengambil foto pada detik ketujuh.
Ambil ulang memulai dari 7 dan kembali ke tokoh membatalkan pengambilan.
`npm run check` dan `git diff --check` lulus. Deteksi wajah otomatis belum
ditambahkan pada revisi ini.

## Beranda slideshow, konfirmasi, loading, QR, dan galeri — 23 Oktober 2026

- Beranda landscape terbagi dua sama lebar, gambar penuh tinggi layar di kanan,
  berganti di antara tujuh ilustrasi setiap enam detik. Caption dihapus.
- Foto tokoh di konfirmasi memakai posisi crop atas agar wajah terlihat; gambar
  tidak menyusut dan nama panjang boleh membungkus tanpa overflow.
- Enam variasi judul dan teks loading berganti setiap lima detik, tanpa persentase
  atau klaim tahap internal provider. Hitung mundur QR hijau dan bold.
- Tombol galeri diperjelas pada beranda/hasil. Backend kini memasukkan Gemini
  dan OpenRouter; migrasi sekali memperbaiki penandaan hasil OpenRouter lama.

Verifikasi: 32 tampilan pada 1920×1080, 1366×768, 1080×1920, dan 390×844 dengan
kamera/API simulasi lulus, termasuk slideshow, enam teks loading, nama panjang,
crop Sosrokartono, warna QR, galeri terisi/kosong/gagal/retry dari beranda dan
hasil, serta reset pilihan manual. Tidak ada gambar rusak atau overflow
horizontal; kiosk tetap muat tanpa scroll. Sebelas tes `npm test`,
`npm run check`, syntax server, dan `git diff --check` lulus. Tes backend
mencakup thumbnail kedua provider, hasil OpenRouter baru, pemulihan hasil lama,
retensi, fallback tersembunyi, dan visibilitas setelah restart. Tidak ada
generasi berbayar atau pengiriman email nyata.

## Preview tempat dan pilihan manual — 23 Oktober 2026

Kartu tempat memakai WebP dari PNG sumber utuh di `scene-previews`, sehingga
bagian blur pada referensi AI tidak muncul di pratinjau. Referensi generasi
tetap terpisah. Tempat dan tokoh kosong pada setiap sesi baru; tombol lanjut
nonaktif sampai pengunjung memilih. Kembali ke langkah sebelumnya tetap
mempertahankan pilihan yang dibuat pengunjung.

Verifikasi dengan kamera/provider simulasi:

- 40 tampilan pada 1920×1080, 1440×900, 1366×768, 1080×1920, dan 390×844:
  gambar termuat, tanpa overflow horizontal, kiosk muat tanpa scroll.
- Pilihan awal kosong, status tombol lanjut, pilihan saat kembali, payload
  ID yang dipilih, alur hasil/QR, retry, dan reset sesi lulus.
- `npm run check`, sembilan tes `npm test`, dan `git diff --check` lulus.
- Tidak menjalankan generasi AI berbayar atau mengirim email nyata.

## Email foto opsional dari VPS — 23 Oktober 2026

Halaman hasil/QR menyediakan formulir satu alamat email secara opsional.
Permintaan yang diterima masuk antrean SQLite, diproses worker di VPS, dan
mengirim JPG sebagai lampiran. PNG asli tetap tersedia lewat QR. Ketersediaan
email mengikuti konfigurasi SMTP; jika belum diisi, QR/unduh tetap berfungsi.
Contoh `.env`, environment Compose, dan perintah `npm run email:verify` tersedia.

Verifikasi:

- Sembilan tes otomatis (`npm test`) lulus: format email/header injection,
  validasi token aktif, MIME/JPEG attachment, idempotensi, satu alamat per foto,
  job setelah QR berakhir, pemulihan restart, retry maksimal tiga percobaan,
  status belum pasti setelah timeout, kuota, SMTP nonaktif, dan API privat.
- Browser dengan kamera/API simulasi: formulir dan status sukses dicek pada
  1920×1080, 1440×900, 1366×768, 1080×1920, dan 390×844. Kiosk muat tanpa scroll;
  mobile scroll alami, tanpa overflow horizontal. Opsi nonaktif juga diperiksa.
- `npm run check`, syntax server, `git diff --check`, dan validasi Compose dengan
  `.env.docker.example` lulus.
- Tidak ada email nyata yang dikirim. Autentikasi SMTP, izin alamat From,
  penerimaan inbox/spam, dan lampiran pada email nyata masih memerlukan akun
  SMTP yang diisi operator di VPS dan satu uji kirim ke alamat operator.

Email penerima tidak masuk galeri/buku tamu, tidak dicetak di log SMTP, dan ikut
terhapus saat retensi foto berakhir. Status `sent` berarti SMTP menerima pesan,
bukan bukti inbox delivery. SMTP timeout ambigu tidak otomatis diulang.

## Pilihan jumlah opsional — 23 Oktober 2026

Layar kamera menyediakan pilihan "Ikuti foto", 1, 2, atau 3 pengunjung. Default
"Ikuti foto" tidak mengirim angka dan bukan deteksi wajah otomatis. Jumlah yang
dipilih tidak termasuk tokoh, ditampilkan di konfirmasi, dipertahankan saat
ambil ulang/retry, dan direset pada sesi baru. Nama/gender tetap tidak diminta.
Backend menerima `people` tanpa `guests`; angka menjadi batasan prompt AI dan
tidak menghasilkan row buku tamu.

Verifikasi dengan kamera/provider simulasi:

- Browser 1366×768 dan mobile 390×844: pemilihan jumlah atau melewatinya,
  konfirmasi, ambil ulang, payload multipart, hasil QR, dan reset lulus.
- Kamera desktop muat tanpa scroll; kedua ukuran tanpa overflow horizontal.
- API menerima tanpa jumlah maupun 1–4; menolak 0, 5, negatif, pecahan, teks,
  string kosong, serta data tamu legacy yang tidak cocok.
- Prompt provider sesuai jumlah yang dipilih. Tidak ada record tamu palsu.
- `npm run check`, syntax server, dan `git diff --check` lulus.

Belum dilakukan pengujian generasi AI berbayar/perangkat fisik pada revisi ini.

## Revisi alur tanpa formulir — 23 Oktober 2026

Alur historis: **Tempat → Tokoh → Foto → Cek foto → Hasil QR**. Implementasi aktif
sekarang memakai **Tokoh → Tempat → Foto → Cek foto → Hasil QR**. Pemilihan tempat dan
tokoh berada di layar terpisah. Form nama, jumlah pengunjung, dan jenis kelamin
dihapus, termasuk state dan field multipart dari kiosk. Prompt meminta model
mempertahankan seluruh orang dalam foto sumber beserta jumlah dan urutannya.
API menerima request tanpa metadata pengunjung dan tidak membuat data buku tamu
palsu; validasi payload lama tetap berlaku bila client lama mengirim metadata.

Verifikasi dengan kamera/provider simulasi:

- 30 tampilan pada 1920×1080, 1440×900, 1366×768, 1080×1920, dan 390×844: tidak
  ada gambar rusak atau overflow horizontal; layar kiosk muat tanpa scroll.
- Pemilihan tempat → tokoh → kamera → konfirmasi → hasil berjalan tanpa input.
- Payload browser hanya membawa foto, ID tempat, dan ID tokoh; pilihan tetap
  benar setelah berpindah layar. Retry generasi dan reset sesi berhasil.
- Seluruh 21 kombinasi tokoh/latar diterima backend tanpa metadata tamu;
  provider menerima tiga reference yang sesuai, prompt tanpa jumlah palsu, dan
  database mencatat nol row buku tamu.
- `npm run check`, `node --check server/index.js`, dan `git diff --check` lulus.

Pengiriman email masih berupa rancangan di README, belum menjadi fitur aktif.
Belum dilakukan generasi AI berbayar atau tes perangkat fisik pada revisi ini.
Bagian berikut merekam revisi sebelumnya.

## Revisi UI/UX kiosk — 23 Oktober 2026

- Header dihapus; empat logo digabung ke area pembuka. Lebar konten maksimum
  1760 px, tombol utama 60–78 px, teks utama dan area kamera diperbesar.
- Adegan dan tokoh digabung dalam satu layar. Jumlah orang dan data tamu
  digabung dalam satu layar. Konfirmasi/ambil ulang tetap ada sebelum generasi.
- Indikator menunjukkan empat langkah dengan nama, bukan enam titik tanpa label.
- Tujuh tokoh tersedia, termasuk Adipati Ario. Path thumbnail, reference AI,
  background, dan logo mengikuti folder baru. Prompt Soesalit mengikuti
  referensi anak. PNG dan pustaka referensi asli tidak dihapus oleh revisi ini.
- Nama, lokasi, dan prompt adegan mengikuti gambar baru: Membatik Bersama
  di halaman museum dan Ruang Gagasan di ruang belajar. ID adegan lama tetap
  dipakai agar metadata arsip tetap konsisten.
- Tombol ambil foto diberi label. Countdown menggunakan tiga detik penuh.
  Tombol aktivasi kamera tampil ketika kamera belum siap.
- QR diperbesar menjadi 160–220 px sesuai viewport. Screen baru kembali ke
  posisi scroll paling atas. Portrait dan mobile memakai susunan responsif.

Verifikasi revisi:

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run check` | Lulus: validasi 21 file katalog, relasi tokoh/adegan, dan production build. |
| Browser 1920×1080, 1440×900, 1366×768 | Enam tampilan pada setiap ukuran muat tanpa scroll; tidak ada gambar rusak/overflow horizontal. |
| Browser portrait 1080×1920 | Enam tampilan muat; pilihan tokoh disusun empat kolom dan flow satu kolom. |
| Browser mobile 390×844 | Enam tampilan tanpa overflow horizontal; konten panjang dapat di-scroll. |
| Alur kamera simulasi | Lulus dari mulai, memilih tokoh/latar, validasi data kosong, tiga pengunjung, countdown, ambil ulang, sampai hasil QR dan reset. |
| Retry API simulasi | Galeri gagal → retry berhasil; generasi gagal → data/foto tetap ada → retry berhasil. |
| Reset sesi | Nama dibersihkan, jumlah kembali satu, dan tokoh kembali Kartini. |
| Backend dengan provider simulasi | Seluruh 21 kombinasi dari tujuh tokoh × tiga latar diterima; payload mengandung foto pengunjung, reference tokoh yang dipilih, dan background yang dipilih. |

Pemeriksaan browser memakai kamera dan respons generasi simulasi. Revisi ini
belum diuji dengan kamera/printer fisik atau generasi AI berbayar.

Catatan di bawah merekam pemeriksaan versi sebelumnya; alur dan lokasi aset
saat ini mengikuti revisi di atas.


## Kesimpulan

Alur pengunjung, validasi input, kamera wajib aktif, privasi hasil, layout kiosk,
dan OpenRouter image generation sudah melewati smoke test. Penerimaan akhir tetap
membutuhkan satu tes kamera dan QR dari perangkat nyata setelah deploy.

## Skenario utama yang diuji

| ID | Skenario | Hasil |
| --- | --- | --- |
| HP-01 | Beranda → pilih adegan → pilih tokoh → jumlah orang → data tamu | Lulus. State berpindah sesuai urutan PRD. |
| HP-02 | Satu, dua, dan tiga tamu dengan nama serta gender masing-masing | Lulus. Form dibuat sesuai jumlah dan payload divalidasi server. |
| HP-03 | Masuk ke kamera | Lulus secara UI. `getUserMedia()` dipanggil saat layar kamera mount; stream dihentikan saat keluar. |
| HP-04 | Izin kamera tidak tersedia, ditolak, atau prompt menggantung | Lulus secara UI. Pesan ramah muncul setelah 8 detik; kamera wajib aktif dan pengunjung diarahkan mengaktifkan ulang kamera. |
| HP-05 | Capture kamera → konfirmasi | Lulus. Hasil capture JPEG sementara, preview, adegan, tokoh, dan data tamu tetap tampil; tidak ada jalur upload file di kiosk. |
| HP-06 | Generate gagal | Lulus. Foto dan form dipertahankan, layar kembali ke konfirmasi, tombol berubah menjadi “Coba lagi”. |
| HP-07 | Mulai sesi baru setelah gagal/selesai | Lulus. State, kamera, request generate, dan object URL foto dibersihkan. |
| HP-08 | Galeri berhasil/gagal | Lulus. Modal dapat dibuka/tutup; error API ditampilkan sebagai pesan lokal dengan retry. |
| HP-09 | Desktop 1440×900 dan 1920×1080 | Lulus. Tinggi dokumen sama dengan viewport sehingga tidak ada scroll antar layar. |
| HP-10 | Mobile 390×844 | Lulus. Layout tetap responsif dan scroll natural saat konten lebih tinggi dari viewport. |

## Negative scenario

| ID | Kondisi | Respons yang diverifikasi |
| --- | --- | --- |
| NG-01 | Nama atau gender tamu kosong | UI menahan perpindahan dan menampilkan pesan validasi. |
| NG-02 | Jumlah tamu tidak sama dengan array tamu | API `400 GUESTS_INVALID`. |
| NG-03 | Payload foto tidak valid atau MIME bukan gambar | API `415 UPLOAD_INVALID`/`400 PHOTO_INVALID`; UI kiosk tidak menyediakan upload file. |
| NG-04 | Foto tidak ada/rusak/resolusi melewati batas | API menolak dengan error yang aman dan tidak menyimpan hasil. |
| NG-05 | Adegan atau tokoh tidak cocok | API `400 CONFIG_INVALID`. |
| NG-06 | OpenRouter saldo/rate limit bermasalah | API `402 OPENROUTER_PAYMENT_REQUIRED` atau `429 OPENROUTER_RATE_LIMITED`, retryable. |
| NG-07 | Provider gagal selain quota | API `502 GEMINI_GENERATION_FAILED`; UI kembali ke konfirmasi. |
| NG-08 | Galeri/API mengembalikan HTML atau JSON invalid | Modal menampilkan “Galeri tidak dapat dimuat. Coba lagi.”, bukan error browser mentah. |
| NG-09 | Token download tidak ada atau kedaluwarsa | API `404`/`410`; token berhenti bekerja setelah 60 detik, sementara master PNG, thumbnail, dan record tetap tersimpan sampai masa retensi. |
| NG-10 | Hasil database gagal disimpan setelah file ditulis | File master/thumbnail sementara dibersihkan untuk mencegah orphan disk. |

## Bukti pemeriksaan

- `node --check server/index.js` berhasil.
- `npm run build` berhasil dengan Vite.
- Smoke test HTTP dengan generator mock menghasilkan `200`, `provider: gemini`,
  URL download PNG private, token TTL 60 detik, dan item galeri hanya berisi `thumbnailUrl`.
- Uji OpenRouter nyata dengan `openai/gpt-image-2.5-flare` menghasilkan PNG valid
  1536×1024 setelah prompt identity-lock dan parameter `quality: high`,
  `background: opaque`, serta `n: 1` diterapkan.
- Smoke test invalid MIME menghasilkan `415 UPLOAD_INVALID`.
- Smoke test jumlah tamu tidak sesuai menghasilkan `400 GUESTS_INVALID`.
- Smoke test quota menghasilkan `429` dengan pesan retry `30 detik` yang benar.
- SQLite sementara diuji untuk cleanup hasil kedaluwarsa dan cleanup file saat
  persistence gagal.
- Pada versi awal, asset aktif memakai WebP. Pada revisi 23 Oktober, katalog
  memakai folder baru dan PNG/JPG sumber yang ditambahkan pengguna tetap disimpan.
- Browser lokal diuji dari beranda sampai konfirmasi, penanganan kamera wajib, modal
  galeri, retry, dan reset sesi.

## Temuan yang masih terbuka

1. **P0 — Kamera fisik dan biaya provider.** OpenRouter `openai/gpt-image-2.5-flare`
   sudah berhasil diuji end-to-end dengan output PNG 1536×1024. Uji kamera fisik,
   saldo, rate limit, dan konsistensi wajah tetap perlu dilakukan di VPS.
2. **P1 — Buku tamu.** SQLite dan export CSV ber-token tersedia. Integrasi
   Google Sheets dan panel admin penuh belum dibuat.
3. **P1 — Reference library.** Referensi tokoh kini memakai crop portrait terpisah
   di `public/assets/tokoh_pahlawan/<folder>/reference.webp`, sementara background memakai asset terpisah di
   `public/assets/backgrounds`. Ini mengurangi orang sampingan ikut terbaca sebagai
   identitas, tetapi model generatif tetap tidak dapat menjamin kemiripan pixel-perfect.
4. **P2 — Print.** Tombol dan print CSS tersedia, tetapi printer fisik museum
   belum diuji.

## Verifikasi akhir di VPS

```bash
cd ~/photobooth-ai-jepara
git pull --ff-only
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl -fsS https://photobooth-jepara.duckdns.org:8443/api/health
curl -sSI http://photobooth-jepara.duckdns.org:8080/api/health | grep -i '^location:'
docker compose logs --tail=100 app caddy
```

`Location` HTTP harus menunjuk ke
`https://photobooth-jepara.duckdns.org:8443/`. Setelah itu lakukan satu sesi
nyata dari kamera sampai QR dibuka dari ponsel, lalu uji lagi dengan kuota
Gemini habis untuk memastikan pesan retry tetap ramah pengguna.
