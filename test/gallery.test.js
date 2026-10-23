import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import sharp from 'sharp'
import { createApp } from '../server/index.js'

test('gallery returns at most the eight newest eligible results, including when clients request more', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-limit-test-'))
  const current = new Date('2026-10-23T04:00:00Z')
  const instance = createApp({ dataDir: dir, now: () => current, emailOptions: { env: {}, autoStart: false } })
  const server = instance.app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await instance.close(); await fs.rm(dir, { recursive: true, force: true }) })
  const insert = instance.db.prepare('INSERT INTO results (id,token,image_file,thumbnail_file,scene_id,character_id,provider,is_public,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
  for (let id = 1; id <= 15; id += 1) insert.run(id, `token-${id}`, `${id}.png`, `${id}-thumb.webp`, 'gerbang', 'kartini', id === 14 ? 'fallback' : 'gemini', id === 13 ? 0 : 1, current.toISOString(), id === 15 ? '2026-10-22T04:00:00Z' : '2026-10-24T04:00:00Z')
  const base = `http://127.0.0.1:${server.address().port}`
  const expected = Array.from({ length: 8 }, (_, index) => ({ thumbnailUrl: `/api/gallery/image/${12 - index}-thumb.webp` }))
  for (const query of ['', '?limit=8', '?limit=20', '?limit=100', '?limit=Infinity', '?limit=invalid']) {
    const response = await fetch(base + '/api/gallery' + query)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { items: expected })
  }
  assert.deepEqual(await (await fetch(base + '/api/gallery?limit=2.9')).json(), { items: expected.slice(0, 2) })
})

test('gallery includes both AI providers, repairs legacy OpenRouter rows once, and respects visibility/retention', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-test-'))
  const legacy = new Database(path.join(dir, 'photobooth.db'))
  legacy.exec(`CREATE TABLE results (
    id INTEGER PRIMARY KEY, token TEXT UNIQUE, image_file TEXT, thumbnail_file TEXT,
    scene_id TEXT, character_id TEXT, provider TEXT, is_public INTEGER,
    created_at TEXT, expires_at TEXT, download_expires_at TEXT
  )`)
  const now = new Date('2026-10-23T04:00:00Z')
  const insert = legacy.prepare('INSERT INTO results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  for (const [id, provider, visible, expiry] of [
    [1, 'openrouter', 0, '2026-10-24T04:00:00Z'],
    [2, 'gemini', 1, '2026-10-24T04:00:00Z'],
    [3, 'fallback', 0, '2026-10-24T04:00:00Z'],
    [4, 'gemini', 0, '2026-10-24T04:00:00Z'],
    [5, 'openrouter', 0, '2026-10-22T04:00:00Z'],
  ]) insert.run(id, `token-${id}`, `${id}.png`, `${id}-thumb.webp`, 'gerbang', 'kartini', provider, visible, now.toISOString(), expiry, '2026-10-23T03:00:00Z')
  legacy.close()
  await fs.mkdir(path.join(dir, 'generated'))
  const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: 'white' } }).png().toBuffer()
  for (const id of [1, 2, 3, 4]) await sharp(image).webp().toFile(path.join(dir, 'generated', `${id}-thumb.webp`))
  let instance = createApp({ dataDir: dir, now: () => now, emailOptions: { env: {}, autoStart: false } })
  let server = instance.app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = () => `http://127.0.0.1:${server.address().port}`
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await instance.close(); await fs.rm(dir, { recursive: true, force: true }) })
  const gallery = await (await fetch(base() + '/api/gallery')).json()
  assert.deepEqual(gallery, { items: [{ thumbnailUrl: '/api/gallery/image/2-thumb.webp' }, { thumbnailUrl: '/api/gallery/image/1-thumb.webp' }] })
  assert.equal((await fetch(base() + '/api/gallery/image/1-thumb.webp')).status, 200)
  for (const id of [3, 4, 5]) assert.equal((await fetch(base() + `/api/gallery/image/${id}-thumb.webp`)).status, 404)
  // A later decision to hide a repaired row must survive subsequent restarts.
  instance.db.prepare('UPDATE results SET is_public = 0 WHERE id = 1').run()
  await new Promise((resolve) => server.close(resolve)); await instance.close()
  instance = createApp({ dataDir: dir, now: () => now, emailOptions: { env: {}, autoStart: false } })
  server = instance.app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  assert.equal((await (await fetch(base() + '/api/gallery')).json()).items.length, 1)
  assert.equal((await fetch(base() + '/api/gallery/image/1-thumb.webp')).status, 404)
})

test('a new OpenRouter result is published as a gallery thumbnail without exposing its download token', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-generate-test-'))
  const previousKey = process.env.OPENROUTER_API_KEY
  process.env.OPENROUTER_API_KEY = 'test-only'
  const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: 'white' } }).png().toBuffer()
  const instance = createApp({ dataDir: dir, generateWithOpenRouter: async () => image, emailOptions: { env: {}, autoStart: false } })
  const server = instance.app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(async () => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = previousKey
    await new Promise((resolve) => server.close(resolve)); await instance.close(); await fs.rm(dir, { recursive: true, force: true })
  })
  const base = `http://127.0.0.1:${server.address().port}`
  const form = new FormData()
  form.append('photo', new Blob([image], { type: 'image/png' }), 'photo.png')
  form.append('sceneId', 'gerbang'); form.append('characterId', 'kartini')
  const response = await fetch(base + '/api/generate', { method: 'POST', body: form })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.provider, 'openrouter')
  const gallery = await (await fetch(base + '/api/gallery')).json()
  assert.deepEqual(gallery, { items: [{ thumbnailUrl: result.thumbnailUrl }] })
  assert.equal((await fetch(base + gallery.items[0].thumbnailUrl)).status, 200)
  assert.equal(JSON.stringify(gallery).includes('/api/download/'), false)
})
