# PRODUCT REQUIREMENTS DOCUMENT (PRD) 

Photobooth AI Museum R.A. Kartini — Rembang | Version 1.0 

Dokumen dasar untuk perancangan, pengembangan, pengujian, dan deployment 

## **1. Ringkasan Produk** 

Photobooth AI Museum R.A. Kartini adalah aplikasi photobooth berbasis web yang memungkinkan pengunjung museum membuat foto kenangan bersama R.A. Kartini dan beberapa tokoh keluarga/tokoh terkait melalui generative AI. Produk dirancang sebagai pengalaman interaktif di area museum, dengan fokus utama pada pengalaman visual, kesederhanaan penggunaan, keamanan data pengunjung, dan konsistensi identitas tokoh sejarah. 

Versi awal berfokus pada generasi gambar AI. Fitur video 10 detik tidak menjadi bagian dari alur utama versi awal dan disiapkan sebagai modul pengembangan berikutnya. 

### **Tujuan Utama** 

- Memberikan pengalaman museum yang interaktif dan memorable. 

- Memungkinkan pengunjung berfoto dalam adegan historis bersama tokoh yang dipilih. 

- Mempertahankan konsistensi wajah dan karakter tokoh berdasarkan reference library yang telah disetujui. 

- Menyediakan hasil gambar yang dapat diunduh secara privat melalui QR code. 

- Membangun galeri publik berupa arsip visual hasil generasi AI tanpa menampilkan identitas pengunjung. 

- Menyediakan buku tamu digital yang dapat diakses pihak museum. 

## **2. Prinsip Produk** 

|Prinsip|Ketentuan|
|---|---|
|Museum-first|Tampilan dan alur harus terasa sebagai fasilitas<br>museum, bukan aplikasi AI generik.|
|Visual fidelity|Desain implementasi mengikuti visual hierarchy,<br>komposisi, warna, tipografi, dan karakter UI dari<br>desain Canva yang disediakan.|
|Responsive & stable|Layout tidak bergantung pada posisi absolut/canvas<br>tetap dan harus tetap rapi pada resolusi perangkat<br>target.|
|Privacy by design|Galeri publik hanya menampilkan gambar; identitas<br>dan metadatapengunjungtidak ditampilkan.|
|Modular AI|Tokoh, adegan, background, reference image, dan<br>prompt dipisahkan sehingga dapat ditambah tanpa<br>mengubah core flow.|
|Fail-safe|Jika AI gagal, timeout, atau API bermasalah, aplikasi<br>harus menampilkan state error yang jelas dan tidak<br>kehilangan data sesi.|



## **3. Ruang Lingkup V1** 

### **Termasuk** 

- Home / landing screen. 

- Scene selector. 

Photobooth AI Museum R.A. Kartini — PRD V1.0 

- Galeri pengunjung sebagai pop-up dari Home/Scene selector sesuai desain UI. 

- Pemilihan adegan dan tokoh. 

- Pemilihan jumlah pengunjung: 1–3 orang. 

- Form data pengunjung: Nama dan Jenis Kelamin. 

- Kamera/capture foto. 

- Konfirmasi foto sebelum AI diproses. 

- Generasi image AI. 

- Loading screen dengan animasi/preview terbatas dari hasil pengunjung sebelumnya. 

- Result screen. 

- Download personal melalui QR code. 

- Gallery publik dengan hasil terbaru di posisi teratas. 

- Pencatatan buku tamu ke spreadsheet. 

- Struktur reference library dan prompt library. 

- Admin/developer access untuk arsip dan data. 

### **Tidak termasuk V1** 

- Generasi video sebagai bagian dari flow utama. 

- Login pengunjung. 

- Pengumpulan usia. 

- Pengumpulan domisili. 

- Publikasi nama pengunjung pada gallery. 

- Publikasi tanggal/jam/adegan pada gallery. 

- Akses pengunjung terhadap arsip foto orang lain. 

- Dashboard admin kompleks. 

## **4. User Roles** 

|Role|Hak Akses|
|---|---|
|Pengunjung|Menggunakan photobooth, membuat foto, menerima<br>QR untuk hasilnya sendiri.|
|Museum/Admin|Mengakses data buku tamu dan arsip sesuai<br>kebutuhan operasional.|
|Developer|Mengelola konfigurasi, reference library, prompt,<br>database/storage, API, dan maintenance.|



