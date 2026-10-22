# QA report — Photobooth AI Museum R.A. Kartini

Tanggal pemeriksaan: 22 Oktober 2026.

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
- Semua asset publik yang dipakai aplikasi sudah WebP; PNG/JPG redundan telah
  dihapus.
- Browser lokal diuji dari beranda sampai konfirmasi, penanganan kamera wajib, modal
  galeri, retry, dan reset sesi.

## Temuan yang masih terbuka

1. **P0 — Kamera fisik dan biaya provider.** OpenRouter `openai/gpt-image-2.5-flare`
   sudah berhasil diuji end-to-end dengan output PNG 1536×1024. Uji kamera fisik,
   saldo, rate limit, dan konsistensi wajah tetap perlu dilakukan di VPS.
2. **P1 — Buku tamu.** SQLite dan export CSV ber-token tersedia. Integrasi
   Google Sheets dan panel admin penuh belum dibuat.
3. **P1 — Reference library.** Referensi tokoh kini memakai crop portrait terpisah
   di `public/assets/references`, sementara background memakai asset terpisah di
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
