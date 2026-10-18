# Next agent: the task prompt

The owner can paste the block below into a new Claude Code session on this repository. It is kept up to date with
the STATUS line in `PLAN.md`. Last updated: 2026-10-18, after the owner's direction D25 (mid-range to high-end phones,
a very high world-class look).

```text
Continue the "MCQs Mountain" 2D game prototype in the Kafu repo (blsmohamme972-lab/MCQs-Mountain-). The owner's new
direction (game-lab/DECISIONS.md D25): assume mid-range to high-end phones and raise the look to a very high
world-class level, the polish and atmosphere of top 2D platformers (modern Mario, Rayman Legends, Ori level of finish),
using non-commercial or evaluation assets and tools for the test where they help. Spend credits carefully without
lowering quality: do the building yourself, read only the files you need, and use helper agents only for the
independent reviews (at most two at a time, no large multi-agent workflows).

Where the work is:
- Branch ccr-027f1300-5q5swg holds everything so far (it includes ccr-efb5e2bb-wvj576). Fetch it first. If your
  session has a different designated branch, merge this one into yours; do not lose its commits.
- Read: game-lab/PLAN.md (STATUS at the top), game-lab/DECISIONS.md D18-D25, game-lab/README.md (harness contract,
  how to run v2). Open game-lab/research/05-assets-scouting.md only for asset choices. Do not redo the engine spike.

What exists (360x740, 4x CPU, cloud container):
- D24: PixiJS 8.22.0, fetched pinned by tools/fetch_engine.py into game-lab/vendor/ (git-ignored).
- game-lab/v2/ works end to end in Story, Strip and Classic with zero console errors: index.html (CSS, DOM,
  LAB_CONFIG), questions.js, app.js (flow, MCQ sheet, grading, modes, summary, Telegram, harness, sound manager,
  strip), world.js (the world on PixiJS's Canvas 2D renderer with CC0 pixel art from Pixel Frog: floating islands,
  parallax mountains, clouds, hops with dust, two lifts, coins after grading, summit trophy, night palette, reduced
  motion, ?low=1, ?gl=1, ?hero=...). Art comes from tools/fetch_assets.py + tools/build_assets.py (pinned, hashed,
  git-ignored). tools/measure.mjs accepts a URL and reports load time (lab:game-load, lab:game-ready).
- Numbers: Story frame p95 16.7 / p99 16.8 ms, Next to first frame about 5 ms, Next to next MCQ about 1.12 s (1.6 s
  on lifts), load 0.49 s; Strip 138 ms; Classic 22-35 ms. Strip and Classic p99 is 33.4 ms (target 33).

Your task, in order:
1. Keep the current pixel build as the LIGHT tier (weak phones: ?low=1 and Telegram's "LOW)" performance class).
   Fix its small gap first: drawStrip() calls getComputedStyle on every draw; cache the colours, re-measure Strip and
   Classic until p99 <= 33 ms at 4x.
2. Build the HIGH tier (the default for everyone else) at a very high world-class look, in game-lab/v2 (a separate
   world file such as world-hd.js is fine; app.js, the flow, the MCQ sheet, grading, modes and the harness contract
   stay shared and unchanged in behaviour):
   - PixiJS WebGL renderer, resolution min(devicePixelRatio, 2), high-resolution vector or painted art.
   - The hero animated with Spine (the spine-pixi-v8 runtime from npm, pinned and hashed like the engine; Spine's
     evaluation licence, TEST ONLY) or, if no suitable skeleton exists, the best high-resolution frame animation
     available. Full set: idle with breathing and blink, run, anticipation before jumps, jump, fall, land with squash,
     climb stairs, ride the lift looking up, read while the MCQ is open, a celebration after a correct answer, a calm
     supportive pose after a wrong one. Not medical, not a franchise character.
   - A deep world: 4-6 parallax layers plus a foreground layer passing in front of the camera, a mountain to climb,
     decorations on every ledge, animated water or waterfalls, ambient life (birds, leaves, drifting clouds), checkpoint
     flags that rise when a ledge is passed, a landmark at the summit, day and night versions.
   - Atmosphere with PixiJS filters (pixi-filters, pinned): soft light rays or glow, fog on far layers, colour grading;
     particles for dust, coin sparkle trail, confetti. Camera with easing and look-ahead; the XP counter ticks up.
   - Music and sound effects (CC0 or evaluation), off by default, loaded only after the player turns sound on.
   - Candidate free sources are in research/05-assets-scouting.md (for example Kenney Toon Characters + Platformer Pack
     Redux + Background Elements Redux, all CC0 and high resolution; ansimuz music loops, CC0). Use one consistent art
     style. Download by script into assets-test/ (git-ignored), pinned to commits with SHA-256, register every file
     group in a new game-lab/ASSETS.md (author, source, mirror and commit, exact licence with evidence, "TEST ONLY:
     replace before any release" where it applies).
   - Budgets for the high tier: engine + runtimes + game code <= 450 KB gzip; art <= 2 MB (atlases <= 2048 x 2048,
     WebP or PNG); load to first frame <= 1.5 s at 4x CPU in the harness; no long task over 50 ms during transitions;
     script time per frame (update plus render submission, measured with performance marks inside the ticker) p95
     <= 8 ms at 4x CPU. This container has no GPU (WebGL is SwiftShader), so report frame times but judge the GPU side
     on a real mid-range phone later (Gate 2), as D25 says. Story Next to next MCQ about 1 s (1.6 s on lifts), always
     skippable; Strip and Classic under 150 ms.
3. Quality loop: after each build round, an independent review agent scores five screens (Start, mid-climb, lift, MCQ
   open, summit) in day and night out of 10 against the bar above, with concrete fixes. Fix and re-score until every
   screen is at least 9/10, at most 3 rounds. If free and evaluation assets cannot reach 9/10, stop and report it
   honestly with screenshots and the paid options (premium packs, a commissioned artist) for the owner; never buy
   anything.
4. The four reviews from game-lab/climb/SPEC.md against both tiers (speed incl. 6x; QA across modes, question types,
   rapid taps, skip, resize and rotation, reduced motion, dark mode, keyboard, 320 px to iPad 820x1180 and 1280x800;
   rules and learning; visual). Fix blockers and majors. Then a fresh agent that did not fix anything re-measures every
   mode for both tiers at --cpu 1,4,6 --q 8 (JSON to game-lab/results/v2-final-<tier>-<mode>.json) and takes
   screenshots (send them in chat, never commit them).
5. Phone link (Gate 1): load the artifact-design skill, then publish a private claude.ai Artifact titled
   "MCQs Mountain": the v2 page without its document wrapper, Google Fonts Fredoka and Nunito, the engine and runtimes
   from cdnjs with exact versions and Subresource Integrity hashes of the npm files (jsDelivr as fallback; app.js's
   loader needs integrity, crossorigin and fallback support), and the code and built art and audio as supporting files
   (assetBase 'assets/'). Write the generator as game-lab/tools/make_artifact.py. The repo files stay the source of
   truth. Ask the owner to try both tiers on a mid-range phone.
6. Update the STATUS line in game-lab/PLAN.md, the table in game-lab/README.md, record the high tier's engine choices
   and numbers as a new decision (D26) in DECISIONS.md, and update this file. Commit and push (text only).

Tools: Chromium is preinstalled; install playwright@1.56.1 in a scratch folder and symlink its node_modules into
game-lab/tools/ (git-ignored). Never run "playwright install". Only npm and GitHub are reachable from the container
(itch.io, OpenGameArt, kenney.nl, cdnjs are blocked); public GitHub repos can be cloned after add_repo answers that
read access is available.

Rules:
- Work only inside game-lab/. Do not touch app/, worker/, tools/, CI or deployment. Nothing is integrated into the app
  without the owner's written go-ahead, and the app's start-up and MCQ speed stay untouched (D23).
- Lean storage: commit text only (code, Markdown, JSON). No images, audio, packs, engine files, ZIPs or node_modules.
- Never use Nintendo or other franchise assets or look-alikes; no medical characters. Do not create bots, hosting or
  deployments. Do not open a pull request unless asked.
- At the end, report to the owner in simple Iraqi Arabic: what the high tier looks like (screenshots), the review
  scores, the sizes and speed numbers per tier and mode, the phone link, and what remains.
```
