# Generation references — November 2026

The active catalog uses five revised characters and nine museum locations,
each available in `vintage` and `warna` styles. Vintage is the default.
The five characters each retain one selected face portrait and one selected body
image; the application does not send every alternative from the supplied set.
All twenty-eight rebuild JPGs are kept under `assets/sources/`, separately from
the optimized files served by the application. Derivatives are built with
`npm run assets:revisions`, without generating or retouching a character's face.
The latest background photographs retain their exhibits and dioramas; the asset
build does not remove statues or regenerate architecture. Canonical source and
production directories replace delivery copies and temporary output dependencies.

Each character's selected source pair is
`assets/sources/characters/{id}/face.jpg` and `body.jpg`. The following original
delivery names record provenance only; they are not paths used by the rebuild:

| Character ID | Original selected face | Original selected body/clothing |
| --- | --- | --- |
| `kartini` | `0_RA Kartini/8.jpg` | `0_RA Kartini/5.jpg` |
| `sosrokartono` | `1_Sosrokartono/4.jpg`, head/shoulder crop x520 y15 w900 h1200 | `1_Sosrokartono/5.jpg` |
| `kardinah` | `2_Kardinah/1.jpg` | `2_Kardinah/2.jpg` |
| `roekmini` | `3_Roekmini/f.jpg` | `3_Roekmini/a.jpg` |
| `sosroningrat` | `4_Sosroningrat/a.jpg` | `4_Sosroningrat/c.jpg` |

The ten production WebPs are integrated into each character's existing folder
under `public/assets/tokoh_pahlawan/`, named `reference-2026-11.webp` and
`body-2026-11.webp`:

| Character ID | Production folder under `public/assets/tokoh_pahlawan/` |
| --- | --- |
| `kartini` | `1_ra kartini` |
| `sosrokartono` | `5_sosrokartono` |
| `kardinah` | `3_kardinah` |
| `roekmini` | `4_roekmini` |
| `sosroningrat` | `6_raden mas adipati ario sosroningrat` |

Face encoding uses WebP quality 94, body encoding quality 90; dimensions fit
within the source without upscaling. Adhiningrat and Soesalit retain the
previous `display.webp` and `reference.webp` in their existing folders and their
identity prompts. The old PNG scenes, reference-photo libraries and replaced
character files have been removed.
The client-selected face portrait is the sole character image sent to the model.
The body image is retained for the selection UI and provenance. Its second
human-bearing input was removed after a duplicate-character report.

Eighteen production background WebPs live in
`public/assets/backgrounds/{vintage,warna}/{id}-2026-11-v2.webp`; their unmodified
JPG sources live in `assets/sources/backgrounds/{vintage,warna}/{id}.jpg`.
All nine Vintage sources are 2752×1536. Warna sources for `gerbang-utama`,
`pendopo`, `ruang-makan-keluarga` and `dapur-1900an` are 1376×768; the other five
are 2752×1536. Encoding uses WebP quality 94 and a maximum width of 1920, without
upscaling, cropping, stretching or changing the source JPGs. Large inputs become
1920×1072; smaller inputs retain 1376×768.

`src/backgrounds.js` is generated deterministically by the asset build. Each
location has a stable `id`, a display name and both style variants. A variant
records its `assetId` (`bg-{id}-{style}-v2`), production URL, actual source
dimensions, production `sha256` and original `sourceSha256`. These hashes identify
the chosen source and encoded file. They do not prove that a generated result
retains background pixels or human identities unchanged.

The eighteen backgrounds, ten revised character images, four unchanged character
files and four logos form the 36-file active production set in `public/assets`.
The old eight-background PNG/WebP set and earlier cleaned teaching room are not
inputs to the current build. The obsolete `assets:previews` command is removed.

All nine locations are used by the current sixteen activities and home artwork:

| Background ID | Activities using this location |
| --- | --- |
| `gerbang-utama` | Kartini greeting; Roekmini portrait |
| `pendopo` | Roekmini conversation; Soesalit dakon |
| `aula-berkolom` | Adhiningrat walking; Roekmini welcoming; Sosroningrat explaining exhibits |
| `ruang-utama` | Sosrokartono examining manuscripts; Sosroningrat portrait |
| `ruang-kartini-mengajar` | Kartini teaching |
| `ruang-keluarga` | Adhiningrat seated conversation; Sosrokartono reading |
| `ruang-makan-keluarga` | Kardinah writing/arranging dishes; Kardinah serving |
| `taman-sari` | Kartini batik |
| `dapur-1900an` | Kardinah cooking |

The existing place screen includes a Vintage/Warna selector. Preview and provider
input resolve from the same location/style variant. The selection survives
refresh and is shown on confirmation and result screens; a new session defaults
to Vintage. Home artwork uses the Vintage variants. Current scene IDs remain
stable for saved sessions even where a displayed location name has changed.

Prompts ask for existing furniture, architecture and exhibit positions to remain
unchanged; they no longer request a replacement room or extra reading table.
Only small activity props, such as a handheld book or dakon board, are requested.
The supplied teaching-room diorama and other statues, reliefs and portraits remain
in the reference photographs as inanimate exhibits. They must not supply living
cast members or become duplicated historical figures. This is a provider
instruction, not a deterministic preservation guarantee.

The source ratio is approximately 1.79:1. Provider requests now use 16:9 to avoid
the previous 3:2 framing pressure. There is no forced crop/stretch to A5
1240×874. PNG master storage preserves the provider output proportions while
limiting width to 1800 without upscaling; exact output dimensions remain
provider-dependent.

