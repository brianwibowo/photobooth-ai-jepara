// Uses a temporary local server, synthetic photos, fake camera, and fake SMTP.
// No external AI generation or email is sent.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import express from 'express'
import sharp from 'sharp'
import { createApp } from '../server/index.js'
import { SESSION_KEY } from '../src/session-store.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.resolve(root, process.env.AUDIT_OUTPUT_DIR || 'audit-results')
await fs.mkdir(output, { recursive: true })
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'museum-ui-audit-'))
const results = []
const screenshots = []
let current = Date.now(), group = 1, hold = false, fail = false, release
const calls = []
const fixture = async (count) => {
  const columns = count > 4 ? 4 : count, rows = Math.ceil(count / columns)
  const width = 1600, height = 900
  const people = Array.from({ length: count }, (_, i) => {
    const x = (i % columns + .5) * width / columns, y = (Math.floor(i / columns) + .35) * height / rows
    const radius = Math.min(110, width / columns / 4, height / rows / 5)
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#d1a07b"/><rect x="${x - radius}" y="${y + radius}" width="${radius * 2}" height="${radius * 2}" rx="20" fill="${['#234b60', '#a54c38', '#426a43', '#53466f'][i % 4]}"/><text x="${x}" y="${y + radius * 2.3}" text-anchor="middle" font-size="${radius / 2}" fill="white">${i + 1}</text>`
  }).join('')
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#cdd8d1"/>${people}</svg>`)).jpeg().toBuffer()
}
const generate = async (args) => {
  const sourceGroup = group
  calls.push({ people: args.people, bytes: args.photoBuffer.length, scene: args.sceneId, character: args.characterId })
  if (fail) throw Object.assign(new Error('Provider simulasi gagal.'), { code: 'AUDIT_FAILURE' })
  if (hold) await new Promise((resolve) => { release = resolve })
  return fixture((args.people || sourceGroup) + 1)
}
const instance = createApp({ dataDir: dir, now: () => new Date(current), minIntervalMs: -1, rateLimit: 1000, generateWithOpenRouter: generate, generateWithGemini: generate, emailOptions: { env: { EMAIL_ENABLED: 'true', EMAIL_FROM: 'museum@example.test' }, transport: { sendMail: async () => ({ accepted: ['audit@example.test'] }) }, autoStart: false } })
instance.app.use(express.static(path.join(root, 'dist')))
const server = instance.app.listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}), headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })

