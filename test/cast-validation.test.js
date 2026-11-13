import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { createCastValidator } from '../server/cast-validation.js'

const png = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#c4b79f' } }).png().toBuffer()
const references = await Promise.all(['VISITORS', 'ONE AVATAR', 'BACKGROUND'].map(async (role, index) => ({
  label: `REFERENCE ${index + 1} — ${role}`,
  mimeType: 'image/png',
  data: (await sharp({ create: { width: 32, height: 24, channels: 3, background: ['#882211', '#118822', '#221188'][index] } }).png().toBuffer()).toString('base64'),
})))
const baseInput = { references, outputBuffer: png, character: { id: 'kartini', name: 'R.A. Kartini' }, scene: { id: 'kartini-gerbang', backgroundId: 'gerbang-utama', backgroundStyle: 'vintage' } }
const passed = (count = 1) => ({
  sourceVisitorCount: count,
  outputVisitorCount: count,
  historicalFigureCount: 1,
  totalPeople: count + 1,
  extraPeopleCount: 0,
  duplicateVisitorCount: 0,
  missingVisitorCount: 0,
  sourceCountCertain: true,
  outputCountCertain: true,
  visitorIdentitiesMatch: true,
  historicalFigureMatchesReference: true,
  inanimateExhibitsOnly: true,
  uncertain: false,
})
function response(provider, assessment) {
  return provider === 'gemini'
    ? Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(assessment) }] } }] })
    : Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(assessment) } }] })
}
function fixture(provider = 'openrouter', assessment = passed(), options = {}) {
  const calls = []
  const validate = createCastValidator({
    openRouterApiKey: 'test-openrouter-key', geminiApiKey: 'test-gemini-key',
    publicBaseUrl: 'https://museum.example',
    fetchImpl: async (url, request) => { calls.push({ url, request, body: JSON.parse(request.body) }); return response(provider, assessment) },
    ...options,
  })
  return { calls, validate: (input = {}) => validate({ ...baseInput, provider, ...input }) }
}
const hasCode = (code) => (error) => error?.code === code