## **5. User Flow Utama** 

1. 01 HOME → Pengunjung melihat konsep Photobooth AI dan dapat memilih MULAI atau membuka GALERI. 

2. 02 PILIH ADEGAN → Pengunjung memilih adegan; setiap adegan dapat memiliki tokoh dan background berbeda. 

3. 03 JUMLAH ORANG → Pilih 1, 2, atau 3 orang. 

4. 04 KENALKAN DIRI ANDA → Setiap orang mengisi Nama dan Jenis Kelamin. 

5. 05 FOTO → Kamera menangkap foto pengunjung. 

6. 06 KONFIRMASI FOTO → Pengunjung memastikan foto sudah benar sebelum diproses. 

7. 07 GENERATING → Sistem mengirim foto + reference tokoh + background + prompt ke image generation API. 

8. 08 HASIL → Menampilkan hasil akhir, caption/pesan museum, logo, download/QR, cetak, dan opsi video sebagai fitur lanjutan. 

Photobooth AI Museum R.A. Kartini — PRD V1.0 

### **Gallery Flow** 

- Gallery dibuka sebagai pop-up/modal dari area yang ditentukan desain. 

- Gallery hanya menampilkan hasil image. 

- Urutan: hasil terbaru tampil paling atas. 

- Frontend hanya mengambil sejumlah kecil hasil terbaru (target 12–20 item) untuk mencegah beban browser meningkat. 

- Metadata identitas pengunjung tidak dirender di gallery. 

## **6. Detail Tiap Screen** 

|Screen|Requirement|
|---|---|
|01 — HOME|Headline konsep 'Kisah Kartini', tombol MULAI, akses<br>GALERI, branding museum, dan visual hero sesuai<br>desain referensi.|
|02 — PILIH ADEGAN|Kartu/thumbnail adegan; setiap pilihan terhubung ke<br>konfigurasi character+background+prompt.|
|03 — JUMLAH ORANG|Pilihan 1, 2, atau 3 orang. Sistem menyimpan jumlah<br>sebagai session state.|
|04 — KENALKAN DIRI ANDA|Form per orang: Nama dan Jenis Kelamin. Untuk 3<br>orang dibuat 3 record individu pada spreadsheet<br>dengan timestamp/adegan yang sama.|
|05 — FOTO|Camera capture. Validasi bahwa foto tersedia<br>sebelum lanjut.|
|06 — KONFIRMASI|Preview foto, ringkasan pilihan adegan/tokoh, tombol<br>kembali dan lanjut proses.|
|07 — GENERATING|Progress state, pesan singkat, dan visual memory<br>carousel terbatas. Tidak memuat seluruhgallery.|
|08 — HASIL|Hasil image dalam komposisi polaroid/print-ready<br>sesuai desain. Caption dua baris di samping logo<br>Museum R.A. Kartini pada area bawah.|



## **7. Character & Scene Architecture** 

Sistem tidak boleh meng-hardcode satu tokoh. Character dan scene harus menjadi data/configuration yang dapat ditambah. 

|Entity|Contoh Data|
|---|---|
|Character|R.A. Kartini, Kardinah, Roekmini, Sosrokartono, dan<br>tokoh lainyangdisetujui.|
|Scene|Ruang keluarga, ruang museum, halaman, atau<br>adegan historis lain.|
|Background|Reference image background yang dikunci per<br>scene.|
|Character Reference|Front/3Q/profile atau reference lain sesuai kebutuhan<br>konsistensi.|
|Prompt|Prompt khusus character danprompt khusus scene.|



### **Contoh Struktur Folder** 

- src/data/characters/ 

- src/data/scenes/ 

- src/prompts/global/ 

- src/prompts/characters/ 

- src/prompts/scenes/ 

Photobooth AI Museum R.A. Kartini — PRD V1.0 

- src/assets/references/characters/ 

- src/assets/references/backgrounds/ 

### **Aturan Prompt** 

Setiap prompt disusun modular dengan standar: 

- SUBJECT — identitas tokoh dan pengunjung. 

- STYLE — photorealistic historical Indonesian museum portrait. 

- POSE/COMPOSITION — sesuai adegan. 

- LIGHTING — sesuai reference scene. 

- BACKGROUND — locked to selected scene reference. 

- IDENTITY LOCK — wajah pengunjung tidak boleh diubah secara tidak wajar; karakter mengikuti master reference. 

