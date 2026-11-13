import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { createApp } from '../server/index.js'
import { characters, getSceneForCharacter } from '../src/data.js'

// These fixtures verify the publication gate and API contracts. The injected
// vision decision is simulated; they do not assess real face/count accuracy.
const root = fileURLToPath(new URL('../', import.meta.url))
const validationReceipt = {
  version: 'closed-cast-v1',
  provider: 'openrouter',
  model: 'test-vision',
  sourceVisitorCount: 1,
  outputVisitorCount: 1,
  historicalFigureCount: 1,
  totalPeople: 2,
}
const passingAssessment = {
  sourceVisitorCount: 1,
  outputVisitorCount: 1,
  historicalFigureCount: 1,
  totalPeople: 2,
  extraPeopleCount: 0,
  duplicateVisitorCount: 0,
  missingVisitorCount: 0,
  sourceCountCertain: true,
  outputCountCertain: true,
  visitorIdentitiesMatch: true,
  historicalFigureMatchesReference: true,
  inanimateExhibitsOnly: true,
  uncertain: false,
}

async function fixture(t, { validate, output: suppliedOutput, beforeCleanup, useRealValidator = false, assessment = passingAssessment } = {}) {
  const envKeys = ['OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'ALLOW_LOCAL_FALLBACK', 'NODE_ENV', 'OPENROUTER_CAST_MODEL', 'GEMINI_CAST_MODEL', 'CAST_VALIDATION_TIMEOUT_MS']
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  // Both alternatives are deliberately available: a failed cast decision must
  // not trigger Gemini or the development-only local fallback.
  process.env.OPENROUTER_API_KEY = 'cast-publication-test-only'
  process.env.GEMINI_API_KEY = 'cast-publication-test-only'
  process.env.ALLOW_LOCAL_FALLBACK = 'true'
  process.env.NODE_ENV = 'test'
  process.env.OPENROUTER_CAST_MODEL = 'google/gemini-2.5-flash'
  process.env.GEMINI_CAST_MODEL = 'gemini-2.5-flash'
  process.env.CAST_VALIDATION_TIMEOUT_MS = '5000'
  let dir, instance, server
  t.after(async () => {
    try {
      beforeCleanup?.()
      if (server?.listening) await new Promise((resolve) => server.close(resolve))
      await instance?.close()
      if (dir) await fs.rm(dir, { recursive: true, force: true })
    } finally {
      for (const key of envKeys) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    }
  })
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'museum-cast-publication-'))
  const photo = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#53774e' } }).png().toBuffer()
  const output = suppliedOutput || await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#b59d74' } }).png().toBuffer()
  const generationCalls = [], fallbackCalls = [], validationCalls = [], visionCalls = [], externalCalls = []
  instance = createApp({
    dataDir: dir,
    publicBaseUrl: 'https://museum.example.test',
    minIntervalMs: -1,
    rateLimit: 100,
    generateWithOpenRouter: async (args) => { generationCalls.push(args); return output },
    generateWithGemini: async (args) => { fallbackCalls.push(args); return output },
    ...(useRealValidator ? {} : { validateCast: async (args) => {
      validationCalls.push(args)
      return validate ? validate(args) : validationReceipt
    } }),
    fetchImpl: async (url, options) => {
      if (useRealValidator && url === 'https://openrouter.ai/api/v1/chat/completions') {
        visionCalls.push({ url, options })
        return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(assessment) } }] })
      }
      externalCalls.push(url)
      throw new Error('Unexpected external request in cast publication fixture')
    },
    emailOptions: { env: {}, autoStart: false },
  })
  server = instance.app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  const base = `http://127.0.0.1:${server.address().port}`
  function post({ requestId, people = 1, characterId = 'kartini', sceneId = 'kartini-gerbang', backgroundStyle = 'warna' } = {}) {
    const body = new FormData()
    body.append('photo', new Blob([photo], { type: 'image/png' }), 'capture.png')
    body.append('characterId', characterId)
    body.append('sceneId', sceneId)
    body.append('backgroundStyle', backgroundStyle)
    if (people !== null) body.append('people', String(people))
    return fetch(base + '/api/generate', { method: 'POST', body, ...(requestId ? { headers: { 'x-generation-id': requestId } } : {}) })
  }
  return { ...instance, base, dir, photo, output, generationCalls, fallbackCalls, validationCalls, visionCalls, externalCalls, post }
}

