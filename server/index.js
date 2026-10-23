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
import { createPhotoEmailService } from './photo-email.js'
import { buildGenerationPrompt } from './generation-prompt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const DEFAULT_MODEL = 'gemini-nano-banana-2.1'
// Generated masters remain available to the kiosk/gallery for seven days by
// default. Set RESULT_RETENTION_MS=0 to keep the archive until an operator
// removes it. The QR/download token has a much shorter lifetime so a printed
// or displayed QR code cannot be reused indefinitely.
const DEFAULT_RESULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_DOWNLOAD_TTL_MS = 60 * 1000
const RESULT_CONTINUE_GRACE_MS = 10 * 1000
const RESULT_EXTENSION_MS = 15 * 1000
const MAX_PEOPLE = 3
const DEFAULT_MAX_UPLOAD_MB = 8
const DEFAULT_MAX_PIXELS = 24_000_000

const safeJson = (value, fallback) => {
  try { return JSON.parse(value) } catch { return fallback }
}
const uniqueToken = () => crypto.randomBytes(32).toString('base64url')
const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
function formatRetryDelay(value) {
  const match = String(value || '').match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/i)
  if (!match) return ''
  const amount = Number(match[1]); const unit = match[2].toLowerCase()
  const seconds = unit === 'ms' ? amount / 1000 : unit === 'm' ? amount * 60 : unit === 'h' ? amount * 3600 : amount
  if (seconds < 60) return ` Coba lagi dalam ${Math.max(1, Math.ceil(seconds))} detik.`
  if (seconds < 3600) return ` Coba lagi dalam ${Math.ceil(seconds / 60)} menit.`
  return ` Coba lagi dalam ${Math.ceil(seconds / 3600)} jam.`
}

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
      expires_at TEXT,
      download_expires_at TEXT
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
  try { db.exec('ALTER TABLE results ADD COLUMN download_expires_at TEXT') } catch (error) {
    if (!/duplicate column name/i.test(error.message)) throw error
  }
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)')
  db.transaction(() => {
    const migration = 'openrouter-gallery-v1'
    if (db.prepare('SELECT name FROM schema_migrations WHERE name = ?').get(migration)) return
    // Earlier releases marked every OpenRouter result private by mistake.
    // Repair those legacy rows once; later visibility changes stay respected.
    db.prepare("UPDATE results SET is_public = 1 WHERE provider = 'openrouter' AND is_public = 0").run()
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(migration)
  })()
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