- CONSTRAINTS — no unwanted character substitution, no distorted hands/faces, no modern objects, no accidental costume changes. 

## **8. AI Image Generation** 

### **Input** 

- Visitor photo. 

- Selected character reference(s). 

- Selected background reference. 

- Scene prompt. 

- Character prompt. 

- Global quality/identity constraints. 

### **Output** 

- Final image untuk result screen. 

- Thumbnail/optimized derivative untuk gallery jika diperlukan. 

- Private storage reference untuk QR download. 

### **AI Provider Strategy** 

V1 harus menggunakan provider/model yang memiliki API resmi dan dapat dipanggil dari aplikasi. Google Flow dapat digunakan untuk eksplorasi kreatif dan pengujian kualitas, tetapi Flow bukan fondasi integrasi aplikasi. Integrasi produksi harus menggunakan API resmi model yang dipilih. 

## **9. Data & Privacy** 

### **Buku Tamu** 

|Field|Status|Keterangan|
|---|---|---|
|Nama|Simpan|Diisi per orang.|
|JenisKelamin|Simpan|Diisiperorang.|
|Adegan|Simpan|Untuk kebutuhan<br>administrasi/statistik museum.|
|Tanggal|Simpan|Timestamp.|
|Jam|Simpan|Timestamp.|
|Usia|Tidak digunakan V1|Dihindari untuk meminimalkan<br>data.|



Photobooth AI Museum R.A. Kartini — PRD V1.0 

|Domisili|Tidak digunakan V1|Dihindari untuk meminimalkan<br>data.|
|---|---|---|



### **Aturan Multi-person** 

Jika terdapat 3 pengunjung dalam satu sesi, spreadsheet membuat 3 baris individu. Masing-masing berisi nama dan jenis kelamin. Adegan serta timestamp dapat sama karena berasal dari sesi yang sama. 

### **Gallery Privacy** 

- Gallery publik hanya menampilkan image. 

- Jangan tampilkan nama, jenis kelamin, tanggal, jam, scene, atau metadata pribadi. 

- Gallery tidak boleh menyediakan endpoint publik yang dapat menelusuri seluruh arsip. 

- Homepage hanya meminta subset hasil terbaru. 

### **QR Download Privacy** 

- QR harus mengarah ke token/URL privat yang tidak mudah ditebak. 

- Token tidak boleh menggunakan ID database berurutan sebagai secret. 

- Pengunjung hanya dapat mengakses hasil yang terkait dengan token tersebut. 

- Admin/developer memiliki akses terpisah untuk kebutuhan pengelolaan. 

- Jika QR dibagikan ke orang lain, akses sesuai kebijakan token; untuk V1 disarankan token acak dan tidak memuat informasi pribadi. 

## **10. Storage & Gallery** 

Hasil AI tidak disimpan hanya di browser/localStorage. Untuk deployment museum, hasil yang akan ditampilkan di gallery atau diakses melalui QR harus disimpan pada storage/server yang dapat diakses aplikasi. 

|Komponen|Fungsi|
|---|---|
|Database|Metadata internal, session, timestamp, scene, token<br>reference,statusgeneration.|
|Object Storage|File image hasil AI dan derivative/thumbnail.|
|Public Gallery Query|Mengambil hanya hasil yang ditandai boleh tampil di<br>gallery.|
|Private Result|Hasil yang diakses melalui token QR.|



## **11. Loading & Performance** 

- Jangan memuat seluruh gallery pada loading screen. 

- Gunakan subset kecil hasil terbaru untuk animasi/preview. 

- Target awal 12–20 image preview maksimal dalam satu request. 

- Gunakan thumbnail yang telah dioptimasi, bukan file master beresolusi penuh. 

- Implementasikan lazy loading. 

- Gunakan pagination/limit pada query gallery. 

- Jika AI generation lama, tampilkan progress state tanpa melakukan request berulang. 

- Jika generation gagal, sediakan tombol coba lagi tanpa mengulang seluruh form. 

## **12. Result / Polaroid** 

Hasil akhir mengikuti konsep visual yang sudah dirancang. Area bawah image menggunakan komposisi polaroid dengan logo Museum R.A. Kartini di pojok kiri bawah dan teks/caption rata dua baris di sebelah kanan logo. Caption tidak boleh menampilkan data pribadi pengunjung. 

