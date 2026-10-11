# QA report — Photobooth AI Museum R.A. Kartini

Tanggal pemeriksaan: 11 Oktober 2026.

## Status penerimaan

Aplikasi belum layak disebut selesai penuh karena generasi gambar Gemini belum
berhasil dibuktikan end-to-end pada project API yang memiliki kuota image
generation. Alur UI, validasi server, privasi hasil, dan deployment sudah
diperkeras. Setelah deploy, satu sesi nyata tetap harus diuji dari kamera sampai
QR dibuka dari ponsel.

## Pemeriksaan yang berhasil

- `node --check server/index.js` berhasil.
- `npm run build` berhasil dengan Vite.
- Katalog data memuat 6 tokoh dan 3 adegan; setiap tokoh memiliki reference dan
  prompt, setiap adegan memiliki background dan prompt.
- `docker compose config --quiet` berhasil dengan placeholder untuk secret.
- `createApp()` berhasil membuat dan menutup SQLite pada data directory sementara.
- Browser production dapat membuka domain HTTPS `:8443` dan halaman beranda.
- Layout desktop dikunci satu viewport pada lebar desktop untuk tinggi 900px dan
  1080px; tinggi pendek di bawah 760px kembali mengizinkan scroll agar konten
  tidak terpotong. Mobile tetap memakai scroll normal.
- Kegagalan generate mempertahankan foto dan form, menampilkan pesan, dan
  menyediakan tombol coba lagi. Kamera dihentikan saat berpindah layar dan
  capture memiliki countdown.
- Master hasil hanya dapat diakses melalui token acak yang kedaluwarsa tujuh
  hari. Galeri hanya mengembalikan thumbnail tanpa nama, gender, waktu, adegan,
  atau URL master.
- Hasil dan thumbnail disimpan sebagai WebP. Hasil yang lewat tujuh hari
  dibersihkan berkala untuk menahan pertumbuhan disk.

## Temuan yang masih terbuka

1. **P0 — Gemini.** Probe provider sebelumnya mengembalikan `429` dengan kuota
   Free Tier image `limit: 0`. Server sekarang memakai endpoint resmi
   `generateContent` dan default `gemini-2.5-flash-image`, tetapi key/project di
   VPS harus memiliki billing atau kuota image yang aktif. API key yang pernah
   ditempel di chat harus dirotasi.
2. **P1 — Buku tamu.** SQLite dan export CSV ber-token tersedia. Integrasi
   Google Sheets dan panel admin penuh belum dibuat.
3. **P1 — Reference library.** Asset lokal yang tersisa adalah gambar komposit
   museum, bukan library portrait terpisah untuk semua tokoh. Ini membatasi
   konsistensi wajah output sampai reference yang disetujui dipulihkan.
4. **P2 — Print.** Tombol dan print CSS tersedia, tetapi printer fisik museum
   belum diuji.

## Pemeriksaan yang harus dijalankan di VPS

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl -fsS https://photobooth-jepara.duckdns.org:8443/api/health
curl -sSI http://photobooth-jepara.duckdns.org:8080/api/health | grep -i '^location:'
docker compose logs --tail=100 app caddy
```

`Location` HTTP harus menunjuk ke `https://photobooth-jepara.duckdns.org:8443/`.
Uji satu upload nyata hanya setelah `GEMINI_MODEL=gemini-2.5-flash-image` dan
key baru yang punya kuota sudah berada di `.env` VPS.
