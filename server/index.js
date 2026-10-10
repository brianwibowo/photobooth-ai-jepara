import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import sharp from 'sharp'
import QRCode from 'qrcode'
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const port = Number(process.env.PORT || 8787)
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/$/, '')
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 8)
const generatedDir = path.join(root, 'data', 'generated')
const uploadDir = path.join(root, 'data', 'uploads')
await fs.mkdir(generatedDir, { recursive: true }); await fs.mkdir(uploadDir, { recursive: true })

const db = new Database(path.join(root, 'data', 'photobooth.db'))
db.pragma('journal_mode = WAL')
db.exec(`CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, image_file TEXT NOT NULL, thumbnail_file TEXT NOT NULL, scene_id TEXT NOT NULL, character_id TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'unknown', is_public INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS guests (id INTEGER PRIMARY KEY AUTOINCREMENT, result_id INTEGER NOT NULL, name TEXT NOT NULL, gender TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(result_id) REFERENCES results(id));`)
try { db.exec("ALTER TABLE results ADD COLUMN provider TEXT NOT NULL DEFAULT 'unknown'") } catch (error) { if (!/duplicate column name/i.test(error.message)) throw error }

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use('/media', express.static(generatedDir, { maxAge: '7d', immutable: true }))
app.use('/assets', express.static(path.join(root, 'public', 'assets'), { maxAge: '30d', immutable: true }))
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadMb * 1024 * 1024 } })

const sceneMeta = {
  gerbang: { name: 'Di Gerbang Museum', location: 'Museum R.A. Kartini Rembang', prompt: 'in front of the authentic main entrance of Museum R.A. Kartini Rembang', background: 'public/assets/gerbang.png' },
  keluarga: { name: 'Potret Keluarga', location: 'Ruang keluarga Jawa', prompt: 'in a warm Javanese family room with museum heritage details', background: 'public/assets/gerbang.png' },
  sahabat: { name: 'Ruang Gagasan', location: 'Ruang arsip museum', prompt: 'inside a quiet museum archive room with old letters and warm wood', background: 'public/assets/gerbang.png' }
}
const characterMeta = {
  kartini: 'R.A. Kartini', kardinah: 'R.A. Kardinah', roekmini: 'R.A. Roekmini', sosrokartono: 'R.M.P. Sosrokartono', sosroningrat: 'R.M.A.A. Sosroningrat', soesalit: 'Soesalit'
}
const referenceMap = {
  kartini: 'public/assets/kartini.png', kardinah: 'public/assets/kardinah.png', roekmini: 'public/assets/roekmini.png', sosrokartono: 'public/assets/sosrokartono.png', sosroningrat: 'public/assets/sosroningrat.png', soesalit: 'public/assets/soesalit.png'
}

function safeJson(value, fallback) { try { return JSON.parse(value) } catch { return fallback } }
function uniqueToken() { return crypto.randomBytes(24).toString('base64url') }
function now() { return new Date().toISOString() }
async function imageData(filePath) { const buffer = await fs.readFile(path.join(root, filePath)); return { data: buffer.toString('base64'), mimeType: path.extname(filePath).toLowerCase() === '.jpg' ? 'image/jpeg' : 'image/png' } }

async function generateWithGemini({ photoBuffer, sceneId, characterId, people }) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY belum diisi')
  const model = process.env.GEMINI_MODEL || 'gemini-nano-banana-2.1'
  const scene = sceneMeta[sceneId] || sceneMeta.gerbang
  const character = characterMeta[characterId] || characterMeta.kartini
  const visitor = await sharp(photoBuffer).resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  const prompt = `Create a new photorealistic commemorative museum photograph, not a copy of the input selfie. Re-render the ${people} visitor(s) from the visitor reference as natural full-body or three-quarter subjects together with ${character}. Place them physically in the selected museum scene: ${scene.prompt}. The visitor photo is an identity reference only: preserve each person's facial identity, skin tone, age, hair, and overall likeness while changing the pose, clothing context, lighting, and environment to match the historical photograph. ${character} must remain consistent with the approved historical reference and stand naturally beside the visitors. Use the supplied museum background reference as the location guide. Professional full-frame 50mm camera, eye-level perspective, realistic Indonesian skin texture, believable anatomy and hands, warm late-afternoon light, documentary museum photography, 3:2 landscape composition. Do not return the original selfie, do not make a selfie close-up, do not add extra people, modern objects, text, borders, or watermarks.`
  const input = [{ type: 'text', text: prompt }, { type: 'image', mime_type: 'image/jpeg', data: visitor.toString('base64') }]
  const referencePath = referenceMap[characterId]
  if (referencePath && fsSync.existsSync(path.join(root, referencePath))) { const ref = await imageData(referencePath); input.push({ type: 'image', mime_type: ref.mimeType, data: ref.data }) }
  if (scene.background && fsSync.existsSync(path.join(root, scene.background))) { const background = await imageData(scene.background); input.push({ type: 'image', mime_type: background.mimeType, data: background.data }) }
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify({ model, input }), signal: AbortSignal.timeout(150000) })
  const raw = await response.text()
  let payload
  try { payload = JSON.parse(raw) } catch { payload = {} }
  if (!response.ok) throw new Error(`Gemini Interactions API ${response.status}: ${payload.error?.message || raw.slice(0, 240)}`)
  const imageDataBlock = payload.output_image?.data || payload.output?.find?.((block) => block.type === 'image')?.data
  if (!imageDataBlock) throw new Error('Gemini merespons tanpa output_image')
  return Buffer.from(imageDataBlock, 'base64')
}

