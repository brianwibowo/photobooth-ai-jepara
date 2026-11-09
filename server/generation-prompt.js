// The optional body reference depicts the SAME selected person, not another
// member of the cast. Keep numbering shared across all provider transports.
export function generationReferenceLabels(character, scene) {
  const labels = [
    'REFERENCE 1 — VISITOR PHOTO. The only source of visitor identities and count. Preserve every visitor exactly once.',
    `REFERENCE 2 — PRIMARY FACE IDENTITY: ${character.name}. Add this historical person exactly once. This image is the authority for the selected face.`,
  ]
  if (character.bodyReference) labels.push(`REFERENCE 3 — BODY AND CLOTHING OF THE SAME ${character.name} AS REFERENCE 2. A second view of ONE person, not an additional person. Use only for body proportions and period outfit; Reference 2 remains the face authority.`)
  labels.push(`REFERENCE ${labels.length + 1} — SELECTED MUSEUM BACKGROUND. Location ID: ${scene?.backgroundId || 'selected-location'}. Asset ID: ${scene?.backgroundAssetId || 'selected-asset'}. Style: ${scene?.backgroundStyle || 'vintage'}. This exact photograph supplies architecture, furnishings, perspective, lighting and color treatment only. No visitor or historical identity may come from this image. Existing statues, dioramas, reliefs and framed portraits remain INANIMATE museum exhibits; never animate or copy them as living people.`)
  return labels
}

export function buildGenerationPrompt({ scene, character, people }) {
  const environmentReference = character.bodyReference ? 4 : 3
  const backgroundStyle = scene.backgroundStyle || 'vintage'
  const aspectRatio = scene.outputAspectRatio || '16:9'
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
    `PRIORITY 3 — NON-NEGOTIABLE CHARACTER-SPECIFIC CONTEXT: The selected scene is ${scene.id}, background ID ${scene.backgroundId || 'selected-location'}, background asset ${scene.backgroundAssetId || 'selected-asset'}, style ${backgroundStyle}. Reference ${environmentReference} is the SELECTED BACKGROUND PHOTOGRAPH. Place the closed cast only in ${scene.name}, ${scene.location}. The fixed activity is ${scene.activity || 'the selected museum scene'} and the fixed place is ${scene.place || scene.location}. Preserve the existing architecture, ornamentation, exhibit objects, labels and signage, door and window positions, furniture, perspective and light direction of this exact photograph. Do not redesign or replace the museum, move exhibits, invent label text or add unrelated furniture. The image MUST visibly show: ${mustShow}. The image MUST NOT show or substitute: ${mustNotShow}. Existing diorama figures, statues, reliefs and portraits must remain static INANIMATE museum exhibits, never new living cast members. Never fall back to a generic scene from another character. ${scene.prompt || ''}`,
    'Empty space and empty chairs must stay free of extra people. Build a new composition for this cast; do not recreate a promotional group photograph or add stock-photo visitors.',
    `Use realistic documentary photography with a ${aspectRatio} landscape composition matching the wide background reference. Preserve all source proportions without stretching people or buildings. Do not crop visitors at the edges. Keep clearly readable faces, believable anatomy, original glasses, hijab, hair, shoes and other accessories. Keep visitors' own expressions and clothing; period clothing applies only to the historical figure. Place feet on the same floor plane with plausible eye heights, light direction, contact shadows and occlusion behind existing furniture.`,
    backgroundStyle === 'warna'
      ? 'COLOR TREATMENT: Preserve the natural colors of the selected Warna background, including green paint, wood, foliage and original lighting. Match people with gentle white-balance and exposure harmonization only. Retain natural skin tones, clothing colors and facial detail. Do not apply sepia, monochrome, vintage fading, aged paper or heavy color filters.'
      : 'VINTAGE TREATMENT: Match the selected Vintage photograph with restrained warm sepia and soft midtone contrast while retaining subtle natural color, skin texture, recognizable clothing and sharp facial detail. Harmonize people with the supplied lighting, without heavy brown monochrome, grayscale conversion, grain, scratches, blur, vignette or fading.',
    'No face swap or face morphing, beauty filters, changed expressions, plastic skin, gender swap, duplicated people, extra fingers or limbs, cutout seams, collage, white padding, added text, captions, rounded corners, decorative borders, logos, or watermarks. Existing museum signage and display artwork remain unchanged in the environment; never turn them into an additional person.',
    'Before returning the image, check that every human belongs to Reference 1 or is the single selected person from Reference 2. Remove any other person. Facial identity and the closed cast take precedence over decorative scene details.',
  ].join('\n\n')
}