Photobooth AI Museum R.A. Kartini — PRD V1.0 

## **13. Monetization / Feature Policy** 

Model layanan yang direncanakan: fasilitas photobooth menjadi bagian dari pengalaman kunjungan museum. Hak penggunaan dasar dapat diberikan sebagai fasilitas pengunjung. Fitur tambahan seperti pengulangan generasi setelah batas fasilitas, cetak, dan video dapat diperlakukan sebagai layanan berbayar yang ditanggung pengunjung. Nilai tarif belum ditentukan dalam PRD ini. 

## **14. Deployment** 

Aplikasi sebaiknya tetap berupa web application yang dideploy, bukan hanya berjalan local di komputer museum. Local mode dapat disediakan sebagai fallback/operasional internal jika diperlukan. 

|Komponen|Rekomendasi V1|
|---|---|
|Frontend|Web deployment; Netlify dapat digunakan untuk<br>frontend bila stack dan kebutuhan cocok.|
|Domain|Custom domain museum/project bila diperlukan;<br>domain bukan syarat teknis untuk prototipe.|
|Backend/API|Server/API layer untuk menjaga secret API key dan<br>mengelolageneration.|
|Database|Database cloud yang mendukung kebutuhan<br>session, gallery, dan admin.|
|Storage|Object storage untuk image hasil.|
|Spreadsheet|Google Sheets sebagai buku tamu tahap awal.|



## **15. Security** 

- API key tidak boleh ditaruh langsung pada frontend/public JavaScript. 

- Secret harus berada pada server/API route/backend. 

- QR token dibuat random dan cukup panjang. 

- Validasi file upload/capture sebelum dikirim ke API. 

- Batasi ukuran file dan resolusi input. 

- Rate limit generation agar sistem tidak disalahgunakan. 

- Pisahkan public gallery asset dan private result asset. 

- Jangan expose database credentials di client. 

## **16. Technical Architecture — Target** 

Arsitektur target bersifat modular dan beginner-friendly. Nama library dapat berubah selama implementasi, tetapi pemisahan tanggung jawab berikut dipertahankan. 

- UI Layer — React/Next.js components. 

- State Layer — session state untuk pilihan scene, jumlah orang, form, photo, generation status. 

- Data Layer — configuration JSON/TS untuk character dan scene. 

- API Layer — server-side endpoints untuk AI generation, gallery query, QR result, dan spreadsheet integration. 

- Storage Layer — database + object storage. 

- Admin Layer — akses terbatas untuk data dan arsip. 

Photobooth AI Museum R.A. Kartini — PRD V1.0 

## **17. Suggested Folder Structure** 

src/ 



<!-- Start of picture text -->
├── app/<br>│   ├── page.tsx<br>│   ├── photobooth/<br>│   ├── result/<br>│   └── api/<br>│<br>├── components/<br>│   ├── home/<br>│   ├── scene/<br>│   ├── camera/<br>│   ├── guest/<br>│   ├── generating/<br>│   ├── result/<br>│   └── gallery/<br>│<br>├── data/<br>│   ├── characters/<br>│   └── scenes/<br>│<br>├── prompts/<br>│   ├── global/<br>│   ├── characters/<br>│   └── scenes/<br>│<br>├── lib/<br>│   ├── ai/<br>│   ├── storage/<br>│   ├── gallery/<br>│   ├── qr/<br>│   └── sheets/<br>│<br>├── assets/<br>│   └── references/<br>│<br>└── types/<br><!-- End of picture text -->

## **18. Development Phases** 

|Phase|Pekerjaan|Acceptance|
|---|---|---|
|Phase 0 — Project Foundation|Repo baru, environment, folder<br>structure, design references,<br>routing dasar.|Build berjalan.|
|Phase 1 — UI/UX|Implementasi Home sampai Result<br>menggunakan mock data, tanpa<br>AI.|Visual mendekati desain referensi<br>dan responsive.|
|Phase 2 — Scene & Character<br>System|Data-driven character, scene,<br>background, reference, prompt.|Menambah tokoh tidak<br>membutuhkan perubahan core UI.|



Photobooth AI Museum R.A. Kartini — PRD V1.0 

