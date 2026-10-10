# Photobooth AI Museum R.A. Kartini

A lightweight, museum-first photobooth web app for a 2 GB VPS. Visitors select a scene, choose the group size, enter the guest book details, capture a photo, and receive an AI-generated WebP result with a private QR download link.

## Stack

- React + Vite: responsive single-page experience with no heavy UI framework.
- Express: small server/API layer that keeps the Gemini secret off the client.
- SQLite: local metadata and guest book storage, suitable for a single museum kiosk/VPS.
- Sharp: converts input/output to WebP and creates gallery thumbnails.
- Gemini image generation: configurable through `GEMINI_MODEL`; if the provider is unavailable, the flow uses a local branded fallback so a visitor session does not get stuck.

## Run locally

```bash
cp .env.example .env
# Add GEMINI_API_KEY in .env (server-side only)
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

Pastikan TCP 80/443 terbuka di firewall VPS/provider dan tidak digunakan layanan lain.
Caddy mengurus sertifikat serta redirect HTTP ke HTTPS; QR memakai domain yang sama.
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

## Main API

- `GET /api/health`: readiness and provider mode.
- `GET /api/gallery?limit=12`: newest public thumbnails only (max 20).
- `POST /api/generate`: multipart upload with `photo`, `sceneId`, `characterId`, `people`, and `guests`.
- `GET /api/download/:token`: token-based private result access used by the QR.

The gallery response intentionally contains only image URLs and opaque IDs; guest names, gender, scene, and timestamps remain server-side. Generated masters and thumbnails are WebP to reduce bandwidth and disk usage.
