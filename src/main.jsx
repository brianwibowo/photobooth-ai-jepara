import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import QRCode from 'qrcode'
import { characters, scenes, getCharacter, getScene } from './data'
import './styles.css'

const STEPS = ['home', 'scene', 'people', 'guests', 'camera', 'confirm', 'generating', 'result']
const freshGuests = (count) => Array.from({ length: count }, (_, index) => ({ name: '', gender: '', label: `Pengunjung ${index + 1}` }))

function App() {
  const [screen, setScreen] = useState('home')
  const [sceneId, setSceneId] = useState(null)
  const [characterId, setCharacterId] = useState('kartini')
  const [people, setPeople] = useState(1)
  const [guests, setGuests] = useState(freshGuests(1))
  const [photo, setPhoto] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [result, setResult] = useState(null)
  const [gallery, setGallery] = useState([])
  const [error, setError] = useState('')
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [generationNote, setGenerationNote] = useState('Menyiapkan ruang dan cahaya museum…')
  const [qrData, setQrData] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)

  const scene = useMemo(() => getScene(sceneId), [sceneId])
  const character = useMemo(() => getCharacter(characterId), [characterId])
  const stepIndex = Math.max(0, STEPS.indexOf(screen))

  useEffect(() => () => stopCamera(), [])
  useEffect(() => { if (isGalleryOpen) loadGallery() }, [isGalleryOpen])
  useEffect(() => {
    if (result?.qrUrl) QRCode.toDataURL(result.qrUrl, { width: 280, margin: 1, color: { dark: '#173e40', light: '#ffffff' } }).then(setQrData)
  }, [result])

  function go(next) { setError(''); setScreen(next) }
  function begin() { setResult(null); setPhoto(null); setPhotoFile(null); setSceneId(null); go('scene') }
  function chooseScene(id) { setSceneId(id); const selected = getScene(id); setCharacterId(selected.characterIds[0]); go('people') }
  function choosePeople(count) { setPeople(count); setGuests(freshGuests(count)); go('guests') }
  function updateGuest(index, key, value) { setGuests((current) => current.map((guest, i) => i === index ? { ...guest, [key]: value } : guest)) }
  function continueGuests() {
    if (guests.some((guest) => !guest.name.trim() || !guest.gender)) return setError('Lengkapi nama dan jenis kelamin setiap pengunjung terlebih dahulu.')
    go('camera')
  }
  async function startCamera() {
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak tersedia di perangkat ini.')
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      if (videoRef.current) videoRef.current.srcObject = streamRef.current
    } catch (err) { setError(`${err.message} Anda tetap dapat memilih foto dari perangkat.`) }
  }
  function stopCamera() { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null }
  function capturePhoto() {
    const video = videoRef.current
    if (!video?.videoWidth) return setError('Tunggu sampai kamera siap, lalu coba lagi.')
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => { const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' }); setPhotoFile(file); setPhoto(URL.createObjectURL(blob)); stopCamera(); go('confirm') }, 'image/jpeg', 0.9)
  }
  function selectFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Pilih file gambar JPG, PNG, atau WebP.')
    if (file.size > 8 * 1024 * 1024) return setError('Ukuran foto maksimal 8 MB.')
    setPhotoFile(file); setPhoto(URL.createObjectURL(file)); stopCamera(); go('confirm')
  }
  async function generate() {
    if (!photoFile || !scene) return setError('Foto dan adegan wajib dipilih.')
    setError(''); setGenerationNote('Mengunci komposisi bersama tokoh pilihan…'); go('generating'); setIsBusy(true)
    const body = new FormData(); body.append('photo', photoFile); body.append('sceneId', scene.id); body.append('characterId', character.id); body.append('people', String(people)); body.append('guests', JSON.stringify(guests))
    try {
      setTimeout(() => setGenerationNote('Menyusun cahaya hangat dan detail sejarah…'), 1500)
      const response = await fetch('/api/generate', { method: 'POST', body })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Generasi foto gagal.')
      setResult(payload); setQrData(''); go('result')
    } catch (err) { setError(err.message); go('confirm') }
    finally { setIsBusy(false) }
  }
  async function loadGallery() {
    try { const response = await fetch('/api/gallery?limit=12'); const payload = await response.json(); setGallery(payload.items || []) } catch { setGallery([]) }
  }
  function newSession() { stopCamera(); setResult(null); setPhoto(null); setPhotoFile(null); setSceneId(null); setGuests(freshGuests(1)); go('home') }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={newSession} aria-label="Kembali ke beranda"><img src="/assets/logo-museum.png" alt="" /><span>KISAH<br /><b>KARTINI</b></span></button>
      <div className="topbar-right"><span className="museum-mark">Museum R.A. Kartini<br /><small>Rembang</small></span><button className="gallery-link" onClick={() => setIsGalleryOpen(true)}>Galeri <span>↗</span></button></div>
    </header>

    {screen === 'home' && <Home onStart={begin} onGallery={() => setIsGalleryOpen(true)} />}
    {screen === 'scene' && <ScenePicker selected={sceneId} onSelect={chooseScene} onBack={() => go('home')} />}
    {screen === 'people' && <PeoplePicker value={people} onSelect={choosePeople} onBack={() => go('scene')} />}
    {screen === 'guests' && <GuestForm guests={guests} update={updateGuest} onNext={continueGuests} onBack={() => go('people')} error={error} />}
    {screen === 'camera' && <CameraScreen videoRef={videoRef} onStart={startCamera} onCapture={capturePhoto} onFile={() => fileRef.current?.click()} fileRef={fileRef} onSelectFile={selectFile} onBack={() => go('guests')} error={error} />}
    {screen === 'confirm' && <ConfirmScreen photo={photo} scene={scene} character={character} people={people} guests={guests} onBack={() => go('camera')} onGenerate={generate} error={error} />}
    {screen === 'generating' && <GeneratingScreen photo={photo} note={generationNote} />}
    {screen === 'result' && <ResultScreen result={result} qrData={qrData} onNew={newSession} onGallery={() => setIsGalleryOpen(true)} />}

    {screen !== 'home' && screen !== 'result' && <Progress current={stepIndex} />}
    {isGalleryOpen && <GalleryModal items={gallery} onClose={() => setIsGalleryOpen(false)} />}
  </div>
}

