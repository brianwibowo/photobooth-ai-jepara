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
  test(`${transport} preserves exact selected face/body/background in both styles for every character`, async (t) => {
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
        const environmentNumber = character.bodyReference ? 4 : 3
        assert.equal(references.length, environmentNumber)
        assert.deepEqual(labels, generationReferenceLabels(character, selectedScene))
        assert.equal(references[0], expectedVisitor)
        assert.equal(references[1], await expectedImage(character.reference))
        if (character.bodyReference) {
          assert.equal(references[2], await expectedImage(character.bodyReference))
          assert.match(prompt, /Reference 3 is a body\/clothing view of the SAME person/)
          assert.match(prompt, /never average its face with Reference 2 or render it as a second person/)
        }
        assert.equal(references.at(-1), await expectedImage(selectedScene.background))
        assert.ok(selectedScene.background.startsWith(`/assets/backgrounds/${backgroundStyle}/`))
        assert.match(prompt, new RegExp(`exactly ONE ${character.name.replaceAll('.', '\\.')}`))
        assert.match(prompt, people === undefined ? /V \+ 1 people in total/ : new RegExp(`${people + 1} people in total`))
        if (characterId === 'soesalit') assert.match(prompt, /child historical figure remains a child/)
        if (characterId === 'kartini') {
          assert.match(prompt, /fixed activity is (?:Menyambut pengunjung dan berfoto|Membatik|Mengajar)/)
          assert.match(prompt, new RegExp(`fixed place is ${selectedScene.place}`))
        }
        assert.ok(prompt.includes(`Reference ${environmentNumber} is the SELECTED BACKGROUND PHOTOGRAPH`))
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
    // All three required production assets fail closed. A missing body must
    // not silently fall back to the old face or drop the outfit reference.
    for (const style of BACKGROUND_STYLES) {
    const variant = backgroundCatalog.find(({ id }) => id === selectedScene.backgroundId).variants[style]
    for (const [target, field] of [[kartini, 'reference'], [kartini, 'bodyReference'], [variant, 'image']]) {
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
