import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const previews = [
  ['tokoh_pahlawan/1_ra kartini/Gerbang utama.png', 'gerbang.webp'],
  ['tokoh_pahlawan/1_ra kartini/Kartini_2.png', 'membatik.webp'],
  ['tokoh_pahlawan/5_sosrokartono/Sosrokartono_3.png', 'gagasan.webp'],
]
const assetPath = (name) => fileURLToPath(new URL(`../public/assets/${name}`, import.meta.url))
await mkdir(assetPath('scene-previews'), { recursive: true })
for (const [source, destination] of previews) {
  await sharp(assetPath(source)).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 88 }).toFile(assetPath(`scene-previews/${destination}`))
}
console.log('Tiga preview tempat dibuat dari gambar sumber utuh, terpisah dari reference background AI.')
