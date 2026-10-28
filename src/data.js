const hero = (folder, label) => `/assets/tokoh_pahlawan/${folder}/${label}`

export const logos = [
  { src: '/assets/logo/Logo Prov Jawa Tengah.png', alt: 'Provinsi Jawa Tengah' },
  { src: '/assets/logo/logo-rembang.webp', alt: 'Kabupaten Rembang' },
  { src: '/assets/logo/logo-museum.webp', alt: 'Museum R.A. Kartini' },
  { src: '/assets/logo/logo-hatiku.webp', alt: 'Museum di Hatiku' },
]

// Fixed local editorial frames for the landing poster. These are
// presentation-only references; the selected character and scene still come
// from the kiosk flow.
export const homeStories = [
  { id: 'gerbang', images: [hero('1_ra kartini', 'Kartini_1b.webp'), hero('1_ra kartini', 'Kartini_1c.webp'), hero('1_ra kartini', 'Kartini_1a.webp')], alt: 'Kisah Kartini di depan gerbang museum' },
  { id: 'pintu', images: [hero('4_roekmini', 'Roekmini_3.webp'), hero('4_roekmini', 'Roekmini_1.webp'), hero('4_roekmini', 'Roekmini_2.webp')], alt: 'Kisah Kartini di pintu museum' },
  { id: 'galeri', images: [hero('6_raden mas adipati ario sosroningrat', 'Raden mas adipati_1.webp'), hero('6_raden mas adipati ario sosroningrat', 'Raden mas adipati_2.webp'), hero('6_raden mas adipati ario sosroningrat', 'Raden mas adipati_3.webp')], alt: 'Kisah Kartini di galeri museum' },
]

const legacySceneIds = ['gerbang', 'keluarga', 'sahabat']
const personFree = {
  entrance: '/assets/backgrounds/gerbang.webp',
  courtyard: '/assets/backgrounds/membatik-empty-v1.webp',
  interior: '/assets/backgrounds/gagasan-empty-v1.webp',
  corridor: hero('2_adipati ario singgih djojo adhiningrat', 'Taman_2.webp'),
}

