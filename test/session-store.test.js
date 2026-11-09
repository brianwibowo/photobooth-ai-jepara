import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { parseSnapshot, IDLE_MS } from '../src/session-store.js'

const current = Date.parse('2026-10-23T04:00:00Z')
const saved = (extra = {}) => JSON.stringify({ version: 1, id: crypto.randomUUID(), savedAt: current, screen: 'camera', sceneId: 'keluarga', characterId: 'soesalit', people: 3, idleExpiresAt: current + IDLE_MS, ...extra })
test('session parser preserves selections for 1, 2, 3, 4 and optional count', () => {
  for (const people of [null, 1, 2, 3, 4]) assert.equal(parseSnapshot(saved({ people }), current).people, people)
})
test('existing sessions without a background style restore as vintage', () => {
  const restored = parseSnapshot(saved(), current)
  assert.equal(restored.backgroundStyle, 'vintage')
  assert.equal(restored.characterId, 'soesalit')
  assert.equal(restored.sceneId, 'keluarga')
  assert.equal(restored.people, 3)
})
test('both background styles survive session restoration with optional and manual visitor counts', () => {
  for (const backgroundStyle of ['vintage', 'warna']) {
    for (const people of [null, 1, 2, 3, 4]) {
      const requestId = crypto.randomUUID()
      const restored = parseSnapshot(saved({ backgroundStyle, people, requestId }), current)
      assert.equal(restored.backgroundStyle, backgroundStyle)
      assert.equal(restored.people, people)
      assert.equal(restored.requestId, requestId)
      assert.equal(restored.characterId, 'soesalit')
      assert.equal(restored.sceneId, 'keluarga')
    }
  }
})
test('unknown or malformed background styles cannot be restored as another style', () => {
  for (const backgroundStyle of [null, '', 'sepia', 'color', 'Vintage', 'WARNA', 1, {}, []]) {
    assert.equal(parseSnapshot(saved({ backgroundStyle }), current), null)
  }
})
test('malformed, invalid, expired, and old sessions are rejected without guessing a selected figure or count', () => {
  for (const raw of ['broken JSON', 'null', '{}', saved({ people: 5 }), saved({ people: -1 }), saved({ people: 1.2 }), saved({ sceneId: 'unknown' }), saved({ characterId: 'unknown' }), saved({ screen: 'admin' }), saved({ savedAt: current - 1200001 }), saved({ savedAt: current + 300001 }), saved({ version: 0 }), saved({ idleExpiresAt: current })]) assert.equal(parseSnapshot(raw, current), null)
  assert.equal(parseSnapshot(saved(), current + IDLE_MS), null)
})