async function context(width = 1366, height = 768, media = 'ready') {
  current = Date.now()
  const ctx = await browser.newContext({ viewport: { width, height }, permissions: ['camera'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(({ media, sessionKey }) => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = (url, options) => {
      if (url === '/api/generate') {
        try {
          const saved = JSON.parse(sessionStorage.getItem(sessionKey) || 'null')
          window.__auditReceiptSavedBeforeSend = saved?.screen === 'generating' && saved?.requestId === options?.headers?.['x-generation-id']
        } catch { window.__auditReceiptSavedBeforeSend = false }
      }
      return originalFetch(url, options)
    }
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (media === 'denied') throw new DOMException('Permission denied', 'NotAllowedError')
      if (media === 'missing') throw new DOMException('Device missing', 'NotFoundError')
      if (media === 'unanswered') return new Promise(() => {})
      const stream = await original(constraints)
      window.__auditStream = stream
      return stream
    }
    const originalBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      if (window.__auditPhoto) fetch(window.__auditPhoto).then((r) => r.blob()).then(callback)
      else originalBlob.call(this, callback, ...args)
    }
  }, { media, sessionKey: SESSION_KEY })
  await page.clock.install({ time: current })
  await page.clock.pauseAt(current + 1000); current += 1000
  await page.goto(base)
  await page.getByRole('button', { name: 'Mulai berfoto' }).waitFor()
  const advance = async (ms) => { current += ms; await page.clock.runFor(ms) }
  const reload = async (selector) => { await page.reload(); await page.locator(selector).waitFor() }
  const record = async (name) => {
    await page.locator('img').evaluateAll((images) => Promise.all(images.map((img) => { img.loading = 'eager'; return img.decode().catch(() => {}) })))
    const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, broken: [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src) }))
    assert.ok(size.width <= width, `${name}: horizontal overflow`)
    if (width >= 1080) assert.ok(size.height <= height, `${name}: vertical kiosk overflow ${size.height}/${height}`)
    assert.deepEqual(size.broken, [], `${name}: broken images`)
    assert.deepEqual(errors, [], `${name}: browser errors`)
    const filename = `${width}-${height}-${name}.png`
    await page.screenshot({ path: path.join(output, filename), fullPage: true })
    screenshots.push(filename)
  }
  const camera = async () => {
    await page.getByRole('button', { name: 'Mulai berfoto' }).click()
    await page.locator('.character-card').nth(6).click()
    await page.getByRole('button', { name: 'Pilih tempat' }).click()
    await page.locator('.scene-card').nth(1).click()
    await page.getByRole('button', { name: 'Lanjut ke foto' }).click()
  }
  const capture = async (n) => {
    const data = 'data:image/jpeg;base64,' + (await fixture(n)).toString('base64')
    await page.evaluate((value) => { window.__auditPhoto = value }, data)
    await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0)
    await page.getByRole('button', { name: /^Ambil foto/ }).click()
    assert.equal(await page.locator('.camera-countdown').textContent(), '7')
    await advance(3000); assert.equal(await page.locator('.camera-countdown').textContent(), '4')
    assert.equal(await page.locator('.confirm-screen').count(), 0)
    await advance(3000); assert.equal(await page.locator('.camera-countdown').textContent(), '1')
    await advance(1000); await page.locator('.confirm-screen').waitFor()
  }
  return { ctx, page, advance, reload, record, camera, capture, errors }
}
async function check(name, run) {
  try { await run(); results.push({ name, status: 'pass' }); console.log(`PASS ${name}`) }
  catch (error) {
    const page = browser.contexts().at(-1)?.pages().at(-1)
    const filename = `failure-${name.replaceAll(/[^a-zA-Z0-9-]/g, '-')}.png`
    if (page) await page.screenshot({ path: path.join(output, filename), fullPage: true }).catch(() => {})
    results.push({ name, status: 'fail', error: error.message, screenshot: filename }); throw error
  }
}