function Home({ onStart, onGallery }) { return <main className="home screen-content"><section className="hero-copy"><p className="eyebrow">Photobooth AI · Museum R.A. Kartini</p><h1>Hadirkan<br /><em>kisahmu</em><br />bersama Kartini.</h1><p className="intro">Abadikan satu momen hangat di tempat sejarah bermula. Pilih adegan, tersenyum, dan biarkan kisah baru tercipta.</p><div className="home-actions"><button className="button primary" onClick={onStart}>Mulai pengalaman <span>→</span></button><button className="text-button" onClick={onGallery}>Lihat galeri <span>↗</span></button></div><div className="home-note"><span className="ornament">✦</span><span>Dirancang untuk pengunjung Museum R.A. Kartini, Rembang.<br />Hasil foto dapat diunduh privat melalui QR.</span></div></section><section className="hero-visual"><div className="hero-image"><img src="/assets/gerbang.png" alt="Gerbang Museum R.A. Kartini" /><div className="image-tint" /></div><div className="hero-badge"><img src="/assets/logo-hatiku.png" alt="Museum di Hatiku" /><span>sejarah<br />yang hidup</span></div><span className="vertical-caption">REMBANG · JAWA TENGAH</span></section></main> }

function ScenePicker({ selected, onSelect, onBack }) { return <main className="flow screen-content"><FlowHeading kicker="01 / PILIH ADEGAN" title={<>Di mana kisahmu<br /><em>dimulai?</em></>} copy="Pilih latar yang ingin kamu bawa pulang. Setiap adegan dipersiapkan dengan referensi museum yang otentik." /><div className="scene-grid">{scenes.map((item) => <button className={`scene-card ${selected === item.id ? 'selected' : ''}`} key={item.id} onClick={() => onSelect(item.id)}><img src={item.image} alt="" /><span className="scene-overlay" /><span className="scene-info"><small>{item.location}</small><strong>{item.name}</strong><span>{item.description}</span></span><span className="scene-arrow">↗</span></button>)}</div><BackButton onClick={onBack} /></main> }

