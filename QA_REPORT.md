# QA report — Photobooth AI Museum R.A. Kartini

Tanggal pemeriksaan awal: 22 Oktober 2026.

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
- API menerima tanpa jumlah maupun 1–3; menolak 0, 4, negatif, pecahan, teks,
  string kosong, serta data tamu legacy yang tidak cocok.
- Prompt provider sesuai jumlah yang dipilih. Tidak ada record tamu palsu.
- `npm run check`, syntax server, dan `git diff --check` lulus.

Belum dilakukan pengujian generasi AI berbayar/perangkat fisik pada revisi ini.

## Revisi alur tanpa formulir — 23 Oktober 2026

Alur aktif: **Tempat → Tokoh → Foto → Cek foto → Hasil QR**. Pemilihan tempat dan
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
