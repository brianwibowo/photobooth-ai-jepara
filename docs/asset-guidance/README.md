# Supplied photobooth guidance — 9 November 2026

These four original DOCX files were moved from the supplied guidance folder
without modifying their bytes. Their renamed filenames are stable project
paths. The table records their original delivery names and SHA-256 hashes.

| Saved document | Original delivery filename | SHA-256 |
| --- | --- | --- |
| [01-implementation.docx](01-implementation.docx) | `01_SKILL_Photobooth_Kartini__Alur_dan_Aturan_Implementasi.docx` | `8b0985ace4e91ad38a21a01a5068e8ec1291fccfa7d66fb077181fd4bb771189` |
| [02-prompts.docx](02-prompts.docx) | `02_PROMPT_Photobooth__Template_dan_Prompt_Per_Tahap.docx` | `986662e9e43cc1a9b1955350d6062be7c04af2463842255dbaad6d25eabf8bb8` |
| [03-asset-manifest.docx](03-asset-manifest.docx) | `03_MANIFEST_Aset__Lokasi_Prioritas_Revisi_dan_ID.docx` | `7141017ce22bc74f9982a5b3bd9669f852300256386487996bb178827b3e7933` |
| [04-acceptance-tests.docx](04-acceptance-tests.docx) | `04_QA_Acceptance_Test__Skenario_1_sampai_4_Pengunjung.docx` | `b68d7aba420c7b9fe37b462ae9f69a6d9bc5a0ae10fda0310ccdc2f4586f4c09` |

The documents specify a broader target pipeline than the current application.
Current code integrates five selected revised character face/body pairs, keeps
the other two character references, and provides nine locations in Vintage and
Warna variants. Asset IDs, dimensions and source/production hashes are recorded
in `src/backgrounds.js`. Original source JPGs are retained under
`assets/sources/`; production WebPs live in the existing public character and
background directories.

The implemented generation path remains a full-scene generative edit using
reference images. It does not yet implement segmentation, alpha masks,
deterministic compositing, automatic visitor-count detection, curator approval,
a dedicated consent/deletion interface, or paper-edge effects. It requests
16:9 output for the latest wide background photographs; the documents' fixed
A5 1240×874 output is not enforced. Existing gallery thumbnails remain public.

File hashes establish source provenance. They do not establish preservation of
background pixels or human identities in generated results. Real photos with
one through four visitors still need manual acceptance review; the DOCX test
scenarios are specifications, not evidence of completed live tests.

See [current asset routing and provider limits](../reference-backgrounds.md)
and [QA report](../../QA_REPORT.md) for the implemented contract and validation
status. Historical names in the documents do not reintroduce dependencies on
removed delivery folders or mark an asset curator-approved.
