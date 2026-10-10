export const characters = [
  { id: 'kartini', name: 'R.A. Kartini', role: 'Pelopor emansipasi', image: '/assets/kartini.png', description: 'Surat, gagasan, dan keberanian yang mengubah zaman.' },
  { id: 'kardinah', name: 'R.A. Kardinah', role: 'Sahabat keluarga', image: '/assets/kardinah.png', description: 'Hangat, cerdas, dan dekat dengan kehidupan rakyat.' },
  { id: 'roekmini', name: 'R.A. Roekmini', role: 'Seniman keluarga', image: '/assets/roekmini.png', description: 'Membawa keindahan dan semangat belajar.' },
  { id: 'sosrokartono', name: 'R.M.P. Sosrokartono', role: 'Cendekiawan', image: '/assets/sosrokartono.png', description: 'Jejak ilmu dari Jepara ke dunia.' },
  { id: 'sosroningrat', name: 'R.M.A.A. Sosroningrat', role: 'Bupati Jepara', image: '/assets/sosroningrat.png', description: 'Figur keluarga dan sejarah di balik kisah Kartini.' },
  { id: 'soesalit', name: 'Soesalit', role: 'Putra Kartini', image: '/assets/soesalit.png', description: 'Meneruskan nyala perjuangan sang ibu.' }
]

export const scenes = [
  { id: 'gerbang', name: 'Di Gerbang Museum', location: 'Museum R.A. Kartini Rembang', description: 'Potret perayaan di depan gerbang museum.', characterIds: ['kartini'], image: '/assets/gerbang.png', accent: '#d8a85e' },
  { id: 'keluarga', name: 'Potret Keluarga', location: 'Ruang keluarga Jawa', description: 'Suasana akrab bersama keluarga Kartini.', characterIds: ['kartini', 'kardinah', 'roekmini'], image: '/assets/gerbang.png', accent: '#b97755' },
  { id: 'sahabat', name: 'Ruang Gagasan', location: 'Ruang arsip museum', description: 'Berbagi cerita dan gagasan di ruang sejarah.', characterIds: ['kartini', 'sosrokartono'], image: '/assets/gerbang.png', accent: '#739d8d' }
]

export const getCharacter = (id) => characters.find((item) => item.id === id) || characters[0]
export const getScene = (id) => scenes.find((item) => item.id === id) || scenes[0]
