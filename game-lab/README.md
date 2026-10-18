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
| Playable prototype with 3 modes (Story, Strip, Classic) | See the status line at the top of `PLAN.md` |
| Owner tries it on a phone, then in Telegram through a test bot | Not started (Gate 1) |

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
  PLAN.md              method, gates, kill criteria, current status
  DECISIONS.md         decision log with reasons and sources
  CHARACTER_BRIEF.md   character and world brief, asset list, free tools
  climb/index.html     the playable prototype (one self-contained file, no libraries, no network)
  tools/measure.mjs    speed harness (Playwright, CPU throttling as a cheap-phone proxy)
  results/             measurement JSON from the harness (text only)
  research/            the four research reports with their fact-check corrections
```

## Open the prototype

- On a computer: open `game-lab/climb/index.html` in Chrome. It needs no server and makes no network requests.
- On a phone: the owner gets a private claude.ai link to the same page (an "artifact" copy with the document wrapper
  removed and two Google Fonts added). The repository file stays the source of truth.
- URL options: `?mode=story|strip|classic`, `?debug=1` (frame-time overlay), `?low=1` (low-quality tier),
  `?rm=1` (reduced motion).

## Measure it

```bash
cd game-lab/tools
npm init -y >/dev/null && npm i playwright@1.56.1   # once; do not commit node_modules
node measure.mjs ../climb/index.html --mode story --cpu 1,4,6 --q 8 --json ../results/story.json
```

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
- The prototype follows the app's rules: `docs/DESIGN_STYLE.md` (Arcade-Clean, tokens, 44 px targets, reduced
  motion, neutral wrong answers) and `docs/DESIGN.md` (never celebrate before an answer is scored).
- Original art only. Never brief or prompt "Mario-like" or any existing character.
- Before integration ever happens, the app's start-up budget needs room first (see D7 in `DECISIONS.md`).
