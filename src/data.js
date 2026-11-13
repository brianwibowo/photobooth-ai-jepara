import { backgroundCatalog, BACKGROUND_STYLES, DEFAULT_BACKGROUND_STYLE } from './backgrounds.js'
export { backgroundCatalog, BACKGROUND_STYLES, DEFAULT_BACKGROUND_STYLE } from './backgrounds.js'

const hero = (folder, label) => `/assets/tokoh_pahlawan/${folder}/${label}`
const characterFolders = {
  kartini: '1_ra kartini',
  kardinah: '3_kardinah',
  roekmini: '4_roekmini',
  sosrokartono: '5_sosrokartono',
  sosroningrat: '6_raden mas adipati ario sosroningrat',
}
const revisedCharacter = (id, view) => hero(characterFolders[id], `${view === 'face' ? 'reference' : 'body'}-2026-11.webp`)
const backgroundById = new Map(backgroundCatalog.map((background) => [background.id, background]))

// Resolve preview and provider input from one selected asset, retaining the
// exact source dimensions and file hash for the generation receipt.
function withBackgroundStyle(scene, backgroundStyle = DEFAULT_BACKGROUND_STYLE) {
  if (!scene || !BACKGROUND_STYLES.includes(backgroundStyle)) return null
  const variant = backgroundById.get(scene.backgroundId)?.variants[backgroundStyle]
  if (!variant) return null
  return {
    ...scene,
    backgroundStyle,
    backgroundAssetId: variant.assetId,
    backgroundSha256: variant.sha256,
    backgroundSourceWidth: variant.sourceWidth,
    backgroundSourceHeight: variant.sourceHeight,
    outputAspectRatio: '16:9',
    image: variant.image,
    background: variant.image,
  }
}
const inLocation = (backgroundId, scene) => withBackgroundStyle({ ...scene, backgroundId })
const vintageImage = (id) => backgroundById.get(id).variants[DEFAULT_BACKGROUND_STYLE].image

export const logos = [
  { src: '/assets/logo/Logo Prov Jawa Tengah.png', alt: 'Provinsi Jawa Tengah' },
  { src: '/assets/logo/logo-rembang.webp', alt: 'Kabupaten Rembang' },
  { src: '/assets/logo/logo-museum.webp', alt: 'Museum R.A. Kartini' },
  { src: '/assets/logo/logo-hatiku.webp', alt: 'Museum di Hatiku' },
]

export const homeBackground = vintageImage('gerbang-utama')
// All nine supplied locations appear in the home artwork. Character identity
// still comes only from the selected face/body references, never the setting.
export const homeStories = [
  { id: 'gerbang', images: ['gerbang-utama', 'taman-sari', 'pendopo'].map(vintageImage), alt: 'Gerbang, taman, dan pendopo Museum R.A. Kartini' },
  { id: 'pintu', images: ['aula-berkolom', 'ruang-kartini-mengajar', 'dapur-1900an'].map(vintageImage), alt: 'Aula berkolom, ruang mengajar, dan dapur museum' },
  { id: 'galeri', images: ['ruang-utama', 'ruang-makan-keluarga', 'ruang-keluarga'].map(vintageImage), alt: 'Ruang utama, ruang makan keluarga, dan ruang keluarga museum' },
]

const legacySceneIds = ['gerbang', 'keluarga', 'sahabat']

