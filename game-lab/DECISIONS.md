# MCQs Mountain: decision log

Each decision has its reason and its source. Sources marked `research/0N` point to the saved reports, which list
every claim with its URL and the independent fact-check verdict. Do not reverse a decision without new evidence or
the owner's word; if you do, add a new entry instead of editing the old one.

## Where the owner's first idea needed changing

| Owner's idea | Problem | What we do instead | Source |
|---|---|---|---|
| Walk, take a coin, then the MCQ appears | Rewards before an answer break the app's own rule and the motivation research | A "?" sign opens the MCQ; the coin on that ledge is earned only after the answer is scored | D2 |
| A Super Mario-like world | Art must be original; Nintendo's characters, names, designs, music and look are protected | **Revised by the owner (D19):** Mario-level quality and atmosphere, built from original or properly licensed art. The first answer (Arcade-Clean vector world) is replaced | D4, D19 |
| A walk or climb between every pair of MCQs | Unskippable scenes between questions cost time and, in the studies, learning | Short (about 1 s), always skippable, with a Strip mode and a no-game mode to compare | D5, D6 |
| Building characters first | Professionals prove the loop with a placeholder first | Gray-box prototype now, character brief written, drawing only after Gates 1-2 | D1, `PLAN.md` |

## Decisions

**D1. A separate lab, never integrated without the owner's go-ahead.** Everything lives in `game-lab/`, outside
`app/` (the only deployed folder) and outside every CI path filter. Owner's rule of 2026-10-18. Source:
`research/01-code-map.md` section 7.