// The folder images are composite examples, so each option keeps its own
// activity/place metadata and a preview while generation still receives a
// person-free environment plate.
export const characterSceneCatalog = {
  kartini: [
    { id: 'kartini-gerbang', characterId: 'kartini', name: 'Menyambut di Depan Gerbang', location: 'Depan gerbang utama Museum R.A. Kartini Rembang', description: 'Berfoto bersama R.A. Kartini di depan gerbang utama museum.', activity: 'Menyambut pengunjung dan berfoto', place: 'Depan gerbang utama museum', image: hero('1_ra kartini', 'Kartini_1a.webp'), background: personFree.entrance, prompt: 'R.A. Kartini welcomes the visitors for a commemorative portrait in front of the museum entrance. Keep the real gate, sign and entry path legible. Use a warm greeting pose without copying people from the preview.' },
    { id: 'kartini-membatik', characterId: 'kartini', name: 'Membatik Bersama Kartini', location: 'Area membatik di halaman museum', description: 'R.A. Kartini mengajarkan dan mempraktikkan batik di halaman museum.', activity: 'Membatik', place: 'Area membatik di halaman museum', image: hero('1_ra kartini', 'Kartini_2.webp'), background: personFree.courtyard, prompt: 'R.A. Kartini leads a batik-making activity in the museum courtyard. Show a canting, wax pot and batik cloth while the closed cast joins naturally. Do not copy people from the preview.' },
    { id: 'kartini-mengajar', characterId: 'kartini', name: 'Mengajar di Ruang Pendidikan', location: 'Ruang pendidikan Museum R.A. Kartini Rembang', description: 'R.A. Kartini mengajar dan berbagi gagasan di ruang pendidikan museum.', activity: 'Mengajar', place: 'Ruang pendidikan museum', image: hero('1_ra kartini', 'Kartini_3a.webp'), background: personFree.interior, prompt: 'R.A. Kartini teaches a small lesson in the museum education room beside a blackboard. The closed cast listens or takes notes. Do not copy people from the preview.' },
  ],
  adhiningrat: [
    { id: 'adhiningrat-teras', characterId: 'adhiningrat', name: 'Berbincang di Teras', location: 'Teras Museum R.A. Kartini Rembang', description: 'Adipati Ario Singgih duduk dan berbincang di teras museum.', activity: 'Duduk dan berbincang', place: 'Teras museum', image: hero('2_adipati ario singgih djojo adhiningrat', 'Adipati Ario_1a.webp'), background: personFree.interior, prompt: 'Adipati Ario Singgih sits and converses on the museum terrace. Preserve his exact face, age, moustache, black-gold regent attire and headwear from the character reference. Do not turn this into a batik activity or copy people from the preview.' },
    { id: 'adhiningrat-lorong', characterId: 'adhiningrat', name: 'Berjalan di Lorong Museum', location: 'Lorong Museum R.A. Kartini Rembang', description: 'Adipati Ario Singgih berjalan dan berbincang di lorong museum.', activity: 'Berjalan dan berbincang', place: 'Lorong museum', image: hero('2_adipati ario singgih djojo adhiningrat', 'Adipati Ario_3a.webp'), background: personFree.corridor, prompt: 'Adipati Ario Singgih walks and converses in the covered museum corridor. Preserve the corridor architecture and his exact character identity. Do not add a batik table or teaching board.' },
  ],
  kardinah: [
    { id: 'kardinah-menulis', characterId: 'kardinah', name: 'Menulis di Meja Makan', location: 'Ruang makan museum', description: 'Kardinah menulis dan menata hidangan di meja.', activity: 'Menulis dan menata hidangan', place: 'Ruang makan museum', image: hero('3_kardinah', 'Kardinah_1a.webp'), background: personFree.interior, prompt: 'R.A. Kardinah writes and arranges a traditional meal at a museum dining table. Keep her exact identity and period clothing; do not substitute Kartini or another figure.' },
    { id: 'kardinah-memasak', characterId: 'kardinah', name: 'Memasak dan Meracik', location: 'Dapur museum', description: 'Kardinah memasak dan meracik bahan makanan tradisional.', activity: 'Memasak dan meracik', place: 'Dapur museum', image: hero('3_kardinah', 'Kardinah_2.webp'), background: personFree.interior, prompt: 'R.A. Kardinah prepares and mixes traditional ingredients in the museum kitchen. Show cooking vessels and ingredients, with no batik tools or classroom board.' },
    { id: 'kardinah-menyajikan', characterId: 'kardinah', name: 'Menyajikan Hidangan', location: 'Ruang makan museum', description: 'Kardinah menyajikan hidangan tradisional di meja makan.', activity: 'Menyajikan makanan', place: 'Ruang makan museum', image: hero('3_kardinah', 'Kardinah_3.webp'), background: personFree.interior, prompt: 'R.A. Kardinah serves a traditional meal at the museum dining table. Preserve her exact face and clothing and keep the closed cast as the only other people.' },
  ],
  roekmini: [
    { id: 'roekmini-berbincang', characterId: 'roekmini', name: 'Berbincang di Pintu Masuk', location: 'Pintu masuk museum', description: 'Roekmini berbincang dengan pengunjung di pintu masuk.', activity: 'Berbincang', place: 'Pintu masuk museum', image: hero('4_roekmini', 'Roekmini_1.webp'), background: personFree.entrance, prompt: 'R.A. Roekmini converses with visitors at the museum entrance. Keep her exact identity and period attire.' },
    { id: 'roekmini-berpose', characterId: 'roekmini', name: 'Berpose di Depan Museum', location: 'Teras depan museum', description: 'Roekmini berpose di depan Museum R.A. Kartini.', activity: 'Berpose', place: 'Teras depan museum', image: hero('4_roekmini', 'Roekmini_2.webp'), background: personFree.entrance, prompt: 'R.A. Roekmini poses naturally on the front terrace of the museum. Do not place her at a batik workstation.' },
    { id: 'roekmini-menyambut', characterId: 'roekmini', name: 'Menyambut di Pintu', location: 'Pintu museum', description: 'Roekmini membuka pintu dan menyambut pengunjung.', activity: 'Membuka pintu dan menyambut', place: 'Pintu museum', image: hero('4_roekmini', 'Roekmini_3.webp'), background: personFree.entrance, prompt: 'R.A. Roekmini opens the green museum door and welcomes the visitors. Preserve the doorway and her exact identity.' },
  ],
  sosrokartono: [
    { id: 'sosrokartono-membaca', characterId: 'sosrokartono', name: 'Membaca di Ruang Studi', location: 'Ruang baca museum', description: 'Sosrokartono membaca dan berdiskusi di ruang studi.', activity: 'Membaca dan berdiskusi', place: 'Ruang baca museum', image: hero('5_sosrokartono', 'Sosrokartono_1.webp'), background: personFree.interior, prompt: 'R.M.P. Sosrokartono reads and discusses in the museum study room. Preserve his exact identity, age and clothing; do not substitute another historical figure.' },
    { id: 'sosrokartono-mengkaji', characterId: 'sosrokartono', name: 'Mengkaji Naskah', location: 'Ruang studi museum', description: 'Sosrokartono mengkaji naskah dan dokumen di meja.', activity: 'Mengkaji naskah', place: 'Ruang studi museum', image: hero('5_sosrokartono', 'Sosrokartono_3.webp'), background: personFree.interior, prompt: 'R.M.P. Sosrokartono studies historical manuscripts at a wooden table in the museum study room. Keep the activity focused on books and documents.' },
  ],
  sosroningrat: [
    { id: 'sosroningrat-berpose', characterId: 'sosroningrat', name: 'Berpose di Galeri', location: 'Galeri Museum R.A. Kartini', description: 'Sosroningrat berdiri di ruang pamer museum.', activity: 'Berpose', place: 'Galeri museum', image: hero('6_raden mas adipati ario sosroningrat', 'Raden mas adipati_1.webp'), background: personFree.interior, prompt: 'R.M.A.A. Sosroningrat poses in the museum gallery among display cases. Preserve his exact regent identity and attire.' },
    { id: 'sosroningrat-menjelaskan', characterId: 'sosroningrat', name: 'Menjelaskan Koleksi', location: 'Ruang pamer museum', description: 'Sosroningrat menjelaskan benda koleksi museum.', activity: 'Menjelaskan koleksi', place: 'Ruang pamer museum', image: hero('6_raden mas adipati ario sosroningrat', 'Raden mas adipati_2.webp'), background: personFree.interior, prompt: 'R.M.A.A. Sosroningrat explains a museum collection beside a display case. Keep him as the only historical figure and preserve his exact face and clothing.' },
  ],
  soesalit: [
    { id: 'soesalit-dakon', characterId: 'soesalit', name: 'Bermain Dakon', location: 'Aula museum', description: 'Soesalit bermain dakon atau congklak di ruang museum.', activity: 'Bermain dakon/congklak', place: 'Aula museum', image: hero('7_soesalit', 'Soesalit_1.webp'), background: personFree.interior, prompt: 'Soesalit plays a traditional dakon/congklak game in the museum hall. Preserve him as the same young child from the reference, including his age, face and sailor-style outfit. Do not place him at a batik activity.' },
  ],
}