function assertNoResultLinks(payload) {
  for (const key of ['imageUrl', 'thumbnailUrl', 'qrUrl', 'filename', 'email', 'result']) assert.equal(payload[key], undefined, `A failed decision cannot expose ${key}`)
}

async function assertUnpublished(f) {
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM results').get().n, 0)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM guests').get().n, 0)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM photo_emails').get().n, 0)
  assert.deepEqual(await fs.readdir(path.join(f.dir, 'generated')), [])
  assert.deepEqual(await (await fetch(f.base + '/api/gallery')).json(), { items: [] })
  assert.equal(f.fallbackCalls.length, 0, 'A validation failure must never start an alternative image generation')
  assert.deepEqual(f.externalCalls, [], 'All providers are injected; no paid/external request is allowed')
}

test('cast validation gates publication, receives the selected three references, and persists its receipt once', async (t) => {
  let entered, release
  const validationEntered = new Promise((resolve) => { entered = resolve })
  const decision = new Promise((resolve) => { release = resolve })
  const f = await fixture(t, { validate: async () => { entered(); return decision }, beforeCleanup: () => release(validationReceipt) })
  const requestId = crypto.randomUUID()
  const pending = f.post({ requestId })
  let deadline
  try {
    await Promise.race([validationEntered, new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Generation never reached mandatory cast validation')), 5000) })])
  } finally { clearTimeout(deadline) }

  await assertUnpublished(f)
  const running = await fetch(f.base + '/api/generations/' + requestId)
  assert.equal(running.status, 202)
  assert.equal((await running.json()).status, 'running')
  assert.equal(f.generationCalls.length, 1)
  assert.deepEqual(f.generationCalls[0].photoBuffer, f.photo, 'The full uploaded source is passed unchanged to generation')

  const checked = f.validationCalls[0]
  const character = characters.find(({ id }) => id === 'kartini')
  const scene = getSceneForCharacter('kartini-gerbang', 'kartini', 'warna')
  assert.ok(character.bodyReference, 'The duplicated-Kartini regression uses a character that has a second source view')
  assert.equal(checked.references.length, 3, 'A second character/body view must not become another human input')
  const expectedVisitor = await sharp(f.photo).rotate().resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  const expectedAsset = async (asset) => sharp(path.join(root, 'public', asset)).resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer()
  assert.deepEqual(Buffer.from(checked.references[0].data, 'base64'), expectedVisitor)
  assert.deepEqual(Buffer.from(checked.references[1].data, 'base64'), await expectedAsset(character.reference))
  assert.deepEqual(Buffer.from(checked.references[2].data, 'base64'), await expectedAsset(scene.background))
  assert.match(checked.references[0].label, /^REFERENCE 1.*VISITOR/)
  assert.match(checked.references[1].label, /^REFERENCE 2/)
  assert.ok(checked.references[1].label.includes(character.name))
  assert.match(checked.references[2].label, /^REFERENCE 3.*BACKGROUND/)
  assert.deepEqual(checked.outputBuffer, f.output, 'The validator checks the actual generated image before master/thumbnail encoding')
  assert.equal(checked.character.id, 'kartini')
  assert.equal(checked.scene.id, 'kartini-gerbang')
  assert.equal(checked.scene.backgroundStyle, 'warna')
  assert.equal(checked.scene.backgroundAssetId, scene.backgroundAssetId)
  assert.equal(checked.people, 1)
  assert.equal(checked.provider, 'openrouter')

  release(validationReceipt)
  const response = await pending
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.provider, 'openrouter')
  assert.ok(result.qrUrl)
  assert.equal((await fetch(f.base + result.imageUrl)).status, 200)
  const row = f.db.prepare('SELECT * FROM results WHERE id = ?').get(result.id)
  assert.equal(row.is_public, 1)
  const manifest = JSON.parse(row.manifest_json)
  assert.deepEqual(manifest.castValidation, validationReceipt)
  assert.deepEqual(manifest.generationReferenceAssets, [character.reference, scene.background])
  assert.equal(manifest.character.bodyAsset, null, 'The result manifest must describe only the inputs actually sent')
  assert.equal(manifest.scene.backgroundStyle, 'warna')
  assert.deepEqual((await fs.readdir(path.join(f.dir, 'generated'))).sort(), [row.image_file, row.thumbnail_file].sort())
  const gallery = await (await fetch(f.base + '/api/gallery')).json()
  assert.deepEqual(gallery, { items: [{ thumbnailUrl: result.thumbnailUrl }] })
  assert.equal((await fetch(f.base + result.thumbnailUrl)).status, 200)
  assert.equal(JSON.stringify(gallery).includes('/api/download/'), false)

  const restored = await (await fetch(f.base + '/api/generations/' + requestId)).json()
  assert.equal(restored.status, 'complete')
  assert.deepEqual(restored.result, result)
  const replay = await f.post({ requestId })
  assert.equal(replay.status, 200)
  assert.deepEqual(await replay.json(), result)
  assert.equal(f.generationCalls.length, 1)
  assert.equal(f.validationCalls.length, 1)
  assert.equal(f.fallbackCalls.length, 0)
  assert.deepEqual(f.externalCalls, [])
})

for (const { code, status } of [
  { code: 'OUTPUT_CAST_REJECTED', status: 422 },
  { code: 'OUTPUT_VALIDATION_UNAVAILABLE', status: 502 },
]) {
  test(`${code} publishes no result, QR, email, or gallery image and replays the failed receipt without regeneration`, async (t) => {
    const f = await fixture(t, { validate: async () => { throw Object.assign(new Error('Simulated cast decision failure'), { code }) } })
    const requestId = crypto.randomUUID()
    const response = await f.post({ requestId })
    assert.equal(response.status, status)
    const payload = await response.json()
    assert.equal(payload.code, code)
    assert.equal(payload.status, 'failed')
    assertNoResultLinks(payload)
    await assertUnpublished(f)
    assert.equal(f.generationCalls.length, 1)
    assert.equal(f.validationCalls.length, 1)
    const job = f.db.prepare('SELECT status, result_id, http_status, response_json FROM generation_jobs WHERE id = ?').get(requestId)
    assert.equal(job.status, 'failed')
    assert.equal(job.result_id, null)
    assert.equal(job.http_status, status)
    assert.equal(JSON.parse(job.response_json).code, code)
    const restored = await (await fetch(f.base + '/api/generations/' + requestId)).json()
    assert.equal(restored.status, 'failed')
    assert.equal(restored.code, code)
    assertNoResultLinks(restored)
    const replay = await f.post({ requestId })
    assert.equal(replay.status, status)
    assert.deepEqual(await replay.json(), payload)
    assert.equal(f.generationCalls.length, 1, 'Replaying a rejected receipt must not generate another paid image')
    assert.equal(f.validationCalls.length, 1)
    await assertUnpublished(f)
  })
}

test('an invalid provider image is refused before vision validation and cannot leave a publishable result', async (t) => {
  const f = await fixture(t, { output: Buffer.from('invalid generated image') })
  const response = await f.post({ requestId: crypto.randomUUID(), people: null })
  assert.equal(response.status, 502)
  const payload = await response.json()
  assert.equal(payload.code, 'OUTPUT_INVALID')
  assertNoResultLinks(payload)
  assert.equal(f.generationCalls.length, 1)
  assert.equal(f.validationCalls.length, 0)
  await assertUnpublished(f)
})

test('automatic count reaches validation as null and preserves the measured group count for a legacy character', async (t) => {
  const receipt = { ...validationReceipt, sourceVisitorCount: 3, outputVisitorCount: 3, totalPeople: 4 }
  const f = await fixture(t, { validate: async () => receipt })
  const response = await f.post({ requestId: crypto.randomUUID(), people: null, characterId: 'soesalit', sceneId: 'soesalit-dakon', backgroundStyle: 'vintage' })
  assert.equal(response.status, 200)
  const result = await response.json()
  const checked = f.validationCalls[0]
  assert.equal(checked.people, null, 'Automatic count must not silently become one visitor')
  assert.equal(checked.character.id, 'soesalit')
  assert.equal(checked.scene.backgroundStyle, 'vintage')
  assert.equal(checked.references.length, 3)
  assert.equal(f.generationCalls[0].people, null)
  const manifest = JSON.parse(f.db.prepare('SELECT manifest_json FROM results WHERE id = ?').get(result.id).manifest_json)
  assert.equal(manifest.visitorCount, null)
  assert.deepEqual(manifest.castValidation, receipt)
  assert.equal(manifest.character.revision, 'legacy')
  assert.equal(f.generationCalls.length, 1)
  assert.equal(f.validationCalls.length, 1)
  assert.equal(f.fallbackCalls.length, 0)
  assert.deepEqual(f.externalCalls, [])
})

function assertDefaultVisionRequest(f) {
  assert.equal(f.validationCalls.length, 0, 'The injected cast validator is deliberately absent')
  assert.equal(f.visionCalls.length, 1)
  const request = f.visionCalls[0]
  assert.equal(request.url, 'https://openrouter.ai/api/v1/chat/completions', 'Cast assessment uses vision chat, never an image-generation endpoint')
  const body = JSON.parse(request.options.body)
  assert.equal(body.model, 'google/gemini-2.5-flash')
  assert.equal(body.modalities, undefined)
  assert.equal(body.response_format.type, 'json_schema')
  assert.equal(body.response_format.json_schema.strict, true)
  const images = body.messages[0].content.filter((part) => part.type === 'image_url')
  assert.equal(images.length, 4, 'Vision audits the three references plus the generated candidate')
  assert.deepEqual(f.externalCalls, [])
}

test('the default vision validator rejects a duplicate historical figure before publication', async (t) => {
  const f = await fixture(t, { useRealValidator: true, assessment: { ...passingAssessment, historicalFigureCount: 2, totalPeople: 3 } })
  const requestId = crypto.randomUUID()
  const response = await f.post({ requestId })
  assert.equal(response.status, 422)
  const payload = await response.json()
  assert.equal(payload.code, 'OUTPUT_CAST_REJECTED')
  assertNoResultLinks(payload)
  assertDefaultVisionRequest(f)
  await assertUnpublished(f)
  const replay = await f.post({ requestId })
  assert.equal(replay.status, 422)
  assert.deepEqual(await replay.json(), payload)
  assert.equal(f.generationCalls.length, 1)
  assert.equal(f.visionCalls.length, 1, 'Rejected-receipt replay does not repeat vision or image-generation calls')
})

test('the default vision validator publishes only after a passing assessment and stores its real receipt', async (t) => {
  const f = await fixture(t, { useRealValidator: true })
  const response = await f.post({ requestId: crypto.randomUUID() })
  assert.equal(response.status, 200)
  const result = await response.json()
  assertDefaultVisionRequest(f)
  const manifest = JSON.parse(f.db.prepare('SELECT manifest_json FROM results WHERE id = ?').get(result.id).manifest_json)
  assert.deepEqual(manifest.castValidation, { ...validationReceipt, model: 'google/gemini-2.5-flash' })
  assert.deepEqual(await (await fetch(f.base + '/api/gallery')).json(), { items: [{ thumbnailUrl: result.thumbnailUrl }] })
  assert.equal((await fetch(f.base + result.imageUrl)).status, 200)
  assert.equal(f.generationCalls.length, 1)
  assert.equal(f.fallbackCalls.length, 0)
})
