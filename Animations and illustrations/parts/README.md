# Reusable medical parts

This folder stores small, composable medical SVG parts for future HTML video and animation scenes. It is separate from the complete-scene templates in `../templates/`.

## Contract

- Load `medical-parts.js` as a classic script. It exposes `MedicalMotionParts`.
- Search `catalog.json` by `id`, title, description, category, anatomy level, role, keywords and aliases.
- Call `MedicalMotionParts.render(partId, options)` to receive an SVG fragment, or `renderSVG(partId, options)` for a reviewable 640 × 440 document.
- The default anchor is `x:320, y:220`. Use `x`, `y`, `scale`, `rotation`, `opacity` and a palette `accent`.
- Geometry is conceptual and deterministic. Every part has sources and limitations; these metadata fields travel with the catalog entry.

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

Use the searchable gallery at `parts/index.html` to inspect the current inventory. The complete addition workflow is documented in `../docs/ADDING_PARTS.md`.
