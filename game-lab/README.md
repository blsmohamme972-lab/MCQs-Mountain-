# game-lab: MCQs Mountain (2D game prototype)

> **PROTOTYPE ONLY. NOT DEPLOYED. NOT LINKED FROM THE APP.**
> Nothing in this folder ships to students. Only `app/` is deployed (`wrangler.app.jsonc`), and no CI workflow
> watches `game-lab/`. Do not copy anything from here into `app/`, `worker/` or `tools/` without the owner's explicit
> written go-ahead for integration (see Gate 6 in `PLAN.md`).

ملخص للمالك: هذا مختبر منفصل لفكرة لعبة ثنائية الأبعاد حول الأسئلة. ما يأثر على التطبيق الحالي. كل شي موثق هنا
حتى أي عميل جديد يكمل بدون ما يعيد البحث.

## The idea in one paragraph

The owner's idea (2026-10-18): a 2D side-scrolling world around the MCQs. The character starts at START, an arrow says
"First MCQ", the character moves, the MCQ opens with its explanation, comments and video; "Next MCQ" closes it fast,
and the character climbs stairs or rides a lift to the next one. One continuous story. It must be fast, free and
professional, and it stays out of the app until the owner is fully convinced.

## Where things stand

| Item | Status |
|---|---|
| Research: code, tech, learning science, art pipeline, each fact-checked | Done, in `research/` |
| Decisions and the reasons for them | Done, in `DECISIONS.md` |
| Step-by-step method with gates and kill criteria | Done, in `PLAN.md` |
| Character and world brief (before any drawing) | Done, in `CHARACTER_BRIEF.md` |
| Speed harness | Done, `tools/measure.mjs` |
| Playable prototype with 3 modes (Story, Strip, Classic) | First draft works (flow, MCQ, speed). Its look was **rejected** by the owner (D18) |
| New direction: world-class 2D quality, professional engine, no medical characters | Written down (`DECISIONS.md` D18-D23) |
| Engine spike | Done: PixiJS 8 with Canvas 2D renderer (D24, `results/spike-*.json`) |
| v2 light tier (`v2/world.js`, Canvas 2D pixel art, `?low=1` / `?tier=light`) | Works in all modes; Strip and Classic p99 16.8 ms at 4x |
| v2 HD tier (`v2/world-hd.js`, WebGL, the default; D26) | Works in all modes; three visual review rounds reached 5-6.5 of 10, not 9 (free-art ceiling about 7.5); QA findings, three reviews, final re-measure and phone link still open (`NEXT_AGENT.md`) |
| Owner tries it on a phone, then in Telegram through a test bot | Not started (Gate 1) |

**New agent: start with `NEXT_AGENT.md`.** It is the ready task prompt for the next step.

**Current gate and the next action are always written at the top of `PLAN.md`.** Update that line whenever you
finish a step.

## Read in this order

1. This file.
2. `PLAN.md`: the method, the gates, what is done and what is next.
3. `DECISIONS.md`: every decision already made and why. Do not reopen them without new evidence or the owner.
4. `CHARACTER_BRIEF.md`: before anyone draws anything.
5. `research/` only when you need the evidence behind a decision:
   - `01-code-map.md`: how the real question screen works and where a game would attach later (with file:line).
   - `02-tech.md`: Telegram Mini App features, WebViews, engine sizes, the Iraqi phone market, profiling tools.
   - `03-learning.md`: what the studies say about game wrappers around questions, and how to test properly.
   - `04-art.md`: how professionals make characters and worlds, free tools, licences, AI images.

## Folder map

```
game-lab/
  README.md            this file (entry point)
  NEXT_AGENT.md        the ready task prompt for whoever continues
  PLAN.md              method, gates, kill criteria, current status
  DECISIONS.md         decision log with reasons and sources (D18-D23: the owner's new direction)
  CHARACTER_BRIEF.md   character and world brief, asset list, free tools
  ASSETS.md            asset register with exact licences (both tiers, engine, runtimes)
  assets-test/         downloaded test assets, git-ignored, never committed
  climb/index.html     first draft of the prototype (flow and speed good, look rejected)
  v2/                  the rebuild on PixiJS 8: index.html, app.js (flow, MCQ sheet, tiers), world.js (light tier),
                       world-hd.js (HD tier)
  spike/               the engine spike scenes (Phaser 4 and PixiJS 8)
  vendor/              engine builds fetched by tools/fetch_engine.py, git-ignored
  climb/SPEC.md        the spec of the first draft, and the four review checklists
  tools/measure.mjs    speed harness (Playwright, CPU throttling as a cheap-phone proxy)
  tools/shots.mjs      screenshots of the five review screens, day and night
  tools/fetch_*.py     pinned downloads (engine, runtimes, test art and sound); build_assets*.py build the art
  tools/make_artifact.py  the phone copy (claude.ai artifact folder) of v2, both tiers
  results/             measurement JSON from the harness (text only)
  research/            the four research reports with their fact-check corrections
```

