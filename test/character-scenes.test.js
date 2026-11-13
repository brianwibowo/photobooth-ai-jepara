import test from 'node:test'
import assert from 'node:assert/strict'
import { backgroundCatalog, BACKGROUND_STYLES, DEFAULT_BACKGROUND_STYLE, characters, scenes, characterScenes, homeBackground, homeStories, getCharacter, getScene, getSceneForCharacter, getScenesForCharacter } from '../src/data.js'
import { buildGenerationPrompt } from '../server/generation-prompt.js'

const characterRoot = '/assets/tokoh_pahlawan/'
const revisedFolders = {
  kartini: '1_ra kartini',
  kardinah: '3_kardinah',
  roekmini: '4_roekmini',
  sosrokartono: '5_sosrokartono',
  sosroningrat: '6_raden mas adipati ario sosroningrat',
}

const activityBackgrounds = {
  'kartini-gerbang': 'gerbang-utama',
  'kartini-membatik': 'taman-sari',
  'kartini-mengajar': 'ruang-kartini-mengajar',
  'adhiningrat-teras': 'ruang-keluarga',
  'adhiningrat-lorong': 'aula-berkolom',
  'kardinah-menulis': 'ruang-makan-keluarga',
  'kardinah-memasak': 'dapur-1900an',
  'kardinah-menyajikan': 'ruang-makan-keluarga',
  'roekmini-berbincang': 'pendopo',
  'roekmini-berpose': 'gerbang-utama',
  'roekmini-menyambut': 'aula-berkolom',
  'sosrokartono-membaca': 'ruang-keluarga',
  'sosrokartono-mengkaji': 'ruang-utama',
  'sosroningrat-berpose': 'ruang-utama',
  'sosroningrat-menjelaskan': 'aula-berkolom',
  'soesalit-dakon': 'pendopo',
}
const productionPath = (style, id) => `/assets/backgrounds/${style}/${id}-2026-11-v2.webp`

function assertBackgroundReceipt(scene, backgroundId, style) {
  const variant = backgroundCatalog.find(({ id }) => id === backgroundId).variants[style]
  assert.equal(scene.backgroundId, backgroundId)
  assert.equal(scene.backgroundStyle, style)
  assert.equal(scene.image, productionPath(style, backgroundId))
  assert.equal(scene.background, scene.image, 'The card must show the exact selected provider reference')
  assert.equal(scene.backgroundAssetId, variant.assetId)
  assert.equal(scene.backgroundSha256, variant.sha256)
  assert.equal(scene.backgroundSourceWidth, variant.sourceWidth)
  assert.equal(scene.backgroundSourceHeight, variant.sourceHeight)
  assert.equal(scene.outputAspectRatio, '16:9')
}

test('all nine supplied locations have paired Vintage and Warna variants with traceable identities', () => {
  assert.equal(DEFAULT_BACKGROUND_STYLE, 'vintage')
  assert.deepEqual(BACKGROUND_STYLES, ['vintage', 'warna'])
  assert.equal(backgroundCatalog.length, 9)
  assert.equal(new Set(backgroundCatalog.map(({ id }) => id)).size, 9)
  const assetIds = new Set()
  const hashes = new Set()
  for (const background of backgroundCatalog) {
    assert.ok(background.name)
    assert.deepEqual(Object.keys(background.variants).sort(), ['vintage', 'warna'])
    for (const style of BACKGROUND_STYLES) {
      const variant = background.variants[style]
      assert.equal(variant.image, productionPath(style, background.id))
      assert.equal(variant.assetId, `bg-${background.id}-${style}-v2`)
      assert.match(variant.sha256, /^[a-f0-9]{64}$/)
      assert.ok(Number.isInteger(variant.sourceWidth) && variant.sourceWidth > 0)
      assert.ok(Number.isInteger(variant.sourceHeight) && variant.sourceHeight > 0)
      assetIds.add(variant.assetId)
      hashes.add(variant.sha256)
    }
    assert.notEqual(background.variants.vintage.image, background.variants.warna.image)
    assert.notEqual(background.variants.vintage.sha256, background.variants.warna.sha256)
  }
  assert.equal(assetIds.size, 18)
  assert.equal(hashes.size, 18)
})

