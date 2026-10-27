import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { createApp } from '../server/index.js'
import { scenes, characters, getSceneForCharacter } from '../src/data.js'

async function fixture(t, overrides = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'museum-audit-'))
  const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#abbfaa' } }).jpeg().toBuffer()
  const calls = []
  const generate = async (args) => { calls.push(args); return overrides.generate ? overrides.generate(args) : image }
  let time = Date.now()
  const options = { dataDir: dir, now: () => new Date(time), minIntervalMs: -1, rateLimit: 1000, generateWithGemini: generate, generateWithOpenRouter: generate, emailOptions: { env: {}, autoStart: false }, ...overrides.options }
  const instance = createApp(options)
  const server = instance.app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await instance.close(); await fs.rm(dir, { recursive: true, force: true }) })
  const base = `http://127.0.0.1:${server.address().port}`
  function form(people, extra = {}) {
    const body = new FormData()
    if (!extra.noPhoto) body.append('photo', new Blob([extra.bytes || image], { type: extra.type || 'image/jpeg' }), 'photo.jpg')
    body.append('sceneId', extra.scene || 'keluarga'); body.append('characterId', extra.character || 'soesalit')
    if (people !== undefined) body.append('people', String(people))
    if (extra.guests !== undefined) body.append('guests', extra.guests)
    return body
  }
  const post = (people, extra = {}, request = {}) => fetch(base + '/api/generate', { method: 'POST', body: form(people, extra), ...request })
  return { ...instance, base, dir, image, calls, post, form, setTime: (value) => { time = value } }
}

test('visitor matrix accepts automatic count and 1, 2, 3, 4 without guest-book metadata', async (t) => {
  const f = await fixture(t)
  for (const people of [undefined, 1, 2, 3, 4]) {
    const response = await f.post(people)
    assert.equal(response.status, 200)
    assert.equal(f.calls.at(-1).people, people ?? null)
    assert.deepEqual(f.calls.at(-1).guests, [])
    const result = await response.json()
    assert.equal((await fetch(f.base + result.imageUrl)).status, 200)
  }
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM guests').get().n, 0)
})

test('invalid count, metadata, image, scene, and figure are rejected before invoking a provider', async (t) => {
  const f = await fixture(t)
  for (const people of [0, -1, 5, 21, 1.5, '', 'many', 'Infinity', '[]']) assert.equal((await f.post(people)).status, 400)
  for (const extra of [{ noPhoto: true }, { bytes: Buffer.from('broken image') }, { scene: 'invalid' }, { character: 'invalid' }, { guests: 'broken JSON' }, { guests: '[]' }]) assert.equal((await f.post(1, extra)).status, 400)
  assert.equal((await f.post(1, { type: 'text/plain' })).status, 415)
  assert.equal((await f.post(1, { bytes: Buffer.alloc(8 * 1024 * 1024 + 1) })).status, 413)
  assert.equal(f.calls.length, 0)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM results').get().n, 0)
})

test('all 21 figure/location combinations preserve the selected IDs', async (t) => {
  const f = await fixture(t)
  const filenames = new Set()
  for (const scene of scenes) for (const character of characters) {
    const response = await f.post(3, { scene: scene.id, character: character.id })
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.deepEqual(result.character, { id: character.id, name: character.name })
    const selectedScene = getSceneForCharacter(scene.id, character.id)
    const expectedScene = { id: scene.id, name: selectedScene.name, location: selectedScene.location }
    if (selectedScene.activity) expectedScene.activity = selectedScene.activity
    if (selectedScene.place) expectedScene.place = selectedScene.place
    assert.deepEqual(result.scene, expectedScene)
    assert.match(result.filename, /^photobooth_kartini_\d{6,}\.png$/)
    assert.equal(filenames.has(result.filename), false)
    filenames.add(result.filename)
    assert.equal(f.calls.at(-1).sceneId, scene.id)
    assert.equal(f.calls.at(-1).characterId, character.id)
  }
})

test('character-specific scene rejects the old shared activity for Soesalit', async (t) => {
  const f = await fixture(t)
  const response = await f.post(1, { scene: 'soesalit-dakon', character: 'soesalit' })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.deepEqual(result.scene, { id: 'soesalit-dakon', name: 'Bermain Dakon', location: 'Aula museum', activity: 'Bermain dakon/congklak', place: 'Aula museum' })
  assert.equal(f.calls.at(-1).sceneId, 'soesalit-dakon')
  assert.equal((await f.post(1, { scene: 'kartini-membatik', character: 'soesalit' })).status, 400)
})

