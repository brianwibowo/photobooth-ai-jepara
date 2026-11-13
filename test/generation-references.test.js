import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { createApp } from '../server/index.js'
import { scenes, characters, getScenesForCharacter, getSceneForCharacter, backgroundCatalog, BACKGROUND_STYLES } from '../src/data.js'
import { generationReferenceLabels } from '../server/generation-prompt.js'

for (const transport of ['gemini', 'openrouter-images', 'openrouter-chat']) {
  test(`${transport} sends only visitor, one primary character and selected background in both styles for every character`, async (t) => {
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
    const instance = createApp({ dataDir: dir, minIntervalMs: -1, rateLimit: 100, emailOptions: { env: {}, autoStart: false },
      // This suite verifies provider inputs. Cast validation is covered by its
      // own tests and must never make an external request from this fixture.
      validateCast: async () => ({ version: 'closed-cast-v1', provider: 'fixture', model: 'fixture', sourceVisitorCount: 1, outputVisitorCount: 1, historicalFigureCount: 1, totalPeople: 2 }),
      fetchImpl: async (_url, options) => {
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
    const expectedImages = new Map()
    const expectedImage = async (asset) => {
      if (!expectedImages.has(asset)) expectedImages.set(asset, sharp(fileURLToPath(new URL(`../public${asset}`, import.meta.url))).resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer().then((buffer) => buffer.toString('base64')))
      return expectedImages.get(asset)
    }
    const expectedVisitor = (await sharp(image).rotate().resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()).toString('base64')
    for (const backgroundStyle of BACKGROUND_STYLES) {
    for (const character of characters) {
      const characterId = character.id
      const peopleValues = characterId === 'soesalit' ? [undefined, 1, 2, 3, 4] : [1]
      const options = [...getScenesForCharacter(characterId, backgroundStyle), ...(characterId === 'kartini' ? scenes : [])]
      for (const scene of options) {
        const selectedScene = getSceneForCharacter(scene.id, characterId, backgroundStyle)
        for (const people of peopleValues) {
        const form = new FormData()
        form.append('photo', new Blob([image], { type: 'image/png' }), 'photo.png')
        form.append('sceneId', scene.id); form.append('characterId', characterId)
        form.append('backgroundStyle', backgroundStyle)
        if (people !== undefined) form.append('people', String(people))
        const response = await fetch(base + '/api/generate', { method: 'POST', body: form })
        assert.equal(response.status, 200)
        const result = await response.json()
        assert.equal(result.scene.backgroundStyle, backgroundStyle)
        assert.equal(result.scene.backgroundId, selectedScene.backgroundId)
        assert.equal(result.scene.backgroundAssetId, selectedScene.backgroundAssetId)
        let prompt, references, labels
        if (transport === 'gemini') {
          prompt = captured.contents[0].parts[0].text
          references = captured.contents[0].parts.filter((p) => p.inline_data).map((p) => p.inline_data.data)
          labels = captured.contents[0].parts.filter((p) => p.text?.startsWith('REFERENCE ')).map((p) => p.text)
          assert.equal(captured.generationConfig.imageConfig.aspectRatio, '16:9')
        } else if (transport === 'openrouter-images') {
          prompt = captured.prompt
          references = captured.input_references.map((p) => p.image_url.url.split(',')[1])
          labels = generationReferenceLabels(character, selectedScene)
          for (const label of labels) assert.ok(prompt.includes(label), 'Images API must number every input role in the prompt')
          assert.equal(captured.aspect_ratio, '16:9')
        } else {
          prompt = captured.messages[0].content[0].text
          references = captured.messages[0].content.filter((p) => p.type === 'image_url').map((p) => p.image_url.url.split(',')[1])
          labels = captured.messages[0].content.filter((p) => p.type === 'text' && p.text.startsWith('REFERENCE ')).map((p) => p.text)
          assert.equal(captured.image_config.aspect_ratio, '16:9')
        }
        assert.equal(references.length, 3, 'Every character must have exactly one person reference; body photos must never be sent')
        assert.equal(labels.length, 3)
        assert.deepEqual(labels, generationReferenceLabels(character, selectedScene))
        assert.deepEqual(references, [
          expectedVisitor,
          await expectedImage(character.reference),
          await expectedImage(selectedScene.background),
        ], 'Provider inputs must preserve visitor → primary character → selected background order')
        if (character.bodyReference) {
          assert.equal(references.includes(await expectedImage(character.bodyReference)), false, 'The archived/UI body image is not an AI input')
        }
        assert.doesNotMatch(prompt, /Reference 3 is a body\/clothing view|BODY AND CLOTHING OF THE SAME|supplied face and full-body references|Reference 4/i)
        assert.ok(selectedScene.background.startsWith(`/assets/backgrounds/${backgroundStyle}/`))
        assert.match(prompt, new RegExp(`exactly ONE ${character.name.replaceAll('.', '\\.')}`))
        assert.match(prompt, people === undefined ? /V \+ 1 people in total/ : new RegExp(`${people + 1} people in total`))
        if (characterId === 'soesalit') assert.match(prompt, /child historical figure remains a child/)
        if (characterId === 'kartini') {
          assert.match(prompt, /fixed activity is (?:Menyambut pengunjung dan berfoto|Membatik|Mengajar)/)
          assert.match(prompt, new RegExp(`fixed place is ${selectedScene.place}`))
        }
        assert.ok(prompt.includes('Reference 3 is the SELECTED BACKGROUND PHOTOGRAPH'))
        assert.match(prompt, backgroundStyle === 'vintage' ? /VINTAGE TREATMENT/ : /COLOR TREATMENT/)
        assert.equal(prompt.includes('VINTAGE TREATMENT'), backgroundStyle === 'vintage')
        assert.match(prompt, /INANIMATE museum exhibits/)
        assert.ok(prompt.includes(selectedScene.backgroundAssetId))
        assert.match(prompt, /without stretching/)
        assert.match(prompt, /never turn them into an additional person/)
        assert.match(prompt, new RegExp(selectedScene.name))
        }
      }
    }
    }
    const kartini = characters.find(({ id }) => id === 'kartini')
    const selectedScene = getScenesForCharacter(kartini.id)[0]
    // Only the primary character and background are required model assets.
    // An unavailable archived/UI body photo must not block a generation or
    // cause it to substitute a second person reference.
    for (const style of BACKGROUND_STYLES) {
    const variant = backgroundCatalog.find(({ id }) => id === selectedScene.backgroundId).variants[style]
    const originalBody = kartini.bodyReference
    try {
      kartini.bodyReference = '/assets/tokoh_pahlawan/not-present-body.webp'
      captured = null
      const form = new FormData()
      form.append('photo', new Blob([image], { type: 'image/png' }), 'photo.png')
      form.append('sceneId', selectedScene.id); form.append('characterId', kartini.id)
      form.append('backgroundStyle', style)
      const response = await fetch(base + '/api/generate', { method: 'POST', body: form })
      assert.equal(response.status, 200, 'A missing body image must not affect the one-character generation contract')
      const references = transport === 'gemini'
        ? captured.contents[0].parts.filter((part) => part.inline_data).map((part) => part.inline_data.data)
        : transport === 'openrouter-images'
          ? captured.input_references.map((part) => part.image_url.url.split(',')[1])
          : captured.messages[0].content.filter((part) => part.type === 'image_url').map((part) => part.image_url.url.split(',')[1])
      assert.deepEqual(references, [expectedVisitor, await expectedImage(kartini.reference), await expectedImage(variant.image)])
    } finally { kartini.bodyReference = originalBody }
    for (const [target, field] of [[kartini, 'reference'], [variant, 'image']]) {
      const original = target[field]
      try {
        target[field] = `${original.slice(0, original.lastIndexOf('/') + 1)}not-present.webp`
        captured = null
        const form = new FormData()
        form.append('photo', new Blob([image], { type: 'image/png' }), 'photo.png')
        form.append('sceneId', selectedScene.id); form.append('characterId', kartini.id)
        form.append('backgroundStyle', style)
        const response = await fetch(base + '/api/generate', { method: 'POST', body: form })
        assert.equal(response.status, 502)
        assert.equal((await response.json()).code, 'REFERENCE_MISSING')
        assert.equal(captured, null, `Missing ${field} must never send a partial reference set to a provider`)
      } finally { target[field] = original }
    }
    const originalHash = variant.sha256
    try {
      variant.sha256 = '0'.repeat(64)
      captured = null
      const form = new FormData()
      form.append('photo', new Blob([image], { type: 'image/png' }), 'photo.png')
      form.append('sceneId', selectedScene.id); form.append('characterId', kartini.id); form.append('backgroundStyle', style)
      const response = await fetch(base + '/api/generate', { method: 'POST', body: form })
      assert.equal(response.status, 502)
      assert.equal((await response.json()).code, 'REFERENCE_CHANGED')
      assert.equal(captured, null, 'Changed background bytes must not be silently used under an old asset receipt')
    } finally { variant.sha256 = originalHash }
    }
  })
}
