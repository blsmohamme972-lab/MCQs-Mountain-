# MCQs Mountain: the method, step by step

**STATUS (update this line whenever a step finishes):** Gate 0, v2 with two tiers; paused by the owner on 2026-10-18
before the final reviews. The ready prompt: `NEXT_AGENT.md`.
- Done: engine spike and D24. Light tier (`v2/world.js`, Canvas 2D pixel art): Strip and Classic p99 now 16.8 ms at
  4x CPU (the old 33.4 ms was the harness's own script injection; the harness now warms it up first). HD tier (D26,
  `v2/world-hd.js`, WebGL): code-rigged CC0 hero, painted parallax and cliffs, filters, particles, sound (off by
  default, both tiers), `ASSETS.md`, the phone-copy generator `tools/make_artifact.py`. Numbers in D26: HD first frame
  about 1.4 s at 4x, script time p95 7-9 ms, no long task in transitions, 320 KB gzip of code, 0.59 MB of art.
- Visual loop: three independent rounds, best scores 5-6.5 of 10, not the 9 the owner asked for. The reviewer's
  ceiling with free and procedural art is about 7.5; a 9 needs an artist-made hero with a rig and premium props (D26).
- Open: the QA findings in `results/qa-v2-partial.md` (unverified, one page error while loading), the round-3 bugs
  (lift looks like a gallows, broken stair columns, night halo), chapters from a few MCQs to 200 within the same
  budgets (owner, D27: stages of about 10, pooled objects, three-digit numbers that fit), the speed, rules and visual
  reviews on both tiers, the fresh final re-measure (also at 200 MCQs), the phone link (Gate 1).

Last updated: 2026-10-18.

## How a professional runs this (the principles behind the gates)

1. **Measure before building, and decide the pass/fail rules before testing.** Write the speed budget and the kill
   criteria first, so the result cannot be argued afterwards.
2. **Gray-box before art.** Test the loop with simple shapes and a placeholder character. Draw the real character only
   after the loop has proved fast and liked.
3. **Test on the worst phone, inside Telegram.** A fast laptop proves nothing. The floor device is a cheap Android
   phone of the kind most Kafu students own.
4. **Compare against no game.** Every test runs Story mode (the owner's idea), Strip mode (the research alternative)
   and Classic mode (no game) side by side.
5. **The question is the level.** The game exists to get more MCQs answered and remembered. Questions per minute and
   accuracy are guardrails that the game must not lower.
6. **Students and instruments decide, not opinions.** Device traces, timed playtests and a pilot with a comparison
   group are the evidence. Our own impression is not.
7. **World-class look, even for tests (owner, D19).** A test with weak art cannot convince anyone, so the placeholder
   stage uses world-class test assets (registered, never shipped, D22) instead of home-made shapes.

## Gates

Each gate has an exit condition. Do not start a gate before the previous one has passed, unless the owner says so.

### Gate 0: lab prototype and lab numbers

- First draft (done): `climb/index.html`, hand-written Canvas 2D, three modes, the harness contract from `README.md`.
  Its look was rejected by the owner (D18).
- Now: pick a professional engine with a measured spike (D21), then rebuild the world and hero at world-class quality
  (D19) with registered test assets (D22), keeping the flow, MCQ sheet, grading, modes and harness contract.
- Review it four ways (speed, bugs, the app's design rules, visual quality), fix, then have an agent who did not build
  it re-measure.
- **Exit:** at 4x CPU throttling, movement frame p95 at or under 16.7 ms and p99 at or under 33 ms; no long task over
  50 ms during transitions; Next to the first visible change under 100 ms; Story mode Next to the next MCQ about 1 s
  (about 1.6 s on a lift beat); Strip and Classic under 150 ms; the game's own load time (engine plus art, from
  starting to load until the first frame) measured and reported. Results saved as JSON in `results/`. The owner
  judges the look from screenshots: it has to read as a world-class 2D game, not a demo (D19).

### Gate 1: the owner feels it

- Send the owner the private claude.ai link (phone-friendly copy of `climb/index.html`). Ask them to try all three
  modes and say which ones go forward.
- Then, **only if the owner agrees and does the account steps**, run it inside Telegram as its own Mini App:
  - The owner creates a separate test bot in @BotFather (for example "Kafu Lab"). Never reuse `@KafuMcqsbot`.
  - Host the one file on a free static host that is separate from the app (for example its own Cloudflare Worker
    with static assets, or Cloudflare Pages). Never put it under `app/`.
  - Why a separate bot: since Bot API 10.2 (switched on for all Mini Apps on 2026-07-20) Telegram blocks Mini App
    methods from origins other than the Mini App's own domain. A page opened from inside Kafu on another domain loses
    the Telegram APIs. A separate bot also keeps the owner's "do not integrate yet" rule.
- **Exit:** the owner has played it and chosen the modes to keep.

### Gate 2: real phones

- Devices: one floor phone (Helio G36 or G81 class: Honor X5b, Infinix Smart 9 or Tecno Spark Go 1), one mid-range
  Samsung A, one older iPhone (WKWebView is capped at 60 fps; Low Power Mode drops to 30).
- Android trace: in Telegram press and hold the version number (in Settings) twice, choose "Enable WebView Debug",
  connect USB, open `chrome://inspect/#devices` on a computer, record a Performance trace while playing 8 MCQs.
- iOS trace: in Telegram tap Settings 10 times, turn on "Allow Web View Inspection", use Safari Web Inspector,
  Timelines, Rendering Frames.
- Also open the prototype with `?debug=1` on each phone and photograph the overlay at the end.
- **Exit:** the same numbers as Gate 0, but on the floor phone inside Telegram, recorded in `results/devices.md`.
  If the floor phone fails, use `?low=1` (DPR 1.5, no parallax) and re-test before changing the design.

### Gate 3: the game's own original hero

- The test assets of Gate 0 prove the game; this gate replaces them with Kafu's own original hero and world (not
  medical, D18), at the same world-class quality, so nothing "TEST ONLY" remains.
