import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { characters, scenes, characterScenes, logos, homeStories, getScenesForCharacter } from '../src/data.js'

const paths = new Set([
  ...characters.flatMap(({ image, reference }) => [image, reference]),
  ...scenes.flatMap(({ image, background }) => [image, background]),
  ...characters.flatMap(({ id }) => getScenesForCharacter(id).flatMap(({ image, background }) => [image, background])),
  ...homeStories.flatMap(({ images }) => images),
  ...logos.map(({ src }) => src),
])
const issues = []
for (const asset of paths) {
  if (!asset?.startsWith('/assets/')) {
    issues.push(`Path aset tidak valid: ${asset}`)
    continue
  }
  try { await access(fileURLToPath(new URL(`../public${asset}`, import.meta.url))) }
  catch { issues.push(`Aset tidak ditemukan: ${asset}`) }
}
const ids = new Set(characters.map(({ id }) => id))
if (ids.size !== characters.length) issues.push('ID tokoh duplikat.')
for (const scene of scenes) {
  if (!scene.characterIds.length) issues.push(`Adegan ${scene.id} belum memiliki tokoh.`)
  for (const id of scene.characterIds) if (!ids.has(id)) issues.push(`Tokoh ${id} di adegan ${scene.id} tidak ditemukan.`)
}
for (const scene of characterScenes) {
  if (!scene.characterId || !ids.has(scene.characterId)) issues.push(`Scene khusus ${scene.id} memiliki tokoh tidak valid.`)
  if (!scene.activity || !scene.place || !scene.contextMustShow?.length || !scene.contextMustNotShow?.length) issues.push(`Scene khusus ${scene.id} belum memiliki kunci konteks lengkap.`)
}
for (const id of ids) if (!scenes.some(({ characterIds }) => characterIds.includes(id))) issues.push(`Tokoh ${id} belum bisa dipilih.`)
if (issues.length) {
  console.error(issues.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Aset valid: ${characters.length} tokoh, ${characterScenes.length} scene khusus, ${scenes.length} latar legacy, ${logos.length} logo (${paths.size} file).`)
}