async function getOpenRouterImage(payload, fetchImpl) {
  const choice = payload?.choices?.[0]
  const images = choice?.message?.images || []
  for (const img of images) {
    const url = img?.image_url?.url || img?.url || ''
    if (url.startsWith('data:image/')) {
      const base64Data = url.split(',')[1]
      if (base64Data) return Buffer.from(base64Data, 'base64')
    } else if (url.startsWith('http')) {
      const res = await fetchImpl(url)
      return Buffer.from(await res.arrayBuffer())
    }
  }
  const messageContent = choice?.message?.content
  if (Array.isArray(messageContent)) {
    for (const part of messageContent) {
      if (part?.type === 'image_url') {
        const url = part?.image_url?.url || ''
        if (url.startsWith('data:image/')) {
          const base64Data = url.split(',')[1]
          if (base64Data) return Buffer.from(base64Data, 'base64')
        } else if (url.startsWith('http')) {
          const res = await fetchImpl(url)
          return Buffer.from(await res.arrayBuffer())
        }
      }
      if (part?.type === 'image' && (part?.data || part?.source?.data)) {
        return Buffer.from(part.data || part.source.data, 'base64')
      }
    }
  }
  if (Array.isArray(payload?.data)) {
    for (const item of payload.data) {
      if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
      if (item?.url) {
        const res = await fetchImpl(item.url)
        return Buffer.from(await res.arrayBuffer())
      }
    }
  }
  if (typeof messageContent === 'string') {
    const dataMatch = messageContent.match(/data:image\/[a-zA-Z0-9.-]+;base64,([A-Za-z0-9+/=]+)/)
    if (dataMatch?.[1]) return Buffer.from(dataMatch[1], 'base64')
    const urlMatch = messageContent.match(/https?:\/\/[^\s"')]+\.(?:png|jpe?g|webp)/i)
    if (urlMatch?.[0]) {
      const res = await fetchImpl(urlMatch[0])
      return Buffer.from(await res.arrayBuffer())
    }
  }
  return null
}

export function createApp(options = {}) {
  const now = options.now || (() => new Date())
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(root, 'data')
  const generatedDir = path.join(dataDir, 'generated')
  const uploadDir = path.join(dataDir, 'uploads')
  fsSync.mkdirSync(generatedDir, { recursive: true })
  fsSync.mkdirSync(uploadDir, { recursive: true })
  const db = options.db || createDatabase(dataDir)
  const photoEmail = createPhotoEmailService({ db, generatedDir, clock: () => now().getTime(), ...options.emailOptions })
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const publicBaseUrl = (options.publicBaseUrl || process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8787}`).replace(/\/$/, '')
  const maxUploadMb = Number(options.maxUploadMb || process.env.MAX_UPLOAD_MB || DEFAULT_MAX_UPLOAD_MB)
  const maxPixels = Number(options.maxPixels || process.env.MAX_UPLOAD_PIXELS || DEFAULT_MAX_PIXELS)
  const timeoutMs = Number(options.timeoutMs || process.env.GEMINI_TIMEOUT_MS || 150000)
  const maxQueue = Number(options.maxQueue || process.env.MAX_GENERATION_QUEUE || 2)
  const minIntervalMs = Number(options.minIntervalMs || process.env.GENERATION_MIN_INTERVAL_MS || 3000)
  const rateWindowMs = Number(options.rateWindowMs || process.env.GENERATION_RATE_WINDOW_MS || 10 * 60 * 1000)
  const rateLimit = Number(options.rateLimit || process.env.GENERATION_RATE_LIMIT || 8)
  const resultRetentionMs = Number(options.resultRetentionMs ?? process.env.RESULT_RETENTION_MS ?? DEFAULT_RESULT_RETENTION_MS)
  const downloadTtlMs = Number(options.downloadTtlMs ?? process.env.DOWNLOAD_TTL_MS ?? DEFAULT_DOWNLOAD_TTL_MS)
  const { characterMap, sceneMap } = catalogMaps()
  let active = false
  let queued = 0
  let lastStartedAt = 0
  const requestHistory = new Map()

  async function cleanupExpiredResults() {
    if (!(resultRetentionMs > 0)) return 0
    const rows = db.prepare("SELECT id, image_file, thumbnail_file, created_at, expires_at FROM results WHERE NOT EXISTS (SELECT 1 FROM photo_emails e WHERE e.result_id = results.id AND e.status = 'sending')").all()
      .filter((row) => {
        const retentionExpiry = row.expires_at ? new Date(row.expires_at) : new Date(new Date(row.created_at).getTime() + resultRetentionMs)
        return Number.isFinite(retentionExpiry.getTime()) && retentionExpiry.getTime() <= now().getTime()
      })
    if (!rows.length) return 0
    const remove = db.transaction((expired) => {
      const deleteGuests = db.prepare('DELETE FROM guests WHERE result_id = ?')
      const deleteEmails = db.prepare('DELETE FROM photo_emails WHERE result_id = ?')
      const deleteResult = db.prepare('DELETE FROM results WHERE id = ?')
      for (const row of expired) {
        deleteEmails.run(row.id)
        deleteGuests.run(row.id)
        deleteResult.run(row.id)
      }
    })
    remove(rows)
    await Promise.all(rows.flatMap((row) => [row.image_file, row.thumbnail_file]).map(async (file) => {
      if (!/^[a-zA-Z0-9._-]+(?:-thumb)?\.(?:png|webp)$/.test(file || '')) return
      try { await fs.unlink(path.join(generatedDir, file)) } catch (error) { if (error?.code !== 'ENOENT') console.error('Expired file cleanup failed') }
    }))
    return rows.length
  }

  // Keep generated masters/thumbnails for the retention window. Token expiry
  // is intentionally independent: a QR can expire after 60 seconds while the
  // result remains available to the gallery and admin records.
  void cleanupExpiredResults().catch(() => {})
  const cleanupTimer = setInterval(() => { void cleanupExpiredResults().catch(() => {}) }, 6 * 60 * 60 * 1000)
  cleanupTimer.unref?.()

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!/^(image\/(jpeg|png|webp))$/i.test(file.mimetype)) return cb(new Error('UNSUPPORTED_IMAGE_TYPE'))
      cb(null, true)
    },
  })
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(cors({ origin: publicBaseUrl, methods: ['GET', 'POST'], credentials: false }))
  app.use(express.json({ limit: '1mb' }))
  app.use('/assets', express.static(path.join(root, 'public', 'assets'), { maxAge: '30d', immutable: true }))

  function validateGuestPayload(body) {
    // Visitor count is optional and independent of legacy guest book data.
    if (body.people === undefined && body.guests === undefined) return null
    const people = Number(body.people)
    if (!Number.isInteger(people) || people < 1 || people > MAX_PEOPLE) return 'Jumlah pengunjung harus 1–3 orang.'
    if (body.guests === undefined) return null
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
      if (!['jpeg', 'png', 'webp'].includes(metadata.format)) return 'Format foto tidak didukung.'
      return null
    } catch { return 'File foto tidak valid atau rusak.' }
  }

  async function imageData(relativePath) {
    const buffer = await fs.readFile(path.join(root, relativePath))
    const optimized = await sharp(buffer).resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer()
    return { data: optimized.toString('base64'), mimeType: 'image/jpeg' }
  }

  async function prepareGenerationReferences({ photoBuffer, character, scene }) {
    // Never fall back to promotional previews: those may contain sample people.
    const required = [character.reference, scene.background]
    for (const asset of required) {
      if (!asset?.startsWith('/assets/') || !fsSync.existsSync(path.join(root, 'public', asset))) {
        throw Object.assign(new Error('Referensi tokoh atau latar kosong belum tersedia.'), { code: 'REFERENCE_MISSING' })
      }
    }
    const visitor = await sharp(photoBuffer).rotate().resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
    const charRef = await imageData(path.join('public', character.reference))
    const sceneRef = await imageData(path.join('public', scene.background))
    return { visitor, charRef, sceneRef }
  }

  async function callGeminiModel({ model, apiKey, inputParts }) {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: inputParts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const raw = await response.text()
    let payload = {}
    try { payload = JSON.parse(raw) } catch { /* handled below */ }
    if (response.status === 429) {
      const retryDelay = payload?.error?.details?.find((d) => d['@type']?.includes('RetryInfo'))?.retryDelay
      throw Object.assign(new Error(`quota exceeded for ${model}`), { code: 'GEMINI_QUOTA_EXCEEDED', retryDelay, quotaError: true })
    }
    if (!response.ok) throw Object.assign(new Error(`provider request failed (${response.status})`), { code: `GEMINI_HTTP_${response.status}` })
    const image = getOutputImage(payload)
    if (!image) throw Object.assign(new Error('provider returned no image'), { code: 'GEMINI_NO_IMAGE' })
    return Buffer.from(image, 'base64')
  }

  async function generateWithGemini({ photoBuffer, sceneId, characterId, people }) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw Object.assign(new Error('missing api key'), { code: 'MISSING_API_KEY' })
    const configuredModel = process.env.GEMINI_MODEL || DEFAULT_MODEL
    const scene = sceneMap[sceneId] || getScene(sceneId)
    const character = characterMap[characterId] || getCharacter(characterId)
    const { visitor, charRef, sceneRef } = await prepareGenerationReferences({ photoBuffer, character, scene })
    const prompt = buildGenerationPrompt({ scene, character, people })
    const inputParts = [
      { text: prompt },
      { text: 'REFERENCE 1 — VISITOR PHOTO. This is the only source of visitor identities and count. Preserve every visitor exactly once.' },
      { inline_data: { mime_type: 'image/jpeg', data: visitor.toString('base64') } },
      { text: `REFERENCE 2 — ONLY THE SELECTED FIGURE: ${character.name}. Add this person exactly once.` },
      { inline_data: { mime_type: charRef.mimeType, data: charRef.data } },
      { text: 'REFERENCE 3 — EMPTY MUSEUM ENVIRONMENT. Architecture and lighting only; no people to copy.' },
      { inline_data: { mime_type: sceneRef.mimeType, data: sceneRef.data } },
    ]
    return await callGeminiModel({ model: configuredModel, apiKey, inputParts })
  }

  async function generateWithOpenRouter({ photoBuffer, sceneId, characterId, people }) {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw Object.assign(new Error('missing openrouter api key'), { code: 'MISSING_OPENROUTER_KEY' })
    const configuredModel = process.env.OPENROUTER_MODEL || process.env.AI_INFOGRAPHIC_MODEL || 'openai/gpt-image-2.5-flare'

    const scene = sceneMap[sceneId] || getScene(sceneId)
    const character = characterMap[characterId] || getCharacter(characterId)
    const { visitor, charRef, sceneRef } = await prepareGenerationReferences({ photoBuffer, character, scene })
    const prompt = buildGenerationPrompt({ scene, character, people })

    const isImagesEndpoint = configuredModel.includes('gpt-image') ||
      configuredModel.includes('flare') ||
      configuredModel.includes('sunburst') ||
      configuredModel.includes('seedream') ||
      configuredModel.includes('flux') ||
      configuredModel.includes('dall-e') ||
      process.env.OPENROUTER_ENDPOINT === 'images'

    let response
    if (isImagesEndpoint) {
      console.log(`Generating image using OpenRouter /api/v1/images (${configuredModel})...`)
      const inputReferences = [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${visitor.toString('base64')}` } }
      ]
      if (charRef) {
        inputReferences.push({ type: 'image_url', image_url: { url: `data:${charRef.mimeType};base64,${charRef.data}` } })
      }
      if (sceneRef) {
        inputReferences.push({ type: 'image_url', image_url: { url: `data:${sceneRef.mimeType};base64,${sceneRef.data}` } })
      }

      response = await fetchImpl('https://openrouter.ai/api/v1/images', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': publicBaseUrl,
          'X-Title': 'Photobooth AI Museum RA Kartini'
        },
        body: JSON.stringify({
          model: configuredModel,
          prompt: prompt,
          input_references: inputReferences,
          aspect_ratio: '3:2',
          quality: 'high',
          background: 'opaque',
          n: 1
        }),
        signal: AbortSignal.timeout(timeoutMs)
      })
    } else {
      const contentParts = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${visitor.toString('base64')}` } }
      ]
      if (charRef) {
        contentParts.push({ type: 'image_url', image_url: { url: `data:${charRef.mimeType};base64,${charRef.data}` } })
      }
      if (sceneRef) {
        contentParts.push({ type: 'image_url', image_url: { url: `data:${sceneRef.mimeType};base64,${sceneRef.data}` } })
      }
      console.log(`Generating image using OpenRouter /api/v1/chat/completions (${configuredModel})...`)
      response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': publicBaseUrl,
          'X-Title': 'Photobooth AI Museum RA Kartini'
        },
        body: JSON.stringify({
          model: configuredModel,
          modalities: ['image', 'text'],
          messages: [{ role: 'user', content: contentParts }]
        }),
        signal: AbortSignal.timeout(timeoutMs)
      })
    }

    const raw = await response.text()
    let payload = {}
    try { payload = JSON.parse(raw) } catch { /* handled below */ }

    if (response.status === 402) {
      throw Object.assign(new Error(payload?.error?.message || 'Saldo OpenRouter kurang dari $1.00.'), {
        code: 'OPENROUTER_PAYMENT_REQUIRED',
        remedy: 'Top up minimal $1 di https://openrouter.ai/settings/credits untuk membuka fitur gambar.'
      })
    }
    if (response.status === 429) {
      throw Object.assign(new Error(payload?.error?.message || 'Rate limit OpenRouter tercapai.'), {
        code: 'OPENROUTER_RATE_LIMITED'
      })
    }
    if (!response.ok) {
      throw Object.assign(new Error(payload?.error?.message || `OpenRouter request failed (${response.status})`), {
        code: `OPENROUTER_HTTP_${response.status}`
      })
    }

    const imageBuffer = await getOpenRouterImage(payload, fetchImpl)
    if (!imageBuffer) throw Object.assign(new Error('OpenRouter tidak mengembalikan gambar valid'), { code: 'OPENROUTER_NO_IMAGE' })
    return imageBuffer
  }

  async function fallbackImage({ photoBuffer }) {
    return sharp(photoBuffer).rotate().resize({ width: 1600, height: 1200, fit: 'cover' }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
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

  app.get('/api/health', (_req, res) => {
    const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY)
    const hasGemini = Boolean(process.env.GEMINI_API_KEY)
    let mode = 'not-configured'
    if (hasOpenRouter && hasGemini) mode = 'openrouter+gemini'
    else if (hasOpenRouter) mode = 'openrouter'
    else if (hasGemini) mode = 'gemini'
    return res.json({
      ok: true,
      emailAvailable: photoEmail.available,
      mode,
      openrouterModel: process.env.OPENROUTER_MODEL || process.env.AI_INFOGRAPHIC_MODEL || 'openai/gpt-image-2.5-flare',
      geminiModel: process.env.GEMINI_MODEL || DEFAULT_MODEL
    })
  })
  app.get('/api/gallery', (req, res) => {
    const limit = Math.min(Math.max(Math.floor(Number(req.query.limit) || 8), 1), 8)
    const current = now().toISOString()
    const query = resultRetentionMs > 0
      ? "SELECT id, thumbnail_file FROM results WHERE is_public = 1 AND provider IN ('gemini', 'openrouter') AND ((expires_at IS NOT NULL AND expires_at > ?) OR (expires_at IS NULL AND datetime(created_at, '+7 days') > datetime(?))) ORDER BY id DESC LIMIT ?"
      : "SELECT id, thumbnail_file FROM results WHERE is_public = 1 AND provider IN ('gemini', 'openrouter') ORDER BY id DESC LIMIT ?"
    const rows = resultRetentionMs > 0 ? db.prepare(query).all(current, current, limit) : db.prepare(query).all(limit)
    res.json({ items: rows.map((row) => ({ thumbnailUrl: `/api/gallery/image/${encodeURIComponent(row.thumbnail_file)}` })) })
  })
  app.get('/api/gallery/image/:file', (req, res) => {
    const current = now().toISOString()
    const query = resultRetentionMs > 0
      ? "SELECT thumbnail_file FROM results WHERE thumbnail_file = ? AND is_public = 1 AND provider IN ('gemini', 'openrouter') AND ((expires_at IS NOT NULL AND expires_at > ?) OR (expires_at IS NULL AND datetime(created_at, '+7 days') > datetime(?)))"
      : "SELECT thumbnail_file FROM results WHERE thumbnail_file = ? AND is_public = 1 AND provider IN ('gemini', 'openrouter')"
    const row = resultRetentionMs > 0 ? db.prepare(query).get(req.params.file, current, current) : db.prepare(query).get(req.params.file)
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
    const people = req.body.people === undefined ? null : Number(req.body.people)
    const guestError = validateGuestPayload(req.body)
    if (guestError) return res.status(400).json({ error: guestError, code: 'GUESTS_INVALID', retryable: false })
    if (!(await acquireSlot())) return res.status(429).json({ error: 'Photobooth sedang sibuk. Silakan coba lagi sebentar.', code: 'GENERATION_BUSY', retryable: true })
    const guestList = safeJson(req.body.guests, [])
    const writtenFiles = []
    try {
      let output; let provider = 'gemini'
      try {
        if (process.env.OPENROUTER_API_KEY) {
          try {
            console.log('Generating image using OpenRouter models chain...')
            output = await (options.generateWithOpenRouter || generateWithOpenRouter)({ photoBuffer: req.file.buffer, sceneId, characterId, people, guests: guestList })
            provider = 'openrouter'
          } catch (orErr) {
            console.warn('OpenRouter generation failed:', orErr?.code || orErr?.message)
            if (process.env.GEMINI_API_KEY) {
              console.log('Falling back to Google Gemini direct...')
              output = await (options.generateWithGemini || generateWithGemini)({ photoBuffer: req.file.buffer, sceneId, characterId, people, guests: guestList })
              provider = 'gemini'
            } else {
              throw orErr
            }
          }
        } else {
          output = await (options.generateWithGemini || generateWithGemini)({ photoBuffer: req.file.buffer, sceneId, characterId, people, guests: guestList })
          provider = 'gemini'
        }
      } catch (error) {
        console.error('AI generation failed', error?.code || 'UNKNOWN', error?.message)
        if (error?.code === 'OPENROUTER_PAYMENT_REQUIRED') {
          return res.status(402).json({
            error: 'Saldo OpenRouter kurang dari $1.00 (syarat minimum OpenRouter untuk fitur gambar). Silakan isi saldo di https://openrouter.ai/settings/credits.',
            code: 'OPENROUTER_PAYMENT_REQUIRED',
            retryable: true
          })
        }
        if (error?.quotaError) {
          const retryHint = formatRetryDelay(error.retryDelay)
          return res.status(429).json({ error: `Kuota API Gemini untuk model image habis.${retryHint} Aktifkan billing di Google Cloud atau gunakan OpenRouter.`, code: 'GEMINI_QUOTA_EXCEEDED', retryable: true })
        }
        if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_LOCAL_FALLBACK === 'true') { output = await fallbackImage({ photoBuffer: req.file.buffer }); provider = 'fallback' }
        else return res.status(502).json({ error: error?.message || 'AI belum berhasil membuat gambar. Periksa API key, model, dan kuota lalu coba lagi.', code: error?.code || 'GENERATION_FAILED', retryable: true })
      }
      let generatedMeta
      try { generatedMeta = await sharp(output, { limitInputPixels: maxPixels }).metadata() } catch {
        return res.status(502).json({ error: 'Hasil Gemini tidak valid.', code: 'OUTPUT_INVALID', retryable: true })
      }
      if (!generatedMeta.width || !generatedMeta.height || generatedMeta.width * generatedMeta.height > maxPixels) return res.status(502).json({ error: 'Hasil Gemini tidak valid.', code: 'OUTPUT_INVALID', retryable: true })
      const token = uniqueToken(); const stem = crypto.randomBytes(16).toString('hex')
      // Keep the generated result lossless and downloadable as PNG. Gallery
      // thumbnails remain WebP to keep the public gallery lightweight.
      const imageFile = `${stem}.png`; const thumbFile = `${stem}-thumb.webp`
      const master = await sharp(output).rotate().resize({ width: 1800, withoutEnlargement: true }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
      const thumb = await sharp(master).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer()
      await fs.writeFile(path.join(generatedDir, imageFile), master); writtenFiles.push(imageFile)
      await fs.writeFile(path.join(generatedDir, thumbFile), thumb); writtenFiles.push(thumbFile)
      const createdAt = now()
      const expiresAt = resultRetentionMs > 0 ? new Date(createdAt.getTime() + resultRetentionMs).toISOString() : null
      const downloadExpiresAt = new Date(createdAt.getTime() + downloadTtlMs).toISOString()
      const resultId = db.transaction(() => {
        const result = db.prepare('INSERT INTO results (token,image_file,thumbnail_file,scene_id,character_id,provider,is_public,created_at,expires_at,download_expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(token, imageFile, thumbFile, sceneId, characterId, provider, ['gemini', 'openrouter'].includes(provider) ? 1 : 0, createdAt.toISOString(), expiresAt, downloadExpiresAt)
        const insertGuest = db.prepare('INSERT INTO guests (result_id,name,gender,created_at) VALUES (?,?,?,?)')
        guestList.forEach((guest) => insertGuest.run(result.lastInsertRowid, guest.name.trim().slice(0, 80), guest.gender, createdAt.toISOString()))
        return result.lastInsertRowid
      })()
      const downloadUrl = `${publicBaseUrl}/api/download/${token}`
      const downloadSeconds = Math.max(1, Math.ceil(downloadTtlMs / 1000))
      return res.json({ id: resultId, imageUrl: `/api/download/${token}`, thumbnailUrl: `/api/gallery/image/${encodeURIComponent(thumbFile)}`, qrUrl: downloadUrl, provider, expiresIn: `${downloadSeconds} detik`, downloadExpiresAt, retentionExpiresAt: expiresAt, session: { extendEndpoint: `/api/results/${token}/extend`, graceSeconds: RESULT_CONTINUE_GRACE_MS / 1000, extensionSeconds: RESULT_EXTENSION_MS / 1000 }, email: { available: photoEmail.available, endpoint: `/api/results/${token}/email` } })
    } catch (error) {
      await Promise.all(writtenFiles.map(async (file) => { try { await fs.unlink(path.join(generatedDir, file)) } catch { /* best effort */ } }))
      console.error('Generation persistence failed', error?.code || 'UNKNOWN')
      return res.status(500).json({ error: 'Foto belum dapat disimpan. Silakan coba lagi.', code: 'RESULT_SAVE_FAILED', retryable: true })
    } finally { releaseSlot() }
  })

  const extendResult = db.transaction((token) => {
    const row = db.prepare('SELECT image_file, created_at, expires_at, download_expires_at FROM results WHERE token = ?').get(token)
    if (!row) return { code: 404, error: 'Foto tidak ditemukan.' }
    const current = now().getTime()
    const retention = row.expires_at ? Date.parse(row.expires_at) : Infinity
    const expiry = row.download_expires_at ? Date.parse(row.download_expires_at) : row.expires_at ? Date.parse(row.expires_at) : Date.parse(row.created_at) + DEFAULT_DOWNLOAD_TTL_MS
    if (!Number.isFinite(expiry) || (row.expires_at && !Number.isFinite(retention)) || retention <= current || current >= expiry + RESULT_CONTINUE_GRACE_MS) return { code: 410, error: 'Sesi foto sudah berakhir. Silakan mulai sesi baru.' }
    if (!/^[a-zA-Z0-9._-]+\.(?:png|webp)$/.test(row.image_file) || !fsSync.existsSync(path.join(generatedDir, row.image_file))) return { code: 404, error: 'Foto tidak ditemukan.' }
    // Active/repeated requests return the current deadline without accumulating time.
    const nextExpiry = expiry > current ? expiry : Math.min(current + RESULT_EXTENSION_MS, retention)
    if (nextExpiry !== expiry) db.prepare('UPDATE results SET download_expires_at = ? WHERE token = ?').run(new Date(nextExpiry).toISOString(), token)
    return { code: 200, downloadExpiresAt: new Date(nextExpiry).toISOString() }
  })
  app.post('/api/results/:token/extend', (req, res) => {
    res.set('Cache-Control', 'private, no-store')
    const { code, ...payload } = extendResult(req.params.token)
    return res.status(code).json(payload)
  })

  app.post('/api/results/:token/email', (req, res) => {
    res.set('Cache-Control', 'private, no-store')
    const { code, ...payload } = photoEmail.enqueue(req.params.token, req.body?.email, req.ip)
    return res.status(code).json(payload)
  })
  app.get('/api/results/:token/email', (req, res) => {
    res.set('Cache-Control', 'private, no-store')
    const { code, ...payload } = photoEmail.status(req.params.token)
    return res.status(code).json(payload)
  })

  app.get('/api/download/:token', (req, res) => {
    const row = db.prepare('SELECT image_file, created_at, expires_at, download_expires_at FROM results WHERE token = ?').get(req.params.token)
    if (!row) return res.status(404).send('Tautan foto tidak ditemukan.')
    // New rows use a 60-second token TTL. Legacy rows without the column keep
    // their old retention expiry so existing links do not break on migration.
    const expiresAt = row.download_expires_at ? new Date(row.download_expires_at) : (row.expires_at ? new Date(row.expires_at) : new Date(new Date(row.created_at).getTime() + DEFAULT_DOWNLOAD_TTL_MS))
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now()) return res.status(410).send('Tautan foto sudah kedaluwarsa.')
    if (!/^[a-zA-Z0-9._-]+\.(?:png|webp)$/.test(row.image_file)) return res.status(404).send('Gambar tidak ditemukan.')
    const extension = path.extname(row.image_file).toLowerCase() === '.png' ? 'png' : 'webp'
    res.type(extension).set('Content-Disposition', `inline; filename="kisah-kartini.${extension}"`).set('Cache-Control', 'private, no-store').sendFile(path.join(generatedDir, row.image_file))
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
  return { app, db, photoEmail, close: async () => { clearInterval(cleanupTimer); await photoEmail.close(); db.close() } }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const { app, close } = createApp()
  const port = Number(process.env.PORT || 8787)
  const server = app.listen(port, () => console.log(`Photobooth server listening on ${port}`))
  const shutdown = () => {
    server.close(async () => { await close(); process.exit(0) })
    setTimeout(() => process.exit(1), 40000).unref()
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
