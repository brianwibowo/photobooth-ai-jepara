import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import sharp from 'sharp'
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { characters, scenes, getCharacter, getScene } from '../src/data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const DEFAULT_MODEL = 'gemini-2.5-flash-image'
const RESULT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_PEOPLE = 3
const DEFAULT_MAX_UPLOAD_MB = 8
const DEFAULT_MAX_PIXELS = 24_000_000

const safeJson = (value, fallback) => {
  try { return JSON.parse(value) } catch { return fallback }
}
const now = () => new Date()
const uniqueToken = () => crypto.randomBytes(32).toString('base64url')
const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

function catalogMaps() {
  const characterMap = Object.fromEntries(characters.map((item) => [item.id, item]))
  const sceneMap = Object.fromEntries(scenes.map((item) => [item.id, item]))
  return { characterMap, sceneMap }
}

function createDatabase(dataDir) {
  fsSync.mkdirSync(dataDir, { recursive: true })
  const db = new Database(path.join(dataDir, 'photobooth.db'))
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      image_file TEXT NOT NULL,
      thumbnail_file TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'unknown',
      is_public INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      result_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(result_id) REFERENCES results(id)
    );
  `)
  try { db.exec('ALTER TABLE results ADD COLUMN expires_at TEXT') } catch (error) {
    if (!/duplicate column name/i.test(error.message)) throw error
  }
  return db
}

function getOutputImage(payload) {
  const parts = []
  for (const candidate of payload?.candidates || []) parts.push(...(candidate?.content?.parts || []))
  parts.push(...(payload?.output || []))
  for (const part of parts) {
    const data = part?.inlineData?.data || part?.inline_data?.data || part?.data
    if (part?.inlineData?.mimeType?.startsWith('image/') || part?.inline_data?.mime_type?.startsWith('image/') || (part?.type === 'image' && data)) return data
  }
  return null
}

export function createApp(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(root, 'data')
  const generatedDir = path.join(dataDir, 'generated')
  const uploadDir = path.join(dataDir, 'uploads')
  fsSync.mkdirSync(generatedDir, { recursive: true })
  fsSync.mkdirSync(uploadDir, { recursive: true })
  const db = options.db || createDatabase(dataDir)
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const publicBaseUrl = (options.publicBaseUrl || process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8787}`).replace(/\/$/, '')
  const maxUploadMb = Number(options.maxUploadMb || process.env.MAX_UPLOAD_MB || DEFAULT_MAX_UPLOAD_MB)
  const maxPixels = Number(options.maxPixels || process.env.MAX_UPLOAD_PIXELS || DEFAULT_MAX_PIXELS)
  const timeoutMs = Number(options.timeoutMs || process.env.GEMINI_TIMEOUT_MS || 150000)
  const maxQueue = Number(options.maxQueue || process.env.MAX_GENERATION_QUEUE || 2)
  const minIntervalMs = Number(options.minIntervalMs || process.env.GENERATION_MIN_INTERVAL_MS || 3000)
  const rateWindowMs = Number(options.rateWindowMs || process.env.GENERATION_RATE_WINDOW_MS || 10 * 60 * 1000)
  const rateLimit = Number(options.rateLimit || process.env.GENERATION_RATE_LIMIT || 8)
  const { characterMap, sceneMap } = catalogMaps()
  let active = false
  let queued = 0
  let lastStartedAt = 0
  const requestHistory = new Map()

  async function cleanupExpiredResults() {
    const cutoff = new Date(Date.now() - RESULT_TTL_MS).toISOString()
    const rows = db.prepare('SELECT id, image_file, thumbnail_file, created_at, expires_at FROM results').all()
      .filter((row) => new Date(row.expires_at || row.created_at || cutoff).getTime() <= Date.now())
    if (!rows.length) return 0
    const remove = db.transaction((expired) => {
      const deleteGuests = db.prepare('DELETE FROM guests WHERE result_id = ?')
      const deleteResult = db.prepare('DELETE FROM results WHERE id = ?')
      for (const row of expired) {
        deleteGuests.run(row.id)
        deleteResult.run(row.id)
      }
    })
    remove(rows)
    await Promise.all(rows.flatMap((row) => [row.image_file, row.thumbnail_file]).map(async (file) => {
      if (!/^[a-zA-Z0-9._-]+(?:-thumb)?\.webp$/.test(file || '')) return
      try { await fs.unlink(path.join(generatedDir, file)) } catch (error) { if (error?.code !== 'ENOENT') console.error('Expired file cleanup failed') }
    }))
    return rows.length
  }

  // Results are private for seven days. Reclaim both master and thumbnail
  // files periodically so a busy kiosk does not fill the VPS disk forever.
  void cleanupExpiredResults().catch(() => {})
  const cleanupTimer = setInterval(() => { void cleanupExpiredResults().catch(() => {}) }, 6 * 60 * 60 * 1000)
  cleanupTimer.unref?.()

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|heic|heif))$/i.test(file.mimetype)),
  })
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(cors({ origin: publicBaseUrl, methods: ['GET', 'POST'], credentials: false }))
  app.use(express.json({ limit: '1mb' }))
  app.use('/assets', express.static(path.join(root, 'public', 'assets'), { maxAge: '30d', immutable: true }))

  function validateGuestPayload(body) {
    const people = Number(body.people)
    if (!Number.isInteger(people) || people < 1 || people > MAX_PEOPLE) return 'Jumlah pengunjung harus 1–3 orang.'
    const guests = safeJson(body.guests, null)
    if (!Array.isArray(guests) || guests.length !== people) return 'Data pengunjung belum lengkap.'
    for (const guest of guests) {
      if (!guest || typeof guest.name !== 'string' || !guest.name.trim() || guest.name.trim().length > 80) return 'Nama pengunjung tidak valid.'
      if (!['Perempuan', 'Laki-laki'].includes(guest.gender)) return 'Jenis kelamin pengunjung tidak valid.'
    }
    return null
  }

  async function validateImage(file) {
    if (!file) return 'Foto belum diterima server.'
    try {
      const metadata = await sharp(file.buffer, { limitInputPixels: maxPixels }).metadata()
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxPixels) return 'Resolusi foto terlalu besar.'
      if (!['jpeg', 'png', 'webp', 'heif', 'heic'].includes(metadata.format)) return 'Format foto tidak didukung.'
      return null
    } catch { return 'File foto tidak valid atau rusak.' }
  }

  async function imageData(relativePath) {
    const buffer = await fs.readFile(path.join(root, relativePath))
    const optimized = await sharp(buffer).resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer()
    return { data: optimized.toString('base64'), mimeType: 'image/jpeg' }
  }

  async function generateWithGemini({ photoBuffer, sceneId, characterId, people }) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw Object.assign(new Error('missing api key'), { code: 'MISSING_API_KEY' })
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL
    const scene = sceneMap[sceneId] || getScene(sceneId)
    const character = characterMap[characterId] || getCharacter(characterId)
    const visitor = await sharp(photoBuffer).rotate().resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
    const prompt = [
      `Create a new photorealistic commemorative museum photograph with ${people} visitor(s) together with ${character.name}.`,
      `Place the visitors physically in the selected scene: ${scene.name}, ${scene.location}.`,
      'Preserve each visitor facial identity, skin tone, age and overall likeness from the visitor reference, but do not return the original selfie or a selfie close-up.',
      `Use the approved ${character.name} reference and the museum scene reference as identity and location guides. ${character.prompt || ''} ${scene.prompt || ''}`,
      'Professional documentary museum photography, eye-level 50mm perspective, natural Indonesian skin texture, believable anatomy and hands, warm historical light, 3:2 landscape composition.',
      'Do not add extra people, modern objects, text, borders, watermarks, costume substitutions, or distorted faces/hands.',
    ].join(' ')
    const inputParts = [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: visitor.toString('base64') } }]
    // Keep the AI input data-driven: identity refs and locked scene refs are
    // separate fields, with image kept as the UI thumbnail fallback.
    const characterPath = (character?.reference || character?.image)?.replace(/^\//, '')
    const scenePath = (scene?.background || scene?.image)?.replace(/^\//, '')
    if (characterPath && fsSync.existsSync(path.join(root, 'public', characterPath))) {
      const ref = await imageData(path.join('public', characterPath))
      inputParts.push({ inline_data: { mime_type: ref.mimeType, data: ref.data } })
    }
    if (scenePath && fsSync.existsSync(path.join(root, 'public', scenePath))) {
      const bg = await imageData(path.join('public', scenePath))
      inputParts.push({ inline_data: { mime_type: bg.mimeType, data: bg.data } })
    }
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: inputParts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const raw = await response.text()
    let payload = {}
    try { payload = JSON.parse(raw) } catch { /* handled below */ }
    if (!response.ok) throw Object.assign(new Error('provider request failed'), { code: `GEMINI_HTTP_${response.status}` })
    const image = getOutputImage(payload)
    if (!image) throw Object.assign(new Error('provider returned no image'), { code: 'GEMINI_NO_IMAGE' })
    return Buffer.from(image, 'base64')
  }

  async function fallbackImage({ photoBuffer }) {
    return sharp(photoBuffer).rotate().resize({ width: 1600, height: 1200, fit: 'cover' }).webp({ quality: 86 }).toBuffer()
  }

  async function acquireSlot() {
    if (active || queued >= maxQueue) return false
    queued += 1
    while (active) await new Promise((resolve) => setTimeout(resolve, 25))
    queued -= 1
    const wait = Math.max(0, minIntervalMs - (Date.now() - lastStartedAt))
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    active = true; lastStartedAt = Date.now()
    return true
  }
  function releaseSlot() { active = false }

  function allowGenerationRequest(req) {
    const key = req.ip || req.socket.remoteAddress || 'unknown'
    const threshold = Date.now() - rateWindowMs
    const recent = (requestHistory.get(key) || []).filter((timestamp) => timestamp > threshold)
    if (recent.length >= rateLimit) {
      requestHistory.set(key, recent)
      return false
    }
    recent.push(Date.now())
    requestHistory.set(key, recent)
    if (requestHistory.size > 500) {
      for (const [ip, timestamps] of requestHistory) if (!timestamps.some((timestamp) => timestamp > threshold)) requestHistory.delete(ip)
    }
    return true
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, mode: process.env.GEMINI_API_KEY ? 'gemini' : 'gemini-not-configured', model: process.env.GEMINI_MODEL || DEFAULT_MODEL }))
  app.get('/api/gallery', (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 20)
    const rows = db.prepare("SELECT id, thumbnail_file FROM results WHERE is_public = 1 AND provider = 'gemini' ORDER BY id DESC LIMIT ?").all(limit)
    res.json({ items: rows.map((row) => ({ thumbnailUrl: `/api/gallery/image/${encodeURIComponent(row.thumbnail_file)}` })) })
  })
  app.get('/api/gallery/image/:file', (req, res) => {
    const row = db.prepare("SELECT thumbnail_file FROM results WHERE thumbnail_file = ? AND is_public = 1 AND provider = 'gemini'").get(req.params.file)
    if (!row || !/^[a-zA-Z0-9._-]+-thumb\.webp$/.test(row.thumbnail_file)) return res.status(404).send('Gambar tidak ditemukan.')
    res.type('image/webp').set('Cache-Control', 'public, max-age=604800, immutable').sendFile(path.join(generatedDir, row.thumbnail_file))
  })

  app.post('/api/generate', (req, res, next) => {
    if (!allowGenerationRequest(req)) {
      res.set('Retry-After', String(Math.ceil(rateWindowMs / 1000)))
      return res.status(429).json({ error: 'Batas percobaan tercapai. Silakan tunggu beberapa menit.', code: 'GENERATION_RATE_LIMITED', retryable: true })
    }
    return upload.single('photo')(req, res, (uploadError) => {
    if (uploadError) {
      if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Ukuran foto maksimal ${maxUploadMb} MB.`, code: 'UPLOAD_TOO_LARGE', retryable: false })
      return res.status(415).json({ error: 'Pilih satu file foto JPG, PNG, atau WebP.', code: 'UPLOAD_INVALID', retryable: false })
    }
    next()
  })
  }, async (req, res) => {
    const imageError = await validateImage(req.file)
    if (imageError) return res.status(400).json({ error: imageError, code: 'PHOTO_INVALID', retryable: false })
    const { sceneId, characterId } = req.body
    const scene = sceneMap[sceneId]; const character = characterMap[characterId]
    if (!scene || !character || !Array.isArray(scene.characterIds) || !scene.characterIds.includes(characterId)) return res.status(400).json({ error: 'Adegan atau tokoh tidak valid.', code: 'CONFIG_INVALID', retryable: false })
    const people = Number(req.body.people)
    const guestError = validateGuestPayload(req.body)
    if (guestError) return res.status(400).json({ error: guestError, code: 'GUESTS_INVALID', retryable: false })
    if (!(await acquireSlot())) return res.status(429).json({ error: 'Photobooth sedang sibuk. Silakan coba lagi sebentar.', code: 'GENERATION_BUSY', retryable: true })
    try {
      let output; let provider = 'gemini'
      try { output = await (options.generateWithGemini || generateWithGemini)({ photoBuffer: req.file.buffer, sceneId, characterId, people }) }
      catch (error) {
        console.error('Gemini generation failed', error?.code || 'UNKNOWN')
        if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_LOCAL_FALLBACK === 'true') { output = await fallbackImage({ photoBuffer: req.file.buffer }); provider = 'fallback' }
        else return res.status(502).json({ error: 'Gemini belum berhasil membuat gambar. Periksa API key, model, dan kuota lalu coba lagi.', code: 'GEMINI_GENERATION_FAILED', retryable: true })
      }
      let generatedMeta
      try { generatedMeta = await sharp(output, { limitInputPixels: maxPixels }).metadata() } catch {
        return res.status(502).json({ error: 'Hasil Gemini tidak valid.', code: 'OUTPUT_INVALID', retryable: true })
      }
      if (!generatedMeta.width || !generatedMeta.height || generatedMeta.width * generatedMeta.height > maxPixels) return res.status(502).json({ error: 'Hasil Gemini tidak valid.', code: 'OUTPUT_INVALID', retryable: true })
      const token = uniqueToken(); const stem = crypto.randomBytes(16).toString('hex')
      const imageFile = `${stem}.webp`; const thumbFile = `${stem}-thumb.webp`
      const master = await sharp(output).rotate().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer()
      const thumb = await sharp(master).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer()
      await fs.writeFile(path.join(generatedDir, imageFile), master); await fs.writeFile(path.join(generatedDir, thumbFile), thumb)
      const createdAt = now(); const expiresAt = new Date(createdAt.getTime() + RESULT_TTL_MS).toISOString()
      const guests = safeJson(req.body.guests, [])
      const resultId = db.transaction(() => {
        const result = db.prepare('INSERT INTO results (token,image_file,thumbnail_file,scene_id,character_id,provider,is_public,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)').run(token, imageFile, thumbFile, sceneId, characterId, provider, provider === 'gemini' ? 1 : 0, createdAt.toISOString(), expiresAt)
        const insertGuest = db.prepare('INSERT INTO guests (result_id,name,gender,created_at) VALUES (?,?,?,?)')
        guests.forEach((guest) => insertGuest.run(result.lastInsertRowid, guest.name.trim().slice(0, 80), guest.gender, createdAt.toISOString()))
        return result.lastInsertRowid
      })()
      const downloadUrl = `${publicBaseUrl}/api/download/${token}`
      return res.json({ id: resultId, imageUrl: `/api/download/${token}`, thumbnailUrl: `/api/gallery/image/${encodeURIComponent(thumbFile)}`, qrUrl: downloadUrl, provider, expiresIn: '7 hari' })
    } catch (error) {
      console.error('Generation persistence failed', error?.code || 'UNKNOWN')
      return res.status(500).json({ error: 'Foto belum dapat disimpan. Silakan coba lagi.', code: 'RESULT_SAVE_FAILED', retryable: true })
    } finally { releaseSlot() }
  })

  app.get('/api/download/:token', (req, res) => {
    const row = db.prepare('SELECT image_file, created_at, expires_at FROM results WHERE token = ?').get(req.params.token)
    if (!row) return res.status(404).send('Tautan foto tidak ditemukan.')
    const expiresAt = row.expires_at ? new Date(row.expires_at) : new Date(new Date(row.created_at).getTime() + RESULT_TTL_MS)
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now()) return res.status(410).send('Tautan foto sudah kedaluwarsa.')
    if (!/^[a-zA-Z0-9._-]+\.webp$/.test(row.image_file)) return res.status(404).send('Gambar tidak ditemukan.')
    res.type('image/webp').set('Content-Disposition', 'inline; filename="kisah-kartini.webp"').set('Cache-Control', 'private, no-store').sendFile(path.join(generatedDir, row.image_file))
  })

  app.get('/api/admin/guests.csv', (req, res) => {
    const expected = process.env.ADMIN_TOKEN
    const supplied = req.get('x-admin-token') || req.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!expected || !supplied || expected.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return res.status(401).json({ error: 'Akses admin diperlukan.', code: 'ADMIN_UNAUTHORIZED' })
    const rows = db.prepare('SELECT g.name, g.gender, r.scene_id AS scene, g.created_at AS timestamp FROM guests g JOIN results r ON r.id = g.result_id ORDER BY g.id DESC').all()
    const csv = ['Nama,Jenis Kelamin,Adegan,Timestamp', ...rows.map((row) => [row.name, row.gender, row.scene, row.timestamp].map(csvEscape).join(','))].join('\n') + '\n'
    res.type('text/csv').set('Content-Disposition', 'attachment; filename="buku-tamu.csv"').send(csv)
  })

  if (process.env.NODE_ENV === 'production') { app.use(express.static(path.join(root, 'dist'))); app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html'))) }
  return { app, db, close: () => { clearInterval(cleanupTimer); db.close() } }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const { app } = createApp()
  const port = Number(process.env.PORT || 8787)
  app.listen(port, () => console.log(`Photobooth server listening on ${port}`))
}
