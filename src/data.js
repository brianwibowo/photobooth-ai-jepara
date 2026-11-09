const hero = (folder, label) => `/assets/tokoh_pahlawan/${folder}/${label}`
const revisedCharacter = (id, view) => `/assets/revisions-2026-11/characters/${id}-${view}.webp`
const vintageBackgrounds = {
  main: '/assets/revisions-2026-11/backgrounds/01-ruang-utama.webp',
  pavilion: '/assets/revisions-2026-11/backgrounds/02-pendopo.webp',
  terrace: '/assets/revisions-2026-11/backgrounds/03-teras-museum.webp',
  garden: '/assets/revisions-2026-11/backgrounds/04-taman-sari.webp',
  entrance: '/assets/revisions-2026-11/backgrounds/05-gerbang-utama.webp',
  kitchen: '/assets/revisions-2026-11/backgrounds/06-dapur-1900an.webp',
  classroom: '/assets/revisions-2026-11/backgrounds/07-ruang-mengajar-empty.webp',
  dining: '/assets/revisions-2026-11/backgrounds/08-ruang-makan.webp',
}

export const logos = [
  { src: '/assets/logo/Logo Prov Jawa Tengah.png', alt: 'Provinsi Jawa Tengah' },
  { src: '/assets/logo/logo-rembang.webp', alt: 'Kabupaten Rembang' },
  { src: '/assets/logo/logo-museum.webp', alt: 'Museum R.A. Kartini' },
  { src: '/assets/logo/logo-hatiku.webp', alt: 'Museum di Hatiku' },
]

export const homeBackground = vintageBackgrounds.entrance
// The landing slideshow and scene cards use the same empty vintage locations
// as generation, so no old composite faces appear in the current experience.
export const homeStories = [
  { id: 'gerbang', images: [vintageBackgrounds.entrance, vintageBackgrounds.garden, vintageBackgrounds.pavilion], alt: 'Gerbang, taman, dan pendopo Museum R.A. Kartini' },
  { id: 'pintu', images: [vintageBackgrounds.terrace, vintageBackgrounds.classroom, vintageBackgrounds.kitchen], alt: 'Teras, ruang mengajar, dan dapur museum' },
  { id: 'galeri', images: [vintageBackgrounds.main, vintageBackgrounds.dining, vintageBackgrounds.pavilion], alt: 'Ruang utama, ruang makan, dan pendopo museum' },
]

const legacySceneIds = ['gerbang', 'keluarga', 'sahabat']
const inLocation = (background, scene) => ({ ...scene, image: background, background })