// Preserve activity IDs while matching their room labels and constraints to
// the supplied setting. Only small activity props may supplement the exhibits.
export const characterSceneCatalog = {
  kartini: [
    inLocation('gerbang-utama', { id: 'kartini-gerbang', characterId: 'kartini', name: 'Menyambut di Depan Gerbang', location: 'Depan gerbang utama Museum R.A. Kartini Rembang', description: 'Berfoto bersama R.A. Kartini di depan gerbang utama museum.', activity: 'Menyambut pengunjung dan berfoto', place: 'Depan gerbang utama museum', prompt: 'R.A. Kartini welcomes the visitors for a commemorative portrait in front of the supplied museum entrance. Preserve the existing gate, roof, columns, signage and entry path exactly as the selected reference depicts them. Use a warm greeting pose.' }),
    inLocation('taman-sari', { id: 'kartini-membatik', characterId: 'kartini', name: 'Membatik Bersama Kartini', location: 'Taman Sari museum', description: 'R.A. Kartini mengajarkan dan mempraktikkan batik di Taman Sari museum.', activity: 'Membatik', place: 'Taman Sari museum', prompt: 'R.A. Kartini leads a batik-making activity beside the existing small table in Taman Sari. Add only a canting, small wax pot and batik cloth needed for this cast. Preserve the existing table, lawn, planting, paths and surrounding buildings from the selected reference; do not add or move furniture or replace the garden.' }),
    inLocation('ruang-kartini-mengajar', { id: 'kartini-mengajar', characterId: 'kartini', name: 'Mengajar di Ruang Kartini', location: 'Ruang Kartini Mengajar di museum', description: 'R.A. Kartini mengajar dan berbagi gagasan di ruang dengan diorama pendidikan.', activity: 'Mengajar', place: 'Ruang Kartini Mengajar', prompt: 'The selected R.A. Kartini teaches the visitors beside the existing blackboard in the supplied teaching room. Only visitors from the photo listen or take notes. Keep the existing teaching diorama, including its teacher and pupil statues, as fixed INANIMATE museum exhibits behind the barrier. Never animate, duplicate or replace those statues with living people. Preserve the room, platform, barrier, doors, windows and teaching furniture without rearrangement.' }),
  ],
  adhiningrat: [
    inLocation('ruang-keluarga', { id: 'adhiningrat-teras', characterId: 'adhiningrat', name: 'Berbincang di Ruang Keluarga', location: 'Ruang keluarga museum', description: 'Adipati Ario Singgih duduk dan berbincang di ruang keluarga museum.', activity: 'Duduk dan berbincang', place: 'Ruang keluarga museum', prompt: 'Adipati Ario Singgih sits and converses with the visitors using the existing wooden seating in the supplied family room. Preserve the seating and table positions, exhibit cases, barriers, windows, floor and room layout; do not add furniture. Preserve his exact face, age, moustache, regent attire and headwear from the character reference.' }),
    inLocation('aula-berkolom', { id: 'adhiningrat-lorong', characterId: 'adhiningrat', name: 'Berjalan di Aula Berkolom', location: 'Aula berkolom museum', description: 'Adipati Ario Singgih berjalan dan berbincang di aula berkolom museum.', activity: 'Berjalan dan berbincang', place: 'Aula berkolom museum', prompt: 'Adipati Ario Singgih walks and converses with the visitors in the supplied columned hall. Preserve its columns, tiled floor, timber ceiling, door and window positions, and existing displays. Do not invent a corridor, add furniture or substitute another room.' }),
  ],
  kardinah: [
    inLocation('ruang-makan-keluarga', { id: 'kardinah-menulis', characterId: 'kardinah', name: 'Menulis di Meja Makan', location: 'Ruang makan keluarga museum', description: 'Kardinah menulis dan menata hidangan di meja makan keluarga.', activity: 'Menulis dan menata hidangan', place: 'Ruang makan keluarga museum', prompt: 'R.A. Kardinah writes and arranges a traditional meal at the existing wooden dining table in the supplied family dining room. Add only a notebook, writing materials and small dishes. Preserve all furniture positions, room architecture, barriers and exhibit cases; do not add furniture. Keep her exact identity and reference clothing.' }),
    inLocation('dapur-1900an', { id: 'kardinah-memasak', characterId: 'kardinah', name: 'Memasak dan Meracik', location: 'Dapur 1900-an museum', description: 'Kardinah memasak dan meracik bahan makanan tradisional di dapur 1900-an.', activity: 'Memasak dan meracik', place: 'Dapur 1900-an museum', prompt: 'R.A. Kardinah prepares and mixes traditional ingredients at the existing masonry hearth in the supplied 1900s kitchen. Use the existing vessels, woven baskets and work surfaces. Add only small ingredients or a mortar if needed; preserve the kitchen layout and furniture, with no batik tools or classroom board.' }),
    inLocation('ruang-makan-keluarga', { id: 'kardinah-menyajikan', characterId: 'kardinah', name: 'Menyajikan Hidangan', location: 'Ruang makan keluarga museum', description: 'Kardinah menyajikan hidangan tradisional di meja makan keluarga.', activity: 'Menyajikan makanan', place: 'Ruang makan keluarga museum', prompt: 'R.A. Kardinah serves a traditional meal at the existing wooden dining table in the supplied family dining room. Add only small serving dishes needed for the activity. Preserve the chairs, furniture positions, barriers, exhibit cases and room architecture. Keep her exact face and reference clothing.' }),
  ],
  roekmini: [
    inLocation('pendopo', { id: 'roekmini-berbincang', characterId: 'roekmini', name: 'Berbincang di Pendopo', location: 'Pendopo museum', description: 'Roekmini berbincang dengan pengunjung di pendopo museum.', activity: 'Berbincang', place: 'Pendopo museum', prompt: 'R.A. Roekmini converses naturally with the visitors in the supplied museum pendopo. Preserve the columns, open sides, tiled floor, timber roof and existing objects exactly as shown. Do not add or move furniture. Keep her exact identity and reference attire.' }),
    inLocation('gerbang-utama', { id: 'roekmini-berpose', characterId: 'roekmini', name: 'Berpose di Gerbang Utama', location: 'Gerbang utama museum', description: 'Roekmini berpose di depan gerbang utama Museum R.A. Kartini.', activity: 'Berpose', place: 'Gerbang utama museum', prompt: 'R.A. Roekmini poses naturally with the visitors in front of the supplied main museum gate. Preserve its roof, columns, entrance, signage, planting and reference perspective. Do not replace it with a terrace, room or batik workstation.' }),
    inLocation('aula-berkolom', { id: 'roekmini-menyambut', characterId: 'roekmini', name: 'Menyambut di Aula Berkolom', location: 'Pintu aula berkolom museum', description: 'Roekmini membuka pintu dan menyambut pengunjung di aula berkolom.', activity: 'Membuka pintu dan menyambut', place: 'Pintu aula berkolom museum', prompt: 'R.A. Roekmini opens an existing doorway in the supplied columned hall and welcomes the visitors. Use only the doorway already present in the reference; do not create or relocate a door. Preserve the columns, ceiling, floor, windows, existing displays and room layout. Keep her exact identity and reference clothing.' }),
  ],
  sosrokartono: [
    inLocation('ruang-keluarga', { id: 'sosrokartono-membaca', characterId: 'sosrokartono', name: 'Membaca di Ruang Keluarga', location: 'Ruang keluarga museum', description: 'Sosrokartono membaca dan berdiskusi di ruang keluarga museum.', activity: 'Membaca dan berdiskusi', place: 'Ruang keluarga museum', prompt: 'R.M.P. Sosrokartono reads a small book and discusses it with the visitors in the supplied family room. Use only the existing furniture and preserve its positions, exhibit cases, barriers, windows and room architecture. Add only the handheld book, not a new reading table or furniture. Keep his exact identity, age and reference clothing.' }),
    inLocation('ruang-utama', { id: 'sosrokartono-mengkaji', characterId: 'sosrokartono', name: 'Mengkaji Naskah di Ruang Utama', location: 'Ruang utama Museum R.A. Kartini', description: 'Sosrokartono mengkaji naskah dan dokumen di ruang utama museum.', activity: 'Mengkaji naskah', place: 'Ruang utama museum', prompt: 'R.M.P. Sosrokartono examines a small historical manuscript held in his hands with the visitors in the supplied main museum room. Preserve the relief wall, existing display cases, floor and room architecture. Add only the handheld manuscript; do not add a table, move furniture or invent a separate study room.' }),
  ],
  sosroningrat: [
    inLocation('ruang-utama', { id: 'sosroningrat-berpose', characterId: 'sosroningrat', name: 'Berpose di Ruang Utama', location: 'Ruang utama Museum R.A. Kartini', description: 'Sosroningrat berdiri di ruang utama museum.', activity: 'Berpose', place: 'Ruang utama museum', prompt: 'R.M.A.A. Sosroningrat poses with the visitors in the supplied main museum room beside the existing display cases and relief wall. Preserve all furniture positions and room architecture, his exact identity and his formal reference attire.' }),
    inLocation('aula-berkolom', { id: 'sosroningrat-menjelaskan', characterId: 'sosroningrat', name: 'Menjelaskan Koleksi di Aula', location: 'Aula berkolom museum', description: 'Sosroningrat menjelaskan koleksi yang dipajang di aula berkolom museum.', activity: 'Menjelaskan koleksi', place: 'Aula berkolom museum', prompt: 'R.M.A.A. Sosroningrat explains one of the existing wall displays or framed historical exhibits in the supplied columned hall. Preserve the existing collection, columns, floor, ceiling, doors and windows; do not add a display case or relocate exhibits. Keep his exact face and reference clothing.' }),
  ],
  soesalit: [
    inLocation('pendopo', { id: 'soesalit-dakon', characterId: 'soesalit', name: 'Bermain Dakon', location: 'Pendopo museum', description: 'Soesalit bermain dakon atau congklak di pendopo museum.', activity: 'Bermain dakon/congklak', place: 'Pendopo museum', prompt: 'Soesalit plays a traditional dakon/congklak game with the visitors on the existing floor of the supplied museum pendopo. Add only a small dakon board. Preserve the columns, timber roof, tiled floor, existing objects and pavilion layout without adding furniture. Preserve him as the same young child from the reference, including his age, face and sailor-style outfit.' }),
  ],
}

