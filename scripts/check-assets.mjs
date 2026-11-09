import { access, readFile } from 'node:fs/promises'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { characters, scenes, characterScenes, logos, homeStories, getScenesForCharacter, backgroundCatalog, BACKGROUND_STYLES } from '../src/data.js'

const paths = new Set([
  ...characters.flatMap(({ image, reference, bodyReference }) => [image, reference, ...(bodyReference ? [bodyReference] : [])]),
  ...scenes.flatMap(({ image, background }) => [image, background]),
  ...characters.flatMap(({ id }) => getScenesForCharacter(id).flatMap(({ image, background }) => [image, background])),
  ...homeStories.flatMap(({ images }) => images),
  ...logos.map(({ src }) => src),
  ...backgroundCatalog.flatMap(({ variants }) => BACKGROUND_STYLES.map((style) => variants[style]?.image)),
])
const issues = []
for (const asset of paths) {
  if (!asset?.startsWith('/assets/')) {
    issues.push(`Path aset tidak valid: ${asset}`)
    continue
  }
  if (asset.startsWith('/assets/tokoh_pahlawan/') && asset.toLowerCase().endsWith('.png')) {
    issues.push(`Preview tokoh harus memakai WebP: ${asset}`)
  }
  try { await access(fileURLToPath(new URL(`../public${asset}`, import.meta.url))) }
  catch { issues.push(`Aset tidak ditemukan: ${asset}`) }
}
const ids = new Set(characters.map(({ id }) => id))
const backgroundIds = new Set()
const assetIds = new Set()
for (const background of backgroundCatalog) {
  if (backgroundIds.has(background.id)) issues.push(`ID latar duplikat: ${background.id}`)
  backgroundIds.add(background.id)
  for (const style of BACKGROUND_STYLES) {
    const variant = background.variants[style]
    if (!variant?.image?.startsWith(`/assets/backgrounds/${style}/`) || !variant.assetId || assetIds.has(variant.assetId)) {
      issues.push(`Varian latar tidak valid: ${background.id}/${style}`)
      continue
    }
    assetIds.add(variant.assetId)
    try {
      const buffer = await readFile(fileURLToPath(new URL(`../public${variant.image}`, import.meta.url)))
      if (crypto.createHash('sha256').update(buffer).digest('hex') !== variant.sha256) issues.push(`Hash latar berubah: ${variant.assetId}`)
      const metadata = await sharp(buffer).metadata()
      if (metadata.width > variant.sourceWidth || metadata.height > variant.sourceHeight || Math.abs(metadata.width / metadata.height - variant.sourceWidth / variant.sourceHeight) > .002) issues.push(`Geometri latar berubah: ${variant.assetId}`)
    } catch { issues.push(`Latar tidak dapat diverifikasi: ${variant.assetId}`) }
  }
}
if (ids.size !== characters.length) issues.push('ID tokoh duplikat.')
for (const scene of scenes) {
  if (!scene.characterIds.length) issues.push(`Adegan ${scene.id} belum memiliki tokoh.`)
  for (const id of scene.characterIds) if (!ids.has(id)) issues.push(`Tokoh ${id} di adegan ${scene.id} tidak ditemukan.`)
}
for (const scene of characterScenes) {
  if (!scene.characterId || !ids.has(scene.characterId)) issues.push(`Scene khusus ${scene.id} memiliki tokoh tidak valid.`)
  if (!backgroundIds.has(scene.backgroundId)) issues.push(`Scene khusus ${scene.id} memiliki latar tidak valid.`)
  if (!scene.activity || !scene.place || !scene.contextMustShow?.length || !scene.contextMustNotShow?.length) issues.push(`Scene khusus ${scene.id} belum memiliki kunci konteks lengkap.`)
}
for (const id of ids) if (!scenes.some(({ characterIds }) => characterIds.includes(id))) issues.push(`Tokoh ${id} belum bisa dipilih.`)
if (issues.length) {
  console.error(issues.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Aset valid: ${characters.length} tokoh, ${characterScenes.length} aktivitas, ${backgroundCatalog.length} lokasi × ${BACKGROUND_STYLES.length} nuansa, ${logos.length} logo (${paths.size} file; hash dan rasio latar terverifikasi).`)
}
