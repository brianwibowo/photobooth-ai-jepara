import test from 'node:test'
import assert from 'node:assert/strict'
import { characters, homeStories, getSceneForCharacter, getScenesForCharacter } from '../src/data.js'
import { buildGenerationPrompt } from '../server/generation-prompt.js'

test('Kartini has a fixed activity and place for every available scene', () => {
  const kartini = characters.find((character) => character.id === 'kartini')
  const scenes = getScenesForCharacter('kartini')

  assert.deepEqual(scenes.map(({ id }) => id), ['kartini-gerbang', 'kartini-membatik', 'kartini-mengajar'])
  assert.deepEqual(scenes.map(({ activity }) => activity), [
    'Menyambut pengunjung dan berfoto',
    'Membatik',
    'Mengajar',
  ])
  assert.deepEqual(scenes.map(({ place }) => place), [
    'Depan gerbang utama museum',
    'Area membatik di halaman museum',
    'Ruang pendidikan museum',
  ])
  assert.equal(scenes[0].image, '/assets/tokoh_pahlawan/1_ra kartini/Kartini_1a.webp')
  assert.equal(scenes[1].image, '/assets/tokoh_pahlawan/1_ra kartini/Kartini_2.webp')
  assert.equal(scenes[2].image, '/assets/tokoh_pahlawan/1_ra kartini/Kartini_3a.webp')
  assert.equal(getSceneForCharacter('gerbang', kartini.id).background, '/assets/backgrounds/gerbang.webp')
})

test('Kartini activity and place are included in the locked generation prompt', () => {
  const scene = getSceneForCharacter('sahabat', 'kartini')
  const character = characters.find((item) => item.id === 'kartini')
  const prompt = buildGenerationPrompt({ scene, character, people: 1 })

  assert.match(prompt, /fixed activity is Mengajar/)
  assert.match(prompt, /fixed place is Ruang pendidikan museum/)
  assert.match(prompt, /blackboard/)
  assert.match(prompt, /MUST NOT show or substitute/)
  assert.match(prompt, /exactly ONE R\.A\. Kartini/)
})

test('characters without a completed override keep the current stable scene catalog', () => {
  const scene = getSceneForCharacter('keluarga', 'soesalit')
  assert.equal(scene.name, 'Membatik Bersama')
  assert.equal(scene.location, 'Halaman museum')
  assert.equal(scene.activity, undefined)
})

test('landing poster uses only local static frames for its automatic slideshow', () => {
  assert.deepEqual(homeStories.map(({ id }) => id), ['gerbang', 'pintu', 'galeri'])
  assert.ok(homeStories.every(({ images }) => Array.isArray(images) && images.length >= 3 && images.every((image) => image.startsWith('/assets/'))))
})

test('each character receives only its own static activity/place catalog', () => {
  const expectations = {
    adhiningrat: ['Teras museum', 'Lorong museum'],
    kardinah: ['Ruang makan museum', 'Dapur museum', 'Ruang makan museum'],
    roekmini: ['Pintu masuk museum', 'Teras depan museum', 'Pintu museum'],
    sosrokartono: ['Ruang baca museum', 'Ruang studi museum'],
    sosroningrat: ['Galeri museum', 'Ruang pamer museum'],
    soesalit: ['Aula museum'],
  }
  for (const [id, places] of Object.entries(expectations)) {
    const options = getScenesForCharacter(id)
    assert.deepEqual(options.map(({ place }) => place), places)
    assert.ok(options.every((option) => option.characterId === id && option.activity && option.prompt && option.contextMustShow?.length && option.contextMustNotShow?.length))
  }
  assert.equal(getScenesForCharacter('soesalit').some(({ activity }) => activity === 'Membatik'), false)
})
