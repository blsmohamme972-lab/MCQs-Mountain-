# Medical Motion - reusable medical animation templates

A code-only library for future AI agents and authors. Thirty-five original, parameterized SVG mechanisms share one deterministic JavaScript engine. This directory is a **standalone asset library**, not part of the MCQs application runtime. Nothing outside this directory is required or modified.

## Start here

Download this directory with its relative paths intact and open `index.html` in a modern browser. No server, package installation, API key, CDN or internet connection is needed by the runtime. GitHub displays HTML source; it does not execute this studio from the repository page.

Choose a template, change its parameters, scrub the timeline, and export an SVG illustration, PNG image, JSON scene or **single-file animated HTML**. Playback starts only on an explicit click. The studio supports 9:16, 1:1 and 16:9, light/dark palettes and 2-60 second scenes. The default is a 6-second portrait scene.

For one portable studio file, optionally run `node scripts/build.mjs`. It creates `dist/medical-template-studio.html`, thirty-five independent scene HTML files and full metadata. Node is only an optional development/export tool, not a browser requirement. Generated files remain under this directory and are ignored by Git. Checked-in composed examples are regenerated from their JSON sources and carry provenance hashes.

## The thirty-five templates

| ID | Reusable mechanism | Main controls |
| --- | --- | --- |
| `vessel-flow` | Blood movement through a narrowed vessel lumen | narrowing, speed |
| `alveolar-exchange` | Oxygen and carbon dioxide cross in opposite directions | speed |
| `cardiac-circulation` | Body -> right heart -> lungs -> left heart -> body | speed |
| `ecg-cycle` | Synthetic P-QRS-T electrical sequence | bpm, visual gain |
| `saltatory-conduction` | Successive nodal activation along a myelinated axon | myelin opacity |
| `chemical-synapse` | Vesicle release, cleft transit and receptor binding | particle count |
| `nephron-exchange` | Filtration, reabsorption and secretion directions | speed |
| `membrane-transport` | Facilitated diffusion or generic primary active transport | passive/active, speed |
| `leukocyte-recruitment` | Rolling, adhesion, exit and tissue-directed movement | cell size |
| `wound-healing` | Overlapping repair phases and tissue remodeling | initial visual wound width |
| `bacterial-morphology` | Cocci, bacilli and spirilla shape language | selected morphology |
| `cell-cycle` | G1, S, G2 and M phase order | presentation speed |
| `epithelial-barrier` | Epithelial cells, junctions and routes | junction integrity |
| `sarcomere-sliding-filament` | Actin and myosin overlap | visual overlap |
| `action-potential` | Resting, depolarization, repolarization and refractory phases | presentation speed |
| `endocrine-negative-feedback` | Generic hormone-axis feedback loop | feedback strength |
| `coagulation-fibrin` | Injury, thrombin and fibrin mesh sequence | visual activation |
| `acid-base-buffer` | Carbonic-acid and bicarbonate buffer relationship | qualitative CO2 state |
| `antibody-neutralization` | Matching antigen recognition and blocking | visual binding |
| `apoptosis` | Cell shrinkage, condensation and apoptotic bodies | visual progression |
| `phagocytosis` | Large-particle engulfment by a cell | progress |
| `dna-replication` | Replication fork and complementary strands | progress |
| `transcription` | DNA template to growing RNA | progress |
| `translation` | Ribosome movement and polypeptide growth | progress |
| `enzyme-inhibition` | Competitive or allosteric binding | mode, progress |
| `osmosis` | Water across a semipermeable membrane | gradient |
| `oxidative-phosphorylation` | Proton flow through ATP synthase | progress |
| `peristalsis` | Contraction wave moving a bolus | speed |
| `bile-emulsification` | Fat globule dispersion by bile salts | progress |
| `lymphatic-drainage` | Tissue fluid to lymphatic to venous return | progress |
| `venous-valves` | Valve opening and backflow prevention | progress |
| `bone-remodeling` | Osteoclast resorption and osteoblast deposition | progress |
| `fracture-repair` | Hematoma, callus, union and remodeling | progress |
| `capillary-filtration` | Outward filtration and inward reabsorption | progress |
| `second-messenger` | Receptor relay and intracellular amplification | progress |

All controls except the ECG cursor's cycles-per-minute setting are presentation parameters, not measured physiology. Even that ECG is uncalibrated and is not a patient rhythm. Read each template's `limitations` and `sources` before reusing it medically. The illustrations are conceptual; they have not been clinically validated.

## Organization

