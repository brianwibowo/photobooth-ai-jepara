import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import QRCode from 'qrcode'
import { characters, scenes, logos, homeStories, getSceneForCharacter, getScenesForCharacter } from './data'
import './styles.css'
import { IDLE_MS, readSnapshot, writeSnapshot, clearSnapshot, savePhoto, loadPhoto, removePhoto, cleanupPhotos } from './session-store.js'

const STEPS = ['character', 'scene', 'camera', 'confirm']
const STEP_LABELS = ['Tokoh', 'Tempat', 'Foto', 'Cek foto']
const SESSION_IDLE_MS = IDLE_MS
const CAPTURE_COUNTDOWN_SECONDS = 7

function App() {
  const [hydrated, setHydrated] = useState(false)
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
  const [galleryExpiresAt, setGalleryExpiresAt] = useState(0)
  const [galleryDetail, setGalleryDetail] = useState(null)
  const [requestId, setRequestId] = useState(null)
  const [generationNotice, setGenerationNotice] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [qrData, setQrData] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [resultRemaining, setResultRemaining] = useState(60)
  const [resultResetRemaining, setResultResetRemaining] = useState(null)
  const [resultExtending, setResultExtending] = useState(false)
  const [resultSessionError, setResultSessionError] = useState('')
  const generateControllerRef = useRef(null)
  const resultExtensionRef = useRef(null)
  const idleTimerRef = useRef(null)
  const resultTimerRef = useRef(null)
  const galleryTimerRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const cameraRequestRef = useRef(0)
  const photoUrlRef = useRef(null)
  const sessionIdRef = useRef(null)
  if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID()
  const idleExpiresRef = useRef(0)
  const requestStartedRef = useRef(0)
  const snapshotRef = useRef(null)
  const captureBusyRef = useRef(false)

  const scene = useMemo(() => sceneId ? getSceneForCharacter(sceneId, characterId) : null, [sceneId, characterId])
  const character = useMemo(() => characters.find((item) => item.id === characterId) || null, [characterId])
  const stepIndex = Math.max(0, STEPS.indexOf(screen))

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const restore = async () => {
      void cleanupPhotos().catch(() => {})
      const saved = readSnapshot()
      if (!saved) { clearSnapshot(); setHydrated(true); return }
      sessionIdRef.current = saved.id
      idleExpiresRef.current = saved.idleExpiresAt || Date.now() + SESSION_IDLE_MS
      requestStartedRef.current = saved.requestStartedAt || Date.now()
      let restoredScreen = saved.screen
      let restoredResult = saved.result || null
      let restoredRequestId = saved.requestId || null
      let notice = ''
      let blob = null
      if (['confirm', 'generating', 'camera'].includes(restoredScreen)) {
        try { blob = await loadPhoto(saved.id) } catch { /* return to camera if unavailable */ }
        if (!(blob instanceof Blob) || blob.size === 0 || blob.size > 8 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(blob.type)) blob = null
      }
      if (cancelled) return
      if (['generating', 'result'].includes(restoredScreen) && restoredRequestId) {
        const timeout = window.setTimeout(() => controller.abort(), 6000)
        try {
          const response = await fetch(`/api/generations/${restoredRequestId}`, { signal: controller.signal, cache: 'no-store' })
          const payload = await response.json()
          if (response.status === 410 || (response.status === 404 && restoredScreen === 'result')) {
            clearSnapshot(); void removePhoto(saved.id).catch(() => {}); setHydrated(true); return
          }
          if (payload.status === 'complete' && validResult(payload.result)) { restoredResult = payload.result; restoredScreen = 'result' }
          else if (payload.status === 'failed') { restoredRequestId = null; restoredScreen = blob ? 'confirm' : 'camera'; notice = payload.error }
        } catch {
          notice = 'Sesi dipulihkan. Koneksi ke server belum dapat diperiksa.'
        } finally { window.clearTimeout(timeout) }
      }
      if (cancelled) return
      if (restoredScreen === 'result') {
        const expiry = Date.parse(restoredResult?.downloadExpiresAt || '')
        if (!Number.isFinite(expiry) || Date.now() >= expiry + (restoredResult.session?.graceSeconds ?? 10) * 1000) { clearSnapshot(); void removePhoto(saved.id).catch(() => {}); setHydrated(true); return }
      } else {
        if (!saved.characterId && restoredScreen !== 'home') restoredScreen = 'character'
        else if (!saved.sceneId && ['camera', 'confirm', 'generating'].includes(restoredScreen)) restoredScreen = 'scene'
        else if (restoredScreen === 'confirm' && !blob) { restoredScreen = 'camera'; notice = 'Foto sebelumnya belum tersedia. Silakan ambil ulang.' }
        else if (restoredScreen === 'generating' && !restoredRequestId) { restoredScreen = blob ? 'confirm' : 'camera'; notice = 'Permintaan sebelumnya belum tercatat. Periksa foto sebelum mencoba lagi.' }
      }
      if (blob) { setPhotoFile(new File([blob], 'capture.jpg', { type: blob.type || 'image/jpeg' })); replacePhoto(URL.createObjectURL(blob)) }
      if (saved.screen === 'generating' && restoredScreen !== 'generating' && restoredScreen !== 'result') idleExpiresRef.current = Date.now() + SESSION_IDLE_MS
      setSceneId(saved.sceneId); setCharacterId(saved.characterId); setPeople(saved.people)
      setRequestId(restoredRequestId); setResult(restoredResult); setScreen(restoredScreen)
      setIsBusy(restoredScreen === 'generating'); setGenerationNotice(notice); setError(notice)
      const galleryActive = saved.galleryOpen && saved.galleryExpiresAt > Date.now()
      setIsGalleryOpen(Boolean(galleryActive)); setGalleryExpiresAt(saved.galleryExpiresAt || 0)
      if (galleryActive && saved.galleryDetail && /^\/(api\/gallery\/image|assets)\//.test(saved.galleryDetail.src)) setGalleryDetail(saved.galleryDetail)
      setHydrated(true)
    }
    void restore()
    return () => { cancelled = true; controller.abort() }
  }, [])
  useEffect(() => {
    if (!hydrated) return
    snapshotRef.current = { id: sessionIdRef.current, screen, sceneId, characterId, people, requestId, requestStartedAt: requestStartedRef.current, result, idleExpiresAt: idleExpiresRef.current, galleryOpen: isGalleryOpen, galleryExpiresAt, galleryDetail }
    writeSnapshot(snapshotRef.current)
  }, [hydrated, screen, sceneId, characterId, people, requestId, result, isGalleryOpen, galleryExpiresAt, galleryDetail])
  useEffect(() => {
    const save = () => { if (snapshotRef.current) writeSnapshot({ ...snapshotRef.current, idleExpiresAt: idleExpiresRef.current }) }
    window.addEventListener('pagehide', save)
    return () => window.removeEventListener('pagehide', save)
  }, [])
  useEffect(() => () => { stopCamera(); generateControllerRef.current?.abort(); resultExtensionRef.current?.abort(); clearTimeout(idleTimerRef.current); clearTimeout(galleryTimerRef.current); clearInterval(resultTimerRef.current); if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current) }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [screen])
  useEffect(() => { if (isGalleryOpen) loadGallery() }, [isGalleryOpen])
  useEffect(() => {
    clearTimeout(galleryTimerRef.current)
    if (!isGalleryOpen) return undefined
    galleryTimerRef.current = window.setTimeout(closeGallery, Math.max(0, galleryExpiresAt - Date.now()))
    return () => clearTimeout(galleryTimerRef.current)
  }, [isGalleryOpen, galleryExpiresAt])
  useEffect(() => {
    if (result?.qrUrl) QRCode.toDataURL(result.qrUrl, { width: 280, margin: 1, color: { dark: '#173e40', light: '#ffffff' } }).then(setQrData)
  }, [result?.qrUrl])
  useEffect(() => {
    clearTimeout(idleTimerRef.current)
    if (!hydrated || screen === 'home' || screen === 'result' || screen === 'generating') return undefined
    const schedule = () => { clearTimeout(idleTimerRef.current); idleTimerRef.current = window.setTimeout(newSession, Math.max(0, idleExpiresRef.current - Date.now())) }
    const armIdleReset = () => {
      idleExpiresRef.current = Date.now() + SESSION_IDLE_MS
      if (snapshotRef.current) writeSnapshot({ ...snapshotRef.current, idleExpiresAt: idleExpiresRef.current })
      schedule()
    }
    const events = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((event) => document.addEventListener(event, armIdleReset, { passive: true }))
    schedule()
    return () => { clearTimeout(idleTimerRef.current); events.forEach((event) => document.removeEventListener(event, armIdleReset)) }
  }, [screen, hydrated])
  useEffect(() => {
    clearInterval(resultTimerRef.current)
    if (screen !== 'result' || !result) return undefined
    const parsed = Date.parse(result.downloadExpiresAt || '')
    const expiry = Number.isFinite(parsed) ? parsed : Date.now() + 60000
    const graceMs = result.session?.continuationUsed ? 0 : (result.session?.graceSeconds ?? 10) * 1000
    const update = () => {
      const current = Date.now()
      setResultRemaining(Math.max(0, Math.ceil((expiry - current) / 1000)))
      if (current < expiry) { setResultResetRemaining(null); return }
      setIsGalleryOpen(false)
      if (result.session?.continuationUsed) { newSession(); return }
      const resetRemaining = Math.max(0, Math.ceil((expiry + graceMs - current) / 1000))
      setResultResetRemaining(resetRemaining)
      if (resetRemaining <= 0) newSession()
    }
    update()
    resultTimerRef.current = window.setInterval(update, 250)
    return () => clearInterval(resultTimerRef.current)
  }, [screen, result])

  function go(next) { idleExpiresRef.current = Date.now() + SESSION_IDLE_MS; setError(''); setScreen(next) }
  function openGallery() { setGalleryDetail(null); setGalleryExpiresAt(Date.now() + 45000); setIsGalleryOpen(true) }
  function closeGallery() { setGalleryDetail(null); setIsGalleryOpen(false); setGalleryExpiresAt(0) }
  function replacePhoto(nextUrl) {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = nextUrl || null
    setPhoto(nextUrl)
  }
  function begin() { snapshotRef.current = null; clearSnapshot(); void removePhoto(sessionIdRef.current).catch(() => {}); sessionIdRef.current = crypto.randomUUID(); setRequestId(null); stopCamera(); setResult(null); replacePhoto(null); setPhotoFile(null); setSceneId(null); setPeople(null); setCharacterId(null); go('character') }
  function chooseScene(id) {
    const selected = characterId ? getSceneForCharacter(id, characterId) : scenes.find((item) => item.id === id)
    if (!selected) return
    if (sceneId !== id) setRequestId(null)
    setSceneId(id)
    if (!selected.characterIds.includes(characterId)) setCharacterId(null)
  }
  async function startCamera() {
    stopCamera()
    const activeRequestId = ++cameraRequestRef.current
    setError('')
    setCameraReady(false)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak tersedia di perangkat ini.')
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
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => { if (streamRef.current === stream) { stopCamera(); setError('Kamera terputus. Sambungkan kembali lalu aktifkan kamera.') } }))
      setCameraReady(true)
    } catch (err) {
      if (activeRequestId !== cameraRequestRef.current) return
      const messages = { NotAllowedError: 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.', NotFoundError: 'Kamera tidak ditemukan. Sambungkan kamera, lalu coba lagi.', NotReadableError: 'Kamera tidak dapat dibuka. Tutup aplikasi lain yang sedang memakai kamera.', OverconstrainedError: 'Pengaturan kamera tidak tersedia pada perangkat ini.' }
      setCameraReady(false); setError(messages[err.name] || `${err.message} Kamera wajib aktif untuk membuat foto kenangan.`)
    }
  }
  function stopCamera() { cameraRequestRef.current += 1; captureBusyRef.current = false; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false) }
  function capturePhoto() {
    if (captureBusyRef.current) return
    const video = videoRef.current
    if (!cameraReady || !video?.videoWidth || video.readyState < 2 || !streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')) return setError('Tunggu sampai kamera siap, lalu coba lagi.')
    const activeRequest = cameraRequestRef.current
    const activeSession = sessionIdRef.current
    captureBusyRef.current = true
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(async (blob) => {
      if (activeRequest !== cameraRequestRef.current || activeSession !== sessionIdRef.current) return
      if (!blob) { captureBusyRef.current = false; return setError('Foto belum siap. Coba ambil ulang.') }
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
      try { await savePhoto(activeSession, file) } catch { /* allow capture even if browser storage is blocked */ }
      if (activeRequest !== cameraRequestRef.current || activeSession !== sessionIdRef.current) { void removePhoto(activeSession).catch(() => {}); return }
      setRequestId(null); setPhotoFile(file); replacePhoto(URL.createObjectURL(blob)); stopCamera(); go('confirm')
    }, 'image/jpeg', 0.9)
  }
  function validResult(payload) { return payload && /^\/api\/download\/[A-Za-z0-9_-]+$/.test(payload.imageUrl) && typeof payload.qrUrl === 'string' && Number.isFinite(Date.parse(payload.downloadExpiresAt)) }
  function receiveResult(payload) {
    if (!validResult(payload)) throw new Error('Respons hasil foto belum valid. Silakan periksa status lagi.')
    setResult(payload); setQrData(''); setIsBusy(false); setGenerationNotice(''); go('result')
  }
  useEffect(() => {
    if (!hydrated || screen !== 'generating' || !requestId) return undefined
    let stopped = false; let timer; let controller; let missing = 0
    const poll = async () => {
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 8000)
      try {
        const response = await fetch(`/api/generations/${requestId}`, { signal: controller.signal, cache: 'no-store' })
        const payload = await response.json()
        if (stopped) return
        if (response.status === 410) { newSession(); return }
        if (payload.status === 'complete') { receiveResult(payload.result); return }
        if (payload.status === 'failed') { setRequestId(null); setIsBusy(false); go(photoFile ? 'confirm' : 'camera'); setError(payload.error); return }
        if (response.status === 404) missing += 1
        else if (!response.ok && response.status !== 202) throw new Error('Status proses belum dapat diperiksa.')
        if (Date.now() - requestStartedRef.current > 360000) setGenerationNotice('Proses belum selesai. Kamu boleh kembali ke cek foto; permintaan yang sama tetap akan diperiksa saat mencoba lagi.')
        if (missing >= 4 && !generateControllerRef.current) { setIsBusy(false); go(photoFile ? 'confirm' : 'camera'); setError('Permintaan belum terkonfirmasi. Coba lagi untuk memeriksa permintaan yang sama.'); return }
      } catch { if (!stopped) setGenerationNotice('Koneksi belum merespons. Kami memeriksa proses yang sama; tidak mengirim generasi baru.') }
      finally { window.clearTimeout(timeout) }
      if (!stopped) timer = window.setTimeout(poll, 2000)
    }
    timer = window.setTimeout(poll, 1000)
    return () => { stopped = true; clearTimeout(timer); controller?.abort() }
  }, [hydrated, screen, requestId])
  async function generate() {
    if (isBusy || generateControllerRef.current) return
    if (!photoFile || !scene || !character) return setError('Foto, tempat, dan tokoh wajib dipilih.')
    const id = requestId || crypto.randomUUID()
    if (!requestId) requestStartedRef.current = Date.now()
    setRequestId(id); setError(''); setGenerationNotice(''); setScreen('generating'); setIsBusy(true)
    const body = new FormData(); body.append('photo', photoFile); body.append('sceneId', scene.id); body.append('characterId', character.id)
    if (people !== null) body.append('people', String(people))
    const controller = new AbortController(); generateControllerRef.current = controller
    const activeSession = sessionIdRef.current
    // Store the receipt before sending, even if the browser reloads before React commits.
    snapshotRef.current = { ...snapshotRef.current, id: activeSession, screen: 'generating', sceneId, characterId, people, requestId: id, requestStartedAt: requestStartedRef.current, result: null, idleExpiresAt: idleExpiresRef.current, galleryOpen: false }
    writeSnapshot(snapshotRef.current)
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'x-generation-id': id }, body, signal: controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (controller.signal.aborted || activeSession !== sessionIdRef.current) return
      if (response.status === 202) { setGenerationNotice('Proses sebelumnya masih berjalan. Menunggu hasil yang sama…'); return }
      if (!response.ok) {
        if (payload.status === 'failed' || (response.status < 500 && payload.code !== 'GENERATION_RATE_LIMITED')) setRequestId(null)
        setIsBusy(false); go('confirm'); setError(payload.error || 'Generasi foto belum terkonfirmasi. Coba lagi untuk memeriksa permintaan yang sama.'); return
      }
      receiveResult(payload)
    } catch (err) {
      if (!controller.signal.aborted && activeSession === sessionIdRef.current) setGenerationNotice(err.message || 'Koneksi terputus. Memeriksa proses yang sama…')
    } finally { if (generateControllerRef.current === controller) generateControllerRef.current = null }
  }
  async function loadGallery() {
    setGalleryLoading(true); setGalleryError('')
    try {
      const response = await fetch('/api/gallery?limit=8')
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || !Array.isArray(payload.items)) throw new Error(payload?.error || 'Galeri tidak dapat dimuat. Coba lagi.')
      setGallery(payload.items.slice(0, 8))
      setGalleryDetail((current) => current && payload.items.some((item) => (item.thumbnailUrl || item.imageUrl) === current.src) ? { ...current, index: payload.items.findIndex((item) => (item.thumbnailUrl || item.imageUrl) === current.src) } : null)
    } catch (err) {
      setGallery([])
      setGalleryError(err.message || 'Galeri tidak dapat dimuat. Coba lagi.')
    } finally { setGalleryLoading(false) }
  }
  async function extendResultSession() {
    if (resultExtensionRef.current || !result?.session?.extendEndpoint) return
    const controller = new AbortController()
    resultExtensionRef.current = controller
    setResultExtending(true); setResultSessionError('')
    const timeout = window.setTimeout(() => controller.abort(), 6000)
    try {
      const response = await fetch(result.session.extendEndpoint, { method: 'POST', signal: controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Waktu belum berhasil ditambah. Coba lagi.')
      if (!Number.isFinite(Date.parse(payload.downloadExpiresAt)) || Date.parse(payload.downloadExpiresAt) <= Date.now()) throw new Error('Waktu QR belum berhasil diperbarui. Coba lagi.')
      if (controller.signal.aborted) return
      setResult((current) => current?.imageUrl === result.imageUrl ? { ...current, downloadExpiresAt: payload.downloadExpiresAt, session: { ...current.session, continuationUsed: Boolean(payload.continuationUsed), graceSeconds: payload.continuationUsed ? 0 : 10 } } : current)
      setResultResetRemaining(null)
    } catch (err) {
      if (resultExtensionRef.current === controller) setResultSessionError(err.name === 'AbortError' ? 'Koneksi belum merespons. Coba lagi sebelum sesi berakhir.' : err.message)
    } finally {
      window.clearTimeout(timeout)
      if (resultExtensionRef.current === controller) { resultExtensionRef.current = null; setResultExtending(false) }
    }
  }
  function newSession() { const oldId = sessionIdRef.current; snapshotRef.current = null; clearSnapshot(); void removePhoto(oldId).catch(() => {}); sessionIdRef.current = crypto.randomUUID(); idleExpiresRef.current = 0; requestStartedRef.current = 0; setRequestId(null); setIsBusy(false); setGenerationNotice(''); closeGallery(); stopCamera(); generateControllerRef.current?.abort(); generateControllerRef.current = null; resultExtensionRef.current?.abort(); resultExtensionRef.current = null; clearInterval(resultTimerRef.current); setResultResetRemaining(null); setResultExtending(false); setResultSessionError(''); setIsGalleryOpen(false); setResult(null); setQrData(''); setError(''); replacePhoto(null); setPhotoFile(null); setSceneId(null); setPeople(null); setCharacterId(null); go('home') }

  if (!hydrated) return <main className="generating screen-content"><p role="status">Memulihkan sesi…</p></main>

  return <div className="app-shell">
    {screen === 'home' && <Home onStart={begin} onGallery={openGallery} />}
    {screen === 'scene' && <ScenePicker scene={scene} character={character} onSelect={chooseScene} onNext={() => { if (scene && character) go('camera') }} onBack={() => go('character')} />}
    {screen === 'character' && <CharacterPicker character={character} onSelect={(id) => { if (id !== characterId) { setRequestId(null); setSceneId(null) }; setCharacterId(id) }} onNext={() => { if (character) go('scene') }} onBack={newSession} />}
    {screen === 'camera' && <CameraScreen people={people} onPeople={(value) => { setRequestId(null); setPeople(value) }} videoRef={videoRef} cameraReady={cameraReady} onStart={startCamera} onStop={stopCamera} onCapture={capturePhoto} onBack={() => { stopCamera(); go('character') }} error={error || generationNotice} />}
    {screen === 'confirm' && <ConfirmScreen people={people} photo={photo} scene={scene} character={character} onBack={() => go('camera')} onGenerate={generate} error={error} />}
    {screen === 'generating' && <GeneratingScreen photo={photo} notice={generationNotice} onBack={() => { generateControllerRef.current?.abort(); generateControllerRef.current = null; setIsBusy(false); go(photoFile ? 'confirm' : 'camera') }} />}
    {screen === 'result' && <ResultScreen result={result} qrData={qrData} remaining={resultRemaining} notice={error} onNew={newSession} onGallery={openGallery} onPrint={() => window.print()} />}

    {STEPS.includes(screen) && <Progress current={stepIndex} />}
    {isGalleryOpen && <GalleryModal items={gallery} loading={galleryLoading} error={galleryError} onRetry={loadGallery} onClose={closeGallery} selectedPhoto={galleryDetail} onPhotoSelect={setGalleryDetail} />}
    {screen === 'result' && resultResetRemaining !== null && <ResultExpiryDialog remaining={resultResetRemaining} extending={resultExtending} error={resultSessionError} canExtend={Boolean(result?.session?.extendEndpoint)} onContinue={extendResultSession} onExit={newSession} />}
  </div>
}

function LogoStrip() {
  return <div className="logo-strip" aria-label="Museum R.A. Kartini dan mitra">{logos.map((logo) => <img key={logo.src} src={logo.src} alt={logo.alt} />)}</div>
}

function Home({ onStart, onGallery }) {
  const storyViewportRef = useRef(null)
  useEffect(() => {
    let frame
    let last = performance.now()
    const tick = (now) => {
      const viewport = storyViewportRef.current
      const firstCard = viewport?.firstElementChild?.firstElementChild
      if (!viewport || !firstCard) { frame = window.requestAnimationFrame(tick); return }
      const gap = Number.parseFloat(window.getComputedStyle(viewport.firstElementChild).rowGap || '0') || 0
      const step = firstCard.getBoundingClientRect().height + gap
      const elapsed = Math.min(64, now - last)
      last = now
      // Keep the editorial strip visibly moving while leaving enough time to
      // read each card. The old 35 px/s pace felt stalled on the kiosk.
      viewport.scrollTop += elapsed * 0.08
      const loopDistance = step * homeStories.length
      if (loopDistance > 0 && viewport.scrollTop >= loopDistance) viewport.scrollTop -= loopDistance
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return <main className="home screen-content">
    <section className="hero-copy">
      <div className="home-title"><div className="home-eyebrow">PHOTOBOOTH AI</div><div className="home-title-top"><span>Hadir dalam</span><img className="home-brand" src="/assets/logo/logo-museum.webp" alt="Museum R.A. Kartini Rembang" /></div><em>Kisah Kartini</em><div className="home-title-rule" aria-hidden="true"><span>✦</span></div></div>
      <div className="home-museum-art"><img src="/assets/backgrounds/gerbang.webp" alt="Gerbang Museum R.A. Kartini Rembang" /></div>
      <div className="home-actions">
        <button className="home-start" onClick={onStart}>MULAI <span aria-hidden="true">▶</span></button>
        <button className="home-gallery" onClick={onGallery}>Lihat Galeri <span aria-hidden="true">↗</span></button>
      </div>
    </section>
    <section className="home-static-catalog" aria-label="Pilihan kisah R.A. Kartini">
      <div className="home-story-viewport" ref={storyViewportRef}><div className="home-story-track">{[...homeStories, ...homeStories].map((story, index) => <div className="home-story-card" key={`${story.id}-${index}`}><img src={story.images[0]} alt={story.alt} decoding="async" /></div>)}</div></div>
    </section>
  </main>
}

function ScenePicker({ scene, character, onSelect, onNext, onBack }) {
  const available = character ? getScenesForCharacter(character.id) : []
  return <main className="flow screen-content picker-screen scene-screen">
    <FlowHeading kicker="02 / PILIH TEMPAT" title={<>Di mana kisahmu <em>dimulai?</em></>} copy={`Pilih suasana untuk berfoto bersama ${character?.name || 'tokoh pilihanmu'}.`} />
    <div className="scene-grid">{available.map((item) => <button aria-pressed={scene?.id === item.id} className={`scene-card ${scene?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => onSelect(item.id)}><img src={item.image} alt="" /><span className="scene-overlay" /><span className="scene-info"><strong>{item.name}</strong><span>{item.activity ? `${item.activity} · ${item.place}` : item.description}</span></span><span className="selection-check" aria-hidden="true">{scene?.id === item.id ? '✓' : '+'}</span></button>)}</div>
    <div className="flow-actions"><BackButton onClick={onBack} /><p className="selection-summary">{scene?.name || 'Pilih satu tempat'}</p><button className="button primary" onClick={onNext} disabled={!scene}>Lanjut ke foto <span>→</span></button></div>
  </main>
}

function CharacterPicker({ character, onSelect, onNext, onBack }) {
  const available = characters
  return <main className="flow screen-content picker-screen character-screen">
    <FlowHeading kicker="01 / PILIH TOKOH" title={<>Siapa <em>teman fotomu?</em></>} copy="Pilih satu tokoh yang akan menemanimu dalam foto kenangan." />
    <div className="character-grid">{available.map((item) => <button aria-pressed={character?.id === item.id} className={`character-card ${character?.id === item.id ? 'selected' : ''}`} onClick={() => onSelect(item.id)} key={item.id}><img src={item.reference} alt="" /><span className="character-info"><strong>{item.name}</strong><small>{item.role}</small></span><span className="selection-check" aria-hidden="true">{character?.id === item.id ? '✓' : '+'}</span></button>)}</div>
    <div className="flow-actions"><BackButton onClick={onBack} /><p className="selection-summary">{character?.name || 'Pilih satu tokoh'}</p><button className="button primary" onClick={onNext} disabled={!character}>Pilih tempat <span>→</span></button></div>
  </main>
}

function CameraScreen({ people, onPeople, videoRef, cameraReady, onStart, onStop, onCapture, onBack, error }) {
  const [countdown, setCountdown] = useState(null)
  const countdownTimerRef = useRef(null)
  useEffect(() => { onStart(); return () => { window.clearInterval(countdownTimerRef.current); onStop() } }, [])
  useEffect(() => { if (!cameraReady) { window.clearInterval(countdownTimerRef.current); setCountdown(null) } }, [cameraReady])
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
      <div className="capture-people-options">{[null, 1, 2, 3, 4].map((count) => <button type="button" key={count ?? 'photo'} aria-pressed={people === count} aria-label={count === null ? 'Ikuti jumlah orang di foto' : `${count} pengunjung`} onClick={() => onPeople(count)}>{count === null ? 'Ikuti foto' : count}</button>)}</div>
      <p>Tidak termasuk tokoh pilihanmu.</p>
    </fieldset>
  </FlowHeading><div className="camera-stage"><video ref={videoRef} autoPlay playsInline muted /><div className="camera-guide"><span /><span /><span /><span /></div>{countdown !== null && <div className="camera-countdown" aria-live="assertive">{countdown}</div>}<div className="camera-hint">{cameraReady ? 'Kamera siap · pastikan wajah terlihat jelas' : 'Menunggu izin kamera…'}</div></div><div className="flow-footer">{error && <ErrorMessage text={error} />}<div className="camera-actions"><BackButton onClick={onBack} /><button className="button primary capture-button" onClick={captureWithCountdown} disabled={!cameraReady || countdown !== null}>{countdown !== null ? `Bersiap… ${countdown}` : 'Ambil foto'} <span>◉</span></button>{!cameraReady && <button className="button secondary camera-start" onClick={onStart}>Aktifkan kamera <span>↗</span></button>}</div></div></main>
}

function ConfirmScreen({ people, photo, scene, character, onBack, onGenerate, error }) { return <main className="flow screen-content horizontal-flow confirm-screen"><FlowHeading kicker="04 / CEK FOTO" title={<>Sudah siap<br /><em>jadi kenangan?</em></>} copy="Periksa foto dan pilihanmu sebelum kami menyusun hasil akhir." /><div className="confirm-layout"><div className="photo-preview"><img src={photo} alt="Pratinjau foto pengunjung" /><div className="photo-label">FOTO KAMU{people !== null && ` · ${people} PENGUNJUNG`}</div></div><div className="summary-card"><span className="summary-kicker">KISAH PILIHANMU</span><h3>{scene?.name}</h3><p>{scene?.location}</p>{scene?.activity && <p className="scene-activity">Aktivitas: {scene.activity}</p>}<div className="summary-character"><img src={character?.reference} alt="" /><span><small>Bersama</small><strong>{character?.name}</strong></span></div><p className="privacy-note">Pastikan semua wajah terlihat jelas. Kamu bisa mengambil ulang foto sebelum melanjutkan.</p></div></div><div className="flow-footer">{error && <ErrorMessage text={error} />}<div className="flow-actions"><BackButton onClick={onBack} label="Ambil ulang" /><button className="button primary" onClick={onGenerate}>{error ? 'Coba lagi' : 'Buat foto kenangan'} <span>→</span></button></div></div></main> }

const GENERATING_MESSAGES = [
  { title: 'Menyusun kisah', emphasis: 'untukmu…', note: 'Foto dan pilihanmu menjadi awal sebuah kenangan.' },
  { title: 'Merangkai suasana', emphasis: 'di museum…', note: 'Tokoh dan tempat pilihanmu menghidupkan cerita.' },
  { title: 'Menghadirkan', emphasis: 'cahaya hangat…', note: 'Cahaya, warna, dan suasana untuk potret kenanganmu.' },
  { title: 'Merawat detail', emphasis: 'setiap wajah…', note: 'Senyum dan ciri khasmu menjadi bagian penting dari foto ini.' },
  { title: 'Memadukan cerita', emphasis: 'lintas masa…', note: 'Kamu dan tokoh pilihanmu, dalam satu bingkai.' },
  { title: 'Menanti potret', emphasis: 'kenanganmu…', note: 'AI masih mengolah foto. Tetap di sini sampai hasilnya tampil.' },
]

function GeneratingScreen({ photo, notice, onBack }) {
  const [messageIndex, setMessageIndex] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setMessageIndex((index) => (index + 1) % GENERATING_MESSAGES.length), 5000)
    return () => window.clearInterval(timer)
  }, [])
  const message = GENERATING_MESSAGES[messageIndex]
  return <main className="generating screen-content"><div className="generating-photo">{photo ? <img src={photo} alt="Foto seluruh pengunjung yang sedang diproses" /> : <p role="status">Memeriksa hasil foto…</p>}</div><p className="eyebrow">FOTO SEDANG DIPROSES</p><div className="generating-message" role="status" aria-live="polite" aria-atomic="true"><h1>{message.title}<br /><em>{message.emphasis}</em></h1><p className="generating-note">{message.note}</p></div><div className="loading-line"><span /></div><small>Waktu proses dapat berbeda untuk setiap foto.</small>{notice && <div className="generation-recovery" role="status"><p>{notice}</p><button className="text-button" onClick={onBack}>Kembali ke cek foto</button></div>}</main>
}

function EmailPhotoForm({ delivery, sessionExpiresAt }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(Boolean(delivery?.available))
  const [error, setError] = useState('')
  const pollTimerRef = useRef(null)
  const mountedRef = useRef(true)
  const requestRef = useRef(null)
  useEffect(() => {
    if (!delivery?.available) return undefined
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    setChecking(true)
    fetch(delivery.endpoint, { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      const payload = await response.json()
      if (!cancelled && response.ok && ['idle', 'queued', 'sending', 'sent', 'failed', 'unknown'].includes(payload.status)) setStatus(payload.status)
    }).catch(() => {}).finally(() => { clearTimeout(timeout); if (!cancelled) setChecking(false) })
    return () => { cancelled = true; clearTimeout(timeout); controller.abort() }
  }, [delivery?.endpoint, sessionExpiresAt])
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
  }, [status, delivery?.endpoint, sessionExpiresAt])

  async function submit(event) {
    event.preventDefault()
    if (busy || checking || status !== 'idle') return
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
    {checking ? <p className="email-status" role="status">Memeriksa status pengiriman…</p> : status === 'idle' ? <form onSubmit={submit}>
      <label htmlFor="photo-email">Alamat email penerima</label>
      <div className="email-input-row"><input id="photo-email" type="email" required maxLength={254} autoComplete="off" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="nama@email.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} aria-describedby="email-note" /><button className="button primary" type="submit" disabled={busy}>{busy ? 'Meminta…' : 'Kirim'}</button></div>
      <p id="email-note">Foto menjadi lampiran JPG. Periksa alamat sebelum mengirim.</p>
    </form> : <p className={`email-status ${status}`} role="status">{messages[status] || 'Permintaan sedang diperiksa.'}</p>}
    {error && <p className="email-error" role="alert">{error}</p>}
  </section>
}

function ResultScreen({ result, qrData, remaining, notice, onNew, onGallery, onPrint }) {
  const character = result?.character
  const scene = result?.scene
  return <main className="result screen-content">
    {notice && <ErrorMessage text={notice} />}
    <div className="result-heading"><LogoStrip /><p className="eyebrow">HASIL KENANGAN</p><h1>Inilah <em>kisahmu.</em></h1><p>Terima kasih sudah menghidupkan kembali cerita di Museum R.A. Kartini.</p></div>
    <div className="result-layout">
      <div className="polaroid"><img src={result?.imageUrl} alt="Hasil foto kenangan" /><div className="polaroid-footer"><img src="/assets/logo/logo-museum.webp" alt="Museum R.A. Kartini" /><span className="result-caption">{character && scene ? <><strong>Bersama {character.name}</strong><small>{scene.name} · {scene.location}</small></> : <>Sejarah bukan hanya<br /><b>untuk dikenang.</b></>}</span></div></div>
      <div className="result-tools">
        <div className={`qr-card ${remaining === 0 ? 'expired' : ''}`}><div>{qrData ? <img src={qrData} alt="QR code untuk mengunduh foto" /> : <div className="qr-placeholder" aria-label="QR code sedang disiapkan">QR</div>}</div><div><strong>Scan untuk membawa<br />pulang fotomu</strong><small><b className="qr-expiry">{remaining > 0 ? `QR tersedia ${remaining} detik` : 'QR sudah habis waktunya'}</b><br />{result?.session?.continuationUsed ? 'Setelah waktu habis, kembali ke beranda otomatis.' : 'Saat waktu habis, pilih lanjutkan atau keluar.'}</small></div></div>
        <EmailPhotoForm key={result?.id || result?.imageUrl} delivery={result?.email} sessionExpiresAt={result?.downloadExpiresAt} />
        <div className="result-download-actions"><a className="button secondary download-button" href={result?.imageUrl} download={result?.filename || `photobooth_kartini_${String(result?.id || 0).padStart(6, '0')}.png`}>Unduh PNG <span>↓</span></a><button className="button secondary print-button" onClick={onPrint}>Cetak <span>↗</span></button></div>
      </div>
    </div>
    <div className="result-actions"><button className="button outline gallery-button" onClick={onGallery}>Lihat galeri <span>↗</span></button><button className="button outline" onClick={onNew}>Mulai sesi baru <span>↻</span></button></div>
  </main>
}

function ResultExpiryDialog({ remaining, extending, error, canExtend, onContinue, onExit }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [])
  function handleKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); onExit(); return }
    if (event.key !== 'Tab') return
    const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')]
    const first = buttons[0]; const last = buttons[buttons.length - 1]
    if (!first) return
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus() }
  }
  return <div className="modal-backdrop result-expiry-backdrop"><section className="result-expiry-dialog" ref={dialogRef} tabIndex="-1" role="alertdialog" aria-modal="true" aria-labelledby="expiry-title" aria-describedby="expiry-copy" onKeyDown={handleKey}>
    <p className="eyebrow">WAKTU QR SUDAH HABIS</p><h2 id="expiry-title">Masih ingin<br /><em>menyimpan fotomu?</em></h2>
    <p id="expiry-copy">Kamu akan kembali ke beranda dalam <b className="qr-expiry">{remaining} detik</b>. Pilih lanjutkan untuk mengaktifkan QR lagi selama 15 detik.</p>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="expiry-actions"><button className="button primary" onClick={onContinue} disabled={extending || !canExtend}>{extending ? 'Memperpanjang…' : 'Lanjutkan (15 detik)'}</button><button className="button outline" onClick={onExit}>Keluar</button></div>
  </section></div>
}

function handleGalleryDialogKey(event, dialogRef, onClose) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
  if (event.key !== 'Tab') return
  const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')]
  const first = buttons[0]; const last = buttons[buttons.length - 1]
  if (!first) return
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus() }
}

function GalleryModal({ items, loading, error, onRetry, onClose, selectedPhoto, onPhotoSelect }) {
  const dialogRef = useRef(null)
  const photoTriggerRef = useRef(null)
  const visibleItems = items.slice(0, 8)
  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!selectedPhoto) dialogRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus() }
  }, [])
  return <>
    <div className="modal-backdrop" onClick={onClose} inert={selectedPhoto ? true : undefined} aria-hidden={selectedPhoto ? true : undefined}>
      <section className="gallery-modal" ref={dialogRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="gallery-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => handleGalleryDialogKey(event, dialogRef, onClose)}>
        <div className="modal-header"><div><p className="eyebrow">ARSIP VISUAL MUSEUM</p><h2 id="gallery-title">Galeri <em>terbaru.</em></h2></div><button className="close-button" onClick={onClose} aria-label="Tutup galeri">×</button></div>
        {loading ? <div className="gallery-status" role="status">Memuat galeri terbaru…</div> : error ? <div className="gallery-status error-message" role="alert">{error}<button className="text-button" onClick={onRetry}>Coba lagi</button></div> : <div className="gallery-grid">{visibleItems.length ? visibleItems.map((item, index) => <button className="gallery-photo-button" key={item.thumbnailUrl || item.imageUrl} onClick={(event) => { photoTriggerRef.current = event.currentTarget; onPhotoSelect({ src: item.thumbnailUrl || item.imageUrl, index }) }} aria-label={`Lihat detail foto ${index + 1}`}><img src={item.thumbnailUrl || item.imageUrl} alt="Potret pengunjung museum" loading="lazy" /></button>) : <div className="empty-gallery">Belum ada hasil di galeri. Jadilah yang pertama membuat kisah.</div>}</div>}
      </section>
    </div>
    {selectedPhoto && <GalleryPhotoDialog photo={selectedPhoto} total={visibleItems.length} returnFocusRef={photoTriggerRef} onClose={() => onPhotoSelect(null)} />}
  </>
}

function GalleryPhotoDialog({ photo, total, returnFocusRef, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const previousFocus = returnFocusRef.current || document.activeElement
    dialogRef.current?.focus()
    return () => {
      const target = returnFocusRef.current || document.querySelector(`[aria-label="Lihat detail foto ${photo.index + 1}"]`) || previousFocus
      if (target?.isConnected) target.focus()
    }
  }, [returnFocusRef])
  return <div className="modal-backdrop gallery-detail-backdrop" onClick={onClose}><section className="gallery-detail" ref={dialogRef} tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="gallery-detail-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => handleGalleryDialogKey(event, dialogRef, onClose)}>
    <div className="modal-header"><div><p className="eyebrow">FOTO {photo.index + 1} DARI {total}</p><h2 id="gallery-detail-title">Foto <em>kenangan.</em></h2></div><button className="close-button" onClick={onClose} aria-label="Tutup detail foto">×</button></div>
    <img className="gallery-detail-image" src={photo.src} alt={`Foto kenangan pengunjung museum ${photo.index + 1}`} />
  </section></div>
}

function FlowHeading({ kicker, title, copy, children }) { return <div className="flow-heading"><div className="flow-identity"><img src="/assets/logo/logo-museum.webp" alt="" /><span>MUSEUM R.A. KARTINI · REMBANG</span></div><p className="eyebrow">{kicker}</p><h1>{title}</h1><p>{copy}</p>{children}</div> }
function Progress({ current }) { return <nav className="session-progress" aria-label="Langkah sesi">{STEP_LABELS.map((label, index) => <span key={label} className={index === current ? 'current' : index < current ? 'complete' : ''} aria-current={index === current ? 'step' : undefined}><b>{index < current ? '✓' : index + 1}</b>{label}</span>)}</nav> }
function BackButton({ onClick, label = 'Kembali' }) { return <button className="back-button" onClick={onClick}>← {label}</button> }
function ErrorMessage({ text }) { return <div className="error-message" role="alert">{text}</div> }

createRoot(document.getElementById('root')).render(<App />)
