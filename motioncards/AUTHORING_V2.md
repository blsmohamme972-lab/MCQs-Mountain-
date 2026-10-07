# Kafu MotionCards — scene authoring v2 (compact reference)

Read this file instead of the long docs when you only author scenes. Edit only `work/<batch>/scenes/Q#########.scene.json`. The tooling does selection, hashes and packaging (see `MASTER_PROMPT.md` for the commands).

v2 is opt-in per scene (`"schema_version": 2`). v1 scenes still work unchanged. New scaffolds are v2.

## Loop (do this for every card)

1. Write the scene.
2. `python tools/motioncards.py lint --workspace work/<batch>`: errors name the exact field, e.g. `scene_v2_invalid:layers[3].keys[1].fill:...`.
3. `python tools/motioncards.py render --workspace work/<batch> --out work/<batch>/render`: look at `<QID>_sheet.png` (phone + tablet frames). Fix overlaps, text off-stage, an empty first frame and cramped labels. This needs `pip install playwright`; skip it only if no browser is available.
4. `package`, then `validate`.

## Two ways to draw (mix them freely)

1. **Free mode (SVG + JavaScript): use it for anything professional or precise.** Write normal SVG and normal JavaScript, the way you already know them.
2. **Layers** (declarative JSON below): a shortcut for simple cards: titles, captions, arrows, particles and spotlights in a few lines.

### Free mode

```json
{"schema_version":2,"qid":"Q000000123","duration_ms":9000,"takeaway":"One sentence.",
 "stage":{"width":640,"height":560,"background":"#f4f8f8"},
 "layers":[{"type":"text","text":"Title","x":320,"y":50,"size":28,"weight":800,"max_width":600,"fit":true,"fixed":true}],
 "svg":"<svg><defs>...</defs><path id=\"vessel\" d=\"M ...\" fill=\"@artery\"/>...</svg>",
 "script":"function setup(api){ /* build once */ }\nfunction render(t, api){ /* draw frame at t ms */ }"}
```

- **`svg`:** any SVG markup: gradients, filters, masks, clipPaths, patterns, `<text>`, `<foreignObject>`. Its children are placed on the stage (stage coordinates; the root `<svg>` is only a wrapper). Colours can be `@tokens`. Images use `href="asset:<id>"`. It is checked for well-formed XML; errors report line and column.
- **`script`:** plain JavaScript with full DOM access inside the sandbox.
  - Define `function render(t, api)`, called for every frame with `t` in ms. Optionally define `function setup(api)`, called once before the first frame.
  - **Compute every frame only from `t`** (pure function of time). That keeps pause, seek and replay exact. `render` checks this and fails if a frame depends on the previous one.
  - Precompute in `setup`. Never accumulate state in `render`.
  - `setTimeout`, `setInterval` and `requestAnimationFrame` are inert, because the host owns the clock. `Math.random` is seeded; draw random values in `setup`.
  - The network is blocked: no external images, fonts or scripts. Embed images via `assets`.
  - Inline libraries are allowed if their licence permits it and they can be driven by `t` (seek/progress APIs).
  - The only text forbidden in code is `</script`, `<script` and `<!--`. Write `'<\/script'` if you need it in a string.
- **`api`:**

  | helper | what it does |
  |---|---|
  | `api.$(sel)`, `api.$$(sel)` | query the stage |
  | `api.el(tag, attrs, parent?)` | create an SVG element; strings may be `@tokens` |
  | `api.set(el, attrs)` | set attributes; numbers are rounded, `@tokens` resolved |
  | `api.seg(t, a, b, ease?)` | 0..1 progress between `a` and `b` ms, eased |
  | `api.ease(name, p)`, `api.clamp`, `api.lerp` | easing and maths |
  | `api.mixColor(c1, c2, p)` | colour interpolation |
  | `api.random(seed)` | seeded PRNG function |
  | `api.pointAt(pathEl, f)` | `{x, y, angle, length}` at fraction `f` along a path |
  | `api.asset(id)` | data URI of an asset |
  | `api.color(token)` | resolve a colour token |
  | `api.W`, `api.H`, `api.D`, `api.svg`, `api.hud` | stage width/height, duration, stage `<svg>`, fixed layer group |

