import 'dotenv/config'
import { createSmtpTransport } from './photo-email.js'

let transport
try {
  transport = createSmtpTransport()
  await transport.verify()
  console.log('Koneksi TLS dan autentikasi SMTP berhasil. Tidak ada email yang dikirim. Alamat pengirim tetap perlu diizinkan provider.')
} catch (error) {
  const code = String(error?.code || 'CONFIGURATION').replace(/[^A-Z0-9_]/g, '').slice(0, 40)
  console.error(`Verifikasi SMTP gagal (${code}). Periksa konfigurasi .env, akses keluar VPS, dan izin akun SMTP. Kredensial tidak ditampilkan.`)
  process.exitCode = 1
} finally { transport?.close() }