**D2. Reward after grading.** The character walks to a "?" checkpoint sign; the MCQ opens; the coin appears only after
the answer is scored and is collected when the world returns. Sources: `docs/DESIGN.md` ("Never celebrate before an
answer is actually scored"); Deci, Koestner and Ryan 1999: engagement-contingent rewards undermined free-choice
motivation (d = -0.40) while positive feedback raised it (d = +0.33) (`research/03`).

**D3. Wrong answers are neutral and still move forward.** Silver coin (+5 XP), a small "saved for review" flag, no
falling, no lives, plain wording. Sources: `docs/DESIGN_STYLE.md` study-core rule 5; XP values copied from
`app/modules/xp-ledger.js` (new correct 10, new wrong 5).

**D4. Arcade-Clean vector art, original, no pixel world.** *(Replaced for the game world by D19 and D20. Still applies
to the MCQ sheet.)* Thick ink outline, hard offset shadow, token colours only.
Sources: `docs/DESIGN_STYLE.md` ("Pixel art is a rare reward accent only"; "copied assets, characters... are not
[allowed]"); Clark, Tanner-Smith and Killingsworth 2016: schematic visuals g = 0.48 vs realistic g = -0.01 and a thin
narrative g = 0.47 vs medium g = -0.03 (`research/03`).

**D5. Always compare three modes.** Story (the owner's world between MCQs), Strip (no world screen; a small mountain
strip above the question moves one ledge per answer, never blocking) and Classic (no game, the baseline). Reasons:
seductive details lower learning (g = -0.33, worse when learners cannot control pacing, Sundararajan and Adesope
2020); quizzes placed between game levels taught less and were chosen 7 times less than an integrated design
(Habgood and Ainsworth 2011); Duolingo users built tools just to click through per-answer interstitials. Two 1.5 s
transitions per MCQ would add about 5 minutes per 100 MCQs (`research/03`).

**D6. Time budget.** Story: Next to the next MCQ about 1 s; a lift "story beat" about 1.6 s (every 4th MCQ in the
prototype, every 10-20 in a real chapter). A tap anywhere skips. Reduced motion turns every movement into an instant
cut with a text label. Strip and Classic: under 150 ms. Sources: NN/g animation durations (100-500 ms, frequent
animations shorter); RAIL (respond within 100 ms); `docs/DESIGN_STYLE.md` motion tokens (80/120/180/320 ms).

**D7. Hand-written Canvas 2D, zero libraries.** *(Revised for the lab by D21: a professional engine is allowed.
The budget facts below still decide how a game could ever be loaded in the app.)* The app's start-up budget is full: 153,244 of 153,600 gzip bytes
(CI-exact build, 2026-10-18; older documents quoting 116,858 B are out of date). Measured library sizes (gzip):
Phaser 4.2.1 about 345 KB; PixiJS 8.22.0 about 232 KB full, about 170 KB minimal; Kaplay 68 KB; LittleJS 52 KB only
with the production build condition (112.5 KB otherwise); Unity and Godot web builds are megabytes. A hand-written
loop for one character, coins and parallax costs well under 1 KB. Sources: `research/01`, `research/02` (sizes
re-measured by the fact-checker).

**D8. Speed techniques (keep them in every version).** One canvas that is never recreated (iOS canvas memory limits);
the loop runs only while something moves and stops while the MCQ is open; time-based motion with a clamped delta
(many cheap phones run at 90-120 Hz); devicePixelRatio capped at 2 (1.5 on the low tier); character frames, signs,
coins and parallax baked once into offscreen canvases; no shadowBlur, filters or per-frame gradients; the MCQ is DOM,
animated with transform and opacity only; the next MCQ is built during the climb, so the walk doubles as loading
time. Source: `research/02` section 5.

**D9. Animation by sprite sheets, authored as cut-out vector.** *(Revised for the lab by D22: evaluation or
non-commercial tools such as Spine's free evaluation are allowed for tests.)* Draw body parts on layers in Inkscape, pose them, export
frames, pack with free-tex-packer. Not Spine (its runtime needs a paid editor licence), not Rive (free exports show a
splash screen; heavy WebAssembly runtime), not DragonBones (unmaintained). Sources: `research/02` section 4,
`research/04` section 3.

**D10. Inside Telegram only through a separate test bot.** Bot API 10.2 (enforced from 2026-07-20) blocks Mini App
methods from origins other than the Mini App's own domain, and a separate bot keeps D1. The owner creates the bot and
hosting; agents do not. Source: `research/02` section 1.

**D11. Coins are only a view of the existing XP.** No separate coin balance and no change to XP rules; Leaders fairness
depends on them. Any new saved setting (for example a chosen character) is an additive key with a tested migration and
owner review. Sources: `docs/LEADERS.md`, `docs/DESIGN.md`, `research/01` section 4.

**D12. Quality tiers.** Telegram Android adds a performance class (LOW, AVERAGE, HIGH) to the User-Agent; LOW means
DPR 1.5 and no parallax (`?low=1` in the prototype). iOS, desktop and web give no tier, so a later version should
downgrade itself from measured frame times. Source: `research/02` (and its fact-check).

**D13. Sound off by default, no audio files.** Same as `app/design/game-feel.js`. If sound is wanted later: jsfxr
(Unlicense) or ChipTone (CC0 output), generated at runtime.

**D14. English interface.** `docs/DESIGN.md`: the interface is English-only. Labels: "First MCQ", "Next MCQ".

**D15. Lean storage.** Commit text only (code, Markdown, JSON results). No images, sprite sheets, audio, ZIPs or
`node_modules`. Screenshots go to the owner in chat. Repository rule in `CLAUDE.md`.

**D16. What counts as proof.** CPU throttling in Playwright is only a pre-check (it does not imitate a weak GPU, heat
or low memory). Proof is: traces from the floor phone inside Telegram, timed playtests with students, and a pilot
compared against Classic, with kill criteria written in advance. Floor phone chosen from StatCounter Iraq,
September 2026 (Android 86%; Honor, Infinix, Samsung, Apple, Tecno, Xiaomi; top screen 360 x 800). Sources:
`research/02` sections 6-7, `research/03` section 5.

**D17. Prototype data.** The prototype uses 8 questions copied from the app's own `SAMPLE` data in `app/index.html`,
covering all four types (sba, mtf, multi, emq). No book text is committed. Grading copies the app's `grade()` rules.

## Owner direction after seeing the first draft (2026-10-18, later the same day)

The owner saw screenshots of the draft and said the characters are "very silly" (سخيفة جداً). Their words, in short:
no medical characters; a professional game inside a professional system, with the atmosphere of world-class 2D games
such as Super Mario, even if it is only for testing; non-commercial engines are acceptable for the test; it must be
fast and must not affect the app's speed. These decisions follow from that and replace older ones where marked.

**D18. No medical characters, and the draft character is rejected.** The placeholder "young climbing medic" in
`climb/index.html` is out. The hero is an original game character chosen for appeal (a world-class 2D platformer hero),
not a doctor, nurse, organ or other medical figure. `CHARACTER_BRIEF.md` is updated to match.

**D19. The quality bar is world-class 2D, even for the test.** Target the look and feel of top 2D games (Super Mario
and similar world-class titles): rich layered worlds with depth, appealing animated characters with full animation
sets, polished motion, particles, transitions, music and sound. "Like Super Mario" means that **quality level and the
genre's conventions** (platforms, coins, stairs, lifts, a goal flag). It never means Nintendo's characters, names,
designs, levels, music, sounds or distinctive look: those are protected, and the repo requires original work
(`docs/DESIGN_STYLE.md`). No Nintendo or other franchise asset, even in a private test. The art style (painted,
vector or pixel) is chosen by what reaches this bar; the app's "pixel art only as a rare accent" rule covers the app's
own UI, and the owner's direction allows the lab's game world to differ. Integration would still need a formal rule
change (Gate 6).

**D20. The MCQ stays calm and unchanged in spirit.** The world can be rich, but the MCQ sheet keeps Kafu's study-core
rules: readable text in the reading font, neutral wrong answers, colour never the only signal, no animation on top of
the question text. Rewards still come after grading (D2), wrong answers still move forward (D3), every animation is
still skippable and reduced motion still means instant cuts (D6).

**D21. A professional engine is allowed in the lab.** D7's zero-library rule came from the app's full start-up
budget, which does not limit a separate lab. The next agent picks the engine with a short measured spike instead of
guessing. Candidates and their measured sizes are already in `research/02-tech.md`: Phaser 4 (MIT, full 2D engine
with cameras, tilemaps, particles, lighting; about 345 KB gzip) and PixiJS 8 (MIT, renderer; about 170-232 KB gzip,
plus a skeletal-animation runtime if used). Unity and Godot web builds are megabytes and fail D23. The spike measures,
on the throttled harness and later on the floor phone: download size, time from loading the game code to the first
frame, frame times, memory. Record the choice and its numbers as a new decision.

**D22. Non-commercial and evaluation-only tools and assets are allowed, for testing only.** Examples: Spine's free
evaluation of its runtimes and examples, Rive's free plan (with its splash screen), TexturePacker's free tier,
asset packs licensed for non-commercial use, CC-BY or CC0 packs. Rules:
- Each one goes into an asset register (`ASSETS.md`, to be created by the next agent): file or pack, author, source
  URL, exact licence, and "TEST ONLY: replace before any release" where the licence is non-commercial or evaluation.
- Lean storage still holds: no images, audio or packs in git. Commit a small script that downloads them into a
  git-ignored folder (`game-lab/assets-test/`). The private phone-link copy may embed them.
- Nothing from this category is ever copied into `app/` or shipped to students.

**D23. Fast, and the app's speed is untouched.** The game must not change the app's start-up or the MCQ path:
- The game code and art load only when the game is opened (or quietly after the app is idle), never in the app's
  start-up, and are cached after the first load.
- The MCQ itself stays the app's normal screen (DOM), shown over the game; the next MCQ is prepared during the climb.
- Speed targets stay as in `PLAN.md` Gate 0 (smooth movement, Next answered within 100 ms, Story about 1 s per MCQ,
  Strip and Classic under 150 ms), and on the floor phone at Gate 2. A richer world that misses them is not done.
- The prototype also reports how long its own code and art take to load, so the cost of the engine is visible.

## Engine spike (2026-10-18)

**D24. PixiJS 8 with its Canvas 2D renderer, pixel art drawn at 1 canvas pixel per CSS pixel.** The spike (D21)
built the same scene in Phaser 4.2.1 and PixiJS 8.22.0 (`spike/phaser/`, `spike/pixi/`: 5 parallax layers, an animated
hero from a sprite sheet, coins with particle bursts, a following camera, a DOM MCQ sheet on top) and measured it with
`tools/spike.mjs` (360 x 740 at DPR 3, 3 runs per setting, medians, `results/spike-*.json`). Both engines are fetched
from npm with pinned versions and hashes by `tools/fetch_engine.py` into the git-ignored `vendor/`.

| Setting (4x CPU unless noted) | Engine + scene, gzip | Load to first frame (1x / 4x / 6x) | Frame p95 / p99 at 4x | Frames over 33 ms at 6x | JS heap |
|---|---|---|---|---|---|
| **PixiJS, Canvas 2D, 1x resolution (chosen)** | **239.7 KB** | **172 / 480 / 740 ms** | **16.7 / 16.8 ms** | **0** | **9.5 MB** |
| Phaser, Canvas 2D, 1x resolution | 355.3 KB | 235 / 804 / 1221 ms | 16.8 / 16.8 ms | 3 | 11.3 MB |
| PixiJS, WebGL, 1x resolution | 239.7 KB | 262 / 666 / 892 ms | 33.4 / 50.1 ms | 31 | 9.5 MB |
| Phaser, WebGL, 1x resolution | 355.3 KB | 270 / 971 / 1441 ms | 33.3 / 33.4 ms | 7 | 15.4 MB |
| PixiJS, WebGL, DPR 2 | 239.7 KB | 311 / 806 / 1219 ms | 116.7 / 149.9 ms | 36 | 9.5 MB |
| Phaser, WebGL, DPR 2 | 355.3 KB | 358 / 1169 / 1589 ms | 83.4 / 100.1 ms | 56 | 14.5 MB |

Why:
- At the same smooth frames (p95 16.7 ms at 1x, 4x and 6x CPU, no frame over 33 ms), PixiJS loads 40% faster than
  Phaser (480 vs 804 ms at 4x; its longest blocking task during load is 218 vs 501 ms), downloads a third less
  (237 vs 352 KB gzip for the engine) and uses less memory. Speed and the app's budget are the owner's first rule (D23).
- Phaser's extras (physics, scenes, tweens, a sound manager, tilemaps) are not needed: the game is a scripted path, and
  the draft already has the motion, camera and timing code.
- The Canvas 2D renderer won in both engines. Pixel art needs no WebGL effects, starts faster (no shader compilation),
  cannot lose a WebGL context on iOS, and draws a few dozen sprites cheaply. Drawing at 1 canvas pixel per CSS pixel and
  letting the browser scale with `image-rendering: pixelated` gives the same look as DPR 2 for whole-number art scales,
  with a quarter of the pixels to fill.
- `?gl=1` switches v2 to PixiJS's WebGL renderer, so Gate 2 can compare both on real phones.

Limits of this evidence: the container has no GPU, so WebGL runs on SwiftShader (software) and CPU throttling slows only
the page's main thread. That makes WebGL look worse here than on a phone, where both renderers use the GPU. The choice
does not depend on WebGL: the Canvas 2D path passes with margin on this harness. The real check is the floor phone at
Gate 2 (D16). A plain-sprites variant (`?tile=sprites`, `results/spike-*-sprites.json`) showed the WebGL gap is not
caused by the tiling-sprite shader. For the app (D7, D23), 237 KB gzip can never enter the start-up budget; the game
must load lazily, after the app is idle or when the player opens it.

The phone copy (artifact) loads the same pinned build from cdnjs (`pixi.js/8.22.0/pixi.min.js`, with jsDelivr as a
fallback), checked with a Subresource Integrity hash of the npm file.

## Owner direction: mid-range to high-end phones, a very high world-class bar (2026-10-18, later)

**D25. A "high tier" for mid-range and high-end phones, at a very high world-class quality.** The owner asked to
assume mid-range to high-end phones (a real GPU, WebGL) and to raise the look to a very high world-class level, using
non-commercial or evaluation tools and assets for the test where they help (D22 rules still apply: registered in
`ASSETS.md`, downloaded by script, never committed, never shipped).
- The engine stays PixiJS 8 (D24), but the high tier uses its WebGL renderer at devicePixelRatio up to 2, so it can
  show high-resolution vector or painted art, filters (glow, light, fog, colour grading) and skeletal animation (Spine,
  evaluation licence, TEST ONLY). The Canvas 2D pixel-art build of v2 stays as the light tier for weak phones
  (`?low=1`, and automatically for Telegram's LOW performance class), so the idea of tiers in D12 is kept.
- Speed rules (D23) still bind: the app's start-up and MCQ path stay untouched, the game loads lazily, every animation
  is skippable, rewards come after grading, wrong answers stay neutral (D2, D3, D20).
- This container has no GPU (WebGL runs on SwiftShader), so the high tier's frame times cannot be judged here: in the
  lab it is held to main-thread budgets (script work per frame, long tasks, load time) and its frame rate is checked
  on a real mid-range phone at Gate 2.
- Honesty rule: free and evaluation packs may not reach a very high world-class look. If they do not, say so with
  screenshots and list the paid options (premium packs, a commissioned artist) for the owner to decide; agents do not
  buy anything.

## The HD tier (2026-10-18, later; paused by the owner before the final reviews)

**D26. The HD tier: PixiJS 8 on WebGL with pixi-filters, a hero animated in code from cut-out parts, Kenney CC0 art
plus procedurally painted layers. The pixel build stays as the light tier.** `v2/world-hd.js` is a second world behind
the same `window.World` interface, so `app.js`, the flow, the MCQ sheet, grading, modes and the harness are shared.
- **Tier choice** (`app.js`): `?tier=light|hd` forces one. Otherwise light for `?low=1`, for Telegram's `LOW)` class, or
  when WebGL is missing. If the HD world fails to start, the light tier loads instead. A phone on which the HD world ran
  slow is remembered (`localStorage` `mcqm-tier`) and starts on the light tier next time.
- **Renderer**: WebGL at `min(devicePixelRatio, 2)`, `autoDensity`. Filters (pixi-filters 6.1.5, MIT, pinned in
  `tools/engine-lock.json`): colour grading (AdjustmentFilter) over the whole scene, light rays (GodrayFilter) as an
  additive overlay at half resolution (day only), a glow on the summit star (GlowFilter), a thin outline on the hero
  (OutlineFilter). **PixiJS filters default to resolution 1**: on 2x screens a full-scene filter must be set to
  `resolution: 'inherit'`, or the whole picture is rendered at 1x and stretched (this was the "soft picture" in two
  review rounds).
- **Hero: no Spine.** No existing Spine skeleton fits (the official examples carry weapons or lack the moves), and a new
  skeleton needs the Spine editor, whose free trial cannot save or export. Instead the Kenney Toon Characters "Female
  adventurer" body parts (CC0) are rigged in code: forward kinematics over 9 parts, target poses eased every frame,
  baked blink and happy faces. Idle (breathing, blink, looking around), run (stride locked to the distance, no foot
  sliding), stair steps, anticipation crouch, jump, fall, land squash, lift ride looking up, reading a book while the
  MCQ is open, a hop with arms up after a correct answer, a calm nod with a hand on the heart after a wrong one, summit
  cheer. 0 KB extra runtime, no licence risk.
- **Art** (`tools/build_assets_hd.py`, register in `ASSETS.md`): Kenney CC0 packs from a GitHub mirror pinned to one
  commit (`tools/assets-hd-lock.json`, 101 files with SHA-256), plus procedural painting at 2 texture px per world
  unit: four mountain ranges with apex-lit faces and snow, a landmark peak, a sea of clouds, one painted cliff per
  ledge (strata, outcrops, moss, vines), props (gondola, pulley, cairn, checkpoint posts and pennants, rope). WebP:
  0.59 MB per palette (day or night), 0.71 MB for both; one 2048 x 2048 atlas; sounds 0.40 MB, loaded only after the
  player turns sound on (both tiers share them).
- **World**: 4-6 parallax layers with strong height parallax (far 0.15, peak 0.35, clouds 0.2, mid 0.3, near 0.55 of
  the camera's rise), so the summit reads as the top; a cloud bank below the path; waterfalls with spray; birds,
  leaves by day, fireflies, stars and torch light by night; checkpoint pennants that run up their posts; a gantry
  lift; a cairn with a star at the summit and a camera pull-back; spring camera with look-ahead; XP counter ticks up.
- **Loading**: only the art for the first frame (atlas, layers, the start cliff) before `lab:game-ready`; the rest
  right after, drawn once before the start button turns on (`World.whenReady`), so no texture uploads during a
  climb. Strip mode draws from a small sheet of its own (`strip.webp`), never from the 2048 px atlas.
- **Quality governor**: if frames run long while moving, the light rays go, then the grading, then the phone is
  remembered for the light tier. It never changes the resolution at run time (a canvas reallocation stalled 0.35-1.7 s
  in the container).

Numbers (360 x 740 at DPR 3, 4x CPU, container without a GPU; harness flags for HD: SwiftShader in the GPU process and
2D canvases on the CPU, because with 2D canvases on SwiftShader PixiJS's start-up readback of a 6 x 1 px canvas stalls
about 0.6 s here, against about 1 ms on a phone):

| | Light tier (Canvas 2D) | HD tier (WebGL) |
|---|---|---|
| Engine + runtimes + game code, gzip | 264 KB (PixiJS 236.8 + app 10.0 + world 10.5 + questions 1.7 + page 5.0) | 320 KB (PixiJS 236.8 + filters 44.3 + app 10.0 + world-hd 21.7 + questions 1.7 + page 5.0); budget 450 |
| Art | 0.09 MB (pixel atlas and layers, PNG) | 0.59 MB per palette; budget 2 MB |
| Load to first frame | 0.49 s (earlier session) | 1.26-1.55 s, about 1.4 s typical; budget 1.5 s |
| Strip / Classic frame p95 / p99 | 16.7-16.8 / 16.8 ms (target p99 33; the old 33.4 was the harness's own script injection, now warmed up first) | not judged here (GPU-bound on SwiftShader) |
| Script time per frame (update + render submission) | n/a | p50 3-4 ms, p95 7-9 ms, p99 12-15 ms; budget p95 8 |
| Long tasks over 50 ms during transitions | 0 | 0 (after removing run-time resizes) |
| Story Next to next MCQ | about 1.12 s (1.6 s on lifts) | 1.8-3.1 s here at full resolution because SwiftShader draws a frame in 0.1-0.75 s; 1.33 s average, 1.70 s max on lifts with the GPU load removed (`?res=0.5&fx=0`) |
| Strip / Classic Next to next MCQ | 137-141 ms / 23-25 ms | 142-150 ms / 23-29 ms |


**Visual quality loop (three rounds, each scored by a fresh independent reviewer against the Ori / Rayman Legends bar,
five screens in day and night):** round 1 day 4-5.5, night 4.5-5; round 2 day 5-6, night 5-6.5; round 3 day 5-6.5,
night 4.5-6. Not 9/10. The round-3 reviewer's judgement: backgrounds could reach about 9 procedurally (Alto's Odyssey
level), cliffs about 8, Kenney props top out near 7, the stock Kenney hero near 7; a realistic ceiling with free and
procedural art is about 7.5. A 9 needs paid work: an original hero designed and rigged by an artist (Spine or Rive,
the full move set), and a premium or commissioned prop and tile set (about 25 props). Agents did not buy anything; the
owner decides. Still open from round 3 (bugs, not taste): the lift's post and arm read as a gallows (make it a braced
tower with a counterweight), the stair steps render as broken narrow columns, the hero has a lavender halo and is not
dimmed at night, a leaf seen edge-on draws as a line, the waterfall starts from nothing, "+10 XP" crosses the lift
ropes.

Still to do (the owner paused the work here): fix the open QA findings (`results/qa-v2-partial.md`) and the round-3
bugs, run the speed, rules and visual reviews from `climb/SPEC.md` on both tiers, a fresh agent's final re-measure
(`results/v2-final-<tier>-<mode>.json`), and the phone link (`tools/make_artifact.py` is ready). The prompt:
`NEXT_AGENT.md`.

## Owner direction: chapter size from a few MCQs to 200 (2026-10-18, later)

**D27. A chapter can have any number of MCQs, from a few (even 1) to 200, and the game must fit every size within the
same budgets.** The prototype was built for 8. Measured or read from the code, a straight N = 200 would break or slow
down in four places: the whole path is built at start-up (200 ledges, signs, coins, flags; the light tier bakes one
texture per island), the height parallax runs out after about 20 MCQs (a 200-MCQ climb is about 22,000 units, so the
backgrounds sink away), the Strip bar is hard-coded for 8 ledges (`app.js` `smx`/`smy`), and Story would add about
1.1-1.2 s per MCQ (about 4 minutes per 200; Strip about 0.14 s per MCQ, about 30 s; Classic about 0).
- **Stages.** The path is cut into stages of about 10 MCQs, one mountain each, ending at a camp (the last stage ends
  at the real summit). A short chapter is one stage; a small remainder (under 4) joins the previous stage, so no stage
  is tiny. Each stage gets its own scenery from the same art pieces (day and night palettes, biome tints such as
  forest, snow, dusk), and the height parallax restarts at each stage's base, so the backgrounds never run out. One
  lift per stage (the long beat); the stage change (camp to the next mountain) is a story beat of at most about 2.5 s,
  always skippable.
- **Constant cost.** Only the current and the next stage exist at a time; ledges, signs, coins, posts and cliffs are
  pooled and reused. No per-ledge texture or per-sign `Text`: the sign numbers come from one shared digit sheet. Load
  time, memory and per-frame work must not grow with N.
- **Numbers fit.** Three-digit counters fit everywhere at 320 px wide in both tiers: sign plates ("Q200"), the top bar
  ("Ledge 200/200"), the sheet header ("Q 200/200"), the Strip bar (current stage's ledges plus "Stage 3/20") and the
  summary card. Edge cases: N = 1 (no transition, straight to the summit), 2, 3, 9, 10, 11, 13, 200.
- **Budgets at every N** (1, 3, 8, 10, 11, 50, 100, 200), both tiers, 4x CPU: load to first frame within 10% of the
  N = 8 value (HD at most 1.5 s); JS heap and texture memory flat with N; HD script time per frame p95 at most 8 ms;
  no long task over 50 ms in any transition, stage changes included; Story Next to next MCQ about 1 s (1.6 s on the
  lift), Strip and Classic under 150 ms; average time added per MCQ over the whole chapter at most about 1.2 s in Story
  (the summary card reports the honest total).
- **Testing.** A lab-only `?n=` parameter builds a chapter of n MCQs by repeating the 8 samples (renumbered), and the
  harness gets `--n`; full 200-MCQ runs check memory and every stage change. On the phone link, a lab-only picker on
  the start card offers 8, 50 and 200 MCQs, so the owner can feel a long chapter.