const contextRules = {
  'kartini-gerbang': { contextMustShow: ['museum entrance gate', 'welcoming pose', 'Kartini holding or standing with her book'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dining table'] },
  'kartini-membatik': { contextMustShow: ['canting', 'wax pot', 'batik cloth', 'courtyard batik racks'], contextMustNotShow: ['blackboard lesson', 'cooking kitchen', 'dakon game'] },
  'kartini-mengajar': { contextMustShow: ['blackboard', 'teaching gesture', 'students listening or taking notes'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'dakon game'] },
  'adhiningrat-teras': { contextMustShow: ['covered terrace', 'carved wooden doors', 'chairs for a seated conversation'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'adhiningrat-lorong': { contextMustShow: ['covered museum corridor', 'wooden wall panels', 'walking conversation'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dining table'] },
  'kardinah-menulis': { contextMustShow: ['dining table', 'notebook or writing materials', 'traditional dishes'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'kardinah-memasak': { contextMustShow: ['kitchen table', 'cooking pot', 'mortar and traditional ingredients'], contextMustNotShow: ['blackboard lesson', 'museum corridor', 'dakon game'] },
  'kardinah-menyajikan': { contextMustShow: ['dining table', 'traditional dishes', 'serving gesture'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'roekmini-berbincang': { contextMustShow: ['museum entrance', 'welcoming conversation'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'roekmini-berpose': { contextMustShow: ['front museum terrace', 'welcoming portrait pose'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'dakon game'] },
  'roekmini-menyambut': { contextMustShow: ['green museum door', 'open doorway', 'welcoming gesture'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'sosrokartono-membaca': { contextMustShow: ['study room', 'books', 'reading or discussion'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'dakon game'] },
  'sosrokartono-mengkaji': { contextMustShow: ['wooden study table', 'historical manuscripts', 'documents being examined'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'sosroningrat-berpose': { contextMustShow: ['museum gallery', 'display cases', 'historical collection'], contextMustNotShow: ['batik workstation', 'cooking kitchen', 'dakon game'] },
  'sosroningrat-menjelaskan': { contextMustShow: ['display case', 'museum collection', 'explaining gesture'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'dakon game'] },
  'soesalit-dakon': { contextMustShow: ['museum hall', 'traditional dakon or congklak board', 'young Soesalit playing the game'], contextMustNotShow: ['batik workstation', 'blackboard lesson', 'cooking kitchen', 'study desk as the primary activity'] },
}
const legacyContextIds = { kartini: { gerbang: 'kartini-gerbang', keluarga: 'kartini-membatik', sahabat: 'kartini-mengajar' } }

export const characters = [
  { id: 'kartini', name: 'R.A. Kartini', role: 'Pelopor emansipasi', sceneIds: [...legacySceneIds, ...characterSceneCatalog.kartini.map(({ id }) => id)], image: hero('1_ra kartini', 'display.webp'), reference: hero('1_ra kartini', 'reference.webp'), description: 'Surat, gagasan, dan keberanian yang mengubah zaman.', prompt: 'R.A. Kartini, Javanese woman and educator, wearing a modest white kebaya and brown batik, calm warm expression.' },
  { id: 'adhiningrat', name: 'R.M.A.A. Djojo Adhiningrat', role: 'Suami Kartini · Bupati Rembang', sceneIds: [...legacySceneIds, ...characterSceneCatalog.adhiningrat.map(({ id }) => id)], image: hero('2_adipati ario singgih djojo adhiningrat', 'display.webp'), reference: hero('2_adipati ario singgih djojo adhiningrat', 'reference.webp'), description: 'Bagian dari kisah keluarga Kartini di Rembang.', prompt: 'Adipati Ario Singgih Djojo Adhiningrat, Javanese regent, wearing the formal embroidered attire and headwear in the reference, dignified expression.' },
  { id: 'kardinah', name: 'R.A. Kardinah', role: 'Sahabat keluarga', sceneIds: [...legacySceneIds, ...characterSceneCatalog.kardinah.map(({ id }) => id)], image: hero('3_kardinah', 'display.webp'), reference: hero('3_kardinah', 'reference.webp'), description: 'Hangat, cerdas, dan dekat dengan kehidupan rakyat.', prompt: 'R.A. Kardinah, Javanese woman in a period-appropriate kebaya and batik, warm attentive expression.' },
  { id: 'roekmini', name: 'R.A. Roekmini', role: 'Seniman keluarga', sceneIds: [...legacySceneIds, ...characterSceneCatalog.roekmini.map(({ id }) => id)], image: hero('4_roekmini', 'display.webp'), reference: hero('4_roekmini', 'reference.webp'), description: 'Membawa keindahan dan semangat belajar.', prompt: 'R.A. Roekmini, Javanese woman in a period-appropriate kebaya and batik, gentle artistic presence.' },
  { id: 'sosrokartono', name: 'R.M.P. Sosrokartono', role: 'Cendekiawan', sceneIds: [...legacySceneIds, ...characterSceneCatalog.sosrokartono.map(({ id }) => id)], image: hero('5_sosrokartono', 'display.webp'), reference: hero('5_sosrokartono', 'reference.webp'), description: 'Jejak ilmu dari Jepara ke dunia.', prompt: 'R.M.P. Sosrokartono, Javanese male scholar in historically appropriate formal clothing, composed thoughtful expression.' },
  { id: 'sosroningrat', name: 'R.M.A.A. Sosroningrat', role: 'Bupati Jepara', sceneIds: [...legacySceneIds, ...characterSceneCatalog.sosroningrat.map(({ id }) => id)], image: hero('6_raden mas adipati ario sosroningrat', 'display.webp'), reference: hero('6_raden mas adipati ario sosroningrat', 'reference.webp'), description: 'Figur keluarga dan sejarah di balik kisah Kartini.', prompt: 'R.M.A.A. Sosroningrat, Javanese regent in historically appropriate formal attire, dignified and welcoming.' },
  { id: 'soesalit', name: 'Soesalit', role: 'Putra Kartini', sceneIds: [...legacySceneIds, ...characterSceneCatalog.soesalit.map(({ id }) => id)], image: hero('7_soesalit', 'display.webp'), reference: hero('7_soesalit', 'reference.webp'), description: 'Meneruskan nyala perjuangan sang ibu.', prompt: 'Soesalit as a young Javanese child, preserving the age of the child, face and outfit shown in the reference.' }
]

// Scene IDs remain stable for saved sessions and archived results. The
// character override contains the museum's fixed activity/place metadata and
// the matching visual preview for that character. It is deliberately kept
// separate from the empty background used by the image provider: the PNGs in
// a hero folder are composite examples and contain visitors.
const kartiniSceneOverrides = {
  gerbang: {
    name: 'Menyambut di Depan Gerbang',
    location: 'Depan gerbang utama Museum R.A. Kartini Rembang',
    description: 'Berfoto bersama R.A. Kartini di depan gerbang utama museum.',
    activity: 'Menyambut pengunjung dan berfoto',
    place: 'Depan gerbang utama museum',
    image: hero('1_ra kartini', 'Kartini_1a.webp'),
    prompt: 'This is R.A. Kartini welcoming the visitors for a commemorative portrait in front of the museum entrance. Keep the real gate, sign and entry path from the person-free background reference legible. Use a warm, natural greeting pose without copying the people from the preview image.',
  },
  keluarga: {
    name: 'Membatik Bersama Kartini',
    location: 'Area membatik di halaman museum',
    description: 'R.A. Kartini mengajarkan dan mempraktikkan batik di halaman museum.',
    activity: 'Membatik',
    place: 'Area membatik di halaman museum',
    image: hero('1_ra kartini', 'Kartini_2.webp'),
    prompt: 'This is R.A. Kartini leading a batik-making activity in the museum courtyard. Show her actively working with a canting, wax pot and batik cloth while the closed cast joins naturally. Preserve the covered walkway, batik racks and daylight from the person-free background reference. Do not copy people from the preview image.',
  },
  sahabat: {
    name: 'Mengajar di Ruang Pendidikan',
    location: 'Ruang pendidikan Museum R.A. Kartini Rembang',
    description: 'R.A. Kartini mengajar dan berbagi gagasan di ruang pendidikan museum.',
    activity: 'Mengajar',
    place: 'Ruang pendidikan museum',
    image: hero('1_ra kartini', 'Kartini_3a.webp'),
    prompt: 'This is R.A. Kartini teaching a small lesson in the museum education room. Place her beside a blackboard with a natural teaching gesture, while the closed cast listens or takes notes. Preserve the green-trimmed doors, wooden furniture and warm window light from the person-free background reference. Do not copy people from the preview image.',
  },
}

export const scenes = [
  { id: 'gerbang', name: 'Di Gerbang Museum', location: 'Museum R.A. Kartini Rembang', description: 'Potret perayaan di depan gerbang museum.', characterIds: characters.map(({ id }) => id), image: '/assets/scene-previews/gerbang.webp', background: '/assets/backgrounds/gerbang.webp', accent: '#d8a85e', prompt: 'Place the group naturally in front of the real Museum R.A. Kartini Rembang entrance shown in the background reference. Keep the architecture and sign legible.', characterOverrides: { kartini: kartiniSceneOverrides.gerbang } },
  { id: 'keluarga', name: 'Membatik Bersama', location: 'Halaman museum', description: 'Mengenal batik dalam suasana hangat.', characterIds: characters.map(({ id }) => id), image: '/assets/scene-previews/membatik.webp', background: '/assets/backgrounds/membatik-empty-v1.webp', accent: '#b97755', prompt: 'Place the group at a batik-making activity in the empty museum courtyard shown in the background reference, with batik cloth racks, covered walkways and warm daylight. Arrange batik tools naturally without adding any instructor, other historical figure, or bystander.', characterOverrides: { kartini: kartiniSceneOverrides.keluarga } },
  { id: 'sahabat', name: 'Ruang Gagasan', location: 'Ruang belajar museum', description: 'Berbagi cerita dan gagasan di ruang sejarah.', characterIds: characters.map(({ id }) => id), image: '/assets/scene-previews/gagasan.webp', background: '/assets/backgrounds/gagasan-empty-v1.webp', accent: '#739d8d', prompt: 'Place the group around a wooden reading table inside the empty museum study room shown in the background reference, with green-trimmed doors, wooden wall details and warm window light. Do not fill empty chairs with additional people.', characterOverrides: { kartini: kartiniSceneOverrides.sahabat } }
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
