# Adding reusable medical parts

This workflow keeps the library searchable, composable and safe for future HTML video scenes.

## 1. Read the governing files

Read the repository handoff and design rules first:

- root `HANDOFF.md`
- root `tools/MASTER_PROMPT.md` for evidence discipline
- `../AGENTS.md`
- `../parts/README.md`
- `../parts/catalog.json`
- `../parts/schema.json`

The MCQ packaging prompt governs question extraction. It does not authorize copying diagrams or inventing medical claims. Parts use original geometry and source-backed descriptions.

## 2. Search before adding

Search `parts/catalog.json` across:

- `id`, title and aliases
- category: Microbiology, Cell biology, Anatomy, Histology, Physiology, Immunology, Neuroscience, Respiration, Hematology or Surgery
- anatomy level: molecular, cellular, tissue, organ or instrument
- role: cell, organelle, organism, boundary, structure, mechanism or instrument
- keywords and the intended animation mechanism

Reuse an existing part when its mechanism and limitations match. Do not create a duplicate with a new name.

## 3. Decide the addition size

If the request gives a number, add exactly that many new parts. If it gives a domain without a number, identify the smallest coherent set of essential missing parts, normally 5–10 items, and record why each item closes a real catalog gap. Do not pad the set with decorative variants.

A complete addition includes the renderer, metadata, a source and limitation note, catalog entry, gallery visibility and a test case.

## 4. Implement the part

Add one deterministic renderer to a definition module under `parts/definitions/` (the current source module is `parts/definitions/medical.js`; the build concatenates definition modules into the compatible `parts/medical-parts.js` bundle):

- use the 640 × 440 coordinate system and center anchor;
- receive the engine options and helper surface; accept only documented transform and v2 state fields (`theme`, `params`, `state`, `time`, `progress`);
- draw original SVG geometry with escaped text;
- avoid DOM access, network requests, timers, random values, external images, external fonts and CSS animation;
- keep the shape conceptual and state its limitation;
- preserve labels and arrows when colour is unavailable;
- never include doses, treatment recommendations, diagnoses or patient-specific predictions.

Add the same ID and metadata to `parts/catalog.json`. Validate it against `parts/schema.json`.

## 5. Update the searchable surfaces

Update the gallery only when its loader contract changes. The gallery reads the catalog through the registered part metadata, so every new definition must expose the same searchable fields: category, anatomyLevel, role, keywords and aliases.

If the part belongs in a complete explanatory scene, add a separate scene template under `templates/`; do not hide a full scene inside the parts engine.

## 6. Verify and record

Run:

~~~sh
node tests/parts_verify.mjs
node tests/verify.mjs
node scripts/build.mjs
~~~

Inspect at least the default, dark-theme host, portrait and reduced-motion use cases. Confirm that the standalone output has no external requests and that labels remain inside the viewBox.

Add a dated entry to `docs/CHANGELOG.md` with:

- the step completed;
- IDs added or changed;
- sources and known simplifications;
- test commands and their result;
- any unresolved clinician-review item.

### Learn from every visual defect

If QA finds a part escaping its container, changing shape unexpectedly, or failing only at a later animation state, treat it as a contract defect rather than a one-off scene issue. Record **symptom, root cause, correction, prevention rule and regression command** in both the changelog and QA log. Fix the authoritative definition or renderer, rebuild the classic bundle, regenerate affected examples and add a test that samples the risky parameter/time combination. For containers, require closed geometry and an explicit interior fill; for repeated geometry, distribute instances across a fixed bounded span; for flow, verify particle radius and stroke margin against the receiving lumen. A generated HTML edit without a source fix and regression assertion is not complete.

## Standard request for an AI contributor

Use this instruction when delegating future additions:

> Read `Animations and illustrations/AGENTS.md`, `parts/README.md`, `parts/catalog.json` and `docs/ADDING_PARTS.md`. Search for duplicates and identify the smallest coherent missing set for the requested medical domain. Add the requested number, or 5–10 essential parts when no number is specified. For every part add original deterministic SVG geometry, English metadata, authoritative source links, limitations, catalog/schema updates, gallery visibility, tests and a dated changelog entry. Run the verification and build commands. Do not modify the application root, Telegram bot, secrets, infrastructure or medical content.


## Contract v2 and composition checklist

`parts/catalog.json` is the authoritative metadata source. The classic `parts/medical-parts.js` bundle embeds a checked source map so `MedicalMotionParts.discover(id)` remains available when the file is opened directly. Keep geometry registrations separate from registry behavior when adding future modules; the bundle build may concatenate definition modules, but the public entry point must stay compatible.

For every definition declare `version`, `sources`, `limitations`, `bounds`, named `attachments`, `dependencies`, `parameterSchema` and `stateSchema`. Put component-specific values under `options.params`; use `options.theme`, `options.time`, `options.progress` and `options.state` for deterministic frame state. Validate values in the engine and test that each meaningful parameter changes the artwork at more than one time. Test accent recoloring, both themes, transformed bounds and malformed attachment coordinates.

A composed scene is a JSON object with `version: 2`, `components`, `duration`, `format`, `theme`, title and caption. Validate it through `MedicalMotionScene`, render with `MedicalMotionParts.createRenderer(context)`, and export it with the parts engine inlined. Dependencies are explicit and must be present in the scene; the export must contain no `<script src>`, network request or external asset.

The coverage index at `docs/coverage-backlog.json` scores medical usefulness, reuse frequency, combinability and video value. For “add N”, save the starting ID set, search both catalogs and source files for duplicates, implement the highest-scoring nonduplicate gaps, and assert that the set difference is exactly N. A larger `renderBatch` is not evidence of new components.
