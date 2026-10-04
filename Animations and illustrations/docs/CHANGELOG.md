# Medical Motion library changelog

## 2026-10-04 — Final validation and handoff

- Re-read the live GitHub tree before validation and kept all changes inside `Animations and illustrations/`.
- Parts validation passed: 25 registered parts, deterministic output, transform handling, searchable metadata, exact-count batches and 9 invalid-option cases rejected.
- Core validation passed: 20 templates, 1,036 frame cases, 138 invalid configurations rejected, deterministic output and closure isolation.
- `node scripts/build.mjs` generated the offline studio, 20 independent scene files and the searchable parts gallery.
- XML parsing accepted all 25 generated part SVG documents. JavaScript/MJS syntax checks passed for the engine, templates, tests and build script.
- Browser smoke remains environment-dependent because Python Playwright is not installed in this workspace; rerun it where Playwright and Chromium are available.
- Future expansion gap recorded: the current reusable-part inventory has no explicit `Pathology` or `Physiology` category; add a separately sourced, clinician-reviewed coherent set when that scope is requested.

## 2026-10-04 — Gross anatomy set and exact-count client API

- Added five essential gross-anatomy parts: `pituitary-gland`, `clavicle`, `trachea`, `thyroid-gland` and `brainstem`. They close the requested endocrine, shoulder, airway and neuroanatomy gaps without adding decorative variants.
- Added `MedicalMotionParts.search(query, filters)` for metadata-only lookup and `renderBatch(specs, expectedCount)` / `renderBatchSVG(...)` for deterministic HTML composition with an explicit count check.
- Updated the catalog, README and parts verification to keep renderer metadata, searchability, source links and the exact-count rule synchronized.
- Sources: NCBI Bookshelf and OpenStax/NHLBI references recorded per catalog entry. Simplifications remain stated in each part's `limitations` field; clinician review is still required before clinical teaching deployment.
- Verification target: `node tests/parts_verify.mjs`, `node tests/verify.mjs` and `node scripts/build.mjs`.

## 2026-10-04 — Parts-library foundation

1. Read the repository handoff, MASTER_PROMPT, Mini App design guidance and the existing animation-library instructions.
2. Preserved the library boundary: reusable assets stay inside `Animations and illustrations/`; no Worker, D1, bot, secret or application route was changed.
3. Added `parts/medical-parts.js`, a deterministic SVG component engine with 20 searchable medical parts spanning microbiology, cell biology, molecular biology, histology, anatomy, physiology, immunology, neuroscience, hematology, respiration and surgery.
4. Added `parts/catalog.json` and `parts/schema.json` so a future AI client can search by category, anatomy level, role, keywords and aliases before composing a scene.
5. Added `parts/index.html` as an offline searchable gallery with responsive cards and copyable usage snippets.
6. Added `parts/README.md` and `docs/ADDING_PARTS.md` with the reusable contract, duplicate search rule, gap-based sizing rule and exact verification workflow.
7. Kept the existing 20 complete-scene templates and their corrected direction labels intact. The new parts layer complements those scenes rather than replacing them.
8. Next validation: run `node tests/parts_verify.mjs`, `node tests/verify.mjs` and `node scripts/build.mjs`; browser smoke remains a separate environment-dependent check when Playwright and Chromium are available.

## 2026-10-04 — Complete-scene expansion

- Registered 20 complete medical motion templates with JSON examples, schema IDs, catalog metadata and offline build support.
- Corrected label and path overlap in alveolar exchange, cardiac circulation and saltatory conduction scenes.
- Added Telegram Mini App host guidance in `docs/TELEGRAM_MINI_APP.md`.