test('all sixteen stable activities map to their supplied locations in both styles', () => {
  assert.deepEqual(characterScenes.map(({ id }) => id), Object.keys(activityBackgrounds))
  assert.equal(new Set(Object.values(activityBackgrounds)).size, 9, 'Every location has a current activity')
  for (const character of characters) {
    const vintage = getScenesForCharacter(character.id)
    const warna = getScenesForCharacter(character.id, 'warna')
    assert.deepEqual(vintage.map(({ id }) => id), warna.map(({ id }) => id))
    assert.deepEqual(vintage.map(({ activity }) => activity), warna.map(({ activity }) => activity))
    for (const style of BACKGROUND_STYLES) {
      for (const scene of getScenesForCharacter(character.id, style)) {
        assert.equal(scene.characterId, character.id)
        assert.ok(scene.activity && scene.place && scene.prompt && scene.contextMustShow?.length && scene.contextMustNotShow?.length)
        assertBackgroundReceipt(scene, activityBackgrounds[scene.id], style)
        assert.deepEqual(getSceneForCharacter(scene.id, character.id, style), scene)
      }
    }
  }
})

test('Kartini retains its three activities while the style changes only the selected background variant', () => {
  for (const style of BACKGROUND_STYLES) {
    const options = getScenesForCharacter('kartini', style)
    assert.deepEqual(options.map(({ id }) => id), ['kartini-gerbang', 'kartini-membatik', 'kartini-mengajar'])
    assert.deepEqual(options.map(({ activity }) => activity), ['Menyambut pengunjung dan berfoto', 'Membatik', 'Mengajar'])
    assert.deepEqual(options.map(({ place }) => place), ['Depan gerbang utama museum', 'Taman Sari museum', 'Ruang Kartini Mengajar'])
  }
  assert.deepEqual(getScenesForCharacter('kartini'), getScenesForCharacter('kartini', 'vintage'))
})

test('legacy scene IDs resolve exactly in either style without changing their saved identity', () => {
  assert.deepEqual(scenes.map(({ id }) => id), ['gerbang', 'keluarga', 'sahabat'])
  const locations = ['gerbang-utama', 'taman-sari', 'ruang-kartini-mengajar']
  for (const character of characters) {
    for (const [index, scene] of scenes.entries()) {
      for (const style of BACKGROUND_STYLES) {
        const restored = getSceneForCharacter(scene.id, character.id, style)
        assert.equal(restored.id, scene.id)
        assertBackgroundReceipt(restored, locations[index], style)
      }
    }
  }
})

test('unknown or mismatched selections never silently choose another scene, character or style', () => {
  assert.equal(getCharacter('missing-character'), null)
  assert.equal(getScene('missing-scene'), null)
  assert.equal(getSceneForCharacter('missing-scene', 'kartini'), null)
  assert.equal(getSceneForCharacter('kartini-gerbang', 'soesalit'), null)
  assert.equal(getSceneForCharacter('kartini-gerbang', 'missing-character'), null)
  assert.equal(getSceneForCharacter('kartini-gerbang', null), null)
  assert.deepEqual(getScenesForCharacter('missing-character'), [])
  for (const style of ['', null, 'sepia', 'Vintage', '__proto__']) {
    assert.equal(getSceneForCharacter('kartini-gerbang', 'kartini', style), null)
    assert.deepEqual(getScenesForCharacter('kartini', style), [])
  }
})