## Active provider contract

All three provider paths share the same numbering and labels:

1. Visitor photo: the only source of visitor identities and count.
2. Primary selected-character face: fixed identity, added exactly once.
3. Selected location/style photograph.

This is exactly three images for all seven characters. Body photos are selection
UI/archival assets only. Outfit details outside the primary portrait are described
in text. This removes a second appearance of the same character from the input;
it does not guarantee exact body proportions, outfit motifs, or model compliance.

The primary character and selected background are validated before any provider
call. The UI body image is not a generation dependency. Missing files fail with `REFERENCE_MISSING`; previews and older
portraits are never substituted. Provider image inputs use JPEG quality 92 at
maximum width 1536; the full visitor photo keeps its existing processing.
Vintage prompts request restrained warmth with natural skin and facial detail;
Warna prompts preserve the selected natural colors without sepia or aged-paper
effects. Both preserve the visitors' original expressions, clothes and accessories
by instruction.
The optional visitor count is never defaulted to one.

`POST /api/generate` accepts `backgroundStyle=vintage|warna`, defaulting to Vintage
when omitted. Invalid values produce `400 BACKGROUND_STYLE_INVALID` before a
provider call. Style is included in the request fingerprint, so reusing a
generation ID for a different style conflicts rather than replaying another
variant. SQLite results retain `background_style` and a `manifest_json` snapshot
of the character, scene, background ID/asset ID/hash, requested output ratio and
optional visitor count. A restored result uses that snapshot rather than being
relabeled by a later catalog revision. This stores selected-input provenance;
it records input provenance independently of visual quality. New results use
`single-character-v3`, `generationReferenceAssets`, and a `castValidation` receipt.
`character.bodyAsset` is null because the body file was not sent to the model.

Transport tests compare the actual image bytes, order, labels and missing-asset
behavior for every character and current activity, including legacy IDs.
Browser checks use fake camera/provider results; they establish UI behavior,
not actual generated likeness. Real photos of one, two, three and four visitors
still require manual comparison against camera frames, agreed character faces
and both background styles. Check identities, count, clothing, proportions,
furniture/signage, static dioramas, contact shadows and clipping.

## Imported implementation guidance and current limits

The four supplied DOCX documents are preserved byte-for-byte under
[`docs/asset-guidance`](asset-guidance/README.md), with source hashes. Current
implementation adopts explicit asset/location IDs, revised-character priority,
single primary face input, source provenance, static-exhibit instructions,
natural colors and matching previews. A historical filename is not interpreted
as curator approval; no curator-approval registry has been implemented.

The runtime still sends reference photographs to a generative full-scene edit.
Individual segmentation, alpha masks, deterministic layer compositing, a
deterministic visitor detector or identity scorer, a dedicated
consent/deletion interface and optional paper-edge treatment are not implemented.
Therefore, the stronger guidance requirements of immutable background pixels
and unchanged human pixels are not established. The guidance's fixed A5 size is
also not the current output contract.

Existing privacy behavior remains: gallery thumbnails are public and limited to
eight recent results, while the full PNG uses the short-lived private download
token. The guidance's broader privacy/consent requirements do not change that
behavior automatically. No live identity/count or museum-preservation acceptance
test is claimed by asset hashes, simulated tests, or this documentation.

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
figure. At that time, no automatic face detector or output-count validator was implemented.

Provider request tests validate the selected assets, exact order, and prompt
constraints. They do not prove that a generative model will always comply;
live identity/count checks still need a new real session after deployment.

## Historical first November background revision

The first November package used eight A5-ratio PNG backgrounds and a generated
teaching-room cleanup with statues removed. That set and its cleanup prompt are
superseded by the nine-location paired JPG package above. The current build uses
the supplied diorama photographs intact; it does not recreate the earlier cleanup.

## Closed-cast check (November 13, 2026)

Before any result file, download token, QR, email access, or gallery row is made,
a separate vision request compares the visitor input, single character reference,
selected background, and generated result. It checks source/output visitor count,
exactly one selected historical figure, no duplicated or missing visitor, and no
extra living person. Existing busts, portraits, reliefs, and diorama figures in the
background are museum exhibits and do not count as visitors or historical guests.

The check uses the generation provider's key, with `OPENROUTER_CAST_MODEL`
(default `google/gemini-2.5-flash`) or `GEMINI_CAST_MODEL` (default
`gemini-2.5-flash`). It adds one text/vision API call per successful image response;
there is no automatic generation retry after a rejection. Timeout defaults to
45 seconds (`CAST_VALIDATION_TIMEOUT_MS`). Validation is required for AI output:
uncertain/incorrect cast returns `422 OUTPUT_CAST_REJECTED`; missing credentials,
network failure, timeout, or malformed response returns
`502 OUTPUT_VALIDATION_UNAVAILABLE`. Neither response publishes a result.
The existing request receipt records failure, so replay does not spend on another
generation. The development-only local overlay remains private and unvalidated.

This is a model-based quality check, not deterministic face recognition or a
guarantee of historical likeness. It may miss errors or reject a valid image.
Transport and mock tests prove routing and publication behavior only. Existing
results are not retroactively checked or deleted. A real visual acceptance run
with curator-approved references is still needed after deployment.

Provider contracts: [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs),
[vision model](https://openrouter.ai/google/gemini-2.5-flash),
[Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).