async function createFallback({ photoBuffer, sceneId, characterId }) {
  const scene = sceneMeta[sceneId] || sceneMeta.gerbang
  const character = characterMeta[characterId] || characterMeta.kartini
  const base = await sharp(photoBuffer).rotate().resize({ width: 1600, height: 1200, fit: 'cover' }).toBuffer()
  const overlay = Buffer.from(`<svg width="1600" height="1200"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#173e40" stop-opacity=".08"/><stop offset="1" stop-color="#173e40" stop-opacity=".66"/></linearGradient></defs><rect width="1600" height="1200" fill="url(#g)"/><rect x="64" y="64" width="1472" height="1072" fill="none" stroke="#f2eee5" stroke-opacity=".68" stroke-width="3"/><text x="96" y="1010" font-family="Georgia" font-size="42" fill="#f2eee5">${scene.name}</text><text x="96" y="1068" font-family="Arial" font-size="24" letter-spacing="4" fill="#edc98e">BERSAMA ${character.toUpperCase()}</text></svg>`)
  return sharp(base).composite([{ input: overlay }]).webp({ quality: 86 }).toBuffer()
}

app.get('/api/health', (_req, res) => res.json({ ok: true, mode: process.env.GEMINI_API_KEY ? 'gemini-interactions' : 'gemini-not-configured', model: process.env.GEMINI_MODEL || 'gemini-nano-banana-2.1' }))
app.get('/api/gallery', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 20)
  const rows = db.prepare("SELECT id, token, image_file, thumbnail_file, created_at FROM results WHERE is_public = 1 AND provider = 'gemini' ORDER BY id DESC LIMIT ?").all(limit)
  res.json({ items: rows.map((row) => ({ id: row.id, imageUrl: `/media/${row.image_file}`, thumbnailUrl: `/media/${row.thumbnail_file}`, createdAt: row.created_at })) })
})

app.post('/api/generate', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Foto belum diterima server.' })
  const sceneId = String(req.body.sceneId || 'gerbang'); const characterId = String(req.body.characterId || 'kartini'); const people = Math.min(Math.max(Number(req.body.people) || 1, 1), 3)
  const guests = safeJson(req.body.guests, []).slice(0, 3).filter((guest) => guest?.name && guest?.gender)
  if (!sceneMeta[sceneId] || !characterMeta[characterId]) return res.status(400).json({ error: 'Konfigurasi adegan tidak valid.' })
  if (!guests.length) return res.status(400).json({ error: 'Data pengunjung belum lengkap.' })
  try {
    let output
    let provider = 'gemini'
    try {
      output = await generateWithGemini({ photoBuffer: req.file.buffer, sceneId, characterId, people })
    } catch (error) {
      console.error('Gemini generation failed:', error.message)
      if (process.env.ALLOW_LOCAL_FALLBACK === 'true') { output = await createFallback({ photoBuffer: req.file.buffer, sceneId, characterId }); provider = 'fallback' }
      else return res.status(502).json({ error: 'Gemini belum berhasil membuat gambar. Coba lagi setelah memeriksa API key, model, dan kuota.', detail: error.message, code: 'GEMINI_GENERATION_FAILED' })
    }
    const token = uniqueToken(); const stem = `${Date.now()}-${token.slice(0, 8)}`; const imageFile = `${stem}.webp`; const thumbFile = `${stem}-thumb.webp`
    const master = await sharp(output).rotate().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer(); const thumb = await sharp(master).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer()
    await fs.writeFile(path.join(generatedDir, imageFile), master); await fs.writeFile(path.join(generatedDir, thumbFile), thumb)
    const createdAt = now(); const insert = db.transaction(() => { const result = db.prepare('INSERT INTO results (token,image_file,thumbnail_file,scene_id,character_id,provider,is_public,created_at) VALUES (?,?,?,?,?,?,?,?)').run(token, imageFile, thumbFile, sceneId, characterId, provider, provider === 'gemini' ? 1 : 0, createdAt); const guestStmt = db.prepare('INSERT INTO guests (result_id,name,gender,created_at) VALUES (?,?,?,?)'); guests.forEach((guest) => guestStmt.run(result.lastInsertRowid, String(guest.name).slice(0, 80), String(guest.gender).slice(0, 20), createdAt)); return result.lastInsertRowid })();
    res.json({ id: insert, imageUrl: `/media/${imageFile}`, thumbnailUrl: `/media/${thumbFile}`, qrUrl: `${publicBaseUrl}/api/download/${token}`, provider, expiresIn: '7 hari' })
  } catch (error) { console.error(error); res.status(500).json({ error: 'Foto belum dapat dibuat. Silakan coba lagi.' }) }
})

app.get('/api/download/:token', async (req, res) => { const row = db.prepare('SELECT image_file FROM results WHERE token = ?').get(req.params.token); if (!row) return res.status(404).send('Tautan foto tidak ditemukan.'); res.type('image/webp'); res.setHeader('Content-Disposition', 'inline; filename="kisah-kartini.webp"'); res.sendFile(path.join(generatedDir, row.image_file)) })

if (process.env.NODE_ENV === 'production') { app.use(express.static(path.join(root, 'dist'))); app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html'))) }
app.listen(port, () => console.log(`Photobooth server listening on ${port}`))