try {
  for (const { n, width, height } of [{ n: 1, width: 1366, height: 768 }, { n: 2, width: 1920, height: 1080 }, { n: 3, width: 1366, height: 768 }, { n: 4, width: 1366, height: 768 }, { n: 1, width: 390, height: 844 }, { n: 3, width: 390, height: 844 }, { n: 4, width: 1080, height: 1920 }]) {
    const f = await context(width, height)
    const p = f.page
    group = n; hold = true; fail = false
    try {
      await check(`refresh/group-${n}/${width}x${height}`, async () => {
        await p.getByRole('button', { name: 'Mulai berfoto' }).click()
        await f.reload('.character-screen')
        assert.equal(await p.locator('.character-card[aria-pressed=true]').count(), 0)
        assert.equal(await p.getByRole('button', { name: 'Pilih tempat' }).isDisabled(), true)
        await p.locator('.character-card').nth(6).click(); await f.reload('.character-screen')
        assert.equal(await p.locator('.character-card[aria-pressed=true]').count(), 1)
        await p.getByRole('button', { name: 'Pilih tempat' }).click()
        await p.locator('.scene-card').nth(1).click(); await f.reload('.scene-screen')
        assert.equal(await p.locator('.scene-card[aria-pressed=true]').count(), 1)
        await p.getByRole('button', { name: 'Lanjut ke foto' }).click()
        await p.getByRole('button', { name: `${n} pengunjung`, exact: true }).click()
        await f.reload('.camera-screen')
        assert.equal(await p.getByRole('button', { name: `${n} pengunjung`, exact: true }).getAttribute('aria-pressed'), 'true')
        await f.record(`group-${n}-camera`)
        await f.capture(n)
        const hash = () => p.locator('.photo-preview img').evaluate(async (i) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await (await fetch(i.src)).arrayBuffer()))].join(','))
        const before = await hash()
        await f.reload('.confirm-screen'); assert.equal(await hash(), before)
        assert.ok((await p.locator('.photo-label').textContent()).includes(`${n} PENGUNJUNG`))
        const initialCalls = calls.length
        await p.getByRole('button', { name: 'Buat foto kenangan' }).click()
        for (let i = 0; i < 100 && calls.length === initialCalls; i += 1) await new Promise((resolve) => setTimeout(resolve, 10))
        assert.equal(calls.length, initialCalls + 1)
        assert.equal(await p.evaluate(() => window.__auditReceiptSavedBeforeSend), true)
        await f.reload('.generating'); assert.equal(calls.length, initialCalls + 1)
        assert.equal(calls.at(-1).people, n)
        await f.record(`group-${n}-restored-loading`)
        release(); hold = false
        const pendingId = await p.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).requestId, SESSION_KEY)
        for (let i = 0; i < 200 && instance.db.prepare('SELECT status FROM generation_jobs WHERE id = ?').get(pendingId)?.status !== 'complete'; i += 1) await new Promise((resolve) => setTimeout(resolve, 10))
        await f.advance(2100); await p.locator('.result').waitFor()
        const result = await p.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).result, SESSION_KEY)
        assert.equal(await p.locator('.result-caption strong').textContent(), 'Bersama Soesalit')
        assert.ok((await p.locator('.result-caption small').textContent()).includes(result.scene.name))
        assert.ok((await p.locator('.result-caption small').textContent()).includes(result.scene.location))
        assert.match(await p.locator('.download-button').getAttribute('download'), /^photobooth_kartini_\d{6,}\.png$/)
        const downloaded = await p.request.get(base + result.imageUrl)
        assert.ok(downloaded.headers()['content-disposition'].includes(result.filename))
        await f.advance(5000); await f.reload('.result')
        assert.equal(calls.length, initialCalls + 1)
        assert.equal((await p.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).result.downloadExpiresAt, SESSION_KEY)), result.downloadExpiresAt)
        await p.locator('.email-card input').waitFor()
        await f.record(`group-${n}-restored-result`)
        if (n === 1 && width === 1366) {
          await p.getByLabel('Alamat email penerima').fill('audit@example.test')
          await p.getByRole('button', { name: 'Kirim', exact: true }).click()
          await p.locator('.email-status.queued').waitFor()
          await f.reload('.result'); await p.locator('.email-status.queued').waitFor()
          assert.equal(instance.db.prepare('SELECT COUNT(*) AS n FROM photo_emails').get().n, 1)
          await instance.photoEmail.processQueue()
          await f.reload('.result'); await p.locator('.email-status.sent').waitFor()
        }
        await p.getByRole('button', { name: 'Lihat galeri' }).click()
        await p.getByRole('button', { name: 'Lihat detail foto 1', exact: true }).click()
        await f.reload('.gallery-detail')
        await p.getByRole('button', { name: 'Tutup detail foto' }).click()
        await p.getByRole('button', { name: 'Tutup galeri' }).click()
        const untilExpiry = Date.parse(result.downloadExpiresAt) - current
        if (untilExpiry > 0) await f.advance(untilExpiry + 250)
        await p.getByRole('alertdialog').waitFor()
        await f.advance(3000); await f.reload('.result-expiry-dialog')
        assert.ok((await p.locator('#expiry-copy').textContent()).includes('7 detik'))
        await p.getByRole('button', { name: 'Lanjutkan (15 detik)' }).click()
        await p.getByRole('alertdialog').waitFor({ state: 'detached' })
        const extended = await p.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).result.downloadExpiresAt, SESSION_KEY)
        assert.equal(Date.parse(extended), current + 15000)
        await f.reload('.result')
        assert.equal(await p.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).result.downloadExpiresAt, SESSION_KEY), extended)
        await f.advance(15250); await p.getByRole('button', { name: 'Mulai berfoto' }).waitFor()
        assert.equal(await p.getByRole('alertdialog').count(), 0)
        assert.equal((await p.request.post(base + result.session.extendEndpoint)).status(), 410)
        await f.reload('.home'); assert.equal(await p.evaluate((key) => sessionStorage.getItem(key), SESSION_KEY), null)
        // Automatic count remains optional for every tested group size.
        group = n; await f.camera(); await f.capture(n)
        await p.getByRole('button', { name: 'Buat foto kenangan' }).click()
        await p.locator('.result').waitFor(); assert.equal(calls.at(-1).people, null)
        await p.getByRole('button', { name: 'Mulai sesi baru' }).click()
        await f.reload('.home')
      })
    } finally { release?.(); await f.ctx.close() }
  }

  {
    const f = await context()
    const p = f.page
    try {
      await check('result/selected-museum-long-figure-name-and-unique-download', async () => {
        group = 1; hold = false; fail = false
        await p.getByRole('button', { name: 'Mulai berfoto' }).click()
        await p.locator('.character-card').nth(1).click()
        await p.getByRole('button', { name: 'Pilih tempat' }).click()
        await p.locator('.scene-card').nth(0).click()
        await p.getByRole('button', { name: 'Lanjut ke foto' }).click()
        await f.capture(1)
        await p.getByRole('button', { name: 'Buat foto kenangan' }).click()
        await p.locator('.result').waitFor()
        await f.reload('.result')
        assert.equal(await p.locator('.result-caption strong').textContent(), 'Bersama R.M.A.A. Djojo Adhiningrat')
        assert.equal(await p.locator('.result-caption small').textContent(), 'Di Gerbang Museum · Museum R.A. Kartini Rembang')
        const filename = await p.locator('.download-button').getAttribute('download')
        const downloading = p.waitForEvent('download')
        await p.locator('.download-button').click()
        const download = await downloading
        assert.equal(download.suggestedFilename(), filename)
        assert.match(filename, /^photobooth_kartini_\d{6,}\.png$/)
        assert.equal((await sharp(await fs.readFile(await download.path())).metadata()).format, 'png')
        await p.locator('.email-card input').waitFor()
        await f.record('selected-museum-figure-download')
      })
    } finally { await f.ctx.close() }
  }
  for (const media of ['denied', 'missing', 'unanswered']) {
    const f = await context(1366, 768, media)
    try {
      await check(`negative/camera-${media}`, async () => {
        await f.camera()
        if (media === 'unanswered') await f.advance(8100)
        await f.page.getByRole('alert').waitFor()
        assert.equal(await f.page.getByRole('button', { name: /^Ambil foto/ }).isDisabled(), true)
        await f.page.getByRole('button', { name: 'Kembali' }).click(); await f.reload('.character-screen')
      })
    } finally { await f.ctx.close() }
  }
  {
    const f = await context()
    try {
      await check('negative/disconnect-countdown-idle-corrupt-storage', async () => {
        await f.camera(); await f.page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0)
        await f.page.getByRole('button', { name: /^Ambil foto/ }).click(); await f.advance(2000)
        await f.page.evaluate(() => window.__auditStream.getVideoTracks()[0].dispatchEvent(new Event('ended')))
        await f.page.getByRole('alert').waitFor(); await f.advance(6000)
        assert.equal(await f.page.locator('.confirm-screen').count(), 0)
        await f.page.getByRole('button', { name: 'Kembali' }).click()
        await f.advance(120001); await f.reload('.home')
        await f.page.evaluate((key) => sessionStorage.setItem(key, 'invalid JSON'), SESSION_KEY)
        await f.reload('.home')
      })
    } finally { await f.ctx.close() }
  }
  {
    const f = await context()
    try {
      await check('negative/missing-cached-photo-and-provider-failure', async () => {
        group = 2; await f.camera(); await f.capture(2)
        await f.page.evaluate(async () => { await new Promise((resolve, reject) => { const r = indexedDB.open('museum-photobooth-photos', 1); r.onsuccess = () => { const db = r.result, tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').clear(); tx.oncomplete = () => { db.close(); resolve() } }; r.onerror = reject }) })
        await f.reload('.camera-screen'); await f.page.getByRole('alert').waitFor()
        await f.capture(2); fail = true; hold = false
        await f.page.getByRole('button', { name: 'Buat foto kenangan' }).click()
        await f.page.getByRole('alert').waitFor(); assert.equal(await f.page.locator('.confirm-screen').count(), 1)
        await f.reload('.confirm-screen'); fail = false
        await f.page.getByRole('button', { name: 'Buat foto kenangan' }).click(); await f.page.locator('.result').waitFor()
      })
    } finally { fail = false; await f.ctx.close() }
  }
  {
    const f = await context()
    try {
      await check('negative/photo-storage-blocked', async () => {
        const block = () => Object.defineProperty(window, 'indexedDB', { configurable: true, get() { throw new DOMException('Blocked storage', 'SecurityError') } })
        await f.page.addInitScript(block); await f.page.evaluate(block)
        group = 3; await f.camera(); await f.capture(3)
        await f.reload('.camera-screen'); await f.page.getByRole('alert').waitFor()
        assert.equal(await f.page.locator('.confirm-screen').count(), 0)
      })
    } finally { await f.ctx.close() }
  }
  {
    const f = await context()
    try {
      await check('negative/session-storage-blocked-and-fresh-tab', async () => {
        group = 1; await f.camera(); await f.capture(1)
        const freshTab = await f.ctx.newPage()
        await freshTab.goto(base); await freshTab.locator('.home').waitFor(); await freshTab.close()
        const block = () => Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Blocked session storage', 'SecurityError') } })
        await f.page.addInitScript(block); await f.page.evaluate(block)
        const before = calls.length
        await f.reload('.home')
        assert.equal(calls.length, before)
      })
    } finally { await f.ctx.close() }
  }
  {
    const f = await context()
    try {
      await check('negative/lost-generation-response-recovers-without-resending', async () => {
        group = 3; hold = false; await f.camera(); await f.capture(3)
        const initialCalls = calls.length
        await f.page.route('**/api/generate', async (route) => { await route.fetch(); await route.fulfill({ status: 200, contentType: 'text/html', body: 'Proxy response unavailable' }) })
        await f.page.getByRole('button', { name: 'Buat foto kenangan' }).click()
        await f.page.locator('.generation-recovery').waitFor()
        await f.advance(1100); await f.page.locator('.result').waitFor()
        assert.equal(calls.length, initialCalls + 1)
        await f.reload('.result'); assert.equal(calls.length, initialCalls + 1)
      })
    } finally { await f.ctx.close() }
  }
  {
    const f = await context()
    try {
      await check('negative/status-network-error-after-refresh', async () => {
        group = 2; hold = true; await f.camera(); await f.capture(2)
        const initialCalls = calls.length
        await f.page.getByRole('button', { name: 'Buat foto kenangan' }).click()
        for (let i = 0; i < 100 && calls.length === initialCalls; i += 1) await new Promise((resolve) => setTimeout(resolve, 10))
        await f.page.route('**/api/generations/**', (route) => route.abort('failed'))
        await f.reload('.generating'); await f.page.locator('.generation-recovery').waitFor()
        assert.equal(calls.length, initialCalls + 1)
        const id = await f.page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).requestId, SESSION_KEY)
        await f.page.unroute('**/api/generations/**')
        release(); hold = false
        for (let i = 0; i < 200 && instance.db.prepare('SELECT status FROM generation_jobs WHERE id = ?').get(id)?.status !== 'complete'; i += 1) await new Promise((resolve) => setTimeout(resolve, 10))
        await f.advance(2100); await f.page.locator('.result').waitFor()
        assert.equal(calls.length, initialCalls + 1)
      })
    } finally { release?.(); hold = false; await f.ctx.close() }
  }
  {
    const f = await context()
    try {
      await check('negative/gallery-error-invalid-json-retry-and-refresh', async () => {
        await f.page.route('**/api/gallery?*', (route) => route.fulfill({ status: 503, json: { error: 'Galeri uji tidak tersedia.' } }))
        await f.page.getByRole('button', { name: 'Lihat galeri' }).click(); await f.page.getByRole('alert').waitFor()
        await f.reload('.gallery-modal'); await f.page.getByRole('alert').waitFor()
        await f.page.unroute('**/api/gallery?*')
        await f.page.route('**/api/gallery?*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'Invalid JSON' }))
        await f.page.getByRole('button', { name: 'Coba lagi' }).click(); await f.page.getByRole('alert').waitFor()
        await f.page.unroute('**/api/gallery?*')
        await f.page.getByRole('button', { name: 'Coba lagi' }).click()
        await f.page.getByRole('button', { name: 'Lihat detail foto 1', exact: true }).waitFor()
        assert.ok(await f.page.locator('.gallery-photo-button').count() <= 8)
        await f.page.getByRole('button', { name: 'Tutup galeri' }).click(); await f.reload('.home')
      })
    } finally { await f.ctx.close() }
  }
} finally {
  release?.()
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
  await instance.close()
  await fs.rm(dir, { recursive: true, force: true })
  const report = { scenarios: results, screenshots, providerCalls: calls.length, realAiCalls: 0, realEmails: 0 }
  await fs.writeFile(path.join(output, 'ui-report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: results.filter((r) => r.status === 'pass').length, failed: results.filter((r) => r.status === 'fail').length, screenshots: screenshots.length }))
}