function PeoplePicker({ value, onSelect, onBack }) { return <main className="flow screen-content narrow"><FlowHeading kicker="02 / JUMLAH ORANG" title={<>Berapa orang yang<br /><em>ikut berfoto?</em></>} copy="Kamu bisa mengajak hingga tiga orang dalam satu frame." /><div className="people-grid">{[1, 2, 3].map((count) => <button className={`people-card ${value === count ? 'selected' : ''}`} onClick={() => onSelect(count)} key={count}><span className="people-number">0{count}</span><span className="people-icons">{Array.from({ length: count }, (_, i) => <i key={i} />)}</span><strong>{count === 1 ? 'Sendiri' : `${count} orang`}</strong><small>{count === 1 ? 'Satu potret untukmu' : 'Berbagi momen bersama'}</small><span className="card-arrow">→</span></button>)}</div><BackButton onClick={onBack} /></main> }

function GuestForm({ guests, update, onNext, onBack, error }) { return <main className="flow screen-content narrow"><FlowHeading kicker="03 / KENALKAN DIRI" title={<>Nama kecilmu,<br /><em>cerita besar.</em></>} copy="Data ini hanya digunakan untuk buku tamu museum dan tidak muncul di galeri publik." /><div className="guest-form">{guests.map((guest, index) => <div className="guest-row" key={index}><div className="guest-index">0{index + 1}</div><div className="field-group"><label htmlFor={`name-${index}`}>Nama panggilan</label><input id={`name-${index}`} value={guest.name} onChange={(event) => update(index, 'name', event.target.value)} placeholder="Tulis nama di sini" autoComplete="off" /></div><div className="field-group gender-field"><span>Jenis kelamin</span><div className="choice-row"><label className={guest.gender === 'Perempuan' ? 'active' : ''}><input type="radio" name={`gender-${index}`} checked={guest.gender === 'Perempuan'} onChange={() => update(index, 'gender', 'Perempuan')} /> Perempuan</label><label className={guest.gender === 'Laki-laki' ? 'active' : ''}><input type="radio" name={`gender-${index}`} checked={guest.gender === 'Laki-laki'} onChange={() => update(index, 'gender', 'Laki-laki')} /> Laki-laki</label></div></div></div>)}</div>{error && <ErrorMessage text={error} />}<div className="flow-actions"><BackButton onClick={onBack} /><button className="button primary" onClick={onNext}>Lanjut ke kamera <span>→</span></button></div></main> }

function CameraScreen({ videoRef, onStart, onCapture, onFile, fileRef, onSelectFile, onBack, error }) { return <main className="flow screen-content camera-screen"><FlowHeading kicker="04 / FOTO" title={<>Senyum, ini akan<br /><em>jadi kenangan.</em></>} copy="Posisikan semua orang di dalam frame. Gunakan cahaya yang cukup agar hasil terbaik." /><div className="camera-stage"><video ref={videoRef} autoPlay playsInline muted /><div className="camera-guide"><span /><span /><span /><span /></div><div className="camera-hint">Pastikan wajah terlihat jelas</div></div><input ref={fileRef} type="file" accept="image/*" onChange={onSelectFile} hidden />{error && <ErrorMessage text={error} />}<div className="camera-actions"><BackButton onClick={onBack} /><button className="button secondary" onClick={onFile}>Pilih foto</button><button className="shutter" onClick={onCapture} aria-label="Ambil foto"><span /></button><button className="button primary camera-start" onClick={onStart}>Aktifkan kamera <span>↗</span></button></div></main> }

