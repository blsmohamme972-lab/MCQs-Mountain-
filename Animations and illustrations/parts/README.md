# Reusable medical parts (contract v2)

This folder stores small, composable medical SVG parts for future HTML video and animation scenes. It is separate from the complete-scene templates in `../templates/`.

## Contract

- Load `medical-parts.js` as a classic script. It exposes `MedicalMotionParts` v2. The file remains a compatible offline entry point for all v1 calls.
- Search `catalog.json` by `id`, title, description, category, anatomy level, role, keywords and aliases.
- Call `MedicalMotionParts.render(partId, options)` to receive an SVG fragment, or `renderSVG(partId, options)` for a reviewable 640 × 440 document. New optional fields (`theme`, `params`, `state`, `time`, and `progress`) are validated; old transform-only options continue to work.
- The default anchor is `x:320, y:220`. Use `x`, `y`, `scale`, `rotation`, `opacity` and a palette `accent`.
- Geometry is conceptual and deterministic. Every part has sources and limitations; these metadata fields travel with the catalog entry.
- `discover(id)` exposes version, sources, limitations, named `attachments`, local `bounds`, explicit `dependencies`, `parameterSchema` and `stateSchema` at runtime. `catalog.json` is the authoritative metadata source and the verification test checks agreement with the embedded offline map.
- `createRenderer(context)` returns a renderer whose context is explicit. The composed-scene renderer in `scene-renderer.js` uses it rather than hidden closures.

## Component contract

Each component is versioned and centered on the local `0 0 640 440` viewBox. Component-specific values live under `options.params`; deterministic animation is supplied through `options.time`, `options.progress` and `options.state`. Attachment-aware components read named points from `options.state.attachments`. Bounds are metadata for layout checks, not a promise of clinical scale. `theme: "clinical" | "night"` changes the palette while labels and geometry remain deterministic.

## Example

~~~html
<script src="parts/medical-parts.js"></script>
<div id="scene"></div>
<script>
  const fragment = MedicalMotionParts.render('red-blood-cell', {
    x: 300,
    y: 220,
    scale: 0.7,
    accent: 'red'
  });
  document.getElementById('scene').innerHTML =
    '<svg viewBox="0 0 640 440" role="img" aria-label="Red blood cell">' +
    fragment + '</svg>';
</script>
~~~

## Search and exact-count batches

The part engine exposes a small client contract for future HTML scene builders:

```js
const matches = MedicalMotionParts.search('pituitary gland', {anatomyLevel: 'organ'});
const requestedCount = 3;
const specs = [
  {id: 'pituitary-gland', options: {x: 180, y: 220, scale: .55}},
  {id: 'clavicle', options: {x: 320, y: 220, scale: .45, rotation: -8}},
  {id: 'trachea', options: {x: 480, y: 220, scale: .45}}
];
const fragment = MedicalMotionParts.renderBatch(specs, requestedCount);
const review = MedicalMotionParts.renderBatchSVG(specs, requestedCount);
```

`search(query, filters)` searches the same metadata fields used by the gallery and returns metadata only. Supported filters are `category`, `anatomyLevel` and `role`. `renderBatch(specs, expectedCount)` preserves each item's documented placement options and throws if the explicit count does not match the batch length. This makes a request such as “create exactly 3 parts” machine-checkable before any HTML scene is built. `renderBatchSVG` is a reviewable document; `renderBatch` is the fragment intended for insertion into a host SVG.

When adding new IDs, update the renderer and catalog together. Use original deterministic geometry, source-backed descriptions and explicit limitations. A part is a reusable visual component, not a clinical simulator.

## Geometry failure-prevention record

Past composition review found two reusable failure modes: open vessel wall strokes were mistaken for a lumen boundary, and fibrin strands grew past the component's declared bounds at high density. The maintained correction is a closed outer/inner vessel ribbon, a fixed-span mesh layout and a centered clot example. Future parts must follow the same learning loop:

| Check | Required evidence |
|---|---|
| Closed container | The SVG contains a closed interior boundary and an explicit fill for the usable region. |
| Bounds over state | Geometry stays within `bounds` at default, minimum and maximum parameters and at 0/middle/end time. |
| Composition margin | Particle radius and stroke width fit inside the target lumen or attachment region. |
| Source-first repair | The definition/renderer is corrected before regenerating `medical-parts.js` and examples. |
| Regression record | `docs/CHANGELOG.md` and `docs/QA.md` state symptom, cause, correction, prevention and test. |

Do not close a visual bug by moving only one generated instance. If the same geometry could be composed again, fix its authoritative definition and add a reusable assertion in `tests/parts_verify.mjs`.

## Composed offline scenes

`scene-renderer.js` validates a version-2 scene, supplies each part with `{scene,time,progress}` and exports a single HTML document with Play, Pause, Seek and Replay controls. `scripts/build.mjs` creates the three maintained examples under `dist/composed/`; the checked-in JSON examples are the source inputs. The export inlines `medical-parts.js`, so it has no runtime fetches, hidden globals or external assets.

Search `catalog.json` and the scene source before adding anything. For an explicit “add N” request, compare the starting ID set with the final ID set and verify the difference is exactly N; `renderBatch` instance counts do not establish component novelty.

Use the searchable gallery at `parts/index.html` to inspect the current inventory. The complete addition workflow is documented in `../docs/ADDING_PARTS.md`.
