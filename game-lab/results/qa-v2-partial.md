# v2 QA review (partial) — 2026-10-18

The QA agent (both tiers, scripted Playwright) was stopped by the owner's "stop and hand over" before it wrote its
report. These are the issues its raw logs recorded. The HD tier runs on SwiftShader in the container (no GPU), so
frames take 0.1-1 s there, and timing-based checks can misfire. Screenshots stayed in the session scratchpad (not
committed).

**Status (2026-10-19, after the round-2 QA review in `reviews-v2-d27.md`):** the QA reviewer re-tested all ten on both
tiers. Nine are fixed or did not reproduce; #2 needed a second fix (98c61e8); #7 remains a phone check (this machine
has no GPU).

| # | Tier | Likely severity | Finding (from the raw logs) | Probable cause and fix | Status |
|---|---|---|---|---|---|
| 1 | HD | blocker (page errors) | Switching the colour scheme, or hiding the page, while the HD world is still loading throws: `TypeError ... reading 'atlas'` at `frame()` via `setFace()`, `reading 'stop'` at `World.pause()`, `reading 'visible'` at `busy()` | `world-hd.js`: `theme()`, `pause()`, `resume()` and `applyNight()` run before `init()` has built the scene. Guard them (`if (!built) return;`, `if (app && app.ticker)`), as `world.js` does. | Fixed: `theme()`, `pause()`, `resume()`, `applyNight()` and `resize()` do nothing before the scene is built. |
| 2 | both | major | A double tap on "Check answer" (60-140 ms apart) also presses "Next MCQ", which appears in the same place: the explanation is skipped | `app.js`: ignore Next for about 400 ms after grading (or until the feedback has been on screen one frame). Study rule: the explanation must be seen. | Fixed: Next is ignored for 350 ms after a Check tap that graded. Round 2 found it still failed when the second tap waited behind a long frame; the guard now uses the taps' own times (98c61e8): 0 of 16 explanations skipped with a 500 ms stall. |
| 3 | both | major | At 320 px wide, the "Correct answer" and "Your answer" marks are clipped at the sheet edge (Q4, multi) | Caused by the HD-review change in `index.html` (`.mk{white-space:nowrap;flex:none}`). Let the mark wrap on narrow screens, e.g. `@media (max-width:359px){.mk{white-space:normal;flex:0 1 auto}}`. | Fixed: the mark wraps under 360 px. |
| 4 | both | major (keyboard) | After "Check answer" the focus falls to `<body>` (the Check button hides) | `app.js` `doCheck()`: move focus to the feedback block or to the Next button. | Fixed: the focus moves to the feedback block. |
| 5 | both | minor | Classic mode shows "Ledge 0/8" while Q1 is open | `app.js` `go()` in classic calls `openSheet()` without `hud()`; call `hud()` there. | Fixed. |
| 6 | HD | minor (container?) | The HUD XP counter lags the sheet's XP, and at the end showed 50 or 59 instead of 60 in some runs | The tick-up runs on `requestAnimationFrame`, which SwiftShader starves. Add a fallback that sets the final number after about 0.5 s (`setTimeout`). | Fixed: the final number is set after 480 ms if frames are starved. |
| 7 | HD | minor (container?) | Classic "Time added by the game" 0.8-5 s instead of about 0 | Each classic switch waits one animation frame, and frames are slow on SwiftShader. Re-check on a phone; likely not a code bug. | Open: check on a phone. Round 2 here: light median 25-26 ms (max 31-34); HD 390 x 844 median 27 ms (max 153); HD 1280 x 800 median 192 ms. Part of the HD time was the world still running behind the sheet (QA HD1, fixed in 98c61e8); the rest is SwiftShader. |
| 8 | HD | major | Rotating the phone about 200 ms after load (still loading) leaves the canvas stretched (portrait canvas in a landscape view) | `World.resize()` returns early before the scene is built. After `init()` resolves, compare the size with `innerWidth`/`innerHeight` and resize if it changed. | Fixed: `app.js` resizes after the world is ready if the size changed while loading. |
| 9 | both | major (landscape phones) | In landscape at 844x390, 740x360 and 568x320, the start and summary cards slide under the top bar, or are cut off at 320 px tall | `index.html`: limit the cards' height (`max-height: calc(100% - top bar)`, scroll inside) or compact them in landscape. | Fixed: the cards are limited to the view below the top bar and scroll inside; on short screens the summary is compact (7936d66). |
| 10 | HD | check | "Foot button off-screen" (Check/Next below the view) logged once in Story 390x844 Q5 and in Strip 360x740 Q1 | Probably measured during the sheet's slide; verify with the sheet fully open. | Closed: not reproduced in round 2 with the sheet fully open, at 320 x 568, 360 x 740, 390 x 844, 820 x 1180, 1280 x 800, 844 x 390 and 568 x 320, every mode, both tiers. |

Passed in the raw logs (as far as they went): all three modes reached the summary twice per tier at 320, 360, 390,
820 and 1280 widths; grading counts (4 right, 4 wrong: +60 XP); dark mode; switching the scheme during play after
load; a resize storm (40 resizes, no leak); sound requests only after the sound toggle.
