# CHANGELOG

## Unreleased

### MotionCards trusted library improvement
- Added `motioncards.py library-check` (`motioncards/lib/library_gate.py`) and the `MotionCards library auto-merge` workflow. A PR from a `library/…` branch by the repository owner merges automatically only when it is purely additive inside `motioncards/library/` and the MotionCards tests pass. Each new drawing must have a safe licence, a source, a reason and the QIDs that use it, and must import, validate, render and not duplicate existing art. Each new recipe needs a demo that renders deterministically. Everything else is left for the owner.

### MotionCards publisher retention
- Each card now keeps its active version plus its 2 most recent previous versions; a removed card keeps 3. Older versions leave the restore history, and their entry files are deleted from the published site after the new state is saved. A failed publish deletes nothing, and files of other live cards are never touched. This keeps the Worker's static-asset file count at no more than 3 files per card. Restoring a version older than those kept now fails with `motioncards_restore_target_missing`, and the live card stays as it was.

### MotionCards art library and style kit
- Added `motioncards/library/recipes.js` and `motioncards.py recipes`: tested, seekable animation building blocks (flow, impulses, pulsatile bleeding, drip, growing lumps, ulcers, glow, travelling sac, see-through art, tubes, callouts) injected into the scene script. No runtime change; the 9342 and 9343 cards needed less than half the code with the same result. `lint` warns if the `R.grid` layout aid is left in.
- Added `motioncards/library/`: 14 licence-checked Servier Medical Art illustrations (CC BY 3.0) of the thorax and upper GI tract, usable offline via `import-svg lib:<name>`, which adds the credit automatically; `motioncards.py library` lists them.
- `import-svg` now rewrites path data drift-free at an automatic precision (worst-case error 0.1 stage px), keeps offsets and widths at 2 decimals, and shortens colours. Library art is 21% smaller with no visible change (at most 0.43% of pixels differ, all edge anti-aliasing); the thorax card's entry dropped from 187 KB to 153 KB.
- Added `motioncards.py style-kit`: shared SVG shading filters and organ gradients (`kit-volume`, `kit-gloss`, `kit-shadow`, `kit-glow`, `kit-tissue`, `kit-nerve`, ...) inserted into a scene's own SVG. The runtime is unchanged, so previously built ZIPs still validate byte-for-byte.

### MotionCards scene engine v2
- Added opt-in schema v2 scenes:
  - easing, keyframes, and visibility separate from motion;
  - enter/exit presets and pivots on each shape's own centre;
  - path morphing, drawn-on strokes and motion along paths;
  - particles, spotlight and camera;
  - wrapped, auto-fitting text;
  - gradients, shadows and validated raster assets.
- v1 output is byte-identical (golden-hash tested). Protocol, index runtime_version, CSP, app, bot and publisher are unchanged.
- Added `motioncards lint`, plus `motioncards render` (phone/tablet PNG frames and a contact sheet under the production CSP).
- Added the compact `AUTHORING_V2.md` and two gold examples.
- Added v2 free mode (`svg` + `script` with `render(t, api)`, full DOM inside the sandbox) and removed the custom-renderer identifier blacklist. Errors now report their location, determinism is checked on the DOM, and a computed O₂–Hb curve example was added.
- Added `motioncards import-svg` (clean, fit, id-scope and credit third-party SVG art; `--template` for `<use>` symbols), `credits` shown on the card, and the imported-art sickle cell example.
- Research-backed authoring rules:
  - a per-source licence table (NIH BioArt, Servier, Reactome, Health Icons);
  - NC/ND art refused by `import-svg` and flagged by `lint`;
  - lint warning against complex organic path morphs.

### M2 Step 2
- Added synthetic all-types, v2, multipart, and broken fixture generation.
- Added real publishing-path fixture proof through the Publish Kafu Book workflow.
- Added duplicate package state helper.
- Added static catalog takedown helper.
- Added Cloudflare live-catalog polling for deploy/rollback/takedown proof.
- Proved stable permanent IDs across v2 and preserved progress keys.
- Proved multipart publishing.
- Proved broken-package repair_report.md generation.
- Proved live rollback and takedown semantics.
- Fixed Library behavior so an empty published catalog falls back to built-in samples.

### M2 Step 1
- Connected Kafu to the published content Worker.
- Added offline image ZIP extraction/storage/rendering.
- Added scalable permanent-question deep-link routing.
- Added app↔publisher contract tests.
