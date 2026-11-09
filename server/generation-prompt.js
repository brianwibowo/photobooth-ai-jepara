// The optional body reference depicts the SAME selected person, not another
// member of the cast. Keep numbering shared across all provider transports.
export function generationReferenceLabels(character) {
  const labels = [
    'REFERENCE 1 — VISITOR PHOTO. The only source of visitor identities and count. Preserve every visitor exactly once.',
    `REFERENCE 2 — PRIMARY FACE IDENTITY: ${character.name}. Add this historical person exactly once. This image is the authority for the selected face.`,
  ]
  if (character.bodyReference) labels.push(`REFERENCE 3 — BODY AND CLOTHING OF THE SAME ${character.name} AS REFERENCE 2. A second view of ONE person, not an additional person. Use only for body proportions and period outfit; Reference 2 remains the face authority.`)
  labels.push(`REFERENCE ${labels.length + 1} — VINTAGE MUSEUM ENVIRONMENT. Architecture, furnishings, perspective and lighting only. No visitor or historical identity may come from this image. Do not turn museum reliefs or display artwork into living people.`)
  return labels
}

export function buildGenerationPrompt({ scene, character, people }) {
  const environmentReference = character.bodyReference ? 4 : 3
  const population = people
    ? `The requested visitor count is ${people}. The final photograph must contain exactly ${people} visitors from Reference 1 plus exactly ONE ${character.name}: ${people + 1} people in total.`
    : `First count the distinct real visitors visible in Reference 1. Call that number V. The final photograph must contain exactly V visitors plus exactly ONE ${character.name}: V + 1 people in total. If Reference 1 contains one visitor, the final image contains exactly TWO people.`
  const mustShow = scene.contextMustShow?.length ? scene.contextMustShow.join(', ') : 'the selected activity and place'
  const mustNotShow = scene.contextMustNotShow?.length ? scene.contextMustNotShow.join(', ') : 'any unrelated museum activity'
  return [
    `Create one authentic photorealistic commemorative photograph at Museum R.A. Kartini Rembang using the ${environmentReference} numbered reference images below.`,
    'PRIORITY 1 — CLOSED CAST AND VISITOR IDENTITY:', population,
    'Reference 1 is the ONLY source of visitor identities and visitor count. Preserve every visitor exactly once, including the same face, facial proportions, eyes, nose, mouth, hair, age, skin tone, body proportions, clothing, and left-to-right order. Never invent, duplicate, merge, replace, or omit a visitor. If a requested count does not match the visible identities, never fabricate a missing visitor.',
    `PRIORITY 2 — ONE SELECTED FIGURE: Reference 2 shows ONLY ${character.name}. Add exactly this one historical figure. Treat the supplied face as the fixed identity: preserve facial structure, eye spacing, eyelids, nose, lips, jaw, age, skin tone, hairline and hairstyle. Do not substitute a generic historical face or an imagined face from the person's name. ${character.bodyReference ? `Reference 3 is a body/clothing view of the SAME person. Use it for proportions and outfit only; never average its face with Reference 2 or render it as a second person.` : 'Preserve the clothing and body proportions of Reference 2.'} ${character.prompt || ''}`,
    'The museum name describes the LOCATION; it does not request any other historical figure. Do not add family members, parents, companions, batik instructors, museum staff, tourists, bystanders, crowds, silhouettes, or extra reflected people. A child historical figure remains a child and does not require an accompanying adult.',
    `PRIORITY 3 — NON-NEGOTIABLE CHARACTER-SPECIFIC CONTEXT: The selected scene is ${scene.id}. Reference ${environmentReference} is a PERSON-FREE environment plate; museum reliefs and display artwork are inanimate objects only. Place the closed cast only in ${scene.name}, ${scene.location}. The fixed activity is ${scene.activity || 'the selected museum scene'} and the fixed place is ${scene.place || scene.location}. Keep the supplied room or exterior recognizable: preserve architecture, door and window positions, furniture, perspective and light direction. Do not invent a replacement museum. The image MUST visibly show: ${mustShow}. The image MUST NOT show or substitute: ${mustNotShow}. Never fall back to a generic scene from another character, including a batik activity for a non-batik selection. If the requested activity or place is not visible, the result is incorrect. ${scene.prompt || ''}`,
    'Empty space and empty chairs must stay free of extra people. Build a new composition for this cast; do not recreate a promotional group photograph or add stock-photo visitors.',
    'Use realistic documentary photography, eye-level 50mm perspective, natural skin texture, believable anatomy and hands, matching light direction and contact shadows, and a 3:2 landscape composition. The environment reference has an A5-like landscape ratio: preserve its proportions without stretching; if needed, extend only unobtrusive background at the edges to fit 3:2. Keep all visitors and the selected figure fully inside the frame with clearly readable faces. Period clothing applies to the historical figure; keep the visitors recognizable in their own clothing.',
    'VINTAGE TREATMENT: Match the supplied environment with warm restrained sepia, soft historical photographic contrast and coherent lighting on people and setting. Retain skin texture, facial detail and recognizable clothing. Do not obscure identity with heavy sepia, grain, scratches, blur, fading or a beauty filter.',
    'No face morphing, plastic skin, gender swap, duplicated faces, extra limbs, cutout edges, collage, added text, captions, borders, logos, or watermarks. Existing museum signage or display artwork may remain part of the environment; never turn it into an additional person.',
    'Before returning the image, check that every human belongs to Reference 1 or is the single selected person from Reference 2. Remove any other person. Facial identity and the closed cast take precedence over decorative scene details.',
  ].join('\n\n')
}