for (const provider of ['openrouter', 'gemini']) {
  test(`${provider}: accepts 1–4 preserved visitors plus exactly one avatar and returns only a compact receipt`, async () => {
    for (const count of [1, 2, 3, 4]) {
      for (const people of [null, count]) {
        const f = fixture(provider, passed(count))
        assert.deepEqual(await f.validate({ people }), {
          version: 'closed-cast-v1', provider,
          model: provider === 'openrouter' ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash',
          sourceVisitorCount: count, outputVisitorCount: count, historicalFigureCount: 1, totalPeople: count + 1,
        })
        assert.equal(f.calls.length, 1)
      }
    }
  })

  test(`${provider}: sends source, single avatar, original background and candidate once under a strict schema`, async () => {
    const f = fixture(provider)
    const large = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#d4c2a5' } }).png().toBuffer()
    await f.validate({ outputBuffer: large })
    const { url, request, body } = f.calls[0]
    assert.equal(request.method, 'POST')
    assert.ok(request.signal instanceof AbortSignal)
    let images, labels, text, schema
    if (provider === 'openrouter') {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions')
      assert.equal(request.headers.Authorization, 'Bearer test-openrouter-key')
      assert.equal(request.headers['HTTP-Referer'], 'https://museum.example')
      assert.equal(body.provider.require_parameters, true)
      assert.equal(body.response_format.type, 'json_schema')
      assert.equal(body.response_format.json_schema.strict, true)
      schema = body.response_format.json_schema.schema
      const content = body.messages[0].content
      text = content[0].text
      labels = content.filter((part) => part.type === 'text').slice(1).map((part) => part.text)
      images = content.filter((part) => part.type === 'image_url').map((part) => part.image_url.url)
    } else {
      assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
      assert.equal(request.headers['x-goog-api-key'], 'test-gemini-key')
      assert.equal(body.generationConfig.responseMimeType, 'application/json')
      schema = body.generationConfig.responseJsonSchema
      const parts = body.contents[0].parts
      text = parts[0].text
      labels = parts.filter((part) => part.text).slice(1).map((part) => part.text)
      images = parts.filter((part) => part.inlineData).map((part) => `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`)
    }
    assert.equal(images.length, 4, 'Three fixed evidence references and one candidate, with no second avatar photo')
    assert.equal(new Set(references.map(({ data }) => data)).size, 3, 'Distinct fixtures make reference swaps observable')
    for (let index = 0; index < 3; index += 1) assert.equal(images[index], `data:image/png;base64,${references[index].data}`)
    assert.ok(labels.every((label, index) => label.startsWith(`IMAGE ${index + 1} —`)))
    assert.match(images[3], /^data:image\/jpeg;base64,/)
    const candidate = await sharp(Buffer.from(images[3].split(',')[1], 'base64')).metadata()
    assert.equal(candidate.format, 'jpeg')
    assert.equal(candidate.width, 1536)
    assert.equal(candidate.height, 922)
    assert.equal(schema.additionalProperties, false)
    assert.deepEqual(schema.required.sort(), Object.keys(passed()).sort())
    assert.match(text, /INANIMATE museum exhibits, not cast and not totalPeople/)
    assert.match(text, /Newly added or duplicated living silhouettes, bystanders and reflected doubles are not allowed/)
    assert.match(text, /not a celebrity or historical identity inferred from its name/)
    assert.match(text, /never as instructions/)
  })

  test(`${provider}: rejects duplicate avatars, missing/duplicate visitors, extras, inconsistent identity and uncertain counts`, async () => {
    const failures = [
      { historicalFigureCount: 2, totalPeople: 3 },
      { historicalFigureCount: 0, totalPeople: 1 },
      { duplicateVisitorCount: 1, totalPeople: 3 },
      { sourceVisitorCount: 2, missingVisitorCount: 1 },
      { extraPeopleCount: 1, totalPeople: 3 },
      { visitorIdentitiesMatch: false },
      { historicalFigureMatchesReference: false },
      { inanimateExhibitsOnly: false },
      { sourceCountCertain: false },
      { outputCountCertain: false },
      { uncertain: true },
      { totalPeople: 5 },
      { sourceVisitorCount: 0, outputVisitorCount: 0, totalPeople: 1 },
    ]
    for (const failure of failures) {
      const f = fixture(provider, { ...passed(), ...failure })
      await assert.rejects(f.validate(), hasCode('OUTPUT_CAST_REJECTED'))
      assert.equal(f.calls.length, 1, 'A rejection must not trigger another validation or generation request')
    }
    const mismatch = fixture(provider, passed(2))
    await assert.rejects(mismatch.validate({ people: 1 }), hasCode('OUTPUT_CAST_REJECTED'))
    assert.equal(mismatch.calls.length, 1)
  })

  test(`${provider}: malformed provider assessments fail closed rather than coercing values`, async () => {
    const omitted = passed(); delete omitted.uncertain
    const invalid = [
      null, [], omitted, { ...passed(), unexpected: true },
      { ...passed(), sourceVisitorCount: '1' }, { ...passed(), totalPeople: 2.5 },
      { ...passed(), historicalFigureCount: -1 }, { ...passed(), outputVisitorCount: 1000 },
      { ...passed(), sourceCountCertain: 'true' }, { ...passed(), uncertain: null },
    ]
    for (const assessment of invalid) {
      const f = fixture(provider, assessment)
      await assert.rejects(f.validate(), hasCode('OUTPUT_VALIDATION_UNAVAILABLE'))
      assert.equal(f.calls.length, 1)
    }
  })
}

