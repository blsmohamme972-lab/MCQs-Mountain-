# MCQs Mountain: decision log

Each decision has its reason and its source. Sources marked `research/0N` point to the saved reports, which list
every claim with its URL and the independent fact-check verdict. Do not reverse a decision without new evidence or
the owner's word; if you do, add a new entry instead of editing the old one.

## Where the owner's first idea needed changing

| Owner's idea | Problem | What we do instead | Source |
|---|---|---|---|
| Walk, take a coin, then the MCQ appears | Rewards before an answer break the app's own rule and the motivation research | A "?" sign opens the MCQ; the coin on that ledge is earned only after the answer is scored | D2 |
| A Super Mario-like world | The approved style allows pixel art only as a rare accent, and art must be original | Arcade-Clean vector world and an original character | D4 |
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

**D4. Arcade-Clean vector art, original, no pixel world.** Thick ink outline, hard offset shadow, token colours only.
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

**D7. Hand-written Canvas 2D, zero libraries.** The app's start-up budget is full: 153,244 of 153,600 gzip bytes
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

**D9. Animation by sprite sheets, authored as cut-out vector.** Draw body parts on layers in Inkscape, pose them, export
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
