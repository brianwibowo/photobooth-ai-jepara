// Deterministic production derivatives from the client-approved November assets.
// Original files are never modified. The teaching-room cleanup is generated
// separately with image_gen, then visually verified before running this script.
import sharp from 'sharp'
import { access, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const projectPath = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url))
const destination = 'public/assets/revisions-2026-11'
const portraits = [
  { id: 'kartini', folder: '0_RA Kartini', face: '8.jpg', body: '5.jpg' },
  // Crop only the seated source photograph: include all headwear, the face,
  // neck and shoulders, without changing facial pixels or inventing detail.
  { id: 'sosrokartono', folder: '1_Sosrokartono', face: '4.jpg', body: '5.jpg', faceCrop: { left: 520, top: 15, width: 900, height: 1200 } },
  { id: 'kardinah', folder: '2_Kardinah', face: '1.jpg', body: '2.jpg' },
  { id: 'roekmini', folder: '3_Roekmini', face: 'f.jpg', body: 'a.jpg' },
  { id: 'sosroningrat', folder: '4_Sosroningrat', face: 'a.jpg', body: 'c.jpg' },
]
const backgrounds = [
  ['0_Revisi/Background/01_Ruang_Utama_A5_Vintage.png', '01-ruang-utama'],
  ['0_Revisi/Background/02_Pendopo_A5_Vintage.png', '02-pendopo'],
  ['0_Revisi/Background/03_Teras_Museum_A5_Vintage.png', '03-teras-museum'],
  ['0_Revisi/Background/04_Taman_Sari_A5_Vintage.png', '04-taman-sari'],
  ['0_Revisi/Background/05_Gerbang_Utama_A5_Vintage.png', '05-gerbang-utama'],
  ['0_Revisi/Background/06_Dapur_1900an_A5_Vintage.png', '06-dapur-1900an'],
  ['output/revision-assets/07-ruang-mengajar-empty.png', '07-ruang-mengajar-empty'],
  ['0_Revisi/Background/08_Ruang_Makan_Keluarga_A5_Vintage.png', '08-ruang-makan'],
]

// Used only while preparing the separately edited teaching-room source. A
// normal rebuild fails when that clean source is missing, rather than silently
// substituting the original room full of human-shaped statues.
const skipTeaching = process.argv.includes('--skip-teaching')
const selectedBackgrounds = backgrounds.filter(([, id]) => !skipTeaching || id !== '07-ruang-mengajar-empty')
const sources = [
  ...portraits.flatMap(({ folder, face, body }) => [face, body].map((file) => `0_Revisi/${folder}/${file}`)),
  ...selectedBackgrounds.map(([source]) => source),
]
for (const source of sources) {
  try { await access(projectPath(source)) }
  catch { throw new Error(`Sumber revisi belum tersedia: ${source}. Ruang mengajar wajib memakai versi kosong yang sudah diperiksa.`) }
}

await mkdir(projectPath(`${destination}/characters`), { recursive: true })
await mkdir(projectPath(`${destination}/backgrounds`), { recursive: true })
for (const { id, folder, face, body, faceCrop } of portraits) {
  let faceImage = sharp(projectPath(`0_Revisi/${folder}/${face}`)).rotate()
  if (faceCrop) faceImage = faceImage.extract(faceCrop)
  await faceImage.resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 94, effort: 6 }).toFile(projectPath(`${destination}/characters/${id}-face.webp`))
  await sharp(projectPath(`0_Revisi/${folder}/${body}`)).rotate()
    .resize({ height: 1600, withoutEnlargement: true })
    .webp({ quality: 90, effort: 6 }).toFile(projectPath(`${destination}/characters/${id}-body.webp`))
}
for (const [source, id] of selectedBackgrounds) {
  // Width-only resize preserves the source ratio. The provider prompt adapts
  // the final composition to 3:2; these references are never stretched/cropped.
  await sharp(projectPath(source)).rotate().resize({ width: 1536, withoutEnlargement: true })
    .webp({ quality: 94, effort: 6 }).toFile(projectPath(`${destination}/backgrounds/${id}.webp`))
}
console.log(`Revisi dibuat: ${portraits.length} tokoh (wajah + tubuh), ${selectedBackgrounds.length} latar vintage${skipTeaching ? '; ruang mengajar belum dibangun' : ''}.`)
