import test from 'node:test'
import assert from 'node:assert/strict'
import { characters, scenes, characterScenes, homeBackground, homeStories, getSceneForCharacter, getScenesForCharacter } from '../src/data.js'
import { buildGenerationPrompt } from '../server/generation-prompt.js'

const backgroundRoot = '/assets/revisions-2026-11/backgrounds/'
const characterRoot = '/assets/revisions-2026-11/characters/'

test('Kartini keeps all three activities with matching vintage environments', () => {
  const options = getScenesForCharacter('kartini')
  assert.deepEqual(options.map(({ id }) => id), ['kartini-gerbang', 'kartini-membatik', 'kartini-mengajar'])
  assert.deepEqual(options.map(({ activity }) => activity), [
    'Menyambut pengunjung dan berfoto',
    'Membatik',
    'Mengajar',
  ])
  assert.deepEqual(options.map(({ place }) => place), [
    'Depan gerbang utama museum',
    'Area membatik di halaman museum',
    'Ruang pendidikan museum',
  ])
  assert.deepEqual(options.map(({ background }) => background), [
    `${backgroundRoot}05-gerbang-utama.webp`,
    `${backgroundRoot}04-taman-sari.webp`,
    `${backgroundRoot}07-ruang-mengajar-empty.webp`,
  ])
})

test('Kartini activity and place remain locked in the generation prompt', () => {
  const scene = getSceneForCharacter('sahabat', 'kartini')
  const character = characters.find((item) => item.id === 'kartini')
  const prompt = buildGenerationPrompt({ scene, character, people: 1 })
  assert.match(prompt, /fixed activity is Mengajar/)
  assert.match(prompt, /fixed place is Ruang pendidikan museum/)
  assert.match(prompt, /blackboard/)
  assert.match(prompt, /MUST NOT show or substitute/)
  assert.match(prompt, /exactly ONE R\.A\. Kartini/)
  assert.match(prompt, /visitors from the photo listening or taking notes/)
})

test('legacy scene IDs remain available and resolve to current vintage plates', () => {
  assert.deepEqual(scenes.map(({ id }) => id), ['gerbang', 'keluarga', 'sahabat'])
  const expectedBackgrounds = [
    `${backgroundRoot}05-gerbang-utama.webp`,
    `${backgroundRoot}04-taman-sari.webp`,
    `${backgroundRoot}07-ruang-mengajar-empty.webp`,
  ]
  for (const character of characters) {
    for (const [index, scene] of scenes.entries()) {
      const restored = getSceneForCharacter(scene.id, character.id)
      assert.equal(restored.id, scene.id, 'A restored session must retain its saved scene ID')
      assert.equal(restored.background, expectedBackgrounds[index])
      assert.equal(restored.image, restored.background)
    }
  }
  assert.equal(getSceneForCharacter('keluarga', 'soesalit').activity, undefined)
})

test('only the five supplied characters receive separate new face and body references', () => {
  const revisedIds = ['kartini', 'kardinah', 'roekmini', 'sosrokartono', 'sosroningrat']
  assert.deepEqual(characters.filter(({ bodyReference }) => bodyReference).map(({ id }) => id), revisedIds)
  for (const id of revisedIds) {
    const character = characters.find((item) => item.id === id)
    assert.equal(character.reference, `${characterRoot}${id}-face.webp`)
    assert.equal(character.bodyReference, `${characterRoot}${id}-body.webp`)
    assert.equal(character.image, character.bodyReference)
    assert.notEqual(character.reference, character.bodyReference, 'Face detail and full-body clothing have separate inputs')
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

test('each activity uses the matching environment and the same empty image for its preview', () => {
  const mapping = {
    'kartini-gerbang': '05-gerbang-utama',
    'kartini-membatik': '04-taman-sari',
    'kartini-mengajar': '07-ruang-mengajar-empty',
    'adhiningrat-teras': '03-teras-museum',
    'adhiningrat-lorong': '03-teras-museum',
    'kardinah-menulis': '08-ruang-makan',
    'kardinah-memasak': '06-dapur-1900an',
    'kardinah-menyajikan': '08-ruang-makan',
    'roekmini-berbincang': '03-teras-museum',
    'roekmini-berpose': '03-teras-museum',
    'roekmini-menyambut': '03-teras-museum',
    'sosrokartono-membaca': '01-ruang-utama',
    'sosrokartono-mengkaji': '01-ruang-utama',
    'sosroningrat-berpose': '01-ruang-utama',
    'sosroningrat-menjelaskan': '01-ruang-utama',
    'soesalit-dakon': '02-pendopo',
  }
  assert.equal(characterScenes.length, Object.keys(mapping).length)
  for (const scene of characterScenes) {
    assert.equal(scene.background, `${backgroundRoot}${mapping[scene.id]}.webp`)
    assert.equal(scene.image, scene.background, 'The location card must show the environment supplied to generation')
    assert.ok(scene.activity && scene.place && scene.prompt && scene.contextMustShow?.length && scene.contextMustNotShow?.length)
    assert.ok(getScenesForCharacter(scene.characterId).some(({ id }) => id === scene.id))
  }
})

test('landing slideshow uses all eight vintage locations and no old composite figures', () => {
  assert.equal(homeBackground, `${backgroundRoot}05-gerbang-utama.webp`)
  assert.deepEqual(homeStories.map(({ id }) => id), ['gerbang', 'pintu', 'galeri'])
  assert.ok(homeStories.every(({ images }) => images.length === 3 && images.every((image) => image.startsWith(backgroundRoot))))
  assert.equal(new Set(homeStories.flatMap(({ images }) => images)).size, 8)
})

test('activity labels and prompts agree with the revised architecture', () => {
  const walk = getSceneForCharacter('adhiningrat-lorong', 'adhiningrat')
  assert.equal(walk.place, 'Teras museum')
  assert.match(walk.name, /Teras/)
  assert.equal(getSceneForCharacter('soesalit-dakon', 'soesalit').place, 'Pendopo museum')
  assert.equal(getScenesForCharacter('soesalit').some(({ activity }) => activity === 'Membatik'), false)
  for (const scene of getScenesForCharacter('sosrokartono')) {
    assert.equal(scene.place, 'Ruang utama museum')
    assert.match(scene.prompt, /small freestanding/)
    assert.match(scene.prompt, /[Pp]reserv/)
  }
  const welcome = getSceneForCharacter('roekmini-menyambut', 'roekmini')
  assert.ok(welcome.contextMustShow.includes('wooden glazed museum door'))
  assert.equal(welcome.contextMustShow.some((item) => item.includes('green')), false)
})
