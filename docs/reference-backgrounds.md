# Generation references — November 2026

The active catalog uses the client-supplied `0_Revisi` portraits and vintage
locations. The retained source set contains the ten selected portrait JPGs
listed below and seven original background PNGs in `0_Revisi`, plus the cleaned
teaching-room PNG and its editing prompt in `output/revision-assets/`.
Derivatives are built with `npm run assets:revisions`, without generating or
retouching any character's face. Unused portrait alternatives, the original
teaching-room image containing statues, and obsolete production assets have
been removed.

| Character | Face source in `0_Revisi` | Body/clothing source |
| --- | --- | --- |
| Kartini | `0_RA Kartini/8.jpg` | `0_RA Kartini/5.jpg` |
| Sosrokartono | `1_Sosrokartono/4.jpg`, head/shoulder crop x520 y15 w900 h1200 | `1_Sosrokartono/5.jpg` |
| Kardinah | `2_Kardinah/1.jpg` | `2_Kardinah/2.jpg` |
| Roekmini | `3_Roekmini/f.jpg` | `3_Roekmini/a.jpg` |
| Sosroningrat | `4_Sosroningrat/a.jpg` | `4_Sosroningrat/c.jpg` |

These ten production WebPs live in `public/assets/revisions-2026-11/characters/`
as `{id}-face.webp` and `{id}-body.webp`. Face encoding uses WebP quality 94,
body encoding quality 90; dimensions fit within the source without upscaling.
Adhiningrat and Soesalit keep their previous image/reference files and identity
prompts. Their two `display.webp` and two `reference.webp` files are the only
remaining assets under `public/assets/tokoh_pahlawan/`; the old PNG scenes,
reference-photo libraries and five replaced character sets have been removed.
The client-selected face portrait is the identity authority; the body image
supplies proportions and clothing, not another face to average in.

Eight background WebPs live in `public/assets/revisions-2026-11/backgrounds/`.
Seven retain their source 1240×874 dimensions. The teaching-room cleanup retains
its generated 1494×1053 dimensions. Encoding/resizing preserves aspect ratios;
the output prompt requests 3:2 with small edge extensions, never stretching.
Together with the ten new character images, four unchanged character files
and four logos, these form the 26-file active production set in `public/assets`.
The old `backgrounds` and `scene-previews` directories and the obsolete
`assets:previews` build command have been removed.

| Activity | Background |
| --- | --- |
| Kartini greeting | `05-gerbang-utama.webp` |
| Kartini batik | `04-taman-sari.webp` |
| Kartini teaching | `07-ruang-mengajar-empty.webp` |
| Adhiningrat sitting/walking, Roekmini entrance/terrace | `03-teras-museum.webp` |
| Kardinah writing/serving | `08-ruang-makan.webp` |
| Kardinah cooking | `06-dapur-1900an.webp` |
| Sosrokartono reading/manuscripts, Sosroningrat gallery | `01-ruang-utama.webp` |
| Soesalit dakon | `02-pendopo.webp` |

Activity props absent from a location, such as a small batik setup or reading
table, are requested explicitly without replacing the supplied architecture.
Door/terrace/pendopo descriptions match the new images. Scene cards and the
home artwork use the same vintage locations; old group-example faces no longer
appear in the selection UI. Stable scene IDs are preserved for saved sessions.

## Teaching-room cleanup

The supplied `07_Ruang_Kartini_Mengajar_A5_Vintage.png` contained a teacher and
seated pupil statues. Built-in `image_gen` removed the three-dimensional human
figures and the framed human photos while retaining the blackboard, empty mat,
glass barrier, windows, lamp and room architecture. The output was visually
checked for remaining figures before integration. The statue-filled original
was then removed; rebuild uses only the approved clean source.

The generated source is saved at
`output/revision-assets/07-ruang-mengajar-empty.png`; the exact editing prompt is
in its sibling `07-ruang-mengajar-empty.prompt.txt`. Rebuild refuses a missing
clean source rather than substituting the original statue scene. Museum reliefs
in the main gallery remain display artwork and must never become living people.

## Active provider contract

All three provider paths share the same numbering and labels:

1. Visitor photo: the only source of visitor identities and count.
2. Primary selected-character face: fixed identity, added exactly once.
3. Optional full-body image of that same character (five revised characters).
4. Vintage environment; this is Reference 3 when there is no body image.