test('admin export requires a valid token and malformed Unicode tokens return 401', async (t) => {
  const previous = process.env.ADMIN_TOKEN
  process.env.ADMIN_TOKEN = 'a'.repeat(32)
  t.after(() => { if (previous === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = previous })
  const f = await fixture(t)
  for (const headers of [{}, { 'x-admin-token': 'wrong' }, { 'x-admin-token': 'é'.repeat(32) }]) assert.equal((await fetch(f.base + '/api/admin/guests.csv', { headers })).status, 401)
  const response = await fetch(f.base + '/api/admin/guests.csv', { headers: { 'x-admin-token': process.env.ADMIN_TOKEN } })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/csv/)
})

test('refresh recovery and concurrent retries of the same request invoke the provider only once', async (t) => {
  let release, started
  const ready = new Promise((resolve) => { started = resolve })
  const gate = new Promise((resolve) => { release = resolve })
  const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: 'white' } }).png().toBuffer()
  const f = await fixture(t, { generate: async () => { started(); await gate; return image } })
  const id = crypto.randomUUID(); const headers = { 'x-generation-id': id }
  const controller = new AbortController()
  const first = f.post(3, {}, { headers, signal: controller.signal }).catch((error) => error)
  await ready; controller.abort(); await first
  const pending = await fetch(f.base + '/api/generations/' + id)
  assert.equal(pending.status, 202)
  assert.match(pending.headers.get('cache-control'), /no-store/)
  assert.equal((await f.post(3, {}, { headers })).status, 202)
  assert.equal((await f.post(2, {}, { headers })).status, 409)
  assert.equal(f.calls.length, 1)
  release()
  let status
  for (let attempt = 0; attempt < 100; attempt += 1) {
    status = await (await fetch(f.base + '/api/generations/' + id)).json()
    if (status.status === 'complete') break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal(status.status, 'complete')
  const replay = await f.post(3, {}, { headers })
  assert.equal(replay.status, 200)
  assert.deepEqual(await replay.json(), status.result)
  assert.equal(f.calls.length, 1)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM results').get().n, 1)
  f.setTime(Date.parse(status.result.downloadExpiresAt) + 10000)
  assert.equal((await fetch(f.base + '/api/generations/' + id)).status, 410)
  assert.equal((await f.post(3, {}, { headers })).status, 410)
  assert.equal((await fetch(f.base + '/api/generations/invalid')).status, 400)
  assert.equal((await fetch(f.base + '/api/generations/' + crypto.randomUUID())).status, 404)
})

test('slot reservation covers the cooldown interval and busy jobs fail safely', async (t) => {
  const f = await fixture(t, { options: { minIntervalMs: 120 } })
  assert.equal((await f.post(1)).status, 200)
  const id = crypto.randomUUID()
  const first = f.post(3, {}, { headers: { 'x-generation-id': id } })
  for (let i = 0; i < 100 && !f.db.prepare('SELECT id FROM generation_jobs WHERE id = ?').get(id); i += 1) await new Promise((resolve) => setTimeout(resolve, 1))
  const secondId = crypto.randomUUID()
  const second = await f.post(3, {}, { headers: { 'x-generation-id': secondId } })
  assert.equal(second.status, 429)
  assert.equal((await second.json()).code, 'GENERATION_BUSY')
  assert.equal((await first).status, 200)
  assert.equal(f.calls.length, 2)
  const failed = await (await fetch(f.base + '/api/generations/' + secondId)).json()
  assert.equal(failed.status, 'failed')
})

test('provider failure, invalid provider image, and persistence failure do not expose a false result', async (t) => {
  let mode = 'invalid'
  const f = await fixture(t, { generate: async () => {
    if (mode === 'error') throw Object.assign(new Error('Simulated provider failure'), { code: 'TEST_PROVIDER_FAILURE' })
    if (mode === 'missing-dir') { await fs.rename(path.join(f.dir, 'generated'), path.join(f.dir, 'generated-hidden')); return f.image }
    return Buffer.from('not an image')
  } })
  for (const [value, expected] of [['invalid', 502], ['error', 502], ['missing-dir', 500]]) {
    mode = value
    const id = crypto.randomUUID()
    const response = await f.post(3, {}, { headers: { 'x-generation-id': id } })
    assert.equal(response.status, expected)
    const payload = await response.json()
    assert.equal(payload.status, 'failed')
    assert.equal(payload.imageUrl, undefined)
    assert.equal((await (await fetch(f.base + '/api/generations/' + id)).json()).status, 'failed')
  }
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM results').get().n, 0)
})

test('rate limits include a retry header and image pixel limits reject oversized inputs', async (t) => {
  const f = await fixture(t, { options: { rateLimit: 2, maxPixels: 1000000 } })
  const large = await sharp({ create: { width: 1500, height: 1500, channels: 3, background: 'white' } }).png().toBuffer()
  assert.equal((await f.post(3, { bytes: large })).status, 400)
  assert.equal((await f.post(3)).status, 200)
  const limited = await f.post(3)
  assert.equal(limited.status, 429)
  assert.ok(Number(limited.headers.get('retry-after')) > 0)
})
