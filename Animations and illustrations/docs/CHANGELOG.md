
## 2026-10-04 — Gross anatomy set and exact-count client API

- Added five essential gross-anatomy parts: `pituitary-gland`, `clavicle`, `trachea`, `thyroid-gland` and `brainstem`. They close the requested endocrine, shoulder, airway and neuroanatomy gaps without adding decorative variants.
- Added `MedicalMotionParts.search(query, filters)` for metadata-only lookup and `renderBatch(specs, expectedCount)` / `renderBatchSVG(...)` for deterministic HTML composition with an explicit count check.
- Updated the catalog, README and parts verification to keep renderer metadata, searchability, source links and the exact-count rule synchronized.
- Sources: NCBI Bookshelf and OpenStax/NHLBI references recorded per catalog entry. Simplifications remain stated in each part's `limitations` field; clinician review is still required before clinical teaching deployment.
- Verification target: `node tests/parts_verify.mjs`, `node tests/verify.mjs` and `node scripts/build.mjs`.
# Medical Motion library changelog

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
