import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { createApp } from '../server/index.js'

test('result continuation reactivates the QR for 15 seconds only within the 10-second grace window', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'result-session-test-'))
  let current = Date.parse('2026-10-23T04:00:00Z')
  const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: 'white' } }).png().toBuffer()
  const env = { EMAIL_ENABLED: 'true', EMAIL_FROM: 'museum@example.test' }
  const instance = createApp({ dataDir: dir, now: () => new Date(current), generateWithOpenRouter: async () => image, generateWithGemini: async () => image, emailOptions: { env, transport: { sendMail: async () => ({ accepted: ['v@example.test'] }) }, autoStart: false } })
  const server = instance.app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await instance.close(); await fs.rm(dir, { recursive: true, force: true }) })
  const base = `http://127.0.0.1:${server.address().port}`
  const form = new FormData()
  form.append('photo', new Blob([image], { type: 'image/png' }), 'photo.png')
  form.append('sceneId', 'keluarga'); form.append('characterId', 'soesalit')
  const response = await fetch(base + '/api/generate', { method: 'POST', body: form })
  assert.equal(response.status, 200)
  const result = await response.json()
  const endpoint = base + result.session.extendEndpoint
  assert.equal(result.session.graceSeconds, 10)
  assert.equal(result.session.extensionSeconds, 15)
  assert.equal((await fetch(base + result.imageUrl)).status, 200)
  const early = await (await fetch(endpoint, { method: 'POST' })).json()
  assert.equal(early.downloadExpiresAt, result.downloadExpiresAt)
  const initialExpiry = Date.parse(result.downloadExpiresAt)
  current = initialExpiry
  assert.equal((await fetch(base + result.imageUrl)).status, 410)
  const emailPost = () => fetch(base + result.email.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'v@example.test' }) })
  assert.equal((await emailPost()).status, 410)
  current += 9000
  const continuations = await Promise.all([fetch(endpoint, { method: 'POST' }), fetch(endpoint, { method: 'POST' })])
  const payloads = await Promise.all(continuations.map((r) => r.json()))
  assert.ok(continuations.every((r) => r.status === 200))
  assert.match(continuations[0].headers.get('cache-control'), /no-store/)
  assert.equal(Date.parse(payloads[0].downloadExpiresAt), current + 15000)
  assert.deepEqual(payloads[0], payloads[1])
  assert.equal((await fetch(base + result.imageUrl)).status, 200)
  assert.equal((await emailPost()).status, 202)
  current += 15000
  assert.equal((await fetch(base + result.imageUrl)).status, 410)
  current += 10000
  assert.equal((await fetch(endpoint, { method: 'POST' })).status, 410)
  assert.equal((await fetch(base + '/api/results/unknown/extend', { method: 'POST' })).status, 404)

  // Retention is never extended, even if a QR is still in its grace period.
  const token = result.imageUrl.split('/').pop()
  instance.db.prepare('UPDATE results SET download_expires_at = ?, expires_at = ? WHERE token = ?').run(new Date(current - 1000).toISOString(), new Date(current - 1).toISOString(), token)
  assert.equal((await fetch(endpoint, { method: 'POST' })).status, 410)
  instance.db.prepare('UPDATE results SET expires_at = ? WHERE token = ?').run(new Date(current + 5000).toISOString(), token)
  const capped = await (await fetch(endpoint, { method: 'POST' })).json()
  assert.equal(Date.parse(capped.downloadExpiresAt), current + 5000)
})
