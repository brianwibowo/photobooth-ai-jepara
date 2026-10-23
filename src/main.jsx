import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import QRCode from 'qrcode'
import { characters, scenes, logos } from './data'
import './styles.css'

const STEPS = ['scene', 'character', 'camera', 'confirm']
const STEP_LABELS = ['Tempat', 'Tokoh', 'Foto', 'Cek foto']
const SESSION_IDLE_MS = 2 * 60 * 1000
const CAPTURE_COUNTDOWN_SECONDS = 7

function App() {
  const [screen, setScreen] = useState('home')
  const [sceneId, setSceneId] = useState(null)
  const [characterId, setCharacterId] = useState(null)
  const [people, setPeople] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [result, setResult] = useState(null)
  const [gallery, setGallery] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryError, setGalleryError] = useState('')
  const [error, setError] = useState('')
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [qrData, setQrData] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [resultRemaining, setResultRemaining] = useState(60)
  const generateControllerRef = useRef(null)
  const idleTimerRef = useRef(null)
  const resultTimerRef = useRef(null)
  const galleryTimerRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const cameraRequestRef = useRef(0)
  const photoUrlRef = useRef(null)

  const scene = useMemo(() => scenes.find((item) => item.id === sceneId) || null, [sceneId])
  const character = useMemo(() => characters.find((item) => item.id === characterId) || null, [characterId])
  const stepIndex = Math.max(0, STEPS.indexOf(screen))

  useEffect(() => () => { stopCamera(); generateControllerRef.current?.abort(); clearTimeout(idleTimerRef.current); clearTimeout(galleryTimerRef.current); clearInterval(resultTimerRef.current); if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current) }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [screen])
  useEffect(() => { if (isGalleryOpen) loadGallery() }, [isGalleryOpen])
  useEffect(() => {
    clearTimeout(galleryTimerRef.current)
    if (!isGalleryOpen) return undefined
    galleryTimerRef.current = window.setTimeout(() => setIsGalleryOpen(false), 45 * 1000)
    return () => clearTimeout(galleryTimerRef.current)
  }, [isGalleryOpen])
  useEffect(() => {
    if (result?.qrUrl) QRCode.toDataURL(result.qrUrl, { width: 280, margin: 1, color: { dark: '#173e40', light: '#ffffff' } }).then(setQrData)
  }, [result])
  useEffect(() => {
    clearTimeout(idleTimerRef.current)
    if (screen === 'home' || screen === 'result' || screen === 'generating') return undefined
    const armIdleReset = () => {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(() => newSession(), SESSION_IDLE_MS)
    }
    const events = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((event) => document.addEventListener(event, armIdleReset, { passive: true }))
    armIdleReset()
    return () => {
      clearTimeout(idleTimerRef.current)
      events.forEach((event) => document.removeEventListener(event, armIdleReset))
    }
  }, [screen])
  useEffect(() => {
    clearInterval(resultTimerRef.current)
    if (screen !== 'result' || !result) return undefined
    const expiry = Date.parse(result.downloadExpiresAt || '')
    let remaining = Number.isFinite(expiry) ? Math.max(0, Math.ceil((expiry - Date.now()) / 1000)) : 60
    setResultRemaining(remaining)
    if (remaining <= 0) { newSession(); return undefined }
    resultTimerRef.current = window.setInterval(() => {
      remaining -= 1
      setResultRemaining(Math.max(remaining, 0))
      if (remaining <= 0) {
        clearInterval(resultTimerRef.current)
        newSession()
      }
    }, 1000)
    return () => clearInterval(resultTimerRef.current)
  }, [screen, result])

  function go(next) { setError(''); setScreen(next) }
  function replacePhoto(nextUrl) {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = nextUrl || null
    setPhoto(nextUrl)
  }
  function begin() { stopCamera(); setResult(null); replacePhoto(null); setPhotoFile(null); setSceneId(null); setPeople(null); setCharacterId(null); go('scene') }
  function chooseScene(id) {
    const selected = scenes.find((item) => item.id === id)
    if (!selected) return
    setSceneId(id)
    if (!selected.characterIds.includes(characterId)) setCharacterId(null)
  }
  async function startCamera() {
    setError('')
    setCameraReady(false)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak tersedia di perangkat ini.')
      stopCamera()
      const activeRequestId = ++cameraRequestRef.current
      const request = navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      let timeoutId
      let stream
      try {
        stream = await Promise.race([
          request,
          new Promise((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error('Permintaan izin kamera belum dijawab.')), 8000)
          }),
        ])
      } catch (error) {
        // A permission prompt can resolve after the timeout. Do not leave that
        // late stream open in a kiosk session where the visitor already moved on.
        request.then((lateStream) => lateStream.getTracks().forEach((track) => track.stop())).catch(() => {})
        throw error
      } finally {
        window.clearTimeout(timeoutId)
      }
      if (activeRequestId !== cameraRequestRef.current) return stream.getTracks().forEach((track) => track.stop())
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = streamRef.current
      setCameraReady(true)
    } catch (err) { setCameraReady(false); setError(`${err.message} Kamera wajib aktif untuk membuat foto kenangan.`) }
  }
  function stopCamera() { cameraRequestRef.current += 1; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false) }
  function capturePhoto() {
    const video = videoRef.current
    if (!video?.videoWidth) return setError('Tunggu sampai kamera siap, lalu coba lagi.')
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => { if (!blob) return setError('Foto belum siap. Coba ambil ulang.'); const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' }); setPhotoFile(file); replacePhoto(URL.createObjectURL(blob)); stopCamera(); go('confirm') }, 'image/jpeg', 0.9)
  }
  async function generate() {
    if (isBusy) return
    if (!photoFile || !scene || !character) return setError('Foto, tempat, dan tokoh wajib dipilih.')
    setError(''); setScreen('generating'); setIsBusy(true)
    const body = new FormData(); body.append('photo', photoFile); body.append('sceneId', scene.id); body.append('characterId', character.id)
    if (people !== null) body.append('people', String(people))
    const controller = new AbortController(); generateControllerRef.current = controller
    try {
      const response = await fetch('/api/generate', { method: 'POST', body, signal: controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Generasi foto gagal.')
      setResult(payload); setQrData(''); go('result')
    } catch (err) {
      if (err.name === 'AbortError') return
      setScreen('confirm')
      setError(err.message || 'Generasi foto gagal. Coba lagi tanpa mengulang pilihan dan foto.')
    } finally { generateControllerRef.current = null; setIsBusy(false) }
  }
  async function loadGallery() {
    setGalleryLoading(true); setGalleryError('')
    try {
      const response = await fetch('/api/gallery?limit=12')
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || !Array.isArray(payload.items)) throw new Error(payload?.error || 'Galeri tidak dapat dimuat. Coba lagi.')
      setGallery(payload.items)
    } catch (err) {
      setGallery([])
      setGalleryError(err.message || 'Galeri tidak dapat dimuat. Coba lagi.')
    } finally { setGalleryLoading(false) }
  }
  function newSession() { stopCamera(); generateControllerRef.current?.abort(); setIsGalleryOpen(false); setResult(null); setQrData(''); setError(''); replacePhoto(null); setPhotoFile(null); setSceneId(null); setPeople(null); setCharacterId(null); go('home') }

  return <div className="app-shell">
    {screen === 'home' && <Home onStart={begin} onGallery={() => setIsGalleryOpen(true)} />}
    {screen === 'scene' && <ScenePicker scene={scene} onSelect={chooseScene} onNext={() => { if (scene) go('character') }} onBack={newSession} />}
    {screen === 'character' && <CharacterPicker scene={scene} character={character} onSelect={setCharacterId} onNext={() => { if (scene && character) go('camera') }} onBack={() => go('scene')} />}
    {screen === 'camera' && <CameraScreen people={people} onPeople={setPeople} videoRef={videoRef} cameraReady={cameraReady} onStart={startCamera} onStop={stopCamera} onCapture={capturePhoto} onBack={() => { stopCamera(); go('character') }} error={error} />}
    {screen === 'confirm' && <ConfirmScreen people={people} photo={photo} scene={scene} character={character} onBack={() => go('camera')} onGenerate={generate} error={error} />}
    {screen === 'generating' && <GeneratingScreen photo={photo} />}
    {screen === 'result' && <ResultScreen result={result} qrData={qrData} remaining={resultRemaining} onNew={newSession} onGallery={() => setIsGalleryOpen(true)} onPrint={() => window.print()} />}

    {STEPS.includes(screen) && <Progress current={stepIndex} />}
    {isGalleryOpen && <GalleryModal items={gallery} loading={galleryLoading} error={galleryError} onRetry={loadGallery} onClose={() => setIsGalleryOpen(false)} />}
  </div>
}

function LogoStrip() {
  return <div className="logo-strip" aria-label="Museum R.A. Kartini dan mitra">{logos.map((logo) => <img key={logo.src} src={logo.src} alt={logo.alt} />)}</div>
}

function Home({ onStart, onGallery }) {
  const [activeImage, setActiveImage] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => {
      if (!document.hidden) setActiveImage((index) => (index + 1) % characters.length)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [])
  return <main className="home screen-content">
    <section className="hero-copy">
      <LogoStrip />
      <p className="eyebrow">Photobooth AI · Museum R.A. Kartini, Rembang</p>
      <h1>Jadi bagian dari<br /><em>kisah Kartini.</em></h1>
      <p className="intro">Berfoto bersama Kartini dan tokoh di sekitarnya. Pilih suasananya, ambil foto, lalu bawa pulang kenanganmu.</p>
      <div className="home-actions"><button className="button primary" onClick={onStart}>Mulai berfoto <span>→</span></button><button className="button outline gallery-button" onClick={onGallery}>Lihat galeri <span>↗</span></button></div>
      <div className="home-note"><span className="ornament">✦</span><span>Sendiri atau bersama · Langsung ambil foto<br />Pindai QR untuk menyimpan hasil ke ponsel.</span></div>
    </section>
    <section className="hero-visual" aria-label="Contoh foto bersama tokoh museum"><div className="hero-image">{characters.map((item, index) => <img key={item.id} className={index === activeImage ? 'active' : ''} src={item.image} alt={index === activeImage ? `Contoh foto bersama ${item.name}` : ''} aria-hidden={index !== activeImage} />)}</div></section>
  </main>
}

function ScenePicker({ scene, onSelect, onNext, onBack }) {
  return <main className="flow screen-content picker-screen scene-screen">
    <FlowHeading kicker="01 / PILIH TEMPAT" title={<>Di mana kisahmu <em>dimulai?</em></>} copy="Pilih suasana untuk foto kenanganmu." />
    <div className="scene-grid">{scenes.map((item) => <button aria-pressed={scene?.id === item.id} className={`scene-card ${scene?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => onSelect(item.id)}><img src={item.image} alt="" /><span className="scene-overlay" /><span className="scene-info"><strong>{item.name}</strong><span>{item.description}</span></span><span className="selection-check" aria-hidden="true">{scene?.id === item.id ? '✓' : '+'}</span></button>)}</div>
    <div className="flow-actions"><BackButton onClick={onBack} /><p className="selection-summary">{scene?.name || 'Pilih satu tempat'}</p><button className="button primary" onClick={onNext} disabled={!scene}>Pilih tokoh <span>→</span></button></div>
  </main>
}

function CharacterPicker({ scene, character, onSelect, onNext, onBack }) {
  const available = characters.filter((item) => scene?.characterIds.includes(item.id))
  return <main className="flow screen-content picker-screen character-screen">
    <FlowHeading kicker="02 / PILIH TOKOH" title={<>Siapa <em>teman fotomu?</em></>} copy={`Pilih tokoh yang akan menemanimu di ${scene?.name || 'tempat pilihanmu'}.`} />
    <div className="character-grid">{available.map((item) => <button aria-pressed={character?.id === item.id} className={`character-card ${character?.id === item.id ? 'selected' : ''}`} onClick={() => onSelect(item.id)} key={item.id}><img src={item.reference} alt="" /><span className="character-info"><strong>{item.name}</strong><small>{item.role}</small></span><span className="selection-check" aria-hidden="true">{character?.id === item.id ? '✓' : '+'}</span></button>)}</div>
    <div className="flow-actions"><BackButton onClick={onBack} /><p className="selection-summary">{character?.name || 'Pilih satu tokoh'}</p><button className="button primary" onClick={onNext} disabled={!character}>Lanjut ke kamera <span>→</span></button></div>
  </main>
}

function CameraScreen({ people, onPeople, videoRef, cameraReady, onStart, onStop, onCapture, onBack, error }) {
  const [countdown, setCountdown] = useState(null)
  const countdownTimerRef = useRef(null)
  useEffect(() => { onStart(); return () => { window.clearInterval(countdownTimerRef.current); onStop() } }, [])
  function captureWithCountdown() {
    if (countdown !== null) return
    let value = CAPTURE_COUNTDOWN_SECONDS
    setCountdown(value)
    countdownTimerRef.current = window.setInterval(() => {
      value -= 1
      if (value <= 0) { window.clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; setCountdown(null); onCapture() }
      else setCountdown(value)
    }, 1000)
  }
  return <main className="flow screen-content horizontal-flow camera-screen"><FlowHeading kicker="03 / AMBIL FOTO" title={<>Senyum, ini akan<br /><em>jadi kenangan.</em></>} copy={`Pastikan semua wajah terlihat. Sentuh Ambil foto, lalu lihat ke kamera selama hitung mundur ${CAPTURE_COUNTDOWN_SECONDS} detik.`}>
    <fieldset className="capture-people" disabled={countdown !== null}>
      <legend>Jumlah pengunjung <small>opsional</small></legend>
      <div className="capture-people-options">{[null, 1, 2, 3].map((count) => <button type="button" key={count ?? 'photo'} aria-pressed={people === count} aria-label={count === null ? 'Ikuti jumlah orang di foto' : `${count} pengunjung`} onClick={() => onPeople(count)}>{count === null ? 'Ikuti foto' : count}</button>)}</div>
      <p>Tidak termasuk tokoh pilihanmu.</p>
    </fieldset>
  </FlowHeading><div className="camera-stage"><video ref={videoRef} autoPlay playsInline muted /><div className="camera-guide"><span /><span /><span /><span /></div>{countdown !== null && <div className="camera-countdown" aria-live="assertive">{countdown}</div>}<div className="camera-hint">{cameraReady ? 'Kamera siap · pastikan wajah terlihat jelas' : 'Menunggu izin kamera…'}</div></div><div className="flow-footer">{error && <ErrorMessage text={error} />}<div className="camera-actions"><BackButton onClick={onBack} /><button className="button primary capture-button" onClick={captureWithCountdown} disabled={!cameraReady || countdown !== null}>{countdown !== null ? `Bersiap… ${countdown}` : 'Ambil foto'} <span>◉</span></button>{!cameraReady && <button className="button secondary camera-start" onClick={onStart}>Aktifkan kamera <span>↗</span></button>}</div></div></main>
}

function ConfirmScreen({ people, photo, scene, character, onBack, onGenerate, error }) { return <main className="flow screen-content horizontal-flow confirm-screen"><FlowHeading kicker="04 / CEK FOTO" title={<>Sudah siap<br /><em>jadi kenangan?</em></>} copy="Periksa foto dan pilihanmu sebelum kami menyusun hasil akhir." /><div className="confirm-layout"><div className="photo-preview"><img src={photo} alt="Pratinjau foto pengunjung" /><div className="photo-label">FOTO KAMU{people !== null && ` · ${people} PENGUNJUNG`}</div></div><div className="summary-card"><span className="summary-kicker">KISAH PILIHANMU</span><h3>{scene?.name}</h3><p>{scene?.location}</p><div className="summary-character"><img src={character?.reference} alt="" /><span><small>Bersama</small><strong>{character?.name}</strong></span></div><p className="privacy-note">Pastikan semua wajah terlihat jelas. Kamu bisa mengambil ulang foto sebelum melanjutkan.</p></div></div><div className="flow-footer">{error && <ErrorMessage text={error} />}<div className="flow-actions"><BackButton onClick={onBack} label="Ambil ulang" /><button className="button primary" onClick={onGenerate}>{error ? 'Coba lagi' : 'Buat foto kenangan'} <span>→</span></button></div></div></main> }

const GENERATING_MESSAGES = [
  { title: 'Menyusun kisah', emphasis: 'untukmu…', note: 'Foto dan pilihanmu menjadi awal sebuah kenangan.' },
  { title: 'Merangkai suasana', emphasis: 'di museum…', note: 'Tokoh dan tempat pilihanmu menghidupkan cerita.' },
  { title: 'Menghadirkan', emphasis: 'cahaya hangat…', note: 'Cahaya, warna, dan suasana untuk potret kenanganmu.' },
  { title: 'Merawat detail', emphasis: 'setiap wajah…', note: 'Senyum dan ciri khasmu menjadi bagian penting dari foto ini.' },
  { title: 'Memadukan cerita', emphasis: 'lintas masa…', note: 'Kamu dan tokoh pilihanmu, dalam satu bingkai.' },
  { title: 'Menanti potret', emphasis: 'kenanganmu…', note: 'AI masih mengolah foto. Tetap di sini sampai hasilnya tampil.' },
]

function GeneratingScreen({ photo }) {
  const [messageIndex, setMessageIndex] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setMessageIndex((index) => (index + 1) % GENERATING_MESSAGES.length), 5000)
    return () => window.clearInterval(timer)
  }, [])
  const message = GENERATING_MESSAGES[messageIndex]
  return <main className="generating screen-content"><div className="generating-orbit"><div className="orbit-ring" /><img src={photo} alt="" /></div><p className="eyebrow">FOTO SEDANG DIPROSES</p><div className="generating-message" role="status" aria-live="polite" aria-atomic="true"><h1>{message.title}<br /><em>{message.emphasis}</em></h1><p className="generating-note">{message.note}</p></div><div className="loading-line"><span /></div><small>Waktu proses dapat berbeda untuk setiap foto.</small></main>
}

function EmailPhotoForm({ delivery }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pollTimerRef = useRef(null)
  const mountedRef = useRef(true)
  const requestRef = useRef(null)
  useEffect(() => () => {
    mountedRef.current = false
    clearTimeout(pollTimerRef.current)
    requestRef.current?.abort()
  }, [])
  useEffect(() => {
    if (!['queued', 'sending'].includes(status)) return undefined
    let cancelled = false
    const poll = async () => {
      try {
        const response = await fetch(delivery.endpoint, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
        const payload = await response.json()
        if (!cancelled && response.ok) setStatus(payload.status)
        if (!response.ok && [404, 410].includes(response.status)) return
        if (!cancelled && (!response.ok || ['queued', 'sending'].includes(payload.status))) pollTimerRef.current = setTimeout(poll, 2000)
      } catch {
        if (!cancelled) pollTimerRef.current = setTimeout(poll, 5000)
      }
    }
    pollTimerRef.current = setTimeout(poll, 1000)
    return () => { cancelled = true; clearTimeout(pollTimerRef.current) }
  }, [status, delivery?.endpoint])

  async function submit(event) {
    event.preventDefault()
    if (busy || status !== 'idle') return
    setBusy(true); setError('')
    const controller = new AbortController(); requestRef.current = controller
    const timeout = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch(delivery.endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim() }), signal: controller.signal,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Permintaan email belum berhasil. Coba lagi atau simpan lewat QR.')
      if (mountedRef.current) setStatus(payload.status)
    } catch (err) {
      if (mountedRef.current) setError(err.name === 'AbortError' ? 'Respons email belum diterima. Coba lagi untuk memeriksa permintaan yang sama.' : err.message)
    } finally {
      clearTimeout(timeout)
      if (mountedRef.current) setBusy(false)
    }
  }
  if (!delivery?.available) return <div className="email-unavailable">Opsi email belum tersedia. Simpan fotomu lewat QR.</div>
  const messages = {
    queued: 'Permintaan diterima. Foto akan dikirim sebagai lampiran meskipun sesi ini selesai.',
    sending: 'Foto sedang dikirim. Kamu boleh menyimpan salinan lewat QR.',
    sent: 'Foto sudah diserahkan ke layanan email. Periksa inbox atau folder spam.',
    failed: 'Foto belum berhasil dikirim ke email. Silakan simpan melalui QR.',
    unknown: 'Status pengiriman belum dapat dipastikan. Periksa inbox atau simpan lewat QR.',
  }
  return <section className="email-card" aria-labelledby="email-title">
    <div className="email-title-row"><h2 id="email-title">Kirim ke email</h2><span>opsional</span></div>
    {status === 'idle' ? <form onSubmit={submit}>
      <label htmlFor="photo-email">Alamat email penerima</label>
      <div className="email-input-row"><input id="photo-email" type="email" required maxLength={254} autoComplete="off" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="nama@email.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} aria-describedby="email-note" /><button className="button primary" type="submit" disabled={busy}>{busy ? 'Meminta…' : 'Kirim'}</button></div>
      <p id="email-note">Foto menjadi lampiran JPG. Periksa alamat sebelum mengirim.</p>
    </form> : <p className={`email-status ${status}`} role="status">{messages[status] || 'Permintaan sedang diperiksa.'}</p>}
    {error && <p className="email-error" role="alert">{error}</p>}
  </section>
}

function ResultScreen({ result, qrData, remaining, onNew, onGallery, onPrint }) {
  return <main className="result screen-content">
    <div className="result-heading"><LogoStrip /><p className="eyebrow">HASIL KENANGAN</p><h1>Inilah <em>kisahmu.</em></h1><p>Terima kasih sudah menghidupkan kembali cerita di Museum R.A. Kartini.</p></div>
    <div className="result-layout">
      <div className="polaroid"><img src={result?.imageUrl} alt="Hasil foto kenangan" /><div className="polaroid-footer"><img src="/assets/logo/logo-museum.webp" alt="Museum R.A. Kartini" /><span>Sejarah bukan hanya<br /><b>untuk dikenang.</b></span></div></div>
      <div className="result-tools">
        <div className="qr-card"><div>{qrData ? <img src={qrData} alt="QR code untuk mengunduh foto" /> : <div className="qr-placeholder" aria-label="QR code sedang disiapkan">QR</div>}</div><div><strong>Scan untuk membawa<br />pulang fotomu</strong><small><b className="qr-expiry">QR tersedia {remaining} detik</b><br />Sesi berikutnya akan dimulai otomatis.</small></div></div>
        <EmailPhotoForm key={result?.id || result?.imageUrl} delivery={result?.email} />
        <div className="result-download-actions"><a className="button secondary download-button" href={result?.imageUrl} download="kisah-kartini.png">Unduh PNG <span>↓</span></a><button className="button secondary print-button" onClick={onPrint}>Cetak <span>↗</span></button></div>
      </div>
    </div>
    <div className="result-actions"><button className="button outline gallery-button" onClick={onGallery}>Lihat galeri <span>↗</span></button><button className="button outline" onClick={onNew}>Mulai sesi baru <span>↻</span></button></div>
  </main>
}

function GalleryModal({ items, loading, error, onRetry, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => { dialogRef.current?.focus(); const onKeyDown = (event) => event.key === 'Escape' && onClose(); document.addEventListener('keydown', onKeyDown); return () => document.removeEventListener('keydown', onKeyDown) }, [onClose])
  return <div className="modal-backdrop" onClick={onClose}><section className="gallery-modal" ref={dialogRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="gallery-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">ARSIP VISUAL MUSEUM</p><h2 id="gallery-title">Galeri <em>terbaru.</em></h2></div><button className="close-button" onClick={onClose} aria-label="Tutup galeri">×</button></div><p className="modal-copy">Potret pengunjung yang ikut menghidupkan kisah Museum R.A. Kartini.</p>{loading ? <div className="gallery-status" role="status">Memuat galeri terbaru…</div> : error ? <div className="gallery-status error-message" role="alert">{error}<button className="text-button" onClick={onRetry}>Coba lagi</button></div> : <div className="gallery-grid">{items.length ? items.map((item) => <img key={item.thumbnailUrl || item.imageUrl} src={item.thumbnailUrl || item.imageUrl} alt="Potret pengunjung museum" loading="lazy" />) : <div className="empty-gallery">Belum ada hasil di galeri. Jadilah yang pertama membuat kisah.</div>}</div>}</section></div>
}

function FlowHeading({ kicker, title, copy, children }) { return <div className="flow-heading"><div className="flow-identity"><img src="/assets/logo/logo-museum.webp" alt="" /><span>MUSEUM R.A. KARTINI · REMBANG</span></div><p className="eyebrow">{kicker}</p><h1>{title}</h1><p>{copy}</p>{children}</div> }
function Progress({ current }) { return <nav className="session-progress" aria-label="Langkah sesi">{STEP_LABELS.map((label, index) => <span key={label} className={index === current ? 'current' : index < current ? 'complete' : ''} aria-current={index === current ? 'step' : undefined}><b>{index < current ? '✓' : index + 1}</b>{label}</span>)}</nav> }
function BackButton({ onClick, label = 'Kembali' }) { return <button className="back-button" onClick={onClick}>← {label}</button> }
function ErrorMessage({ text }) { return <div className="error-message" role="alert">{text}</div> }

createRoot(document.getElementById('root')).render(<App />)
