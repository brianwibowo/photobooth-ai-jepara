import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import sharp from 'sharp'
import nodemailer from 'nodemailer'
import { createPhotoEmailService, normalizeEmail } from '../server/photo-email.js'
import { createApp } from '../server/index.js'

const emailEnv = { EMAIL_ENABLED: 'true', EMAIL_FROM: 'museum@example.test', EMAIL_FROM_NAME: 'Museum R.A. Kartini' }
async function fixture(t, overrides = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-email-test-'))
  const db = new Database(path.join(dir, 'test.db'))
  db.exec('CREATE TABLE results (id INTEGER PRIMARY KEY, token TEXT, image_file TEXT, created_at TEXT, expires_at TEXT, download_expires_at TEXT)')
  let time = Date.now()
  await sharp({ create: { width: 640, height: 480, channels: 3, background: '#d8a85e' } }).png().toFile(path.join(dir, 'photo.png'))
  const addResult = (id = 1) => db.prepare('INSERT INTO results VALUES (?, ?, ?, ?, ?, ?)').run(id, `token-${id}`, 'photo.png', new Date(time).toISOString(), new Date(time + 604800000).toISOString(), new Date(time + 60000).toISOString())
  addResult()
  const mail = []
  const transport = { sendMail: async (message) => { mail.push(message); return { accepted: [message.to.address], rejected: [] } } }
  const args = { db, generatedDir: dir, env: emailEnv, transport, autoStart: false, clock: () => time, ...overrides }
  const service = createPhotoEmailService(args)
  t.after(async () => { await service.close(); db.close(); await fs.rm(dir, { recursive: true, force: true }) })
  return { service, db, mail, args, addResult, advance: (ms) => { time += ms } }
}

test('accepts one bare recipient and rejects header injection, lists, malformed addresses', () => {
  assert.equal(normalizeEmail(' visitor@Example.COM '), 'visitor@example.com')
  for (const value of ['a@b', 'a@b.com\r\nBcc: x@y.com', 'a@b.com,x@y.com', 'Name <a@b.com>', '.a@b.com', 'a..b@c.com', null]) assert.equal(normalizeEmail(value), null)
})

test('queues one email, attaches the correct JPEG, and keeps delivery independent of QR expiry', async (t) => {
  const f = await fixture(t)
  assert.equal(f.service.enqueue('token-1', 'visitor@example.test').code, 202)
  assert.equal(f.service.enqueue('token-1', 'visitor@example.test').code, 200)
  assert.equal(f.service.enqueue('token-1', 'other@example.test').code, 409)
  f.advance(61000)
  assert.equal(f.service.status('token-1').code, 410)
  await f.service.processQueue()
  assert.equal(f.mail.length, 1)
  const message = f.mail[0]
  assert.equal(message.to.address, 'visitor@example.test')
  assert.equal(message.attachments[0].filename, 'kisah-kartini.jpg')
  assert.equal(message.attachments[0].contentType, 'image/jpeg')
  assert.equal((await sharp(message.attachments[0].content).metadata()).format, 'jpeg')
  assert.equal(f.db.prepare('SELECT status FROM photo_emails').get().status, 'sent')
  await f.service.processQueue()
  assert.equal(f.mail.length, 1)
  // Compile an actual MIME message without connecting to any email service.
  const mime = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(message)
  assert.match(mime.message.toString(), /Content-Disposition: attachment; filename=kisah-kartini.jpg/)
  assert.match(mime.message.toString(), /Content-Type: image\/jpeg/)
})

test('rejects unknown/expired results and invalid recipients without creating jobs', async (t) => {
  const f = await fixture(t)
  assert.equal(f.service.enqueue('unknown', 'v@example.test').code, 404)
  assert.equal(f.service.enqueue('token-1', 'invalid').code, 400)
  f.advance(60001)
  assert.equal(f.service.enqueue('token-1', 'v@example.test').code, 410)
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM photo_emails').get().n, 0)
})

test('disabled SMTP leaves the photobooth usable and refuses sending', async (t) => {
  const f = await fixture(t, { env: { ...emailEnv, EMAIL_ENABLED: 'false' } })
  assert.equal(f.service.available, false)
  assert.equal(f.service.enqueue('token-1', 'v@example.test').code, 503)
  assert.equal(f.service.status('token-1').available, false)
  assert.equal(f.mail.length, 0)
})

test('queued jobs survive restart; ambiguous in-flight jobs are not automatically duplicated', async (t) => {
  const f = await fixture(t)
  f.service.enqueue('token-1', 'v@example.test')
  await f.service.close()
  const restarted = createPhotoEmailService(f.args)
  t.after(() => restarted.close())
  assert.equal(restarted.status('token-1').status, 'queued')
  f.db.prepare("UPDATE photo_emails SET status = 'sending'").run()
  await restarted.close()
  const recovered = createPhotoEmailService(f.args)
  t.after(() => recovered.close())
  assert.equal(recovered.status('token-1').status, 'unknown')
  await recovered.processQueue()
  assert.equal(f.mail.length, 0)
})

