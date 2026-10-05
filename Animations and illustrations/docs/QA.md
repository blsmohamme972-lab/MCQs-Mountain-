# Verification report - 2026-10-04

## Completed

- JavaScript syntax and dependency-free Node tests: 37 reusable components, 1794 frame render cases across aspect ratios/themes/times and parameter bounds, 230 invalid configurations rejected, stable output for identical input/time, and renderer serialization in isolated JavaScript contexts.
- All 35 checked-in example scenes match the engine defaults and pass the common JSON Schema. The catalog IDs match the registered templates.
- Python XML parsing accepted all 35 generated diagram-only SVG documents.
- The browser smoke script is updated for 35 templates and checks SVG parsing, playback, exports, mobile layout and offline standalone scenes. This execution environment did not include the optional Playwright package, so that browser pass must be rerun where Playwright and Chromium are installed.
- SVG, PNG, standalone HTML and JSON downloads exercised; JSON re-import and invalid-input error handling exercised.
- Studio inspected at 1440px desktop width and 390px mobile viewport width, with no document-level horizontal overflow at 390px. Diagram-only overview and desktop/mobile screenshots were reviewed.
- Reduced-motion preference starts with a still preview. The user may explicitly start playback.
- The dependency-free Node build generated the bundled studio and all 35 individual scene HTML files. Numeric-token and syntax checks passed. A Playwright run is still device- and environment-dependent.
- Parts-library verification passed: 37 registered parts matched the catalog; every part rendered deterministically at default and transformed options; searchable metadata and exact-count batches passed; 9 invalid option cases were rejected.
- Python XML parsing accepted all 25 generated reusable-part SVG documents. The built parts gallery contains the inlined engine and no external runtime dependency.

## Limits of this verification

The environment's managed Chromium blocked both file:// and localhost navigation. Browser tests therefore injected the built, self-contained HTML into fresh/about:blank browser documents with networking disabled. This exercises the real inline scripts, UI, SVG, exports and offline behavior, but does not claim a direct file:// navigation test. Classic-script source files were syntax-tested and were included verbatim by the bundler.

This was Chromium testing with mobile viewport emulation, not a physical Android device, Telegram WebView, Safari or Firefox certification. Operating systems and embedded file viewers can handle local HTML downloads differently. Performance on low-end devices and long custom labels require separate review. Screenshots and test output are generated locally under `tests/output/`, not stored in application assets.

These are qualitative educational mechanisms, not anatomically complete models, clinical waveforms, flow solvers, diagnostic tools or treatment guidance. Automated testing does not constitute clinician review. Custom medical content and source interpretation must be reviewed before educational deployment.

## Reproduce

```sh
node tests/verify.mjs
node tests/parts_verify.mjs
node scripts/build.mjs
python tests/browser_smoke.py
```

Python browser QA requires Playwright and an available Chromium executable. Set `CHROMIUM_PATH` to its location. Runtime use of the studio itself requires no Python, Node, Playwright or build step when the source directory or generated HTML is already available.


## 2026-10-04 — Alveolus visual QA

- Updated alveolar exchange template and reusable alveolus part to use the same lobulated air-sac visual language.
- Rendered a diagram-only SVG (640 × 440 viewBox) and a full portrait SVG (720 × 1280 viewBox), then rasterized both to PNG for visual inspection.
- Confirmed readable separation of the sac, exchange interface, capillary blood, O₂/CO₂ arrows and explanatory labels. No visible label/path overlap remained in the reviewed frames.



## 2026-10-05 — v2 component and motion QA

- Node tests cover 37 reusable components, catalog/runtime metadata agreement, source and limitation discovery, attachments and bounds, effective parameter changes, accent recoloring, deterministic state, explicit-count batches and three composed scenes.
- Template QA compares independent diagram frames at 0, 50 and 100% of duration; the result must change in the mechanism artwork, not only captions or UI controls. Themes and portrait/square/landscape rendering remain covered by `tests/verify.mjs`.
- Composed standalone exports inline the parts engine and scene renderer. The smoke suite checks the absence of external script sources and does not claim clinical validation.
- Direct Chrome `file://` opening remains environment-dependent; if unavailable, report the injected about:blank/offline result separately rather than weakening the tests.


## 2026-10-05 — Actual validation run

- `node tests/parts_verify.mjs` passed: 37 components, contract v2, catalog/schema/runtime agreement, parameter and recolouring checks, deterministic output, attachment rendering and three composed examples.
- `node tests/verify.mjs` passed: 35 templates, 1,794 frame cases, 230 invalid configurations rejected, deterministic output and closure isolation.
- `node scripts/build.mjs` passed: the offline studio, 35 template exports, 3 composed exports and the 37-part gallery were generated.
- XML parsing accepted nine representative composed/part SVG files in `tests/output/`.
- `python tests/browser_smoke.py` was attempted and is unavailable in this environment (`ModuleNotFoundError: playwright`); direct Chrome review was also unavailable because the browser surface blocked the local preview. No browser pass is claimed.