- **Precision:** compute geometry from the real relationship instead of eyeballing it (e.g. a dissociation curve from the Hill equation, pressures from a formula). See `examples/v2-free-o2-curve.scene.json`.
- Errors come back with their location, e.g. `script line 12: Unexpected token`, `render(t=4200): api.set: element not found`, or `svg: not well-formed XML at line 3, column 9`.

### Layers scene

```json
{"schema_version":2,"qid":"Q000000123","duration_ms":9000,"takeaway":"One sentence.",
 "stage":{"width":640,"height":560,"background":"#fbfaf7"},
 "palette":{"name":"#hex"}, "gradients":[...], "assets":{...}, "camera":{"keys":[...]},
 "layers":[ ... ]}
```

- Stage default is 640×560, which reads well on phones (about 340×360) and tablets. Coordinates are stage pixels; y grows downward.
- Free-mode `svg` is drawn first (back), then layers in order, then `custom_renderer`. At most 400 layers in total (groups included).
- **The first frame (t=0) must not be empty.** The app shows it before Play.

## Timing model (the important part)

| field | meaning |
|---|---|
| `show: [start,end]` | when the layer exists (default: whole card) |
| `enter` | entrance at `start`: `fade` `pop` `grow` `draw` `type` `slide_up/down/left/right`, or `{"effect":"pop","ms":600,"ease":"back_out"}` (default 450 ms) |
| `exit` | leave at `end`: `fade` `shrink` `slide_*` (only when `end` < duration) |
| `keys` | `[{"t":ms, prop:value, "ease":"..."}]`: absolute ms; holds the first value before and the last value after. `ease` shapes the segment arriving at that key (default `ease_in_out`) |
| `repeat` | `{"every_ms":1200,"from_ms"?,"times"?}`: key `t` values are then inside one cycle (0..every_ms). Use it for heartbeat, pulses, rotation |

Easings: `linear ease_in ease_out ease_in_out sine back_out back_in elastic_out bounce_out step`.

