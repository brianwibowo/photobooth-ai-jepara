const hero = (folder, label) => `/assets/tokoh_pahlawan/${folder}/${label}`

export const logos = [
  { src: '/assets/logo/Logo Prov Jawa Tengah.png', alt: 'Provinsi Jawa Tengah' },
  { src: '/assets/logo/logo-rembang.webp', alt: 'Kabupaten Rembang' },
  { src: '/assets/logo/logo-museum.webp', alt: 'Museum R.A. Kartini' },
  { src: '/assets/logo/logo-hatiku.webp', alt: 'Museum di Hatiku' },
]

export const characters = [
  { id: 'kartini', name: 'R.A. Kartini', role: 'Pelopor emansipasi', image: hero('1_ra kartini', 'display.webp'), reference: hero('1_ra kartini', 'reference.webp'), description: 'Surat, gagasan, dan keberanian yang mengubah zaman.', prompt: 'R.A. Kartini, Javanese woman and educator, wearing a modest white kebaya and brown batik, calm warm expression.' },
  { id: 'adhiningrat', name: 'R.M.A.A. Djojo Adhiningrat', role: 'Suami Kartini · Bupati Rembang', image: hero('2_adipati ario singgih djojo adhiningrat', 'display.webp'), reference: hero('2_adipati ario singgih djojo adhiningrat', 'reference.webp'), description: 'Bagian dari kisah keluarga Kartini di Rembang.', prompt: 'Adipati Ario Singgih Djojo Adhiningrat, Javanese regent, wearing the formal embroidered attire and headwear in the reference, dignified expression.' },
  { id: 'kardinah', name: 'R.A. Kardinah', role: 'Sahabat keluarga', image: hero('3_kardinah', 'display.webp'), reference: hero('3_kardinah', 'reference.webp'), description: 'Hangat, cerdas, dan dekat dengan kehidupan rakyat.', prompt: 'R.A. Kardinah, Javanese woman in a period-appropriate kebaya and batik, warm attentive expression.' },
  { id: 'roekmini', name: 'R.A. Roekmini', role: 'Seniman keluarga', image: hero('4_roekmini', 'display.webp'), reference: hero('4_roekmini', 'reference.webp'), description: 'Membawa keindahan dan semangat belajar.', prompt: 'R.A. Roekmini, Javanese woman in a period-appropriate kebaya and batik, gentle artistic presence.' },
  { id: 'sosrokartono', name: 'R.M.P. Sosrokartono', role: 'Cendekiawan', image: hero('5_sosrokartono', 'display.webp'), reference: hero('5_sosrokartono', 'reference.webp'), description: 'Jejak ilmu dari Jepara ke dunia.', prompt: 'R.M.P. Sosrokartono, Javanese male scholar in historically appropriate formal clothing, composed thoughtful expression.' },
  { id: 'sosroningrat', name: 'R.M.A.A. Sosroningrat', role: 'Bupati Jepara', image: hero('6_raden mas adipati ario sosroningrat', 'display.webp'), reference: hero('6_raden mas adipati ario sosroningrat', 'reference.webp'), description: 'Figur keluarga dan sejarah di balik kisah Kartini.', prompt: 'R.M.A.A. Sosroningrat, Javanese regent in historically appropriate formal attire, dignified and welcoming.' },
  { id: 'soesalit', name: 'Soesalit', role: 'Putra Kartini', image: hero('7_soesalit', 'display.webp'), reference: hero('7_soesalit', 'reference.webp'), description: 'Meneruskan nyala perjuangan sang ibu.', prompt: 'Soesalit as a young Javanese child, preserving the age of the child, face and outfit shown in the reference.' }
]

export const scenes = [
  { id: 'gerbang', name: 'Di Gerbang Museum', location: 'Museum R.A. Kartini Rembang', description: 'Potret perayaan di depan gerbang museum.', characterIds: characters.map(({ id }) => id), image: '/assets/scene-previews/gerbang.webp', background: '/assets/backgrounds/gerbang.webp', accent: '#d8a85e', prompt: 'Place the group naturally in front of the real Museum R.A. Kartini Rembang entrance shown in the background reference. Keep the architecture and sign legible.' },
  { id: 'keluarga', name: 'Membatik Bersama', location: 'Halaman museum', description: 'Mengenal batik dalam suasana hangat.', characterIds: characters.map(({ id }) => id), image: '/assets/scene-previews/membatik.webp', background: '/assets/backgrounds/keluarga.webp', accent: '#b97755', prompt: 'Place the group at a batik-making activity in the museum courtyard shown in the background reference, with batik cloth racks, covered walkways and warm daylight. Reconstruct the blurred lower area naturally; do not reproduce editorial blur or colored sidebars. Ignore the sample people in the background reference.' },
  { id: 'sahabat', name: 'Ruang Gagasan', location: 'Ruang belajar museum', description: 'Berbagi cerita dan gagasan di ruang sejarah.', characterIds: characters.map(({ id }) => id), image: '/assets/scene-previews/gagasan.webp', background: '/assets/backgrounds/sahabat.webp', accent: '#739d8d', prompt: 'Place the group around a wooden reading table inside the museum study room shown in the background reference, with green-trimmed doors, wooden wall details and warm window light. Reconstruct the blurred lower area naturally; do not reproduce editorial blur. Ignore the sample people in the background reference.' }
]

export const getCharacter = (id) => characters.find((item) => item.id === id) || characters[0]
export const getScene = (id) => scenes.find((item) => item.id === id) || scenes[0]
