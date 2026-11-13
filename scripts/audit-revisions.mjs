// Focused UI regression audit with a temporary database, fake camera, and fake
// image provider. It never submits a paid generation or sends email.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import express from 'express'
import sharp from 'sharp'
import { createApp } from '../server/index.js'
import { mockCastValidation } from '../test/helpers/mock-cast.js'
import { characters, homeBackground, getScenesForCharacter } from '../src/data.js'
import { SESSION_KEY } from '../src/session-store.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.resolve(root, process.env.AUDIT_OUTPUT_DIR || 'output/playwright/revisions')
await fs.mkdir(output, { recursive: true })
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'museum-revisions-ui-'))
const generated = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#bfa583' } }).png().toBuffer()
const calls = []
const generate = async (args) => {
  calls.push({ characterId: args.characterId, sceneId: args.sceneId, people: args.people, backgroundStyle: args.backgroundStyle })
  return generated
}
const instance = createApp({
  validateCast: mockCastValidation,
  dataDir: temporary,
  minIntervalMs: -1,
  rateLimit: 100,
  generateWithOpenRouter: generate,
  generateWithGemini: generate,
  emailOptions: { env: {}, autoStart: false },
})
instance.app.use(express.static(path.join(root, 'dist')))
const server = instance.app.listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}`
let browser
const results = []
const screenshots = []
const homeResults = []
const styles = [{ id: 'vintage', label: 'Vintage' }, { id: 'warna', label: 'Warna' }]
const homeOnly = process.env.AUDIT_HOME_ONLY === 'true'
const allowedHomeImage = (src) => /^\/(?:assets\/(?:tokoh_pahlawan|backgrounds\/vintage)\/|api\/gallery\/image\/)/.test(src)

async function snapshot(page) {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), SESSION_KEY)
}

async function waitForSnapshot(page, expected) {
  await page.waitForFunction(({ key, expected }) => {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
    return saved && Object.entries(expected).every(([name, value]) => saved[name] === value)
  }, { key: SESSION_KEY, expected })
}

async function checkImages(page) {
  const broken = await page.locator('img').evaluateAll(async (images) => {
    await Promise.all(images.map((img) => img.decode().catch(() => {})))
    return images.filter((img) => !img.complete || !img.naturalWidth).map((img) => img.src)
  })
  assert.deepEqual(broken, [], 'All revised images must load')
}

async function record(page, viewport, label) {
  await checkImages(page)
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))
  assert.ok(size.width <= viewport.width, `${label}: horizontal overflow`)
  if (viewport.width >= 1080 && viewport.width > viewport.height) assert.ok(size.height <= viewport.height, `${label}: kiosk vertical overflow`)
  const filename = `${viewport.width}-${viewport.height}-${label}.png`
  await page.screenshot({ path: path.join(output, filename), fullPage: true })
  screenshots.push(filename)
}

async function checkHome(context, viewport) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.setDefaultTimeout(10000)
  const publicThumbnail = '/api/gallery/image/audit-public-thumb.webp'
  const privateMarker = 'audit-home-private-token'
  let galleryItems = [
    { thumbnailUrl: publicThumbnail, imageUrl: `/api/download/${privateMarker}` },
    { thumbnailUrl: `/api/download/${privateMarker}` },
    { imageUrl: `/api/download/${privateMarker}` },
  ]
  const thumbnailBytes = await fs.readFile(path.join(root, 'public', characters[0].reference))
  await page.route((url) => url.pathname === '/api/gallery' && url.searchParams.get('limit') === '8', (route) => route.fulfill({ json: { items: galleryItems } }))
  await page.route((url) => url.pathname === publicThumbnail, (route) => route.fulfill({ contentType: 'image/webp', body: thumbnailBytes }))
  try {
    await page.clock.install()
    await page.goto(base)
    await page.locator(`.home-story-card img[src="${publicThumbnail}"]`).first().waitFor({ state: 'attached' })
    assert.equal(await page.getByRole('button', { name: 'Mulai Foto', exact: true }).count(), 1)
    const gallerySources = await page.locator('.home-story-card img').evaluateAll((images) => images.map((image) => image.getAttribute('src')))
    assert.ok(gallerySources.includes(publicThumbnail), 'Home includes the existing public gallery thumbnail')
    assert.ok(characters.every((character) => gallerySources.includes(character.reference)), 'One public gallery photo is supplemented with all seven approved portraits')
    assert.ok(gallerySources.some((src) => src.startsWith('/assets/backgrounds/vintage/')), 'Home also includes current museum backgrounds')
    assert.ok(gallerySources.every(allowedHomeImage))
    assert.ok(!(await page.locator('.home').innerHTML()).includes(privateMarker), 'Private download fields are never rendered on the home screen')
    await record(page, viewport, 'home-gallery-and-people')

    galleryItems = []
    const emptyResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/gallery')
    await page.reload()
    await emptyResponse
    await page.locator(`.home-story-card img[src="${publicThumbnail}"]`).first().waitFor({ state: 'detached' })
    const fallbackSources = await page.locator('.home-story-card img').evaluateAll((images) => images.map((image) => image.getAttribute('src')))
    assert.ok(characters.every((character) => fallbackSources.includes(character.reference)), 'An empty gallery falls back to all seven selected identity portraits')
    assert.equal(new Set(fallbackSources.filter((src) => src.startsWith('/assets/backgrounds/vintage/'))).size, 9, 'All nine current background locations are available in the home strip')
    assert.ok(fallbackSources.every(allowedHomeImage))
    await record(page, viewport, 'home-empty-gallery-fallback')

    const before = await page.locator('.home-story-viewport').evaluate((viewport) => {
      const firstCard = viewport.querySelector('.home-story-card')
      const gap = Number.parseFloat(getComputedStyle(firstCard.parentElement).rowGap) || 0
      return { scrollTop: viewport.scrollTop, step: firstCard.getBoundingClientRect().height + gap }
    })
    await page.clock.runFor(Math.ceil((before.step * 4 + 20) / .08))
    const after = await page.locator('.home-story-viewport').evaluate((viewport) => ({ scrollTop: viewport.scrollTop }))
    assert.ok(after.scrollTop - before.scrollTop >= before.step * 3, 'The running strip advances beyond its first three frames')
    await record(page, viewport, 'home-running-beyond-three-frames')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await page.locator('.home').waitFor()
    const reducedBefore = await page.locator('.home-story-viewport').evaluate((viewport) => viewport.scrollTop)
    await page.clock.runFor(2000)
    const reducedAfter = await page.locator('.home-story-viewport').evaluate((viewport) => viewport.scrollTop)
    assert.equal(reducedAfter, reducedBefore, 'Reduced motion pauses the automatic home strip')
    assert.deepEqual(errors, [])
    homeResults.push({ viewport, publicGallery: 'pass', privateDownloadFields: 'absent', emptyGalleryPortraits: 7, emptyGalleryBackgrounds: 9, runningBeyondThreeFrames: 'pass', reducedMotion: 'pass', pageErrors: errors })
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${viewport.width}-${viewport.height}-home-failure.png`), fullPage: true }).catch(() => {})
    throw error
  } finally {
    await page.close()
  }
}

