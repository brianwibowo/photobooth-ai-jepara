export function createGenerationJobs({ db, clock, resultPayload, resultAvailable }) {
  db.exec(`CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, status TEXT NOT NULL,
    result_id INTEGER, response_json TEXT, http_status INTEGER,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`)
  const iso = () => new Date(clock()).toISOString()
  db.prepare("UPDATE generation_jobs SET status = 'failed', http_status = 503, response_json = ?, updated_at = ? WHERE status = 'running'").run(JSON.stringify({ error: 'Server dimulai ulang saat memproses foto. Hasil belum terkonfirmasi; periksa kembali sebelum mencoba generasi baru.', code: 'GENERATION_INTERRUPTED', retryable: true }), iso())
  db.prepare("DELETE FROM generation_jobs WHERE status != 'running' AND updated_at < ?").run(new Date(clock() - 86400000).toISOString())
  function snapshot(row) {
    if (!row) return { httpStatus: 404, payload: { error: 'Permintaan generasi belum ditemukan.', code: 'GENERATION_NOT_FOUND' } }
    if (row.status === 'running') return { httpStatus: 202, payload: { status: 'running', requestId: row.id } }
    if (row.status === 'failed') return { httpStatus: row.http_status || 502, payload: { status: 'failed', ...JSON.parse(row.response_json) } }
    const result = db.prepare('SELECT * FROM results WHERE id = ?').get(row.result_id)
    if (!result || !resultAvailable(result)) return { httpStatus: 410, payload: { error: 'Sesi hasil foto sudah berakhir.', code: 'RESULT_EXPIRED' } }
    return { httpStatus: 200, payload: resultPayload(result) }
  }
  return {
    validId: (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{20,80}$/.test(id),
    reserve: db.transaction((id, fingerprint) => {
      const row = db.prepare('SELECT * FROM generation_jobs WHERE id = ?').get(id)
      if (row) return row.fingerprint === fingerprint ? snapshot(row) : { httpStatus: 409, payload: { error: 'ID permintaan sudah dipakai untuk foto atau pilihan lain.', code: 'GENERATION_CONFLICT' } }
      db.prepare("INSERT INTO generation_jobs (id,fingerprint,status,created_at,updated_at) VALUES (?,?,'running',?,?)").run(id, fingerprint, iso(), iso())
      return null
    }),
    read: (id) => snapshot(db.prepare('SELECT * FROM generation_jobs WHERE id = ?').get(id)),
    finish(id, httpStatus, payload) {
      db.prepare('UPDATE generation_jobs SET status = ?, result_id = ?, response_json = ?, http_status = ?, updated_at = ? WHERE id = ?').run(httpStatus === 200 ? 'complete' : 'failed', httpStatus === 200 ? payload.id : null, httpStatus === 200 ? null : JSON.stringify(payload), httpStatus, iso(), id)
    },
  }
}