## Open the prototype

- On a computer: open `game-lab/climb/index.html` in Chrome. It needs no server and makes no network requests.
- v2 needs a server and the git-ignored files: `python3 game-lab/tools/fetch_engine.py`, `python3
  game-lab/tools/fetch_assets.py` (Pillow, numpy, ffmpeg; it builds both tiers' art, the HD part takes about a
  minute), then `python3 -m http.server 8765` from `game-lab/` and open `http://127.0.0.1:8765/v2/index.html`.
  Tiers: the HD tier (WebGL) is the default; `?tier=light` or `?low=1` gives the light tier. Light-tier options:
  `?hero=captain|frog|pink|guy|mask`, `?gl=1`. HD options: `?fx=0` (no filters), `?gov=0` (no quality governor, for
  screenshots on a machine without a GPU), `?res=1` (fixed resolution).
- On a phone: the owner gets a private claude.ai link to the same page (an "artifact" copy with the document wrapper
  removed and two Google Fonts added). The repository file stays the source of truth.
- URL options: `?mode=story|strip|classic`, `?debug=1` (frame-time overlay), `?low=1` (low-quality tier),
  `?rm=1` (reduced motion).

## Measure it

```bash
cd game-lab/tools
npm init -y >/dev/null && npm i playwright@1.56.1   # once; do not commit node_modules
node measure.mjs ../climb/index.html --mode story --cpu 1,4,6 --q 8 --json ../results/story.json
node measure.mjs "http://127.0.0.1:8765/v2/index.html?tier=light" --mode strip --cpu 4 --q 8   # light tier
node measure.mjs "http://127.0.0.1:8765/v2/index.html" --mode story --cpu 4 --q 8              # HD tier
node shots.mjs http://127.0.0.1:8765/v2/index.html <scratch-dir>   # 5 screens, day and night (never commit PNGs)
```

For the HD tier the harness starts Chromium with SwiftShader in the GPU process (`--use-angle=swiftshader
--enable-unsafe-swiftshader`) and 2D canvases on the CPU (`--disable-accelerated-2d-canvas`); see D26 for why. It also
reports `script_ms_p50/p95/p99`, the world's own update plus render-submission time per frame (`World.scriptTimes`).
HD frame times in this container are GPU-bound on software rendering and are judged on a real phone (D25).

In the Claude Code cloud container Chromium is preinstalled; `playwright@1.56.1` matches it. Do not run
`playwright install`.

The harness contract (any new prototype version must keep it, or the numbers stop being comparable):

- `window.__lab.state` is `'start' | 'moving' | 'question' | 'done'`.
- `window.__lab.answer()` completes and grades the open MCQ (test hook).
- Buttons: `[data-lab=go]` start arrow, `[data-lab=opt]` options, `[data-lab=next]` Next MCQ.
- Performance marks: `lab:next-tap` (Next pressed), `lab:world-visible` (world fully visible again),
  `lab:sheet-visible` (next MCQ fully open).

CPU throttling only slows the processor. It does not imitate a weak GPU, heat or low memory, so it is a pre-check.
The real gate is a trace from a cheap Android phone inside Telegram (Gate 2 in `PLAN.md`).

## Rules that apply here (short version)

- Stay inside `game-lab/`. No edits to `app/`, `worker/`, `tools/`, CI or deployment for this project.
- Lean storage: commit text only. No images, sprite sheets, audio, ZIPs or `node_modules`. Screenshots go to the
  owner in chat.
- The game world aims at world-class 2D quality (Super Mario level), with no medical characters (D18, D19).
- The MCQ sheet keeps the app's study rules: readable reading font, 44 px targets, reduced motion, neutral wrong
  answers (`docs/DESIGN_STYLE.md`), and no celebration before an answer is scored (`docs/DESIGN.md`).
- A professional engine is allowed in the lab, chosen by a measured spike (D21). The app's start-up and MCQ speed must
  stay untouched (D23).
- Test-only tools and assets (non-commercial, evaluation) are allowed: register each in `ASSETS.md`, download by
  script into `assets-test/`, never commit or ship them (D22).
- Original art only. "Like Super Mario" means its quality, never Nintendo's characters, art, music or look.
- Before integration ever happens, the app's start-up budget needs room first (see D7 in `DECISIONS.md`).
