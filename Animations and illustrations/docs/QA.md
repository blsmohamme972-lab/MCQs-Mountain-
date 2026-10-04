# Verification report - 2026-10-04

## Completed

- JavaScript syntax and dependency-free Node tests: 10 registrations, 524 frame render cases across aspect ratios/themes/times and parameter bounds, 86 invalid configurations rejected, stable output for identical input/time, and renderer serialization in isolated JavaScript contexts.
- All 10 checked-in example scenes match the engine defaults and pass the common JSON Schema. The catalog IDs match the registered templates.
- Headless Chromium: 300 SVG documents parsed as XML without errors; all 10 templates selected, played, paused and reset in the studio.
- SVG, PNG, standalone HTML and JSON downloads exercised; JSON re-import and invalid-input error handling exercised.
- Studio inspected at 1440px desktop width and 390px mobile viewport width, with no document-level horizontal overflow at 390px. Diagram-only overview and desktop/mobile screenshots were reviewed.
- Reduced-motion preference starts with a still preview. The user may explicitly start playback.
- The bundled studio and all 10 individually generated scene HTML files executed with browser networking disabled. No external HTTP(S) requests and no page-level JavaScript errors were observed in the successful test run.

## Limits of this verification

The environment's managed Chromium blocked both file:// and localhost navigation. Browser tests therefore injected the built, self-contained HTML into fresh/about:blank browser documents with networking disabled. This exercises the real inline scripts, UI, SVG, exports and offline behavior, but does not claim a direct file:// navigation test. Classic-script source files were syntax-tested and were included verbatim by the bundler.

This was Chromium testing with mobile viewport emulation, not a physical Android device, Telegram WebView, Safari or Firefox certification. Operating systems and embedded file viewers can handle local HTML downloads differently. Performance on low-end devices and long custom labels require separate review. Screenshots and test output are generated locally under `tests/output/`, not stored in application assets.

These are qualitative educational mechanisms, not anatomically complete models, clinical waveforms, flow solvers, diagnostic tools or treatment guidance. Automated testing does not constitute clinician review. Custom medical content and source interpretation must be reviewed before educational deployment.

## Reproduce

```sh
node tests/verify.mjs
node scripts/build.mjs
python tests/browser_smoke.py
```

Python browser QA requires Playwright and an available Chromium executable. Set `CHROMIUM_PATH` to its location. Runtime use of the studio itself requires no Python, Node, Playwright or build step when the source directory or generated HTML is already available.