- `AGENTS.md`: required workflow, renderer contract, clinical safeguards and extension rules.
- `library.manifest.json`: the authoritative template/part inventory, selection metadata, attachments, dependencies, sources, limitations and coverage fields.
- `catalog.json`: a checked template metadata derivative for compatibility.
- `core/medical-motion.js`: validation, geometry helpers, frame layout, playback and standalone export.
- `templates/`: thirty-five independently loadable complete-scene renderers, each with defaults, parameter descriptors and references.
- `parts/`: thirty-seven versioned reusable SVG components with searchable metadata for future scene composition.
- `parts/index.html`: offline searchable gallery for the reusable parts.
- `parts/catalog.json`: machine-searchable IDs, categories, anatomy levels, roles, aliases, sources and limitations.
- `examples/`: one complete, importable scene JSON per template.
- `scene.schema.json`: common scene-envelope schema; template-specific validation is enforced by the engine.
- `docs/`: medical-source notes, Telegram Mini App integration rules and the test report.
- `scripts/` and `tests/`: deterministic build, inventory, geometry/layout and visual regression commands.

## Minimal reuse

Load the core and only the required template as ordinary scripts. There are no ES modules or runtime `fetch()` calls, so relative script loading does not require a local server.

```html
<div id="scene"></div>
<script src="core/medical-motion.js"></script>
<script src="templates/02-alveolar-exchange.js"></script>
<script>
  const config = MedicalMotion.defaultConfig('alveolar-exchange');
  config.title = 'Gas exchange at the alveolus';
  const player = MedicalMotion.create(document.getElementById('scene'), config);
  player.seek(3); // a deterministic static frame, in seconds
  // Connect player.play() to your own explicit user action.
</script>
```

`MedicalMotion.validate(config)` returns a fully defaulted configuration or throws before rendering. `params` and `labels` may be partial; unknown keys are rejected. The JSON schema validates the common envelope only: **passing the schema alone is not enough**. Run the engine validator after schema validation.

API: `list()`, `get(id)`, `defaultConfig(id)`, `validate(config)`, `renderSVG(config, seconds, {diagramOnly:true})`, `create(element, config, {onframe})`, and `standalone(config)`.

Player API: `play()`, `pause()`, `seek(seconds)`, `update(config)`, `exportSVG()`, `exportJSON()`, `state` and `destroy()`. Destroy a player before removing its host element. Each instance owns its clock; two instances do not share animation state. Playback pauses when its document is hidden and stops at the end instead of looping indefinitely.

`renderSVG` includes the frame by default. `diagramOnly:true` exports just the 640 x 440 medical artwork. Time is clamped to the scene bounds. `standalone(config)` returns an HTML string containing only the core and the selected renderer, with controls and no external assets. Exported SVG/PNG represent the selected frame; exported HTML is interactive animation, **not an MP4/video file**.

## Authoring notes

Titles, subtitles, captions and the declared labels are editable through the JSON editor. Keep anatomical labels short. Wrapping is bounded; overly long text can be ellipsized. Review every customized scene at its intended mobile width and aspect ratio. English defaults are provided; automatic translation and right-to-left layout are not implemented.

Artwork and animation are generated by JavaScript and SVG geometry. Source sites are references for physiology, not image assets. This addition does not grant a separate license or change the repository's licensing. No third-party artwork or font files are included.

## Verify

```sh
node tests/verify.mjs
node scripts/build.mjs
node scripts/build.mjs --check
node tests/library_verify.mjs
node tests/layout_verify.mjs
node tests/visual_regression.mjs
python tests/browser_smoke.py
```

The last command is optional and requires Python Playwright plus Chromium. Set `CHROMIUM_PATH` when necessary. See `docs/QA.md` for what was actually tested and what remains device-dependent.


## Reusable parts

Use the parts catalog when a future scene needs a small visual object rather than a complete explanatory mechanism. Search by category, anatomy level, role, keyword or alias before adding anything. The part engine returns deterministic SVG fragments that can be placed, scaled, rotated, recoloured and animated by a host scene. Contract v2 exposes sources, limitations, bounds, attachments, dependencies and validated component parameters at runtime. `docs/ADDING_PARTS.md` defines the step-by-step addition workflow and the rule for choosing the smallest coherent missing set.

### Exact-count part batches

`parts/medical-parts.js` also exposes `search(query, filters)`, `discover(id)`, `createRenderer(context)`, `renderBatch(specs, expectedCount)` and `renderBatchSVG(specs, expectedCount)`. Composed scenes under `examples/composed/` export offline HTML with playback controls. The batch API is the handoff for future HTML video builders: when a request names a count, pass that count and the renderer rejects a mismatch before the scene is assembled.

## Telegram Mini App readiness

The library remains a dependency-free asset store. Use `docs/TELEGRAM_MINI_APP.md` when embedding a selected standalone scene in a Telegram Mini App; keep bot-side validation of `Telegram.WebApp.initData` on the server and apply Telegram theme and safe-area variables in the host shell. Do not add Telegram runtime code to the reusable templates themselves.



## Composed examples

The maintained `examples/composed/` set demonstrates real part reuse: vessel narrowing with path-based blood flow, clot formation with platelets and fibrin, and wound repair with layered tissue, macrophages and fibroblasts. Each JSON source has a checked-in standalone HTML export with Play, Pause, Seek and Replay controls; the exports inline the parts engine and work without network access.
