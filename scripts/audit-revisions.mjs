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
  calls.push({ characterId: args.characterId, sceneId: args.sceneId, people: args.people })
  return generated
}
const instance = createApp({
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

try {
  browser = await chromium.launch({
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  })
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1080, height: 1920 }, { width: 390, height: 844 }]) {
    console.log(`Checking revised UI at ${viewport.width}x${viewport.height}...`)
    const context = await browser.newContext({ viewport, permissions: ['camera'] })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.setDefaultTimeout(10000)
    try {
      await page.goto(base)
      await page.locator('.home').waitFor()
      assert.equal(await page.locator('.home-museum-art img').getAttribute('src'), homeBackground)
      assert.ok((await page.locator('.home-story-card img').evaluateAll((images) => images.map((img) => img.getAttribute('src')))).every((src) => src.startsWith('/assets/revisions-2026-11/')))
      await record(page, viewport, 'home-vintage')
      await page.getByRole('button', { name: /^MULAI$/i }).click()
      await page.locator('.character-screen').waitFor()
      assert.equal(await page.locator('.character-card').count(), 7)
      assert.deepEqual(await page.locator('.character-card img').evaluateAll((images) => images.map((img) => img.getAttribute('src'))), characters.map((character) => character.reference))
      assert.equal(characters.filter((character) => character.reference.startsWith('/assets/revisions-2026-11/')).length, 5)
      await record(page, viewport, 'characters-five-revised-two-original')
      let choices = 0
      for (let characterIndex = 0; characterIndex < characters.length; characterIndex += 1) {
        const character = characters[characterIndex]
        const scenes = getScenesForCharacter(character.id)
        await page.locator('.character-card').nth(characterIndex).click()
        await page.getByRole('button', { name: 'Pilih tempat' }).click()
        await page.locator('.scene-screen').waitFor()
        assert.equal(await page.locator('.scene-card').count(), scenes.length)
        assert.equal(await page.getByRole('button', { name: /Lanjut ke foto/ }).isDisabled(), true)
        const previews = await page.locator('.scene-card img').evaluateAll((images) => images.map((img) => img.getAttribute('src')))
        assert.deepEqual(previews, scenes.map((scene) => scene.background))
        assert.ok(previews.every((src) => src.startsWith('/assets/revisions-2026-11/backgrounds/')))
        await checkImages(page)
        for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
          await page.locator('.scene-card').nth(sceneIndex).click()
          assert.equal(await page.locator('.scene-card[aria-pressed=true]').count(), 1)
          assert.equal(await page.locator('.scene-card').nth(sceneIndex).getAttribute('aria-pressed'), 'true')
          assert.equal(await page.getByRole('button', { name: /Lanjut ke foto/ }).isEnabled(), true)
          assert.deepEqual(errors, [], `${character.id}: no scene-selection runtime error`)
          choices += 1
        }
        const selectedScene = scenes.at(-1)
        await page.reload()
        await page.locator('.scene-screen').waitFor()
        assert.equal(await page.locator('.scene-card[aria-pressed=true] strong').textContent(), selectedScene.name)
        assert.equal(await page.locator('.scene-screen .flow-heading > p:last-of-type').textContent(), `Pilih suasana untuk berfoto bersama ${character.name}.`)
        if (['kartini', 'kardinah', 'soesalit'].includes(character.id)) await record(page, viewport, `${character.id}-vintage-places`)
        await page.getByRole('button', { name: /Lanjut ke foto/ }).click()
        await page.locator('.camera-screen').waitFor()
        await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0)
        await page.getByRole('button', { name: /Kembali/ }).click()
        await page.locator('.scene-screen').waitFor()
        assert.equal(await page.locator('.scene-card[aria-pressed=true] strong').textContent(), selectedScene.name)
        await page.getByRole('button', { name: /Kembali/ }).click()
        await page.locator('.character-screen').waitFor()
        assert.equal(await page.locator('.character-card[aria-pressed=true] strong').textContent(), character.name)
      }
      assert.equal(choices, 16)
      assert.deepEqual(errors, [])
      results.push({ viewport, sceneChoices: choices, characters: characters.length, refreshAndBack: 'pass', imageLoading: 'pass', pageErrors: errors })

      // One complete capture/generation journey verifies the revised UI still
      // sends the selected IDs; server provider-reference tests check payloads.
      if (viewport.width === 1366) {
        await page.locator('.character-card').first().click()
        await page.getByRole('button', { name: 'Pilih tempat' }).click()
        await page.locator('.scene-card').first().click()
        await page.getByRole('button', { name: /Lanjut ke foto/ }).click()
        await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0)
        await page.clock.install()
        await page.getByRole('button', { name: /^Ambil foto/ }).click()
        await page.clock.runFor(7100)
        await page.locator('.confirm-screen').waitFor()
        await record(page, viewport, 'revised-confirmation')
        await page.getByRole('button', { name: 'Buat foto kenangan' }).click()
        await page.locator('.result').waitFor()
        assert.deepEqual(calls, [{ characterId: 'kartini', sceneId: 'kartini-gerbang', people: null }])
        const saved = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), SESSION_KEY)
        assert.equal(saved.result.character.id, 'kartini')
        assert.equal(saved.result.scene.id, 'kartini-gerbang')
        await record(page, viewport, 'simulated-result')
        assert.deepEqual(errors, [])
      }
      console.log(`PASS ${viewport.width}x${viewport.height}: seven characters, sixteen scene selections, refresh, camera back, image loading, no browser errors`)
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${viewport.width}-${viewport.height}-failure.png`), fullPage: true }).catch(() => {})
      throw error
    } finally {
      await context.close()
    }
  }
  console.log(JSON.stringify({ ok: true, results, simulatedGenerations: calls.length, screenshots, output }, null, 2))
} catch (error) {
  const page = browser?.contexts().at(-1)?.pages().at(-1)
  if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
  throw error
} finally {
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ results, simulatedGenerations: calls.length, screenshots }, null, 2))
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  await instance.close()
  await fs.rm(temporary, { recursive: true, force: true })
}
