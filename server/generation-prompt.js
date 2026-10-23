export function buildGenerationPrompt({ scene, character, people }) {
  const population = people
    ? `The requested visitor count is ${people}. The final photograph must contain exactly ${people} visitors from Reference 1 plus exactly ONE ${character.name}: ${people + 1} people in total.`
    : `First count the distinct real visitors visible in Reference 1. Call that number V. The final photograph must contain exactly V visitors plus exactly ONE ${character.name}: V + 1 people in total. If Reference 1 contains one visitor, the final image contains exactly TWO people.`
  return [
    'Create one authentic photorealistic commemorative photograph at Museum R.A. Kartini Rembang using the three labeled references below.',
    'PRIORITY 1 — CLOSED CAST AND VISITOR IDENTITY:', population,
    'Reference 1 is the ONLY source of visitor identities and visitor count. Preserve every visitor exactly once, including the same face, facial proportions, eyes, nose, mouth, hair, age, skin tone, body proportions, clothing, and left-to-right order. Never invent, duplicate, merge, replace, or omit a visitor. If a requested count does not match the visible identities, never fabricate a missing visitor.',
    `PRIORITY 2 — ONE SELECTED FIGURE: Reference 2 shows ONLY ${character.name}. Add exactly this one historical figure, preserving the reference face, age, hairstyle and clothing. ${character.prompt || ''}`,
    'The museum name describes the LOCATION; it does not request any other historical figure. Do not add family members, parents, companions, batik instructors, museum staff, tourists, bystanders, crowds, silhouettes, or extra reflected people. A child historical figure remains a child and does not require an accompanying adult.',
    `PRIORITY 3 — SELECTED LOCATION: Reference 3 is a PERSON-FREE environment plate. Use it for architecture, furniture, batik materials, lighting and perspective ONLY. Place the closed cast naturally in ${scene.name}, ${scene.location}. ${scene.prompt || ''}`,
    'Empty space and empty chairs must stay free of extra people. Build a new composition for this cast; do not recreate a promotional group photograph or add stock-photo visitors.',
    'Use realistic documentary photography, eye-level 50mm perspective, natural skin texture, believable anatomy and hands, matching light direction and contact shadows, and a 3:2 landscape composition. Period clothing applies to the historical figure; keep the visitors recognizable in their own clothing.',
    'No face morphing, beauty filter, plastic skin, gender swap, duplicated faces, extra limbs, cutout edges, collage, text, captions, borders, logos, or watermarks.',
    'Before returning the image, check that every human belongs to Reference 1 or is the single selected person from Reference 2. Remove any other person. Facial identity and the closed cast take precedence over decorative scene details.',
  ].join('\n\n')
}