- Follow `CHARACTER_BRIEF.md` in order: brief, silhouettes, silhouette test with 5 students, model sheet, expression
  sheet, key poses timed in the prototype, then clean-up and one atlas (1024 x 1024 or smaller).
- **Exit:** 5 new students recognise the silhouette at phone size; reverse-image search finds no look-alike; Gate 2
  numbers still hold with the real atlas.

### Gate 4: students try it (usability)

- Think-aloud sessions: 5 students per round, on their own phones and their own internet, inside Telegram, doing
  their normal 20-40 MCQ session. Fix problems between rounds (the RITE method). Plan 3 rounds of 5.
- Measure per mode: seconds per MCQ, skips, wrong taps, where they hesitate, which mode they would keep. Optional
  questionnaire: PXI (Player Experience Inventory) instead of "do you like it?".
- Record results in `results/playtests.md` without names or Telegram IDs.
- **Exit:** students finish without help, and Story mode costs no more than about 1 s per MCQ in practice.

### Gate 5: baseline and pilot (needs owner approval before starting)

- Any measuring of students in the real app needs the owner's approval first: `docs/DESIGN.md` forbids adding an
  analytics dependency or background polling. Options to put to the owner: on-device logging that students export,
  or a small, privacy-safe counter on the Worker.
- Baseline from the current app for at least 2 weeks: seconds per MCQ, MCQs per session, where sessions end,
  day-1 and day-7 return.
- Pilot with 20-50 students, within-subject crossover: each student uses the game on half the chapters and Classic
  on the other half, order counterbalanced.
- What a pilot this small can show: usability, speed on real phones, big losses in throughput, preference,
  feasibility. What it cannot show: a learning effect, 30-day retention, or anything after the novelty wears off
  (gamification effects start fading after about 4 weeks).
- **Kill criteria (write them down before the pilot starts, do not change them after):**
  - MCQs per minute drop by more than 5% against Classic, or
  - accuracy drops, or
  - no improvement in 7-day return or in finishing planned sets.
  - If any is hit: stop the full game, keep only Strip mode, or drop the idea.
- **Exit:** the kill criteria are not hit, and the owner decides to integrate.

### Gate 6: integration (only with the owner's explicit written go-ahead)

Prerequisites, each in its own reviewed PR:

1. **Make room in the start-up budget.** It is full: 153,244 of 153,600 gzip bytes (measured 2026-10-18). Move
   owner-only code out of the start-up path with behaviour unchanged: `mcq-export` (about 8.9 KB), `admin-usage`
   (about 2.6 KB), the hidden `#gallery` (about 4.4 KB).
2. **Load the game lazily**, the same way as `app/modules/leaders-loader.js`. Lazy files are not counted by
   `tools/ui/check.py budget()`, but `docs/DESIGN.md` words the budget more strictly, so the owner confirms first.
3. **Offline:** `app/sw.js` does not cache `.webp` or most of `/assets/` today. The game's files must be cached, with
   tests (`tools/tests/js/service-worker*.test.cjs`).
4. **Rule changes the owner must approve:** `docs/DESIGN_STYLE.md` says "avoid continuous motion in study views" and
   study-core rule 6 says "no animation on every study event". A game mode needs an explicit exception.
5. **Attach with one `KafuEnhancements` installer:** wrap `nextQuestion` (call the original first so the next MCQ is
   rendered behind the game) and `back`; put the canvas outside `#app` (`render()` replaces `#app` every time); take
   over Telegram's MainButton and BackButton the way `motioncards-player.js` does. Details with line numbers:
   `research/01-code-map.md`.
6. **Coins are only a view of XP** (`app/modules/xp-ledger.js`). No new coin balance, no change to XP rules. Any new
   saved setting is an additive key with a tested migration and owner review.
7. **Off by default, behind a switch,** Classic stays the default. CI `next_question_ms` must stay at or under 100 ms.
8. Design PRs never self-merge. Screenshots and CI are evidence for the owner, who merges.

## Pending owner decisions

- Answered on 2026-10-18: no medical characters; world-class 2D quality and atmosphere in a professional engine, even
  for the test; non-commercial tools allowed for testing; the app's speed must stay untouched (D18-D23).
- Which modes go forward after Gate 1 (Story, Strip, or both)?
- Create a separate test bot and free hosting for Gate 1 (owner's accounts)?
- Approve any measurement of students for Gate 5, and how?
- Name of the main character (Gate 3).
- At Gate 6: budget exception or lazy-chunk rule, and the motion-rule exception.
