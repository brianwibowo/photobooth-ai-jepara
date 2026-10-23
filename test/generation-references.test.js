import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { createApp } from '../server/index.js'
import { scenes, characters } from '../src/data.js'

for (const transport of ['gemini', 'openrouter-images', 'openrouter-chat']) {
  test(`${transport} receives visitor, selected child, and empty scene references in strict order`, async (t) => {
    const keys = ['OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_ENDPOINT', 'ALLOW_LOCAL_FALLBACK']
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
    if (transport === 'gemini') delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = 'test-only'
    process.env.GEMINI_API_KEY = 'test-only'
    process.env.OPENROUTER_MODEL = transport === 'openrouter-images' ? 'test-gpt-image' : 'test-image-chat'
    delete process.env.OPENROUTER_ENDPOINT
    process.env.ALLOW_LOCAL_FALLBACK = 'false'
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reference-test-'))
    const image = await sharp({ create: { width: 640, height: 480, channels: 3, background: 'white' } }).png().toBuffer()
    let captured
    const instance = createApp({ dataDir: dir, minIntervalMs: -1, rateLimit: 100, emailOptions: { env: {}, autoStart: false }, fetchImpl: async (_url, options) => {
      captured = JSON.parse(options.body)
      return Response.json(transport === 'gemini' ? { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: image.toString('base64') } }] } }] } : { data: [{ b64_json: image.toString('base64') }] })
    } })
    const server = instance.app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    t.after(async () => {
      for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] }
      await new Promise((resolve) => server.close(resolve)); await instance.close(); await fs.rm(dir, { recursive: true, force: true })
    })
    const base = `http://127.0.0.1:${server.address().port}`
    const expectedImage = async (asset) => (await sharp(fileURLToPath(new URL(`../public${asset}`, import.meta.url))).resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer()).toString('base64')
    for (const scene of scenes) {
      for (const people of [undefined, 1]) {
        const form = new FormData()
        form.append('photo', new Blob([image], { type: 'image/png' }), 'photo.png')
        form.append('sceneId', scene.id); form.append('characterId', 'soesalit')
        if (people !== undefined) form.append('people', String(people))
        const response = await fetch(base + '/api/generate', { method: 'POST', body: form })
        assert.equal(response.status, 200)
        let prompt, references
        if (transport === 'gemini') {
          prompt = captured.contents[0].parts[0].text
          references = captured.contents[0].parts.filter((p) => p.inline_data).map((p) => p.inline_data.data)
        } else if (transport === 'openrouter-images') {
          prompt = captured.prompt
          references = captured.input_references.map((p) => p.image_url.url.split(',')[1])
        } else {
          prompt = captured.messages[0].content[0].text
          references = captured.messages[0].content.filter((p) => p.type === 'image_url').map((p) => p.image_url.url.split(',')[1])
        }
        assert.equal(references.length, 3)
        assert.equal(references[0], (await sharp(image).rotate().resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()).toString('base64'))
        assert.equal(references[1], await expectedImage(characters.find((c) => c.id === 'soesalit').reference))
        assert.equal(references[2], await expectedImage(scene.background))
        if (scene.id !== 'gerbang') assert.match(scene.background, /empty-v1\.webp$/)
        assert.match(prompt, /exactly ONE Soesalit/)
        assert.match(prompt, people === undefined ? /V \+ 1 people in total/ : /2 people in total/)
        assert.match(prompt, /child historical figure remains a child/)
        assert.match(prompt, /PERSON-FREE environment plate/)
        assert.match(prompt, new RegExp(scene.name))
      }
    }
    const originalBackground = scenes[1].background
    try {
      scenes[1].background = '/assets/backgrounds/not-present.webp'
      captured = null
      const form = new FormData()
      form.append('photo', new Blob([image], { type: 'image/png' }), 'photo.png')
      form.append('sceneId', scenes[1].id); form.append('characterId', 'soesalit')
      const response = await fetch(base + '/api/generate', { method: 'POST', body: form })
      assert.equal(response.status, 502)
      assert.equal((await response.json()).code, 'REFERENCE_MISSING')
      assert.equal(captured, null, 'Missing empty plates must never send promotional scene previews to a provider')
    } finally { scenes[1].background = originalBackground }
  })
}