Animatable in `keys`:
- **All layers:** `x` `y` (offset), `scale` `scale_x` `scale_y` `rotate` (around the layer's own centre, or `origin:[x,y]`), `opacity`.
- **Stroked shapes:** `draw` (0..1, line drawing itself), `fill` `stroke` (hex, rgb, hsl or `@token`), `stroke_width`.
- **Geometry:**
  - rect: `width` `height` `rx`
  - circle: `cx` `cy` `r`
  - ellipse: `cx` `cy` `rx` `ry`
  - line/arrow: `x1` `y1` `x2` `y2` (and `bend` for arrows)
  - path: `d` (morph; same commands and number count, no `A` arcs)
  - particles: `speed`
  - spotlight: `cx` `cy` `r` / `x` `y` `width` `height`, `dim`
- **Along a path:** `progress` (0..1), for layers with `along`.
- **Text:** `fill`.

## Layer types

Common fields: `id`, `fixed` (top level only; ignores the camera, use it for titles and captions), `opacity`, `fill`, `stroke`, `stroke_width`, `fill_opacity`, `stroke_opacity`, `dash:[8,6]`, `linecap`, `linejoin`, `shadow` (`true`/`"soft"`/`"strong"`), `glow:"#hex"`, `blur`, `origin`, `along:{"d":"M..","rotate":true}`.

| type | fields |
|---|---|
| `rect` / `highlight` / `focus` | `x y width height rx`. `highlight` is a translucent yellow wash; `focus` is a dashed outline |
| `circle` | `cx cy r` |
| `ellipse` | `cx cy rx ry` |
| `line` | `x1 y1 x2 y2` |
| `arrow` | `x1 y1 x2 y2`, `bend` (curve, px), `head` (`end`/`start`/`both`/`none`), `head_size` |
| `path` | `d` (SVG path) |
| `polygon` / `polyline` | `points:[[x,y],...]` |
| `text` (alias `label`) | `text` (`\n` = new line), `x y` (**y = vertical centre**), `size weight color anchor font` (`sans`/`serif`/`mono`/`rounded`), `italic`, `max_width` (auto wrap), `fit` + `max_lines` (auto shrink), `box:{fill,stroke,pad,rx}` (label pill), `halo` (outline colour for legibility), `letter_spacing`. Arabic is detected automatically |
| `group` | `x y` (offset for children), `layers:[...]`. Children keep their own timing; the group's keys and effects apply to all of them |
| `particles` | `d` (track), `count` (≤200), `r`, `shape` (`dot`/`ring`/`rbc`), `speed` (px/s, can be keyed), `spread` (px across the track), `seed`, `size_jitter`, `phase`, `guide:{stroke,stroke_width,dash,opacity}` (draws the track), `fade_ends` |
| `spotlight` | dims everything except a circle (`cx cy r`) or box (`x y width height rx`); `dim` (default 0.6), `color`. Key the geometry to walk the eye through steps |
| `image` | `asset` (id from `assets`), `x y width height`, `fit` (`contain`/`cover`/`stretch`) |

## Professional illustrations from the internet (import, never paste)

Never paste a downloaded SVG into your reply: one medical illustration is 8k–25k tokens. Import it with the tool. The model then only references it by id.

```bash
# Place a drawing on the stage (box = x,y,width,height in stage px)
python tools/motioncards.py import-svg heart.svg --scene work/b/scenes/Q….scene.json --id heart --box 40,110,300,320 \
  --credit "Heart: Servier Medical Art, CC BY 4.0"
# Reusable symbol for many copies (box = width,height, centred on 0,0), drawn with <use href="#rbc">
python tools/motioncards.py import-svg erythrocyte.svg --scene … --id rbc --template --box 44,44 --credit "…"
```

The tool:
- strips DOCTYPE, metadata, editor junk and event handlers;
- rejects external links;
- scales the art into the box;
- makes every internal id and CSS class unique, so two files can never break each other's gradients;
- rounds coordinates to 2 decimals;
- records the credit, which the card shows small in the corner.

Then animate it from `script`: `api.$('#heart')` (transform, opacity, filters, or parts by id), or `<use href="#rbc">` copies moved along paths.

Sources and licences (checked October 2026; the licence on each individual file always wins):

| Source | Licence | Notes |
|---|---|---|
| **NIH BioArt Source** (bioart.niaid.nih.gov) | Mostly public domain, **set per entry** | Some entries are CC BY, BY-SA, BY-NC or BY-ND. Read each entry's licence |
| **Servier Medical Art** (smart.servier.com) | CC BY 4.0 on the official site | Credit required; the official site gives the wording. Copies mirrored in the `bioicons` GitHub repo (`static/icons/cc-by-3.0/`) carry CC BY 3.0; credit them as such |
| **Reactome Icon Library** | CC BY 4.0 | Credit Reactome (CSHL, OICR, EBI); cells, proteins, organelles |
| **Health Icons** | CC0 | Simple pictograms. The icons are CC0; the site's code is MIT |
| **Bioicons** | Varies per icon (CC0, CC BY, MIT) | The licence is in the folder name |
| **Wikimedia Commons** | Varies per file | CC BY-SA makes the card share-alike too |

Rules:
- **Never use NC (non-commercial) or ND (no-derivatives) material.** Cards are modified, and the app may be paid. `import-svg` refuses a credit containing NC or ND.
- Never use images whose licence you cannot name. Never trace copyrighted textbook figures.
- Write the credit as `"<what>: <author/source>, <licence>"`, e.g. `"Heart: Servier Medical Art, CC BY 4.0"`.

Quality rules:
- Keep one art style per card; do not mix flat icons with detailed illustrations.
- Check anatomical correctness of the chosen drawing against the source question.
- Animate the teaching relationship (flow, change, sequence) on top of the art; do not just show a static picture.
- Move imported art with rigid changes: position, rotation, scale, opacity, colour, `<use>` copies and drawn-on paths. Language models are reliably weak at non-rigid deformation of organic shapes, so **do not morph complex organic outlines**. Swap or cross-fade between two drawings instead (as the sickle example does).

## 3D (possible, rarely worth it)

three.js runs inside a card (tested: WebGL works in the sandbox under the production CSP). It costs about 640 KB per card, because each card is self-contained. It is heavier on phones and offline storage. The `render` determinism check covers SVG, not canvas pixels. Use 3D only when depth is the point (e.g. a spatial relationship), and get the geometry from a trusted model, not invented shapes.

## Colour

Built-in tokens, used as `"@name"`:
- **Interface:** `ink muted paper surface line accent good bad warn highlight info`
- **Anatomy and physiology:** `artery artery_dark vein vein_dark blood plasma nerve myelin muscle tendon bone cartilage fat skin mucosa lymph cell nucleus bile air water oxygen co2`
- **Agents:** `bacteria virus drug enzyme membrane`

Add your own with `"palette":{"name":"#hex"}` and use them as `@name`.

Gradients: `{"id":"g1","kind":"linear","angle":90,"stops":[{"offset":0,"color":"#fff"},{"offset":1,"color":"@surface"}]}` (radial: `cx cy r` from 0 to 1). Use one with `"fill":"url:g1"`. Gradients are static; they cannot be keyed.

## Camera

`"camera":{"keys":[{"t":0,"x":320,"y":280,"zoom":1},{"t":4000,"x":420,"y":300,"zoom":1.4,"ease":"sine"}]}`, where x/y is the point at the centre of the view. Mark titles and captions `"fixed":true` so the zoom does not crop them.

## Assets (real illustrations)

`"assets":{"heart":"data:image/webp;base64,..."}` (PNG, JPEG or WebP). Each asset is at most 600 KB and all assets together at most 1.2M characters. Use it for pre-drawn anatomy art, then animate it with `keys` and overlay arrows, particles and labels on top. Never copy copyrighted artwork.

## Custom renderer (legacy shortcut)

`"custom_renderer":"function renderCustom(layer,t,h){ h.el('circle',{cx:100+t/10,cy:50,r:8,fill:'@accent'}); }"` draws on a top layer that is cleared every frame. Prefer free mode (`svg` + `script`) for new work.

## Quality checklist (what makes a card look good)

- **One idea per card.** Three or four beats at most, each with a short caption, e.g. `"1 · ..."` captions as fixed text with `box` and `enter:"type"`.
- **Stage the eye.** Use one spotlight or camera move per beat. Fade the context instead of deleting it.
- **Motion has easing and purpose.** Use `back_out`/`pop` for appearance, `draw` for pathways, `particles` for flow, and `repeat` for rhythm. Avoid long slow fades: entrances should take 300–700 ms.
- **Text is legible on phones.** Use size ≥ 18 (titles 26–32) with `max_width` + `fit`, and keep it 30 px from the stage edges.
- **Use a consistent colour meaning** (e.g. `@good` for normal or physiological, `@bad` or `@accent` for pathology) and no more than 5 hues.
- **Hold the final state** for the last 1.5–2 s so the takeaway sinks in. The host then shows the Takeaway and the Correct answer.
- **Accuracy beats decoration.** If you are unsure of a fact, simplify the drawing; never invent anatomy.
- **Morph only simple geometry** (a narrowing wall, a curve computed from an equation). For organic shapes, cross-fade between two real drawings.

## Token-saving patterns

- Use `enter` presets instead of keyframes.
- Use `@tokens` instead of hex.
- Use `group` + `x/y` to reuse coordinates.
- Use `repeat` instead of many keys.
- Use `particles` instead of many moving circles.
- Use `max_width` + `fit` instead of hand-tuned font sizes.

Gold examples:
- `examples/v2-free-o2-curve.scene.json`: free mode, computed physiology curve, professional chart styling;
- `examples/v2-imported-art-sickle.scene.json`: imported Servier cells reused with `<use>`, morph from normal to sickle, vaso-occlusion queue computed in `setup`;
- `examples/v2-stenosis-flow.scene.json`: layers; flow, morph, camera, particles;
- `examples/v2-synapse-steps.scene.json`: layers; stepwise mechanism, along-path, spotlight, captions.