const contextRules = {
  'kartini-gerbang': { contextMustShow: ['supplied museum entrance gate', 'welcoming pose', 'the existing gate architecture'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dining table'] },
  'kartini-membatik': { contextMustShow: ['canting', 'small wax pot and batik cloth', 'Taman Sari and its existing small table'], contextMustNotShow: ['blackboard lesson', 'cooking kitchen', 'dakon game'] },
  'kartini-mengajar': { contextMustShow: ['existing blackboard', 'teaching gesture', 'visitors from the photo listening or taking notes', 'existing diorama statues remaining INANIMATE exhibits'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'animated or duplicated diorama people'] },
  'adhiningrat-teras': { contextMustShow: ['supplied family room', 'existing wooden seating', 'seated conversation'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'new furniture'] },
  'adhiningrat-lorong': { contextMustShow: ['supplied columned hall', 'existing columns and tiled floor', 'walking conversation'], contextMustNotShow: ['invented corridor', 'blackboard lesson', 'new furniture'] },
  'kardinah-menulis': { contextMustShow: ['existing family dining table', 'notebook or writing materials', 'small traditional dishes'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'new furniture'] },
  'kardinah-memasak': { contextMustShow: ['existing masonry cooking hearth', 'existing cooking vessels', 'small traditional ingredients'], contextMustNotShow: ['blackboard lesson', 'museum corridor', 'new furniture'] },
  'kardinah-menyajikan': { contextMustShow: ['existing family dining table', 'small traditional dishes', 'serving gesture'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'new furniture'] },
  'roekmini-berbincang': { contextMustShow: ['supplied museum pendopo', 'existing columns and timber roof', 'welcoming conversation'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'new furniture'] },
  'roekmini-berpose': { contextMustShow: ['supplied main museum gate', 'welcoming portrait pose'], contextMustNotShow: ['substitute terrace or indoor room', 'cooking kitchen', 'new furniture'] },
  'roekmini-menyambut': { contextMustShow: ['supplied columned hall', 'its existing doorway', 'welcoming gesture'], contextMustNotShow: ['invented or relocated doorway', 'blackboard lesson', 'new furniture'] },
  'sosrokartono-membaca': { contextMustShow: ['supplied family room', 'small handheld book', 'reading or discussion'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'new reading table or furniture'] },
  'sosrokartono-mengkaji': { contextMustShow: ['small handheld historical manuscript', 'main room relief wall', 'existing main room architecture'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'new table or furniture'] },
  'sosroningrat-berpose': { contextMustShow: ['supplied museum main room', 'existing display cases', 'existing relief wall'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'new furniture'] },
  'sosroningrat-menjelaskan': { contextMustShow: ['supplied columned hall', 'existing wall displays or framed exhibits', 'explaining gesture'], contextMustNotShow: ['new display case', 'blackboard lesson', 'relocated exhibits or new furniture'] },
  'soesalit-dakon': { contextMustShow: ['supplied museum pendopo', 'small dakon or congklak board', 'young Soesalit playing the game'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'new furniture'] },
}
const legacyContextIds = { kartini: { gerbang: 'kartini-gerbang', keluarga: 'kartini-membatik', sahabat: 'kartini-mengajar' } }

export const characters = [
  { id: 'kartini', name: 'R.A. Kartini', role: 'Pelopor emansipasi', sceneIds: [...legacySceneIds, ...characterSceneCatalog.kartini.map(({ id }) => id)], image: revisedCharacter('kartini', 'body'), reference: revisedCharacter('kartini', 'face'), bodyReference: revisedCharacter('kartini', 'body'), description: 'Surat, gagasan, dan keberanian yang mengubah zaman.', prompt: 'R.A. Kartini, matching the single supplied character reference: cream kebaya, brown batik, plain hair bun, cream earrings and necklace. Preserve the reference facial proportions and age, with a calm warm expression.' },
  { id: 'adhiningrat', name: 'R.M.A.A. Djojo Adhiningrat', role: 'Suami Kartini · Bupati Rembang', sceneIds: [...legacySceneIds, ...characterSceneCatalog.adhiningrat.map(({ id }) => id)], image: hero('2_adipati ario singgih djojo adhiningrat', 'display.webp'), reference: hero('2_adipati ario singgih djojo adhiningrat', 'reference.webp'), description: 'Bagian dari kisah keluarga Kartini di Rembang.', prompt: 'Adipati Ario Singgih Djojo Adhiningrat, Javanese regent, wearing the formal embroidered attire and headwear in the reference, dignified expression.' },
  { id: 'kardinah', name: 'R.A. Kardinah', role: 'Sahabat keluarga', sceneIds: [...legacySceneIds, ...characterSceneCatalog.kardinah.map(({ id }) => id)], image: revisedCharacter('kardinah', 'body'), reference: revisedCharacter('kardinah', 'face'), bodyReference: revisedCharacter('kardinah', 'body'), description: 'Hangat, cerdas, dan dekat dengan kehidupan rakyat.', prompt: 'R.A. Kardinah, matching the single supplied character reference in a cream lace kebaya and brown batik. Preserve her exact face, hairstyle, facial proportions and age rather than substituting another woman.' },
  { id: 'roekmini', name: 'R.A. Roekmini', role: 'Seniman keluarga', sceneIds: [...legacySceneIds, ...characterSceneCatalog.roekmini.map(({ id }) => id)], image: revisedCharacter('roekmini', 'body'), reference: revisedCharacter('roekmini', 'face'), bodyReference: revisedCharacter('roekmini', 'body'), description: 'Membawa keindahan dan semangat belajar.', prompt: 'R.A. Roekmini, matching the single supplied character reference in a cream buttoned kebaya and brown batik. Preserve her exact face, facial proportions, age and hairstyle with a gentle expression.' },
  { id: 'sosrokartono', name: 'R.M.P. Sosrokartono', role: 'Cendekiawan', sceneIds: [...legacySceneIds, ...characterSceneCatalog.sosrokartono.map(({ id }) => id)], image: revisedCharacter('sosrokartono', 'body'), reference: revisedCharacter('sosrokartono', 'face'), bodyReference: revisedCharacter('sosrokartono', 'body'), description: 'Jejak ilmu dari Jepara ke dunia.', prompt: 'R.M.P. Sosrokartono, the slender older man in the single supplied character reference, wearing a dark striped beskap, brown blangkon and brown batik. Preserve his exact facial proportions, age and slender build with a thoughtful expression.' },
  { id: 'sosroningrat', name: 'R.M.A.A. Sosroningrat', role: 'Bupati Jepara', sceneIds: [...legacySceneIds, ...characterSceneCatalog.sosroningrat.map(({ id }) => id)], image: revisedCharacter('sosroningrat', 'body'), reference: revisedCharacter('sosroningrat', 'face'), bodyReference: revisedCharacter('sosroningrat', 'body'), description: 'Figur keluarga dan sejarah di balik kisah Kartini.', prompt: 'R.M.A.A. Sosroningrat, matching the single supplied character reference with grey sideburns and moustache, a dark brown formal jacket, white collar, medal, brown blangkon and brown batik. Preserve his exact facial proportions, age and dignified expression.' },
  { id: 'soesalit', name: 'Soesalit', role: 'Putra Kartini', sceneIds: [...legacySceneIds, ...characterSceneCatalog.soesalit.map(({ id }) => id)], image: hero('7_soesalit', 'display.webp'), reference: hero('7_soesalit', 'reference.webp'), description: 'Meneruskan nyala perjuangan sang ibu.', prompt: 'Soesalit as a young Javanese child, preserving the age of the child, face and outfit shown in the reference.' }
]

// Keep the three legacy IDs valid without resolving unknown IDs to another
// setting. Their selected style is resolved exactly as for current activities.
const kartiniSceneOverrides = Object.fromEntries(Object.entries(legacyContextIds.kartini).map(([legacyId, currentId]) => [legacyId, characterSceneCatalog.kartini.find(({ id }) => id === currentId)]))

export const scenes = [
  inLocation('gerbang-utama', { id: 'gerbang', name: 'Di Gerbang Museum', location: 'Museum R.A. Kartini Rembang', description: 'Potret perayaan di depan gerbang museum.', characterIds: characters.map(({ id }) => id), accent: '#d8a85e', prompt: 'Place the cast naturally in front of the supplied main museum gate. Preserve its architecture, roof, columns, signage and entry path without adding or moving furniture.', characterOverrides: { kartini: kartiniSceneOverrides.gerbang } }),
  inLocation('taman-sari', { id: 'keluarga', name: 'Membatik Bersama', location: 'Taman Sari museum', description: 'Mengenal batik dalam suasana Taman Sari.', characterIds: characters.map(({ id }) => id), accent: '#b97755', prompt: 'Place the cast at a batik-making activity beside the existing small table in the supplied Taman Sari garden. Add only small batik tools and cloth. Preserve planting, paths, buildings and furniture positions; add no instructor or bystander.', characterOverrides: { kartini: kartiniSceneOverrides.keluarga } }),
  inLocation('ruang-kartini-mengajar', { id: 'sahabat', name: 'Ruang Gagasan', location: 'Ruang Kartini Mengajar', description: 'Berbagi cerita dan gagasan di ruang pendidikan museum.', characterIds: characters.map(({ id }) => id), accent: '#739d8d', prompt: 'Place the cast in the supplied teaching room without changing its existing blackboard, platform, barrier, doors, windows or furniture. Preserve the existing diorama statues as INANIMATE museum exhibits only; never animate or duplicate them as living people.', characterOverrides: { kartini: kartiniSceneOverrides.sahabat } })
]

export const characterScenes = Object.values(characterSceneCatalog).flat().map((scene) => ({ ...scene, ...(contextRules[scene.id] || {}) }))
export const sceneCatalog = [...scenes, ...characterScenes]
export const getCharacter = (id) => characters.find((item) => item.id === id) || null
export const getScene = (id) => scenes.find((item) => item.id === id) || null
export const getSceneForCharacter = (sceneId, characterId, backgroundStyle = DEFAULT_BACKGROUND_STYLE) => {
  const character = getCharacter(characterId)
  if (!character || !BACKGROUND_STYLES.includes(backgroundStyle)) return null
  const specific = characterScenes.find((item) => item.id === sceneId)
  if (specific) return specific.characterId === characterId ? withBackgroundStyle(specific, backgroundStyle) : null
  const scene = getScene(sceneId)
  if (!scene || !scene.characterIds.includes(characterId)) return null
  const override = scene.characterOverrides?.[characterId]
  const context = contextRules[legacyContextIds[characterId]?.[sceneId]] || {}
  const selected = override ? { ...scene, ...override, ...context, id: scene.id, characterIds: scene.characterIds } : scene
  return withBackgroundStyle(selected, backgroundStyle)
}
export const getScenesForCharacter = (characterId, backgroundStyle = DEFAULT_BACKGROUND_STYLE) => {
  const character = getCharacter(characterId)
  if (!character || !BACKGROUND_STYLES.includes(backgroundStyle)) return []
  return characterScenes.filter((scene) => scene.characterId === characterId).map((scene) => withBackgroundStyle(scene, backgroundStyle))
}