test('only the five supplied characters receive separate new face and body references', () => {
  const revisedIds = ['kartini', 'kardinah', 'roekmini', 'sosrokartono', 'sosroningrat']
  assert.deepEqual(characters.filter(({ bodyReference }) => bodyReference).map(({ id }) => id), revisedIds)
  for (const id of revisedIds) {
    const character = characters.find((item) => item.id === id)
    assert.equal(character.reference, `${characterRoot}${revisedFolders[id]}/reference-2026-11.webp`)
    assert.equal(character.bodyReference, `${characterRoot}${revisedFolders[id]}/body-2026-11.webp`)
    assert.equal(character.image, character.bodyReference)
    assert.notEqual(character.reference, character.bodyReference, 'Primary generation reference and UI body asset remain separate files')
  }
  const unchanged = {
    adhiningrat: {
      image: '/assets/tokoh_pahlawan/2_adipati ario singgih djojo adhiningrat/display.webp',
      reference: '/assets/tokoh_pahlawan/2_adipati ario singgih djojo adhiningrat/reference.webp',
      prompt: 'Adipati Ario Singgih Djojo Adhiningrat, Javanese regent, wearing the formal embroidered attire and headwear in the reference, dignified expression.',
    },
    soesalit: {
      image: '/assets/tokoh_pahlawan/7_soesalit/display.webp',
      reference: '/assets/tokoh_pahlawan/7_soesalit/reference.webp',
      prompt: 'Soesalit as a young Javanese child, preserving the age of the child, face and outfit shown in the reference.',
    },
  }
  for (const [id, expected] of Object.entries(unchanged)) {
    const character = characters.find((item) => item.id === id)
    for (const [field, value] of Object.entries(expected)) assert.equal(character[field], value)
    assert.equal(character.bodyReference, undefined)
  }
})

test('home artwork uses all nine current Vintage locations', () => {
  assert.equal(homeBackground, productionPath('vintage', 'gerbang-utama'))
  assert.deepEqual(homeStories.map(({ id }) => id), ['gerbang', 'pintu', 'galeri'])
  assert.ok(homeStories.every(({ images }) => images.length === 3))
  const images = homeStories.flatMap(({ images }) => images)
  assert.equal(images.length, 9)
  assert.equal(new Set(images).size, 9)
  assert.deepEqual([...images].sort(), backgroundCatalog.map(({ id }) => productionPath('vintage', id)).sort())
})

test('room labels and activity prompts preserve the supplied layout and inanimate teaching diorama', () => {
  const expectedPlaces = {
    adhiningrat: ['Ruang keluarga museum', 'Aula berkolom museum'],
    kardinah: ['Ruang makan keluarga museum', 'Dapur 1900-an museum', 'Ruang makan keluarga museum'],
    roekmini: ['Pendopo museum', 'Gerbang utama museum', 'Pintu aula berkolom museum'],
    sosrokartono: ['Ruang keluarga museum', 'Ruang utama museum'],
    sosroningrat: ['Ruang utama museum', 'Aula berkolom museum'],
    soesalit: ['Pendopo museum'],
  }
  for (const [id, places] of Object.entries(expectedPlaces)) assert.deepEqual(getScenesForCharacter(id).map(({ place }) => place), places)
  for (const scene of getScenesForCharacter('sosrokartono')) {
    assert.match(scene.prompt, /[Pp]reserve/)
    assert.match(scene.prompt, /do not add|not a new/)
    assert.equal(scene.contextMustShow.some((item) => item.includes('freestanding')), false)
  }
  for (const style of BACKGROUND_STYLES) {
    const teaching = getSceneForCharacter('kartini-mengajar', 'kartini', style)
    assert.match(teaching.prompt, /INANIMATE museum exhibits/)
    assert.match(teaching.prompt, /Never animate, duplicate or replace/)
    const prompt = buildGenerationPrompt({ scene: teaching, character: getCharacter('kartini'), people: 1 })
    assert.match(prompt, /fixed activity is Mengajar/)
    assert.match(prompt, /fixed place is Ruang Kartini Mengajar/)
    assert.match(prompt, /visitors from the photo listening or taking notes/)
  }
})
