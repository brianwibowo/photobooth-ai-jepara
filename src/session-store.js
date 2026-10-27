import { characters, sceneCatalog } from './data.js'
import { MAX_VISITORS } from './config.js'

export const SESSION_KEY = 'museum-photobooth-session-v1'
export const IDLE_MS = 120000
const PHOTO_MAX_AGE_MS = 20 * 60 * 1000

export function parseSnapshot(raw, current = Date.now()) {
  try {
    const saved = JSON.parse(raw)
    if (saved?.version !== 1 || !/^[A-Za-z0-9_-]{20,80}$/.test(saved.id) || !Number.isFinite(saved.savedAt) || current - saved.savedAt > PHOTO_MAX_AGE_MS || saved.savedAt > current + 300000) return null
    if (!['home', 'scene', 'character', 'camera', 'confirm', 'generating', 'result'].includes(saved.screen)) return null
    if (saved.people !== null && (!Number.isInteger(saved.people) || saved.people < 1 || saved.people > MAX_VISITORS)) return null
    if (saved.sceneId !== null && !sceneCatalog.some((scene) => scene.id === saved.sceneId)) return null
    if (saved.characterId !== null && !characters.some((character) => character.id === saved.characterId)) return null
    if (saved.screen !== 'home' && saved.screen !== 'result' && saved.screen !== 'generating' && (!Number.isFinite(saved.idleExpiresAt) || saved.idleExpiresAt <= current)) return null
    if (saved.requestId && !/^[A-Za-z0-9_-]{20,80}$/.test(saved.requestId)) return null
    if (saved.screen === 'result' && (!saved.result || !/^\/api\/download\/[A-Za-z0-9_-]+$/.test(saved.result.imageUrl))) return null
    return saved
  } catch { return null }
}

export function readSnapshot() { try { return parseSnapshot(window.sessionStorage.getItem(SESSION_KEY)) } catch { return null } }
export function writeSnapshot(snapshot) {
  try {
    if (snapshot.screen === 'home' && !snapshot.galleryOpen) window.sessionStorage.removeItem(SESSION_KEY)
    else window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...snapshot, version: 1, savedAt: Date.now() }))
  } catch { /* The current session stays usable if storage is unavailable. */ }
}
export function clearSnapshot() { try { window.sessionStorage.removeItem(SESSION_KEY) } catch { /* storage blocked */ } }

async function withPhotos(mode, work) {
  const db = await new Promise((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => { settled = true; reject(new Error('Penyimpanan foto tidak tersedia.')) }, 2000)
    const request = indexedDB.open('museum-photobooth-photos', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' })
    request.onsuccess = () => { clearTimeout(timer); if (settled) request.result.close(); else resolve(request.result) }
    request.onerror = () => { clearTimeout(timer); reject(request.error) }
  })
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('photos', mode)
      let result
      work(tx.objectStore('photos'), (value) => { result = value })
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error || new Error('Penyimpanan foto dibatalkan.'))
    })
  } finally { db.close() }
}

export const savePhoto = (id, blob) => withPhotos('readwrite', (store) => store.put({ id, blob, savedAt: Date.now() }))
export const removePhoto = (id) => withPhotos('readwrite', (store) => store.delete(id))
export const loadPhoto = (id) => withPhotos('readonly', (store, done) => {
  const request = store.get(id)
  request.onsuccess = () => done(request.result && Date.now() - request.result.savedAt < PHOTO_MAX_AGE_MS ? request.result.blob : null)
})
export const cleanupPhotos = () => withPhotos('readwrite', (store) => {
  const request = store.openCursor()
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    if (!Number.isFinite(cursor.value.savedAt) || cursor.value.savedAt < Date.now() - PHOTO_MAX_AGE_MS) cursor.delete()
    cursor.continue()
  }
})
