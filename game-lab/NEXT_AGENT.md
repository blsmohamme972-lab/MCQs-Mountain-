# Next agent: the task prompt

The owner can paste the block below into a new Claude Code session on this repository. It is kept up to date with
the STATUS line in `PLAN.md`. Last updated: 2026-10-18 (late), when the owner stopped the session in the middle of
D27 (chapters from a few MCQs to 200): the HD world and app.js are done, the light world is not.

```text
Continue the "MCQs Mountain" 2D game prototype in the Kafu repo (blsmohamme972-lab/MCQs-Mountain-). The game has two
tiers (game-lab/DECISIONS.md D25-D27): the LIGHT tier (v2/world.js, Canvas 2D pixel art, for weak phones) and the HD
tier (v2/world-hd.js, WebGL, the default, for mid-range and high-end phones). The owner's latest rule (D27): a chapter
can have any number of MCQs from 1 to 200, and the game must fit every size within the same speed and size budgets.
Finish the job. Spend credits carefully: do the building yourself, read only the files you need, use helper agents
only for the independent reviews (at most two at a time, no large multi-agent workflows). The owner may ask you to
pace the work (for example "work half an hour, rest an hour"): then commit and push before each rest and schedule
your own wake-up with the send_later tool.

Where the work is:
- Branch ccr-be53cbba-utrxso holds everything (it includes ccr-027f1300-5q5swg and ccr-efb5e2bb-wvj576). Fetch it
  first. If your session has a different designated branch, merge this one into yours; do not lose its commits.
- Read: game-lab/PLAN.md (STATUS at the top), game-lab/DECISIONS.md D24-D27 (D26: the HD tier's design and numbers so
  far; D27: chapters of 1 to 200 MCQs), game-lab/README.md (harness contract, how to run both tiers, harness flags),
  game-lab/ASSETS.md, game-lab/results/qa-v2-partial.md (QA findings and which ones are fixed). Do not redo the engine
  spike, the art direction or the visual quality loop: three rounds are done (best 5-6.5 of 10; the reviewers' ceiling
  with free and procedural art is about 7.5; a 9 needs an artist-made hero and premium props; the owner decides).

Setup (the container is fresh each session; nothing below is committed):
- python3 game-lab/tools/fetch_engine.py (PixiJS 8.22.0 and pixi-filters 6.1.5 from npm, pinned and hashed).
- python3 game-lab/tools/fetch_assets.py (light and HD test art and sound from pinned GitHub mirrors, then builds both
  tiers; needs Pillow, numpy and ffmpeg; about a minute).
- Install playwright@1.56.1 in a scratch folder and symlink its node_modules into game-lab/tools/ (git-ignored).
  Never run "playwright install".
- Serve game-lab/ with python3 -m http.server 8765. Pages: http://127.0.0.1:8765/v2/index.html (HD),
  ?tier=light (light), ?n=25 (a chapter of 25 MCQs: the 8 samples repeated), ?mode=story|strip|classic, ?rm=1
  (reduced motion, everything instant: fastest way to run a long chapter), ?gov=0 (HD full quality for screenshots).
- This container has no GPU: HD frames take 0.1-0.75 s here (SwiftShader), which also stretches the timed animations.
  Judge the HD tier on main-thread numbers (script time per frame, long tasks, load to first frame); the frame rate
  is checked on the owner's phone (D25). tools/measure.mjs already starts Chromium with the right flags for HD.

State of the work (all pushed, last commit on the branch):
- DONE in app.js and index.html: chapter size from ?n= or the start card's lab picker (localStorage mcqm-n), stages of
  about 10 MCQs (a remainder under 4 joins the previous stage) passed to the world as env.stages, the Strip bar per
  stage with "Stage s/S", lab switches on the start card (HD / Light, 8 / 50 / 200), and the QA fixes listed as fixed
  in results/qa-v2-partial.md (Check double-tap guard, focus after Check, Classic ledge counter, XP fallback, resize
  after a rotation while loading, answer marks wrapping under 360 px, cards scrolling instead of sliding under the
  top bar).
- DONE in world-hd.js: stage-local layout, a per-stage build from shared textures (constant work per stage), clouds
  rise to hide the stage change (about 1 s, skippable), a camp at the top of each stage and the real summit only in
  the last, per-stage light, sign numbers from one bitmap font, a braced lift tower with a counterweight (it looked
  like a gallows before), stairs as stone blocks on a rock base, waterfalls between two rocks, night halo removed,
  guards before the scene exists. Checked ONLY functionally, with reduced motion: chapters of 1, 8, 13, 25 and 200
  complete in Story with no errors, 25 in Strip and Classic, HD heap 10-12 MB from 8 to 200 MCQs.
- NOT DONE: nobody has looked at the new HD art yet (stage change, camp, lift tower, stone stairs, the lab row on the
  start card, the Strip bar per stage); world.js (light tier) is not stage-aware (it still builds the whole chapter,
  bakes one island texture per ledge and one sign texture per number); no measurement at N > 8; the four reviews;
  the final re-measure; the phone link; the final docs.

Your task, in order:
1. Look before building on it: run tools/shots.mjs (day and night) and a normal-motion Story run with ?n=25 on the HD
   tier; take screenshots of a stage change (clouds rising, the camp, the next mountain), the lift tower, the stone
   stairs, the start card's lab row at 320 x 568 and 360 x 740, and the Strip bar on stage 2. Fix anything broken.
2. Make world.js (light tier) stage-aware like world-hd.js, with the same window.World interface and env.stages:
   stage-local layout, build only the current stage, cache the island textures by size (columns x rows) instead of one
   per ledge, draw sign numbers from the pixel font onto a shared plate (no texture per number, or release them when
   the stage ends), a short fade for the stage change (skippable, instant under reduced motion), a camp at the end of
   each stage and the summit only in the last.
3. Add --n to tools/measure.mjs (it already has --q for the number of MCQs answered) and measure both tiers at N = 1,
   8, 50 and 200 against the D27 budgets: load to first frame within 10% of N = 8 (HD at most 1.5 s at 4x CPU), JS
   heap flat with N, HD script time per frame p95 at most 8 ms, no long task over 50 ms in any transition (stage
   changes included), Story Next to next MCQ about 1 s (1.6 s on the lift; a stage change about 2.5 s), Strip and
   Classic under 150 ms, at most about 1.2 s added per MCQ on average in Story. Fix what misses. Write the results to
   game-lab/results/d27-<tier>-n<N>.json.
4. The four reviews from game-lab/climb/SPEC.md (speed incl. 6x; QA across modes, question types, rapid taps, skip,
   resize and rotation, reduced motion, dark mode, keyboard, 320 px to iPad 820x1180 and 1280x800, chapter sizes 1,
   8 and 200; rules and learning; visual) against BOTH tiers, by independent agents, at most two at a time. Give the
   HD agents the harness flags from README.md. Fix blockers and majors.
5. Then a fresh agent that did not fix anything re-measures every mode for both tiers at --cpu 1,4,6 --q 8 (JSON to
   game-lab/results/v2-final-<tier>-<mode>.json) plus a 200-MCQ chapter for both tiers (JSON to
   game-lab/results/v2-final-<tier>-<mode>-n200.json), and takes screenshots with tools/shots.mjs (send them in chat,
   never commit them).
6. Phone link (Gate 1): load the artifact-design skill, run python3 game-lab/tools/make_artifact.py <scratch>/artifact
   (it writes the page without its document wrapper, Google Fonts Fredoka and Nunito, PixiJS and pixi-filters from
   cdnjs with Subresource Integrity hashes and jsDelivr as fallback, and the code, art and sound as supporting files
   under assets/), then publish a private claude.ai Artifact titled "MCQs Mountain" with those files. The repo files
   stay the source of truth. Ask the owner to try both tiers and the 8 / 50 / 200 chapters on a mid-range phone (the
   lab row on the start card switches them) and to report how smooth it feels.
7. Update the STATUS line in game-lab/PLAN.md, the table in game-lab/README.md, the numbers in DECISIONS.md D26 and
   D27 (final per tier, mode and chapter size), results/qa-v2-partial.md, and this file. Commit and push (text only).

Rules:
- Work only inside game-lab/. Do not touch app/, worker/, tools/, CI or deployment. Nothing is integrated into the app
  without the owner's written go-ahead, and the app's start-up and MCQ speed stay untouched (D23).
- app.js, the flow, the MCQ sheet, grading, modes and the harness contract stay shared by both tiers and unchanged in
  behaviour (bug fixes excepted).
- Lean storage: commit text only (code, Markdown, JSON). No images, audio, packs, engine files, ZIPs or node_modules.
- Never use Nintendo or other franchise assets or look-alikes; no medical characters. Never buy anything. Do not
  create bots, hosting or deployments. Do not open a pull request unless asked.
- At the end, report to the owner in simple Iraqi Arabic: what changed (screenshots), the review findings and fixes,
  the sizes and speed numbers per tier, mode and chapter size, the phone link, and what remains (including the
  paid-art options for a 9/10 look, already listed in D26).
```