Every required asset is validated before any provider call, including the body
reference. Missing files fail with `REFERENCE_MISSING`; previews and older
portraits are never substituted. Provider image inputs use JPEG quality 92 at
maximum width 1024; the full visitor photo keeps its existing processing.
Warm vintage grading must retain clear faces, skin texture and clothing.
The optional visitor count is never defaulted to one.

Transport tests compare the actual image bytes, order, labels and missing-asset
behavior for every character and current activity, including legacy IDs.
Browser checks use fake camera/provider results; they establish UI behavior,
not actual generated likeness. No face detector, identity scorer or automatic
output-count validator is implemented. A real output comparison with the same
visitor photo is still needed to assess likeness after deployment.

The existing model/provider settings are unchanged. Multi-reference request
format follows the [OpenRouter Image API](https://openrouter.ai/blog/tutorials/image-generation/)
and [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)
documentation; reference limits remain model/provider dependent.

## Historical background edits — 23 October 2026

This section records the previous implementation. The files named below,
their old source library and the old preview-building script have been removed
after the November revision; they are not current rebuild inputs.

These earlier backgrounds were created with the built-in `image_gen` tool using
the imagegen skill, then encoded as WebP (quality 92, maximum width 1536) with
Sharp. Both outputs were visually checked for remaining people at that time.

| Historical input/edit target (removed) | Historical output (removed) |
| --- | --- |
| `public/assets/scene-previews/membatik.webp` | `public/assets/backgrounds/membatik-empty-v1.webp` |
| `public/assets/scene-previews/gagasan.webp` | `public/assets/backgrounds/gagasan-empty-v1.webp` |

### Historical batik courtyard prompt

Use case: precise-object-edit. Asset type: person-free background reference for a museum photobooth image compositing pipeline. Edit target: the attached museum batik courtyard photograph. Remove ALL three people completely, including faces, hair, bodies, limbs, clothing worn by them, and every human reflection. Reconstruct only the surfaces and environment occluded by them: woven floor mat, batik cloth, low batik tools, cloth racks, distant vegetation and courtyard architecture. Keep the existing architecture, courtyard green roof beams, red tiled roofs, batik display racks and fabric patterns, surrounding vegetation, wooden batik tools, perspective, warm natural lighting, colors and 3:2 landscape composition as closely as possible. Preserve the recognizable environment; do not redesign it. The result must be a clean photorealistic EMPTY batik activity setting ready for people to be composited later. No people anywhere, no human silhouettes, no portraits or faces, no mannequins, no blur blocks, no bars, no text, no watermark. Return one standalone full-frame empty environment image, not a collage.

### Historical study room prompt

Use case: precise-object-edit. Asset type: person-free background reference for a museum photobooth image compositing pipeline. Edit target: the attached museum study room photograph. Remove ALL three people completely, including faces, hair, bodies, hands, limbs, and clothing worn by them, plus every human reflection. Reconstruct the portions of the wooden reading table, wooden chairs, room and green-trimmed doors/windows that were occluded. Preserve the existing empty chairs, open books on the table, papers, inkwell, wood grain, white walls, wood ceiling, green frames, hanging lamp, room architecture, camera perspective, warm window lighting, colors and 3:2 landscape composition as closely as possible. Do not redesign the museum environment. The result must be a clean photorealistic EMPTY historical reading room ready for people to be composited later. No people anywhere, no human silhouettes, no portraits or faces, no mannequins, no blur blocks, no text, no watermark. Return one standalone full-frame empty environment image, not a collage.

### Historical generation contract

`server/generation-prompt.js` is shared by Gemini and both OpenRouter paths.
Before the November revision, Reference 1 supplied visitor identities and count; Reference 2 supplied the
single selected figure; Reference 3 supplied only the empty environment.
Missing references fail rather than substituting a promotional group image.
The optional count is not replaced with a default of one. When absent, the model
must count visible visitors and preserve them all, plus exactly one selected
figure. No automatic face detector or output-count validator is implemented.

Provider request tests validate the selected assets, exact order, and prompt
constraints. They do not prove that a generative model will always comply;
live identity/count checks still need a new real session after deployment.
