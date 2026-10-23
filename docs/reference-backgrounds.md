# Person-free generation backgrounds — 23 October 2026

Created with the built-in `image_gen` tool using the imagegen skill, then encoded
as WebP (quality 92, maximum width 1536) with Sharp. The original DKV assets
are preserved. These files are generation inputs, not the scene-card previews.
Both outputs were visually checked for remaining people before integration.

| Input/edit target | Saved project asset |
| --- | --- |
| `public/assets/scene-previews/membatik.webp` | `public/assets/backgrounds/membatik-empty-v1.webp` |
| `public/assets/scene-previews/gagasan.webp` | `public/assets/backgrounds/gagasan-empty-v1.webp` |

## Batik courtyard prompt

Use case: precise-object-edit. Asset type: person-free background reference for a museum photobooth image compositing pipeline. Edit target: the attached museum batik courtyard photograph. Remove ALL three people completely, including faces, hair, bodies, limbs, clothing worn by them, and every human reflection. Reconstruct only the surfaces and environment occluded by them: woven floor mat, batik cloth, low batik tools, cloth racks, distant vegetation and courtyard architecture. Keep the existing architecture, courtyard green roof beams, red tiled roofs, batik display racks and fabric patterns, surrounding vegetation, wooden batik tools, perspective, warm natural lighting, colors and 3:2 landscape composition as closely as possible. Preserve the recognizable environment; do not redesign it. The result must be a clean photorealistic EMPTY batik activity setting ready for people to be composited later. No people anywhere, no human silhouettes, no portraits or faces, no mannequins, no blur blocks, no bars, no text, no watermark. Return one standalone full-frame empty environment image, not a collage.

## Study room prompt

Use case: precise-object-edit. Asset type: person-free background reference for a museum photobooth image compositing pipeline. Edit target: the attached museum study room photograph. Remove ALL three people completely, including faces, hair, bodies, hands, limbs, and clothing worn by them, plus every human reflection. Reconstruct the portions of the wooden reading table, wooden chairs, room and green-trimmed doors/windows that were occluded. Preserve the existing empty chairs, open books on the table, papers, inkwell, wood grain, white walls, wood ceiling, green frames, hanging lamp, room architecture, camera perspective, warm window lighting, colors and 3:2 landscape composition as closely as possible. Do not redesign the museum environment. The result must be a clean photorealistic EMPTY historical reading room ready for people to be composited later. No people anywhere, no human silhouettes, no portraits or faces, no mannequins, no blur blocks, no text, no watermark. Return one standalone full-frame empty environment image, not a collage.

## Generation contract

`server/generation-prompt.js` is shared by Gemini and both OpenRouter paths.
Reference 1 supplies all visitor identities and count; Reference 2 supplies the
single selected figure; Reference 3 supplies only the empty environment.
Missing references fail rather than substituting a promotional group image.
The optional count is not replaced with a default of one. When absent, the model
must count visible visitors and preserve them all, plus exactly one selected
figure. No automatic face detector or output-count validator is implemented.

Provider request tests validate the selected assets, exact order, and prompt
constraints. They do not prove that a generative model will always comply;
live identity/count checks still need a new real session after deployment.