|Phase 3 — Camera & Session|Camera capture, jumlah orang,<br>form, confirmation.|Session berjalan end-to-end tanpa<br>AI.|
|---|---|---|
|Phase4 —Spreadsheet|Kirimdata bukutamu perorang.|3 orang=3 baris.|
|Phase 5 — AI Integration|API generation + error handling +<br>result storage.|Image berhasil dibuat dari input<br>nyata.|
|Phase 6 — Gallery & QR|Gallery terbaru + private result<br>QR.|Public gallery tidak membocorkan<br>metadata.|
|Phase 7 — Deployment|Hosting, domain, environment<br>variables, storage, security.|Bisa digunakan pada perangkat<br>museum.|
|Phase 8— Print|Layoutprintdanprinter workflow.|Hasildapatdiproses untukcetak.|
|Phase 9 — Video (Future)|Veo/API video 10 detik sebagai<br>add-on.|Tidak memengaruhi core image<br>flow.|



## **19. Acceptance Criteria V1** 

- Pengunjung dapat menyelesaikan flow Home → Scene → Jumlah Orang → Data → Foto → Konfirmasi → Generate → Result. 

- Pilihan tokoh dapat berubah tanpa mengubah source code core generation flow. 

- Background mengikuti scene yang dipilih. 

- Hasil generation tersimpan dan dapat ditampilkan kembali. 

- Gallery hanya menampilkan image. 

- Gallery menampilkan hasil terbaru terlebih dahulu. 

- Gallery tidak menampilkan nama/metadata pengunjung. 

- Untuk 3 orang, buku tamu membuat 3 record. 

- QR hasil hanya mengarah ke hasil milik sesi tersebut. 

- API secret tidak terekspos pada browser. 

- Aplikasi tetap rapi pada ukuran layar target dan tidak berubah total dari desain referensi. 

- Jika API gagal, user mendapatkan error state dan opsi retry. 

## **20. Prompt untuk Codex — Kickoff** 

Prompt berikut digunakan setelah repository baru dan file design reference sudah disiapkan. Jangan meminta Codex langsung mengerjakan seluruh sistem. 

Anda adalah senior frontend/full-stack engineer yang membantu membangun Photobooth AI Museum R.A. Kartini. 

Baca seluruh file PRD dan design reference yang tersedia di repository sebelum melakukan perubahan. 

#### TUGAS FASE PERTAMA: 

1. Audit repository saat ini. 

2. Jika project masih kosong/berantakan, jangan mempertahankan arsitektur lama secara otomatis. 

3. Buat arsitektur modular sesuai PRD. 

4. Implementasikan UI/UX Phase 1 saja menggunakan mock data. 

5. Jangan integrasikan AI API, database, Google Sheets, QR, atau video pada fase ini. 

6. Gunakan design reference sebagai acuan visual. Jangan melakukan redesign. 

7. Pertahankan hierarchy, spacing, typography, button placement, visual tone, dan komposisi. 

8. Buat layout responsive yang tidak bergantung pada fixed canvas positioning. 

9. Pisahkan components, data, prompts, assets, dan utilities sesuai struktur PRD. 

10. Setelah selesai, jalankan build/test dan laporkan file yang dibuat/diubah serta masalah yang ditemukan. 

Photobooth AI Museum R.A. Kartini — PRD V1.0 

#### ATURAN: 

- Jangan mengarang fitur yang tidak ada di PRD. 

- Jangan menghapus asset reference tanpa konfirmasi. 

- Jangan memasukkan API key ke frontend. 

- Jangan membuat gallery mengambil seluruh data. 

- Jangan membuat data pribadi tampil pada public gallery. 

- Jangan mengimplementasikan video pada fase ini. 

## **21. Open Decisions / Belum Diputuskan** 

- Provider/model image generation produksi. 

- Format dan ukuran final image. 

- Storage provider. 

- Database provider. 

- Domain final. 

- Batas jumlah generation fasilitas per pengunjung. 

- Harga generation tambahan, print, dan video. 

- Spesifikasi printer. 

- Retensi arsip gallery dan private result. 

- Apakah gallery membutuhkan moderasi sebelum tampil publik. 

## **22. Catatan Implementasi** 

Dokumen ini adalah PRD V1 dan menjadi baseline pengembangan. Perubahan fitur sebaiknya dicatat sebagai revisi PRD atau issue agar arsitektur tidak kembali berkembang secara tidak terkontrol. 

Photobooth AI Museum R.A. Kartini — PRD V1.0 

