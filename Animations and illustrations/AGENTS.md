# Agent instructions - Medical Motion library

## Scope

Work only inside `Animations and illustrations/` unless the user separately authorizes application integration. This is a private reusable template store, not an app route. Do not add package dependencies, modify repository-root files, wire an app import, introduce analytics, fetch medical content at runtime, or auto-play motion. Preserve unrelated files and `.gitkeep`.

## Generating an explanation from an existing template

1. Read `catalog.json`; select by mechanism, not just by a disease keyword. Read that template's metadata, sources and limitations. Do not select an approximate template when its arrows would contradict the intended mechanism.
2. Start from `MedicalMotion.defaultConfig(id)` or the matching `examples/<id>.json`. Edit `title`, `subtitle`, `caption`, `duration`, `format`, `theme`, declared `labels` and declared `params`. Never invent parameter names. Each template's `parameterSchema` describes bounds, choices and meaning.
3. Validate with `MedicalMotion.validate(scene)` before rendering. The common JSON schema alone cannot check per-template parameter ranges or label keys. Do not silently coerce invalid types or ignore unknown keys.
4. Prefer a small bundle: the core plus one template. Use `renderSVG(scene,t)` for an illustration, `renderSVG(scene,t,{diagramOnly:true})` for unframed art, or `standalone(scene)` for a complete animated HTML string. Save the actual returned file, not just a description or an empty wrapper.
5. Inspect introduction, middle and final frames; check text, flow directions, overlaps, contrast and both portrait and the requested output ratio. Keep labels concise because bounded wrapping can ellipsize long strings. The default three framing phases are 0-25%, 25-75%, and 75-100% of the configured duration.
6. Report which template and parameters were used, source references, and any simplifications. Never describe an uncalibrated diagram as a clinical simulator or claim that automated tests establish medical accuracy.

A prompt does not get sent to an AI service by this studio. You, the agent, choose and configure the template; the local engine renders your configuration. No API key, backend or model call is embedded.

## Stable public contract

A scene has `version:1`, `templateId`, `title`, `subtitle`, `caption`, `duration` (seconds), `format` (`portrait`, `square`, `landscape`), `theme` (`clinical`, `night`), `params`, and `labels`. Only `templateId` is required for a minimal input; the engine fills defaults. Exported examples contain every field.

`create(host, scene, {onframe})` returns an independent player. `seek(seconds)` is absolute, not a fraction. `update(scene)` validates before replacing the active scene, pauses and resets it. `state.config` is a copy. Call `destroy()` before removing the host or creating a replacement. Use explicit play controls and preserve reduced-motion behavior. Existing static previews remain usable without playing.

Geometry is deterministic at a given configuration and time. `renderSVG` clamps time to [0,duration]. Renderers receive `p` in [0,1] and `t` in seconds. ECG uses `t` for its cursor cadence; the other mechanisms use normalized presentation time. Changing duration is not a claim about physiological timing.

## Adding or extending a renderer

Add one `templates/NN-kebab-id.js` that calls `MedicalMotion.register({...})`. Required metadata: unique `id`, `category`, `title`, `description`, `caption`, `keywords`, exactly three `stages`, `limitations`, `sources`, `params`, `parameterSchema`, `labels`, and `render:function(c,p,t,S){...}`. Follow an existing file.

The render function must be self-contained and use only its arguments and standard JavaScript. **Do not close over file-level variables**: standalone HTML serializes the function and runs it in isolation. No DOM access, timers, requestAnimationFrame, Math.random, Date.now, network calls, SVG animate elements, CSS animation, external images, fonts, eval or unsafe HTML inside renderers. The engine owns the clock. Never insert configuration text without escaping.

Render only the internal artwork, on a 640 x 440 coordinate system; return an SVG fragment, not another framed document. The core owns titles, captions, accessible title/description and output ratios. Keep important content away from the artwork edges. `S.C` provides the selected palette: bg, paper, ink, muted, line, blue, red, teal, gold, soft, tissue. Never rely only on color for direction or identity; retain text and arrows.

Helpers: `S.el(tag,attributes,children)`, `S.text(x,y,text,color,size,anchor,weight)`, `S.wrap(x,y,text,color,size,width,maxLines,anchor)`, `S.path(d,stroke,width,fill,extra)`, `S.circle`, `S.rect`, `S.line`, `S.arrow`, `S.move(polyline,fraction)`, `S.flow(polyline,phase,color,count,radius)`, `S.clamp` and `S.escape`. `el` children are raw markup; text and wrap escape text. Use trusted SVG tags/attribute names only.

Parameter descriptors use either `{type:'number',min,max,step,description}` or `{type:'enum',values:[...],description}`. `step` is a UI increment, not an enforced quantization. Release particle count is rounded by that renderer. Do not label presentation units as millimeters, micrometers, mV, GFR or blood velocity.

When adding template 11+, update the catalog, schema ID enum, example, index script list, visible template-count labels, and tests' expected counts together. `scripts/build.mjs` discovers template JS files automatically, but the studio's classic script list is deliberately explicit for offline loading.

## Medical safeguards

Maintain the source-supported direction of exchange and circuit order. Blood is not literally blue. P/QRS/T represent electrical events rather than contraction measurements. Synaptic receptor binding does not always produce an action potential. Do not depict blood cells or large proteins passing through a normal glomerular filtration barrier. Passive versus active transport must preserve the chosen concentration direction and energy label. Wound-healing phases overlap; do not invent universal completion dates. No dosing, treatment recommendations, diagnosis or patient-specific predictions belong in these templates.

Source links are references, not permission to copy their diagrams. Draw original geometry. Re-check authoritative sources when adding mechanisms or changing scientific claims, and request clinician review before clinical teaching deployment. See `docs/SOURCES.md`.

## Acceptance checks

Run `node tests/verify.mjs`, then `node scripts/build.mjs`; optionally run `python tests/browser_smoke.py`. Review source and standalone output. Exercise parameter bounds, both themes, three aspect ratios, keyboard controls, JSON import/export, pause/seek/reset, invalid-input handling, and hostile text escaping. Verify exported standalone HTML with networking disabled. Do not add generated `dist/` or screenshot output to application imports or commit them unless explicitly requested.
