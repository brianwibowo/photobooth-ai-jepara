import nodemailer from 'nodemailer'
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim()
  if (email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email)) return null
  const [local, domain] = email.split('@')
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null
  return `${local}@${domain.toLowerCase()}`
}

export function createSmtpTransport(env = process.env) {
  const port = Number(env.SMTP_PORT || 587)
  const secure = env.SMTP_SECURE === 'true'
  if (env.EMAIL_ENABLED !== 'true' || !normalizeEmail(env.EMAIL_FROM || '') || !env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || ![465, 587].includes(port) || (secure !== (port === 465))) {
    throw new Error('Isi EMAIL_ENABLED, EMAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, dan SMTP_PASS di .env server.')
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST, port, secure, requireTLS: !secure,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000,
    disableUrlAccess: true, logger: false, debug: false,
  })
}

export function createPhotoEmailService({ db, generatedDir, env = process.env, transport, clock = Date.now, pollMs = 5000, autoStart = true }) {
  db.exec(`CREATE TABLE IF NOT EXISTS photo_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    result_id INTEGER NOT NULL UNIQUE,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    message_id TEXT NOT NULL,
    error_code TEXT,
    FOREIGN KEY(result_id) REFERENCES results(id)
  );
  CREATE INDEX IF NOT EXISTS photo_emails_queue ON photo_emails(status, next_attempt_at);`)
  // SMTP cannot guarantee exactly-once delivery if the process dies after DATA.
  // Never automatically send a second copy when that outcome is uncertain.
  db.prepare("UPDATE photo_emails SET status = 'unknown', error_code = 'WORKER_INTERRUPTED' WHERE status = 'sending'").run()

  const from = normalizeEmail(env.EMAIL_FROM || '')
  const port = Number(env.SMTP_PORT || 587)
  const secure = env.SMTP_SECURE === 'true'
  const configured = Boolean(env.EMAIL_ENABLED === 'true' && from && (transport || (
    env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && [465, 587].includes(port) && (secure === (port === 465))
  )))
  const sender = configured ? (transport || createSmtpTransport(env)) : null
  const dailyLimit = Math.max(1, Number(env.EMAIL_DAILY_LIMIT) || 200)
  let running = false
  let closed = false
  let activeWork = null
  const requests = new Map()
  const iso = () => new Date(clock()).toISOString()
  const snapshot = (row) => ({ status: row.status })

  function getResult(token) {
    const row = db.prepare('SELECT id, token, image_file, created_at, expires_at, download_expires_at FROM results WHERE token = ?').get(token)
    if (!row) return { code: 404, error: 'Foto tidak ditemukan.' }
    const expiry = row.download_expires_at || row.expires_at || new Date(Date.parse(row.created_at) + 60000).toISOString()
    if (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= clock() || (row.expires_at && Date.parse(row.expires_at) <= clock())) return { code: 410, error: 'Sesi foto sudah berakhir. Silakan unduh melalui QR sebelum sesi selesai.' }
    return { row }
  }

  function status(token) {
    const result = getResult(token)
    if (!result.row) return result
    const job = db.prepare('SELECT status FROM photo_emails WHERE result_id = ?').get(result.row.id)
    return { code: 200, available: configured, status: job ? job.status : 'idle' }
  }

  function enqueue(token, address, ip = '') {
    const result = getResult(token)
    if (!result.row) return result
    if (!configured) return { code: 503, error: 'Pengiriman email belum tersedia. Kamu tetap bisa menyimpan foto lewat QR.' }
    const recipient = normalizeEmail(address)
    if (!recipient) return { code: 400, error: 'Tulis satu alamat email yang valid.' }
    const existing = db.prepare('SELECT recipient, status FROM photo_emails WHERE result_id = ?').get(result.row.id)
    if (existing) {
      if (existing.recipient !== recipient) return { code: 409, error: 'Foto ini sudah diminta dikirim ke alamat email lain. Gunakan QR untuk menyimpan salinan.' }
      return { code: 200, ...snapshot(existing) }
    }
    const threshold = clock() - 60 * 60 * 1000
    const recent = (requests.get(ip) || []).filter((at) => at > threshold)
    if (recent.length >= 20) return { code: 429, error: 'Terlalu banyak permintaan email. Silakan simpan foto lewat QR.' }
    if (requests.size >= 500 && !requests.has(ip)) {
      for (const [key, times] of requests) if (!times.some((at) => at > threshold)) requests.delete(key)
      if (requests.size >= 500) return { code: 429, error: 'Pengiriman email sedang sibuk. Silakan simpan foto lewat QR.' }
    }
    const queued = db.prepare("SELECT count(*) AS count FROM photo_emails WHERE status IN ('queued', 'sending')").get().count
    const day = new Date(clock() - 24 * 60 * 60 * 1000).toISOString()
    const sentToday = db.prepare('SELECT count(*) AS count FROM photo_emails WHERE created_at >= ?').get(day).count
    if (queued >= 100 || sentToday >= dailyLimit) return { code: 429, error: 'Batas pengiriman email tercapai. Kamu tetap bisa menyimpan foto lewat QR.' }
    db.prepare('INSERT INTO photo_emails(result_id, recipient, next_attempt_at, created_at, updated_at, message_id) VALUES (?, ?, ?, ?, ?, ?)').run(
      result.row.id, recipient, iso(), iso(), iso(), `<${crypto.randomUUID()}@${from.split('@')[1]}>`,
    )
    requests.set(ip, [...recent, clock()])
    if (autoStart) setImmediate(() => { void processQueue() })
    return { code: 202, status: 'queued' }
  }

  async function deliverNext() {
    if (!configured || closed || running) return false
    running = true
    try {
      const job = db.prepare(`SELECT e.*, r.image_file, r.expires_at FROM photo_emails e
        JOIN results r ON r.id = e.result_id WHERE e.status = 'queued' AND e.next_attempt_at <= ? ORDER BY e.id LIMIT 1`).get(iso())
      if (!job) return false
      db.prepare("UPDATE photo_emails SET status = 'sending', attempts = attempts + 1, updated_at = ? WHERE id = ?").run(iso(), job.id)
      let submitted = false
      try {
        if (job.expires_at && Date.parse(job.expires_at) <= clock()) throw Object.assign(new Error('expired'), { code: 'PHOTO_EXPIRED' })
        if (!/^[a-zA-Z0-9_-]+\.png$/.test(job.image_file)) throw Object.assign(new Error('invalid file'), { code: 'PHOTO_INVALID' })
        // Keep the PNG master unchanged; build a small JPEG attachment on demand.
        const image = await sharp(await fs.readFile(path.join(generatedDir, job.image_file))).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
        if (image.length > 5 * 1024 * 1024) throw Object.assign(new Error('attachment too large'), { code: 'PHOTO_TOO_LARGE' })
        submitted = true
        const info = await sender.sendMail({
          from: { name: (env.EMAIL_FROM_NAME || 'Museum R.A. Kartini').replace(/[\r\n]/g, ''), address: from },
          to: { address: job.recipient },
          messageId: job.message_id,
          subject: 'Foto kenanganmu di Museum R.A. Kartini',
          text: 'Terima kasih sudah berkunjung ke Museum R.A. Kartini, Rembang. Foto kenanganmu terlampir dalam email ini. Simpan lampirannya untuk membawa pulang kisahmu.',
          html: '<h1>Inilah kisahmu.</h1><p>Terima kasih sudah berkunjung ke Museum R.A. Kartini, Rembang.</p><p>Foto kenanganmu terlampir dalam email ini. Simpan lampirannya untuk membawa pulang kisahmu.</p>',
          attachments: [{ filename: 'kisah-kartini.jpg', content: image, contentType: 'image/jpeg', contentDisposition: 'attachment' }],
          disableUrlAccess: true,
          disableFileAccess: true,
        })
        if (info?.rejected?.length || !info?.accepted?.length) throw Object.assign(new Error('recipient rejected'), { code: 'RECIPIENT_REJECTED', responseCode: 550 })
        // Acceptance by SMTP is not a guarantee of inbox delivery.
        db.prepare("UPDATE photo_emails SET status = 'sent', error_code = NULL, updated_at = ? WHERE id = ?").run(iso(), job.id)
      } catch (error) {
        const responseCode = Number(error?.responseCode)
        const explicitlyRejected = responseCode >= 400 && responseCode <= 599
        const connectionFailure = ['ECONNECTION', 'EDNS'].includes(error?.code) && (!error.command || error.command === 'CONN')
        const safeRetry = (responseCode >= 400 && responseCode < 500) || connectionFailure
        const attempts = job.attempts + 1
        const nextStatus = safeRetry && attempts < 3 ? 'queued' : submitted && !explicitlyRejected && !connectionFailure && error?.code !== 'EAUTH' ? 'unknown' : 'failed'
        const nextTime = new Date(clock() + (attempts === 1 ? 60000 : 300000)).toISOString()
        const safeCode = String(error?.code || 'SMTP_ERROR').replace(/[^A-Z0-9_]/g, '').slice(0, 50)
        db.prepare('UPDATE photo_emails SET status = ?, error_code = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?').run(nextStatus, safeCode, nextTime, iso(), job.id)
        // Do not log raw SMTP errors: they can contain recipient addresses.
        console.warn('Photo email job', job.id, nextStatus, safeCode)
      }
      return true
    } finally { running = false }
  }

  function processQueue() {
    if (closed || activeWork) return activeWork || Promise.resolve(false)
    activeWork = deliverNext().catch(() => { console.warn('Photo email worker unavailable'); return false }).finally(() => { activeWork = null })
    return activeWork
  }
  const timer = autoStart ? setInterval(() => { void processQueue() }, pollMs) : null
  timer?.unref?.()
  if (autoStart && configured) setImmediate(() => { void processQueue() })

  return {
    available: configured,
    status,
    enqueue,
    processQueue,
    async close() {
      closed = true
      clearInterval(timer)
      await activeWork
      sender?.close?.()
    },
  }
}