// Each stable activity ID has a matching person-free vintage environment.
// Activity props may be added without replacing the reference architecture.
export const characterSceneCatalog = {
  kartini: [
    inLocation(vintageBackgrounds.entrance, { id: 'kartini-gerbang', characterId: 'kartini', name: 'Menyambut di Depan Gerbang', location: 'Depan gerbang utama Museum R.A. Kartini Rembang', description: 'Berfoto bersama R.A. Kartini di depan gerbang utama museum.', activity: 'Menyambut pengunjung dan berfoto', place: 'Depan gerbang utama museum', prompt: 'R.A. Kartini welcomes the visitors for a commemorative portrait in front of the museum entrance. Preserve the gate, roof, columns and entry path of the vintage environment reference. Use a warm greeting pose.' }),
    inLocation(vintageBackgrounds.garden, { id: 'kartini-membatik', characterId: 'kartini', name: 'Membatik Bersama Kartini', location: 'Area membatik di halaman museum', description: 'R.A. Kartini mengajarkan dan mempraktikkan batik di halaman taman museum.', activity: 'Membatik', place: 'Area membatik di halaman museum', prompt: 'R.A. Kartini leads a batik-making activity at the edge of the museum garden courtyard. Add a small portable batik setup with a canting, wax pot and batik cloth for this cast only. Preserve the lawn, planting, paths and surrounding roofs from the reference; do not replace the garden with a different courtyard.' }),
    inLocation(vintageBackgrounds.classroom, { id: 'kartini-mengajar', characterId: 'kartini', name: 'Mengajar di Ruang Pendidikan', location: 'Ruang pendidikan Museum R.A. Kartini Rembang', description: 'R.A. Kartini mengajar dan berbagi gagasan di ruang pendidikan museum.', activity: 'Mengajar', place: 'Ruang pendidikan museum', prompt: 'R.A. Kartini teaches a small lesson beside the blackboard in the empty vintage education room. Only the visitors from the photo listen or take notes. Preserve the room, wooden platform, windows and teaching furniture from the reference.' }),
  ],
  adhiningrat: [
    inLocation(vintageBackgrounds.terrace, { id: 'adhiningrat-teras', characterId: 'adhiningrat', name: 'Berbincang di Teras', location: 'Teras Museum R.A. Kartini Rembang', description: 'Adipati Ario Singgih duduk dan berbincang di teras museum.', activity: 'Duduk dan berbincang', place: 'Teras museum', prompt: 'Adipati Ario Singgih sits and converses on the museum terrace. Place simple period chairs in front of the existing wooden glazed doorway without changing the cream walls, windows or terrace floor. Preserve his exact face, age, moustache, black-gold regent attire and headwear from the character reference. Do not turn this into a batik activity.' }),
    inLocation(vintageBackgrounds.terrace, { id: 'adhiningrat-lorong', characterId: 'adhiningrat', name: 'Berjalan di Teras Museum', location: 'Teras Museum R.A. Kartini Rembang', description: 'Adipati Ario Singgih berjalan dan berbincang di teras museum.', activity: 'Berjalan dan berbincang', place: 'Teras museum', prompt: 'Adipati Ario Singgih walks and converses along the covered museum terrace shown in the reference. Preserve the wooden glazed doorway, cream walls and tiled terrace floor. Do not invent a different corridor or add a batik table or teaching board.' }),
  ],
  kardinah: [
    inLocation(vintageBackgrounds.dining, { id: 'kardinah-menulis', characterId: 'kardinah', name: 'Menulis di Meja Makan', location: 'Ruang makan museum', description: 'Kardinah menulis dan menata hidangan di meja.', activity: 'Menulis dan menata hidangan', place: 'Ruang makan museum', prompt: 'R.A. Kardinah writes and arranges a traditional meal at the wooden dining table shown in the vintage reference. Add only the needed notebook, writing materials and dishes. Preserve the room, dining furniture and display cases. Keep her exact identity and reference clothing.' }),
    inLocation(vintageBackgrounds.kitchen, { id: 'kardinah-memasak', characterId: 'kardinah', name: 'Memasak dan Meracik', location: 'Dapur museum', description: 'Kardinah memasak dan meracik bahan makanan tradisional.', activity: 'Memasak dan meracik', place: 'Dapur museum', prompt: 'R.A. Kardinah prepares and mixes traditional ingredients in the vintage kitchen shown in the reference. Use its masonry cooking hearth, vessels and woven baskets; add a mortar and ingredients as needed. Preserve the kitchen layout, with no batik tools or classroom board.' }),
    inLocation(vintageBackgrounds.dining, { id: 'kardinah-menyajikan', characterId: 'kardinah', name: 'Menyajikan Hidangan', location: 'Ruang makan museum', description: 'Kardinah menyajikan hidangan tradisional di meja makan.', activity: 'Menyajikan makanan', place: 'Ruang makan museum', prompt: 'R.A. Kardinah serves a traditional meal at the wooden dining table in the vintage reference. Preserve its chairs, room architecture and display cases. Keep her exact face and clothing and the visitors as the only other people.' }),
  ],
  roekmini: [
    inLocation(vintageBackgrounds.terrace, { id: 'roekmini-berbincang', characterId: 'roekmini', name: 'Berbincang di Pintu Masuk', location: 'Pintu masuk museum', description: 'Roekmini berbincang dengan pengunjung di pintu masuk.', activity: 'Berbincang', place: 'Pintu masuk museum', prompt: 'R.A. Roekmini converses with visitors on the terrace beside the wooden glazed entrance doorway in the reference. Preserve the cream walls, windows and terrace layout. Keep her exact identity and reference attire.' }),
    inLocation(vintageBackgrounds.terrace, { id: 'roekmini-berpose', characterId: 'roekmini', name: 'Berpose di Depan Museum', location: 'Teras depan museum', description: 'Roekmini berpose di depan Museum R.A. Kartini.', activity: 'Berpose', place: 'Teras depan museum', prompt: 'R.A. Roekmini poses naturally on the museum terrace in front of the existing wooden glazed doorway. Preserve the vintage entrance architecture and cream walls. Do not place her at a batik workstation.' }),
    inLocation(vintageBackgrounds.terrace, { id: 'roekmini-menyambut', characterId: 'roekmini', name: 'Menyambut di Pintu', location: 'Pintu museum', description: 'Roekmini membuka pintu dan menyambut pengunjung.', activity: 'Membuka pintu dan menyambut', place: 'Pintu museum', prompt: 'R.A. Roekmini opens one leaf of the existing wooden glazed museum door and welcomes the visitors. Preserve the doorway design, cream walls and terrace from the reference, and her exact identity. Do not change the doorway into a green door.' }),
  ],
  sosrokartono: [
    inLocation(vintageBackgrounds.main, { id: 'sosrokartono-membaca', characterId: 'sosrokartono', name: 'Membaca di Ruang Utama', location: 'Ruang utama Museum R.A. Kartini', description: 'Sosrokartono membaca dan berdiskusi di ruang utama museum.', activity: 'Membaca dan berdiskusi', place: 'Ruang utama museum', prompt: 'R.M.P. Sosrokartono reads and discusses a book with the visitors in the museum main gallery. Add a small freestanding period reading table and books for this activity, preserving the existing relief wall, display cases, floor and long room architecture. Keep his exact identity, age and reference clothing.' }),
    inLocation(vintageBackgrounds.main, { id: 'sosrokartono-mengkaji', characterId: 'sosrokartono', name: 'Mengkaji Naskah', location: 'Ruang utama Museum R.A. Kartini', description: 'Sosrokartono mengkaji naskah dan dokumen di meja kecil dalam ruang utama.', activity: 'Mengkaji naskah', place: 'Ruang utama museum', prompt: 'R.M.P. Sosrokartono studies historical manuscripts at a small freestanding wooden table added to the museum main gallery. Preserve the relief wall, existing display cases and room architecture from the reference. Keep the activity focused on books and documents, without inventing a separate study room.' }),
  ],
  sosroningrat: [
    inLocation(vintageBackgrounds.main, { id: 'sosroningrat-berpose', characterId: 'sosroningrat', name: 'Berpose di Galeri', location: 'Galeri Museum R.A. Kartini', description: 'Sosroningrat berdiri di ruang pamer museum.', activity: 'Berpose', place: 'Galeri museum', prompt: 'R.M.A.A. Sosroningrat poses in the museum main gallery beside the existing display cases and relief wall. Preserve the room architecture, his exact identity and his formal reference attire.' }),
    inLocation(vintageBackgrounds.main, { id: 'sosroningrat-menjelaskan', characterId: 'sosroningrat', name: 'Menjelaskan Koleksi', location: 'Ruang pamer museum', description: 'Sosroningrat menjelaskan benda koleksi museum.', activity: 'Menjelaskan koleksi', place: 'Ruang pamer museum', prompt: 'R.M.A.A. Sosroningrat explains a museum collection beside one of the existing display cases in the main gallery. Preserve the relief wall and gallery layout, and keep him as the only historical figure with his exact face and reference clothing.' }),
  ],
  soesalit: [
    inLocation(vintageBackgrounds.pavilion, { id: 'soesalit-dakon', characterId: 'soesalit', name: 'Bermain Dakon', location: 'Pendopo museum', description: 'Soesalit bermain dakon atau congklak di pendopo museum.', activity: 'Bermain dakon/congklak', place: 'Pendopo museum', prompt: 'Soesalit plays a traditional dakon/congklak game with the visitors on the floor of the vintage museum pendopo. Add a dakon board, preserving the wooden columns, high timber roof, tiled floor and pavilion layout. Preserve him as the same young child from the reference, including his age, face and sailor-style outfit. Do not place him at a batik activity.' }),
  ],
}