function ConfirmScreen({ photo, scene, character, people, guests, onBack, onGenerate, error }) { return <main className="flow screen-content confirm-screen"><FlowHeading kicker="05 / KONFIRMASI" title={<>Satu frame,<br /><em>selamanya.</em></>} copy="Periksa foto dan pilihanmu sebelum kami menyusun hasil akhir." /><div className="confirm-layout"><div className="photo-preview"><img src={photo} alt="Pratinjau foto pengunjung" /><div className="photo-label">PREVIEW · {people} ORANG</div></div><div className="summary-card"><span className="summary-kicker">KISAH PILIHANMU</span><h3>{scene?.name}</h3><p>{scene?.location}</p><div className="summary-character"><img src={character?.image} alt="" /><span><small>Bersama</small><strong>{character?.name}</strong></span></div><div className="guest-chips">{guests.map((guest) => <span key={guest.name}>{guest.name}</span>)}</div><p className="privacy-note">Data pengunjung tersimpan aman untuk buku tamu dan tidak ditampilkan pada galeri.</p></div></div>{error && <ErrorMessage text={error} />}<div className="flow-actions"><BackButton onClick={onBack} /><button className="button primary" onClick={onGenerate}>Buat foto kenangan <span>→</span></button></div></main> }

function GeneratingScreen({ photo, note }) { return <main className="generating screen-content"><div className="generating-orbit"><div className="orbit-ring" /><img src={photo} alt="" /></div><p className="eyebrow">06 / GENERATING</p><h1>Menyusun kisah<br /><em>untukmu…</em></h1><p className="generating-note">{note}</p><div className="loading-line"><span /></div><small>Biasanya selesai dalam 15–45 detik</small></main> }

function ResultScreen({ result, qrData, onNew, onGallery }) { return <main className="result screen-content"><div className="result-heading"><p className="eyebrow">07 / HASIL KENANGAN</p><h1>Inilah <em>kisahmu.</em></h1><p>Terima kasih sudah menghidupkan kembali cerita di Museum R.A. Kartini.</p></div><div className="result-layout"><div className="polaroid"><img src={result?.imageUrl} alt="Hasil foto kenangan" /><div className="polaroid-footer"><img src="/assets/logo-museum.png" alt="Museum R.A. Kartini" /><span>Sejarah bukan hanya<br /><b>untuk dikenang.</b></span></div></div><div className="result-tools"><div className="qr-card"><div>{qrData ? <img src={qrData} alt="QR code untuk mengunduh foto" /> : <div className="qr-placeholder">QR</div>}</div><div><strong>Scan untuk membawa<br />pulang fotomu</strong><small>Link privat berlaku selama 7 hari.</small></div></div><a className="button primary download-button" href={result?.imageUrl} download="kisah-kartini.webp">Unduh foto <span>↓</span></a><button className="text-button" onClick={onGallery}>Lihat galeri museum <span>↗</span></button></div></div><div className="result-actions"><button className="button outline" onClick={onNew}>Mulai sesi baru <span>↻</span></button></div></main> }

function GalleryModal({ items, onClose }) { return <div className="modal-backdrop" onClick={onClose}><section className="gallery-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">ARSIP VISUAL MUSEUM</p><h2>Galeri <em>terbaru.</em></h2></div><button className="close-button" onClick={onClose}>×</button></div><p className="modal-copy">Potret pengunjung yang ikut menghidupkan kisah Museum R.A. Kartini.</p><div className="gallery-grid">{items.length ? items.map((item) => <img key={item.id} src={item.thumbnailUrl || item.imageUrl} alt="Potret pengunjung museum" loading="lazy" />) : <div className="empty-gallery">Belum ada hasil di galeri. Jadilah yang pertama membuat kisah.</div>}</div></section></div> }

function FlowHeading({ kicker, title, copy }) { return <div className="flow-heading"><p className="eyebrow">{kicker}</p><h1>{title}</h1><p>{copy}</p></div> }
function Progress({ current }) { return <div className="progress-dots" aria-label="Progress sesi">{STEPS.slice(1, 7).map((step, index) => <span className={index + 1 <= current ? 'active' : ''} key={step} />)}</div> }
function BackButton({ onClick }) { return <button className="back-button" onClick={onClick}>← Kembali</button> }
function ErrorMessage({ text }) { return <div className="error-message" role="alert">{text}</div> }

createRoot(document.getElementById('root')).render(<App />)
