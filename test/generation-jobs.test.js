import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import { createGenerationJobs } from '../server/generation-jobs.js'

test('restart preserves completed receipts and marks interrupted requests without automatically regenerating', () => {
  const db = new Database(':memory:')
  db.exec('CREATE TABLE results (id INTEGER PRIMARY KEY, marker TEXT)')
  db.prepare('INSERT INTO results VALUES (?, ?)').run(1, 'saved-photo')
  const args = { db, clock: () => Date.parse('2026-10-23T04:00:00Z'), resultPayload: (row) => ({ id: row.id, marker: row.marker }), resultAvailable: () => true }
  let jobs = createGenerationJobs(args)
  const complete = crypto.randomUUID(), interrupted = crypto.randomUUID()
  jobs.reserve(complete, 'photo-a'); jobs.finish(complete, 200, { id: 1 })
  jobs.reserve(interrupted, 'photo-b')
  jobs = createGenerationJobs(args)
  assert.equal(jobs.read(complete).httpStatus, 200)
  assert.deepEqual(jobs.read(complete).payload, { id: 1, marker: 'saved-photo' })
  assert.equal(jobs.read(interrupted).payload.status, 'failed')
  assert.equal(jobs.read(interrupted).payload.code, 'GENERATION_INTERRUPTED')
  assert.equal(jobs.reserve(interrupted, 'photo-b').payload.status, 'failed')
  assert.equal(jobs.reserve(complete, 'different-photo').httpStatus, 409)
  db.close()
})