const contextRules = {
  'kartini-gerbang': { contextMustShow: ['museum entrance gate', 'welcoming pose', 'Kartini holding or standing with her book'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dining table'] },
  'kartini-membatik': { contextMustShow: ['canting', 'wax pot', 'batik cloth', 'garden courtyard from the reference'], contextMustNotShow: ['blackboard lesson', 'cooking kitchen', 'dakon game'] },
  'kartini-mengajar': { contextMustShow: ['blackboard', 'teaching gesture', 'visitors from the photo listening or taking notes'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'dakon game'] },
  'adhiningrat-teras': { contextMustShow: ['covered terrace', 'wooden glazed doorway', 'chairs for a seated conversation'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'adhiningrat-lorong': { contextMustShow: ['covered museum terrace', 'wooden glazed doorway and cream walls', 'walking conversation'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dining table'] },
  'kardinah-menulis': { contextMustShow: ['wooden dining table', 'notebook or writing materials', 'traditional dishes'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'kardinah-memasak': { contextMustShow: ['masonry cooking hearth', 'cooking pot', 'mortar and traditional ingredients'], contextMustNotShow: ['blackboard lesson', 'museum corridor', 'dakon game'] },
  'kardinah-menyajikan': { contextMustShow: ['wooden dining table', 'traditional dishes', 'serving gesture'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'roekmini-berbincang': { contextMustShow: ['wooden glazed museum entrance', 'welcoming conversation'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'roekmini-berpose': { contextMustShow: ['museum terrace from the reference', 'welcoming portrait pose'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'dakon game'] },
  'roekmini-menyambut': { contextMustShow: ['wooden glazed museum door', 'open doorway', 'welcoming gesture'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'sosrokartono-membaca': { contextMustShow: ['main gallery and relief wall', 'small freestanding reading table and books', 'reading or discussion'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'dakon game'] },
  'sosrokartono-mengkaji': { contextMustShow: ['small freestanding wooden table', 'historical manuscripts', 'main gallery architecture'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'sosroningrat-berpose': { contextMustShow: ['museum main gallery', 'existing display cases', 'historical collection'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'dakon game'] },
  'sosroningrat-menjelaskan': { contextMustShow: ['existing display case', 'museum collection', 'explaining gesture'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'soesalit-dakon': { contextMustShow: ['wooden museum pendopo', 'traditional dakon or congklak board', 'young Soesalit playing the game'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'cooking kitchen', 'study desk as the primary activity'] },
}
const legacyContextIds = { kartini: { gerbang: 'kartini-gerbang', keluarga: 'kartini-membatik', sahabat: 'kartini-mengajar' } }

export const characters = [
  { id: 'kartini', name: 'R.A. Kartini', role: 'Pelopor emansipasi', sceneIds: [...legacySceneIds, ...characterSceneCatalog.kartini.map(({ id }) => id)], image: revisedCharacter('kartini', 'body'), reference: revisedCharacter('kartini', 'face'), bodyReference: revisedCharacter('kartini', 'body'), description: 'Surat, gagasan, dan keberanian yang mengubah zaman.', prompt: 'R.A. Kartini, matching the supplied face and full-body references: cream kebaya, brown batik, plain hair bun, cream earrings and necklace. Preserve the reference facial proportions and age, with a calm warm expression.' },
  { id: 'adhiningrat', name: 'R.M.A.A. Djojo Adhiningrat', role: 'Suami Kartini · Bupati Rembang', sceneIds: [...legacySceneIds, ...characterSceneCatalog.adhiningrat.map(({ id }) => id)], image: hero('2_adipati ario singgih djojo adhiningrat', 'display.webp'), reference: hero('2_adipati ario singgih djojo adhiningrat', 'reference.webp'), description: 'Bagian dari kisah keluarga Kartini di Rembang.', prompt: 'Adipati Ario Singgih Djojo Adhiningrat, Javanese regent, wearing the formal embroidered attire and headwear in the reference, dignified expression.' },
  { id: 'kardinah', name: 'R.A. Kardinah', role: 'Sahabat keluarga', sceneIds: [...legacySceneIds, ...characterSceneCatalog.kardinah.map(({ id }) => id)], image: revisedCharacter('kardinah', 'body'), reference: revisedCharacter('kardinah', 'face'), bodyReference: revisedCharacter('kardinah', 'body'), description: 'Hangat, cerdas, dan dekat dengan kehidupan rakyat.', prompt: 'R.A. Kardinah, matching the supplied face and full-body references in a cream lace kebaya and brown batik. Preserve her exact face, hairstyle, facial proportions and age rather than substituting another woman.' },
  { id: 'roekmini', name: 'R.A. Roekmini', role: 'Seniman keluarga', sceneIds: [...legacySceneIds, ...characterSceneCatalog.roekmini.map(({ id }) => id)], image: revisedCharacter('roekmini', 'body'), reference: revisedCharacter('roekmini', 'face'), bodyReference: revisedCharacter('roekmini', 'body'), description: 'Membawa keindahan dan semangat belajar.', prompt: 'R.A. Roekmini, matching the supplied face and full-body references in a cream buttoned kebaya and brown batik. Preserve her exact face, facial proportions, age and hairstyle with a gentle expression.' },
  { id: 'sosrokartono', name: 'R.M.P. Sosrokartono', role: 'Cendekiawan', sceneIds: [...legacySceneIds, ...characterSceneCatalog.sosrokartono.map(({ id }) => id)], image: revisedCharacter('sosrokartono', 'body'), reference: revisedCharacter('sosrokartono', 'face'), bodyReference: revisedCharacter('sosrokartono', 'body'), description: 'Jejak ilmu dari Jepara ke dunia.', prompt: 'R.M.P. Sosrokartono, the slender older man in the supplied face and full-body references, wearing a dark striped beskap, brown blangkon and brown batik. Preserve his exact facial proportions, age and slender build with a thoughtful expression.' },
  { id: 'sosroningrat', name: 'R.M.A.A. Sosroningrat', role: 'Bupati Jepara', sceneIds: [...legacySceneIds, ...characterSceneCatalog.sosroningrat.map(({ id }) => id)], image: revisedCharacter('sosroningrat', 'body'), reference: revisedCharacter('sosroningrat', 'face'), bodyReference: revisedCharacter('sosroningrat', 'body'), description: 'Figur keluarga dan sejarah di balik kisah Kartini.', prompt: 'R.M.A.A. Sosroningrat, matching the supplied face and full-body references with grey sideburns and moustache, a dark brown formal jacket, white collar, medal, brown blangkon and brown batik. Preserve his exact facial proportions, age and dignified expression.' },
  { id: 'soesalit', name: 'Soesalit', role: 'Putra Kartini', sceneIds: [...legacySceneIds, ...characterSceneCatalog.soesalit.map(({ id }) => id)], image: hero('7_soesalit', 'display.webp'), reference: hero('7_soesalit', 'reference.webp'), description: 'Meneruskan nyala perjuangan sang ibu.', prompt: 'Soesalit as a young Javanese child, preserving the age of the child, face and outfit shown in the reference.' }
]

// Keep the three legacy IDs usable for saved sessions and archived results.
// Kartini overrides share the same activities and vintage locations as the
// current catalog instead of reviving the old composite previews.
const kartiniSceneOverrides = Object.fromEntries(Object.entries(legacyContextIds.kartini).map(([legacyId, currentId]) => [legacyId, characterSceneCatalog.kartini.find(({ id }) => id === currentId)]))

export const scenes = [
  inLocation(vintageBackgrounds.entrance, { id: 'gerbang', name: 'Di Gerbang Museum', location: 'Museum R.A. Kartini Rembang', description: 'Potret perayaan di depan gerbang museum.', characterIds: characters.map(({ id }) => id), accent: '#d8a85e', prompt: 'Place the group naturally in front of the vintage Museum R.A. Kartini entrance shown in the background reference. Preserve the gate architecture, roof, columns and entry path.', characterOverrides: { kartini: kartiniSceneOverrides.gerbang } }),
  inLocation(vintageBackgrounds.garden, { id: 'keluarga', name: 'Membatik Bersama', location: 'Halaman museum', description: 'Mengenal batik dalam suasana hangat.', characterIds: characters.map(({ id }) => id), accent: '#b97755', prompt: 'Place the group at a batik-making activity beside the lawn in the empty vintage museum garden. Add a small portable batik setup with cloth, a canting and a wax pot while preserving the planting, paths and surrounding architecture. Add no instructor, other historical figure or bystander.', characterOverrides: { kartini: kartiniSceneOverrides.keluarga } }),
  inLocation(vintageBackgrounds.classroom, { id: 'sahabat', name: 'Ruang Gagasan', location: 'Ruang belajar museum', description: 'Berbagi cerita dan gagasan di ruang sejarah.', characterIds: characters.map(({ id }) => id), accent: '#739d8d', prompt: 'Place the group inside the empty vintage education room shown in the background reference. Preserve its blackboard, wooden teaching furniture, platform and room architecture. Do not fill empty places with additional people.', characterOverrides: { kartini: kartiniSceneOverrides.sahabat } })
]

export const characterScenes = Object.values(characterSceneCatalog).flat().map((scene) => ({ ...scene, ...(contextRules[scene.id] || {}) }))
export const sceneCatalog = [...scenes, ...characterScenes]
export const getCharacter = (id) => characters.find((item) => item.id === id) || characters[0]
export const getScene = (id) => scenes.find((item) => item.id === id) || scenes[0]
export const getSceneForCharacter = (sceneId, characterId) => {
  const specific = characterScenes.find((item) => item.id === sceneId && (!characterId || item.characterId === characterId))
  if (specific) return specific
  const scene = getScene(sceneId)
  const override = scene.characterOverrides?.[characterId]
  const context = contextRules[legacyContextIds[characterId]?.[sceneId]] || {}
  return override ? { ...scene, ...override, ...context, id: scene.id, characterIds: scene.characterIds } : scene
}
export const getScenesForCharacter = (characterId) => {
  const character = getCharacter(characterId)
  const specific = characterScenes.filter((scene) => scene.characterId === characterId)
  if (specific.length) return specific
  return scenes
    .filter((scene) => character.sceneIds?.includes(scene.id) ?? scene.characterIds.includes(characterId))
    .map((scene) => getSceneForCharacter(scene.id, characterId))
}