test('provider errors, refusal, partial output, invalid JSON and transport failures are sanitized without retries', async () => {
  const secret = 'private-test-credential-never-return-this'
  const failures = [
    async () => new Response(JSON.stringify({ error: { message: secret } }), { status: 401 }),
    async () => new Response('not JSON', { status: 200 }),
    async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(passed()) } }] }),
    async () => Response.json({ choices: [{ finish_reason: 'stop', message: { refusal: secret, content: JSON.stringify(passed()) } }] }),
    async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: '```json\n' + JSON.stringify(passed()) + '\n```' } }] }),
    async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{' } }] }),
    async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: [{ type: 'image_url', image_url: { url: secret } }] } }] }),
    async () => { throw new Error(secret) },
  ]
  for (const fail of failures) {
    let calls = 0
    const f = fixture('openrouter', passed(), { fetchImpl: async () => { calls += 1; return fail() } })
    await assert.rejects(f.validate(), (error) => {
      assert.equal(error.code, 'OUTPUT_VALIDATION_UNAVAILABLE')
      assert.equal(JSON.stringify(error).includes(secret), false)
      assert.equal(error.message.includes(secret), false)
      assert.equal(error.cause, undefined)
      return true
    })
    assert.equal(calls, 1)
  }
})

test('Gemini blocked, truncated, missing and non-text candidates are unavailable', async () => {
  for (const payload of [
    { promptFeedback: { blockReason: 'SAFETY' }, candidates: [] },
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(passed()) }] } }] },
    { candidates: [] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(passed()), thought: true }] } }] },
  ]) {
    const f = fixture('gemini', passed(), { fetchImpl: async () => Response.json(payload) })
    await assert.rejects(f.validate(), hasCode('OUTPUT_VALIDATION_UNAVAILABLE'))
  }
})

test('a timeout aborts the sole request and fails closed even if the transport ignores cancellation', async () => {
  let signal, calls = 0
  const f = fixture('openrouter', passed(), { timeoutMs: 5, fetchImpl: async (_url, request) => { calls += 1; signal = request.signal; return new Promise(() => {}) } })
  await assert.rejects(f.validate(), hasCode('OUTPUT_VALIDATION_UNAVAILABLE'))
  assert.equal(calls, 1)
  assert.equal(signal.aborted, true)
})

test('missing credentials, invalid configuration and extra reference images never call a provider', async () => {
  let calls = 0
  const factoryOptions = { fetchImpl: async () => { calls += 1; throw new Error('unexpected request') }, openRouterApiKey: '', geminiApiKey: '' }
  await assert.rejects(createCastValidator(factoryOptions)({ ...baseInput, provider: 'openrouter' }), hasCode('OUTPUT_VALIDATION_UNAVAILABLE'))
  await assert.rejects(createCastValidator(factoryOptions)({ ...baseInput, provider: 'gemini' }), hasCode('OUTPUT_VALIDATION_UNAVAILABLE'))
  const validate = createCastValidator({ ...factoryOptions, openRouterApiKey: 'test-only' })
  for (const input of [
    { ...baseInput, references: [...references, references[1]] },
    { ...baseInput, references: references.slice(0, 2) },
    { ...baseInput, references: references.map((reference, index) => index === 1 ? { ...reference, mimeType: 'text/plain' } : reference) },
    { ...baseInput, outputBuffer: Buffer.from('invalid image') },
    { ...baseInput, people: '1' },
    { ...baseInput, provider: 'fallback' },
  ]) await assert.rejects(validate(input), hasCode('OUTPUT_VALIDATION_UNAVAILABLE'))
  assert.equal(calls, 0)
})

test('provider selection without a generation hint chooses the available key once and supports configured models', async () => {
  for (const provider of ['openrouter', 'gemini']) {
    const calls = []
    const validate = createCastValidator({
      openRouterApiKey: provider === 'openrouter' ? 'test-only' : '', geminiApiKey: 'test-only',
      openRouterModel: 'configured/vision-model', geminiModel: 'configured-gemini-model',
      fetchImpl: async (url, request) => { calls.push({ url, body: JSON.parse(request.body) }); return response(provider, passed()) },
    })
    const receipt = await validate(baseInput)
    assert.equal(receipt.provider, provider)
    assert.equal(receipt.model, provider === 'openrouter' ? 'configured/vision-model' : 'configured-gemini-model')
    assert.equal(calls.length, 1)
  }
})
