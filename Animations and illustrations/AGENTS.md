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

Helpers: `S.el(tag,attributes,children)`, `S.text(x,y,text,color,size,anchor,weight)`, `S.wrap(x,y,text,color,size,width,maxLines,anchor)`, `S.path(d,stroke,width,fill,extra)`, `S.circle`, `S.rect`, `S.line`, `S.arrow`, `S.move(polyline,fraction)`, `S.flow(polyline,phase,color,count,radius)`, `S.clamp`, `S.escape` and `S.alveolarSac`. `el` children are raw markup; text and wrap escape text. Use trusted SVG tags/attribute names only.

Parameter descriptors use either `{type:'number',min,max,step,description}` or `{type:'enum',values:[...],description}`. `step` is a UI increment, not an enforced quantization. Release particle count is rounded by that renderer. Do not label presentation units as millimeters, micrometers, mV, GFR or blood velocity.

When adding template 11+, update the catalog, schema ID enum, example, index script list, visible template-count labels, and tests' expected counts together. Keep the explicit script list in numeric order and keep every template's metadata, example and renderer synchronized. `scripts/build.mjs` discovers template JS files automatically, but the studio's classic script list is deliberately explicit for offline loading.

## Medical safeguards

Maintain the source-supported direction of exchange and circuit order. Blood is not literally blue. P/QRS/T represent electrical events rather than contraction measurements. Synaptic receptor binding does not always produce an action potential. Do not depict blood cells or large proteins passing through a normal glomerular filtration barrier. Passive versus active transport must preserve the chosen concentration direction and energy label. Wound-healing phases overlap; do not invent universal completion dates. No dosing, treatment recommendations, diagnosis or patient-specific predictions belong in these templates.

Source links are references, not permission to copy their diagrams. Draw original geometry. Re-check authoritative sources when adding mechanisms or changing scientific claims, and request clinician review before clinical teaching deployment. See `docs/SOURCES.md`.

## Acceptance checks

Run `node tests/verify.mjs`, then `node scripts/build.mjs`; optionally run `python tests/browser_smoke.py`. Review source and standalone output. Exercise parameter bounds, both themes, three aspect ratios, keyboard controls, JSON import/export, pause/seek/reset, invalid-input handling, and hostile text escaping. Verify exported standalone HTML with networking disabled. Do not add generated `dist/` or screenshot output to application imports or commit them unless explicitly requested.


## Telegram Mini App boundary

This directory is a reusable asset library, not the Telegram host application. Keep templates offline-capable and free of `window.Telegram` calls, runtime network requests and server credentials. When a host Mini App embeds a standalone export, load Telegram's official bridge in the host page, call `Telegram.WebApp.ready()` after the first usable frame, use `expand()` only when the product flow needs it, map `themeParams` to CSS variables, and pad content with `safeAreaInset` and `contentSafeAreaInset`. Treat `initDataUnsafe` as untrusted; validate `initData` on the bot server before accepting identity or authorization. Respect reduced motion and Android performance class. See `docs/TELEGRAM_MINI_APP.md` for the maintained integration checklist.

## Reusable parts contract

The `parts/` directory is a versioned component library. `parts/catalog.json` is the authoritative metadata source; `parts/medical-parts.js` is the compatible offline runtime bundle and exposes contract version 2. Read `parts/README.md`, `parts/catalog.json`, `parts/schema.json` and `docs/ADDING_PARTS.md` before changing it.

Every component has a stable ID, version, 640 x 440 local bounds, named attachment points, sources, limitations, dependencies, a validated component-specific parameter schema and deterministic animation state. The legacy transform calls (`x`, `y`, `scale`, `rotation`, `opacity`, `accent`) remain valid; v2 additionally validates `theme`, `params`, `state`, `time` and `progress`. Use `MedicalMotionParts.discover(id)` for runtime metadata and `createRenderer(context)` for explicit scene composition.

Search both catalogs and scene source before adding a component. For a request naming N, verify `finalIds - startingIds` is exactly N; renderBatch instance counts are not a novelty check. Without a count, add the smallest coherent set of essential gaps and document the score and rationale in `docs/coverage-backlog.json` and `docs/CHANGELOG.md`. Preserve original geometry, source links and honest schematic limitations.

Complete scenes under `templates/` must remain independent of the parts bundle unless they explicitly receive a renderer context. Composed examples use `parts/scene-renderer.js`; standalone exports inline the parts engine and component dependencies and must not fetch files at runtime.

Run `node tests/parts_verify.mjs`, `node tests/verify.mjs`, `node scripts/build.mjs` and, when available, `python tests/browser_smoke.py`. Review multiple times, both themes, portrait/square/landscape layouts, hostile labels, reduced motion and offline file opening. Keep generated outputs out of application imports unless the user requests them.