try {
  browser = await chromium.launch({
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1080, height: 1920 }, { width: 390, height: 844 }]) {
    console.log(`Checking revised UI at ${viewport.width}x${viewport.height}...`)
    const context = await browser.newContext({ viewport, permissions: ['camera'] })
    await checkHome(context, viewport)
    if (homeOnly) {
      console.log(`PASS home ${viewport.width}x${viewport.height}: public gallery, mixed fallback, nine locations, full running strip, reduced motion`)
      await context.close()
      continue
    }
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.setDefaultTimeout(10000)
    await page.addInitScript((key) => {
      const marker = `${key}-audit-receipt`
      const requestId = sessionStorage.getItem(marker)
      if (!requestId) return
      sessionStorage.removeItem(marker)
      const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
      if (saved) sessionStorage.setItem(key, JSON.stringify({ ...saved, requestId }))
    }, SESSION_KEY)
    try {
      await page.goto(base)
      await page.locator('.home').waitFor()
      assert.equal(await page.locator('.home-museum-art img').getAttribute('src'), homeBackground)
      const homeSources = await page.locator('.home-story-card img').evaluateAll((images) => images.map((img) => img.getAttribute('src')))
      assert.ok(homeSources.every(allowedHomeImage))
      assert.ok(homeSources.some((src) => src.startsWith('/assets/tokoh_pahlawan/') || src.startsWith('/api/gallery/image/')))
      await page.getByRole('button', { name: 'Mulai Foto', exact: true }).click()
      await page.locator('.character-screen').waitFor()
      assert.equal(await page.locator('.character-card').count(), 7)
      assert.deepEqual(await page.locator('.character-card img').evaluateAll((images) => images.map((img) => img.getAttribute('src'))), characters.map((character) => character.reference))
      assert.equal(characters.filter((character) => character.reference.startsWith('/assets/tokoh_pahlawan/') && character.reference.endsWith('/reference-2026-11.webp')).length, 5)
      await record(page, viewport, 'characters-five-revised-two-original')
      let choices = 0
      for (let characterIndex = 0; characterIndex < characters.length; characterIndex += 1) {
        const character = characters[characterIndex]
        const vintageScenes = getScenesForCharacter(character.id, 'vintage')
        const colorScenes = getScenesForCharacter(character.id, 'warna')
        assert.deepEqual(vintageScenes.map(({ id }) => id), colorScenes.map(({ id }) => id), 'Style toggles keep the same available activities')
        for (let index = 0; index < vintageScenes.length; index += 1) {
          assert.notEqual(vintageScenes[index].background, colorScenes[index].background, 'Vintage and Warna must use separate source variants')
          assert.equal(vintageScenes[index].backgroundId, colorScenes[index].backgroundId, 'Both variants belong to the same stable location')
        }
        await page.locator('.character-card').nth(characterIndex).click()
        await page.getByRole('button', { name: 'Pilih tempat' }).click()
        await page.locator('.scene-screen').waitFor()
        assert.equal(await page.getByRole('button', { name: /Lanjut ke foto/ }).isDisabled(), true)
        if (characterIndex === 0) assert.equal(await page.getByRole('button', { name: 'Vintage', exact: true }).getAttribute('aria-pressed'), 'true', 'Fresh session defaults to vintage')
        for (const style of styles) {
          const scenes = getScenesForCharacter(character.id, style.id)
          const selectedScene = scenes.at(-1)
          // A saved generation receipt from a previous choice must never be
          // reused after changing only the background style.
          if (characterIndex === 0 && style.id === 'warna') {
            await page.evaluate((key) => {
              // Inject after the app's pagehide save, before the next mount.
              sessionStorage.setItem(`${key}-audit-receipt`, crypto.randomUUID())
            }, SESSION_KEY)
            await page.reload()
            await page.locator('.scene-screen').waitFor()
            assert.ok((await snapshot(page)).requestId)
          }
          const beforeStyleCalls = calls.length
          await page.getByRole('button', { name: style.label, exact: true }).click()
          await waitForSnapshot(page, { backgroundStyle: style.id })
          assert.equal(await page.getByRole('button', { name: style.label, exact: true }).getAttribute('aria-pressed'), 'true')
          assert.equal(calls.length, beforeStyleCalls, 'Style selection must not start generation')
          if (characterIndex === 0 && style.id === 'warna') {
            await waitForSnapshot(page, { requestId: null })
            assert.equal(await page.locator('.scene-card[aria-pressed=true] strong').textContent(), selectedScene.name, 'Style changes keep the chosen activity')
          }
          assert.equal(await page.locator('.scene-card').count(), scenes.length)
          const previews = await page.locator('.scene-card img').evaluateAll((images) => images.map((img) => img.getAttribute('src')))
          assert.deepEqual(previews, scenes.map((scene) => scene.background))
          assert.ok(previews.every((src) => src.startsWith('/assets/backgrounds/')))
          await checkImages(page)
          for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
            await page.locator('.scene-card').nth(sceneIndex).click()
            assert.equal(await page.locator('.scene-card[aria-pressed=true]').count(), 1)
            assert.equal(await page.locator('.scene-card').nth(sceneIndex).getAttribute('aria-pressed'), 'true')
            assert.equal(await page.getByRole('button', { name: /Lanjut ke foto/ }).isEnabled(), true)
            assert.deepEqual(errors, [], `${character.id}/${style.id}: no scene-selection runtime error`)
            choices += 1
          }
          await page.reload()
          await page.locator('.scene-screen').waitFor()
          assert.equal(await page.getByRole('button', { name: style.label, exact: true }).getAttribute('aria-pressed'), 'true')
          assert.equal(await page.locator('.scene-card[aria-pressed=true] strong').textContent(), selectedScene.name)
          assert.equal(await page.locator('.scene-screen .flow-heading > p:last-of-type').textContent(), `Pilih suasana untuk berfoto bersama ${character.name}.`)
          if (['kartini', 'kardinah', 'soesalit'].includes(character.id)) await record(page, viewport, `${character.id}-${style.id}-places`)
          await page.getByRole('button', { name: /Lanjut ke foto/ }).click()
          await page.locator('.camera-screen').waitFor()
          await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0)
          await page.getByRole('button', { name: /Kembali/ }).click()
          await page.locator('.scene-screen').waitFor()
          assert.equal(await page.getByRole('button', { name: style.label, exact: true }).getAttribute('aria-pressed'), 'true')
          assert.equal(await page.locator('.scene-card[aria-pressed=true] strong').textContent(), selectedScene.name)
          await waitForSnapshot(page, { backgroundStyle: style.id, characterId: character.id, sceneId: selectedScene.id })
        }
        await page.getByRole('button', { name: /Kembali/ }).click()
        await page.locator('.character-screen').waitFor()
        assert.equal(await page.locator('.character-card[aria-pressed=true] strong').textContent(), character.name)
      }
      assert.equal(choices, 32)
      assert.deepEqual(errors, [])
      results.push({ viewport, sceneChoices: choices, characters: characters.length, backgroundStyles: styles.map(({ id }) => id), styleChangeClearsReceipt: 'pass', refreshAndBack: 'pass', imageLoading: 'pass', pageErrors: errors })

      // Both style variants go through capture and the real API with only the
      // provider replaced. These checks prove routing, not visual AI fidelity.
      if (viewport.width === 1366) {
        await page.clock.install()
        const resultRequestIds = []
        for (const [index, style] of styles.entries()) {
          if (index > 0) await page.getByRole('button', { name: 'Mulai Foto', exact: true }).click()
          await page.locator('.character-card').first().click()
          await page.getByRole('button', { name: 'Pilih tempat' }).click()
          await page.getByRole('button', { name: style.label, exact: true }).click()
          await page.locator('.scene-card').first().click()
          await page.getByRole('button', { name: /Lanjut ke foto/ }).click()
          await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0)
          // Each optional/manual control remains usable after style changes.
          for (const count of [null, 1, 2, 3, 4]) {
            const countButton = page.getByRole('button', { name: count === null ? 'Ikuti jumlah orang di foto' : `${count} pengunjung`, exact: true })
            await countButton.click()
            assert.equal(await countButton.getAttribute('aria-pressed'), 'true')
          }
          const people = style.id === 'vintage' ? 1 : 4
          await page.getByRole('button', { name: `${people} pengunjung`, exact: true }).click()
          await page.getByRole('button', { name: /^Ambil foto/ }).click()
          await page.clock.runFor(7100)
          await page.locator('.confirm-screen').waitFor()
          await record(page, viewport, `${style.id}-confirmation`)
          await page.getByRole('button', { name: 'Buat foto kenangan' }).click()
          await page.locator('.result').waitFor()
          assert.deepEqual(calls.at(-1), { characterId: 'kartini', sceneId: 'kartini-gerbang', people, backgroundStyle: style.id })
          const saved = await snapshot(page)
          assert.equal(saved.result.character.id, 'kartini')
          assert.equal(saved.result.scene.id, 'kartini-gerbang')
          assert.equal(saved.result.scene.backgroundStyle, style.id)
          assert.equal(saved.result.scene.backgroundId, getScenesForCharacter('kartini', style.id)[0].backgroundId)
          assert.ok(saved.result.scene.backgroundAssetId)
          assert.equal(await page.locator('.result-background-style').textContent(), `Nuansa ${style.label}`)
          resultRequestIds.push(saved.requestId)
          await record(page, viewport, `${style.id}-simulated-result`)
          await page.reload()
          await page.locator('.result').waitFor()
          assert.equal(await page.locator('.result-background-style').textContent(), `Nuansa ${style.label}`)
          await waitForSnapshot(page, { backgroundStyle: style.id })
          assert.equal((await snapshot(page)).result.scene.backgroundStyle, style.id)
          assert.deepEqual(errors, [])
          await page.getByRole('button', { name: 'Mulai sesi baru' }).click()
          await page.locator('.home').waitFor()
        }
        assert.equal(calls.length, 2)
        assert.equal(new Set(resultRequestIds).size, 2, 'Different style generations must have distinct receipt IDs')
      }
      console.log(`PASS ${viewport.width}x${viewport.height}: seven characters, sixteen scenes in both styles, refresh, camera back, image loading, no browser errors`)
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${viewport.width}-${viewport.height}-failure.png`), fullPage: true }).catch(() => {})
      throw error
    } finally {
      await context.close()
    }
  }
  console.log(JSON.stringify({ ok: true, homeResults, results, simulatedGenerations: calls.length, screenshots, output }, null, 2))
} catch (error) {
  const page = browser?.contexts().at(-1)?.pages().at(-1)
  if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
  throw error
} finally {
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ homeResults, results, simulatedGenerations: calls.length, screenshots }, null, 2))
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  await instance.close()
  await fs.rm(temporary, { recursive: true, force: true })
}
