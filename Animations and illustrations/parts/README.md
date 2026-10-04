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

Use the searchable gallery at `parts/index.html` to inspect the current inventory. The complete addition workflow is documented in `../docs/ADDING_PARTS.md`.
