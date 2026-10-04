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

Add one deterministic renderer to `parts/medical-parts.js`:

- use the 640 × 440 coordinate system and center anchor;
- accept only the documented options: x, y, scale, rotation, opacity and accent;
- draw original SVG geometry with escaped text;
- avoid DOM access, network requests, timers, random values, external images, external fonts and CSS animation;
- keep the shape conceptual and state its limitation;
- preserve labels and arrows when colour is unavailable;
- never include doses, treatment recommendations, diagnoses or patient-specific predictions.

Add the same ID and metadata to `parts/catalog.json`. Validate it against `parts/schema.json`.

## 5. Update the searchable surfaces

Update the gallery only when its loader contract changes. The gallery reads the catalog through the registered part metadata, so every new renderer must expose the same searchable fields: category, anatomyLevel, role, keywords and aliases.

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

## Standard request for an AI contributor

Use this instruction when delegating future additions:

> Read `Animations and illustrations/AGENTS.md`, `parts/README.md`, `parts/catalog.json` and `docs/ADDING_PARTS.md`. Search for duplicates and identify the smallest coherent missing set for the requested medical domain. Add the requested number, or 5–10 essential parts when no number is specified. For every part add original deterministic SVG geometry, English metadata, authoritative source links, limitations, catalog/schema updates, gallery visibility, tests and a dated changelog entry. Run the verification and build commands. Do not modify the application root, Telegram bot, secrets, infrastructure or medical content.