test('retries explicit transient SMTP rejection and does not retry ambiguous timeouts', async (t) => {
  let calls = 0
  const f = await fixture(t, { transport: { sendMail: async () => {
    calls += 1
    if (calls === 1) throw Object.assign(new Error('temporary'), { code: 'EENVELOPE', responseCode: 451 })
    return { accepted: ['v@example.test'], rejected: [] }
  } } })
  f.service.enqueue('token-1', 'v@example.test')
  await f.service.processQueue()
  assert.equal(f.service.status('token-1').status, 'queued')
  f.advance(60001)
  await f.service.processQueue()
  assert.equal(calls, 2)
  assert.equal(f.db.prepare('SELECT status FROM photo_emails').get().status, 'sent')
  f.addResult(2)
  const timeoutService = createPhotoEmailService({ ...f.args, transport: { sendMail: async () => { throw Object.assign(new Error('timeout after DATA'), { code: 'ETIMEDOUT', command: 'DATA' }) } } })
  t.after(() => timeoutService.close())
  timeoutService.enqueue('token-2', 'v@example.test')
  await timeoutService.processQueue()
  assert.equal(timeoutService.status('token-2').status, 'unknown')
})

test('caps transient retry attempts at three and fails permanently rejected recipients', async (t) => {
  let calls = 0
  const f = await fixture(t, { transport: { sendMail: async () => {
    calls += 1
    throw Object.assign(new Error('retry later'), { code: 'EENVELOPE', responseCode: 451 })
  } } })
  f.service.enqueue('token-1', 'v@example.test')
  for (let i = 0; i < 3; i += 1) { await f.service.processQueue(); f.advance(300001) }
  assert.equal(calls, 3)
  assert.equal(f.db.prepare('SELECT status FROM photo_emails').get().status, 'failed')
  await f.service.processQueue()
  assert.equal(calls, 3)
  f.addResult(2)
  const permanent = createPhotoEmailService({ ...f.args, transport: { sendMail: async () => { throw Object.assign(new Error('no mailbox'), { code: 'EENVELOPE', responseCode: 550 }) } } })
  t.after(() => permanent.close())
  permanent.enqueue('token-2', 'v@example.test')
  await permanent.processQueue()
  assert.equal(f.db.prepare('SELECT status FROM photo_emails WHERE result_id = 2').get().status, 'failed')
})

test('concurrent repeated submissions only create one job and one delivery; daily quota enforced', async (t) => {
  const f = await fixture(t, { env: { ...emailEnv, EMAIL_DAILY_LIMIT: '1' } })
  const replies = await Promise.all(Array.from({ length: 10 }, () => Promise.resolve(f.service.enqueue('token-1', 'v@example.test'))))
  assert.equal(replies.filter((r) => r.code === 202).length, 1)
  await Promise.all([f.service.processQueue(), f.service.processQueue()])
  assert.equal(f.mail.length, 1)
  f.addResult(2)
  assert.equal(f.service.enqueue('token-2', 'v@example.test').code, 429)
})

test('HTTP result exposes only availability and a token-bound endpoint; email is private', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'email-http-test-'))
  const photo = await sharp({ create: { width: 640, height: 480, channels: 3, background: 'white' } }).png().toBuffer()
  const send = async () => photo
  const instance = createApp({ dataDir: dir, generateWithOpenRouter: send, generateWithGemini: send, emailOptions: { env: emailEnv, transport: { sendMail: async () => ({ accepted: ['v@example.test'] }) }, autoStart: false } })
  const server = instance.app.listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  t.after(async () => { await new Promise((r) => server.close(r)); await instance.close(); await fs.rm(dir, { recursive: true, force: true }) })
  const base = `http://127.0.0.1:${server.address().port}`
  const form = new FormData()
  form.append('photo', new Blob([photo], { type: 'image/png' }), 'photo.png')
  form.append('sceneId', 'gerbang'); form.append('characterId', 'kartini')
  const result = await (await fetch(`${base}/api/generate`, { method: 'POST', body: form })).json()
  assert.equal(result.email.available, true)
  const post = await fetch(base + result.email.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'v@example.test' }) })
  assert.equal(post.status, 202)
  assert.match(post.headers.get('cache-control'), /no-store/)
  const status = await (await fetch(base + result.email.endpoint)).json()
  assert.deepEqual(status, { available: true, status: 'queued' })
  const gallery = await (await fetch(base + '/api/gallery')).text()
  assert.equal(gallery.includes('v@example.test'), false)
  assert.equal(instance.db.prepare('SELECT count(*) AS n FROM guests').get().n, 0)
})
