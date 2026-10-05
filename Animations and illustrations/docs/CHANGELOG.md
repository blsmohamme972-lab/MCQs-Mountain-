## 2026-10-05 — Fifteen reusable mechanism templates

- Added templates 21–35 for phagocytosis, DNA replication, transcription, translation, enzyme inhibition, osmosis, oxidative phosphorylation, peristalsis, bile emulsification, lymphatic drainage, venous valves, bone remodeling, fracture repair, capillary filtration and second-messenger signaling.
- Added one validated example scene and catalog metadata per template.
- Updated the offline studio, common schema, build and verification counts to 35.

# Medical Motion library changelog

## 2026-10-04 — Ten-template visual refinement and alveolar cluster rebuild

- Reworked templates `01`–`10` with original deterministic SVG geometry: layered vessel narrowing, a ten-space alveolar cluster with a capillary mesh, a chambered heart circuit, a clearer ECG grid, segmented myelin, a synapse with receptor gates, a glomerulus and nephron loop, a phospholipid membrane, a lobed leukocyte and layered wound repair.
- Rebuilt the reusable `alveolus` part as a cluster of exactly ten individually shaped air spaces, with septal highlights, capillary loops and red-cell detail. Added `data-structure="alveolar-space"` markers and verification assertions so the requested count cannot silently drift.
- Preserved the source-backed directions: oxygen travels from alveolar air to capillary blood and carbon dioxide travels back to the air space. The ten shapes are enlarged teaching geometry, not histology or a scale model.
- Verification passed: `node tests/parts_verify.mjs`, `node tests/verify.mjs`, `node scripts/build.mjs`; all ten diagram-only SVGs were rasterized locally with Inkscape and parsed as XML. Browser smoke was not run because Chromium/Playwright is unavailable in this workspace.

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


## 2026-10-04 — Alveolus shape refinement

- Reworked `templates/02-alveolar-exchange.js` from a perfect-circle air space into a lobulated alveolar sac with a separated exchange interface, capillary band, readable O₂/CO₂ labels and non-overlapping direction arrows.
- Updated the reusable `parts/medical-parts.js` `alveolus` component and its catalog metadata so future clients receive the same improved shape.
- Generated and visually reviewed diagram-only and portrait SVG/PNG previews. Local SVG rendering, PNG rasterization, JavaScript syntax checks and XML parsing passed.



## 2026-10-05 — Composition contract and mechanism animation repair

- Repaired mechanism-level time changes in `coagulation-fibrin`, `enzyme-inhibition` and `venous-valves`; the clock now drives artwork while manual progress remains the selected endpoint. All advertised templates were checked at 0, 50 and 100% of duration.
- Fixed accent recoloring for legacy parts and corrected malformed synapse coordinate concatenation. Corrected the coccus limitation metadata so it no longer claims gas-exchange constraints.
- Versioned the reusable-parts contract to v2 with validated component parameters, themes, named attachments, local bounds, explicit dependencies, state metadata, runtime discovery and an explicit renderer context. The compatible `medical-parts.js` entry point remains available.
- Added configurable vessel segments, path-based blood flow, attachment arrows and labels, platelets, fibrin mesh, layered tissue, fibroblasts, macrophages, plaque overlay, heart and nephron parts. Edema and necrosis remain backlog candidates.
- Added three composed scene JSON examples and offline HTML export support with Play, Pause, Seek and Replay controls.
- Added the scored coverage/backlog index and exact-N novelty workflow.
