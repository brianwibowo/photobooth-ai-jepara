import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { parseSnapshot, IDLE_MS } from '../src/session-store.js'

const current = Date.parse('2026-10-23T04:00:00Z')
const saved = (extra = {}) => JSON.stringify({ version: 1, id: crypto.randomUUID(), savedAt: current, screen: 'camera', sceneId: 'keluarga', characterId: 'soesalit', people: 6, idleExpiresAt: current + IDLE_MS, ...extra })
test('session parser preserves selections for 1, 3, 4, 6, 8 and optional count', () => {
  for (const people of [null, 1, 3, 4, 6, 8, 20]) assert.equal(parseSnapshot(saved({ people }), current).people, people)
})
test('malformed, invalid, expired, and old sessions are rejected without guessing a selected figure or count', () => {
  for (const raw of ['broken JSON', 'null', '{}', saved({ people: 21 }), saved({ people: -1 }), saved({ people: 1.2 }), saved({ sceneId: 'unknown' }), saved({ characterId: 'unknown' }), saved({ screen: 'admin' }), saved({ savedAt: current - 1200001 }), saved({ savedAt: current + 300001 }), saved({ version: 0 }), saved({ idleExpiresAt: current })]) assert.equal(parseSnapshot(raw, current), null)
  assert.equal(parseSnapshot(saved(), current + IDLE_MS), null)
})
