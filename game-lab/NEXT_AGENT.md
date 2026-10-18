# Next agent: the task prompt

The owner can paste the block below into a new Claude Code session on this repository. It is kept up to date with
the STATUS line in `PLAN.md`. Last updated: 2026-10-18, after the engine spike (D24) and the first v2 build, paused by
the owner.

```text
Continue the "MCQs Mountain" 2D game prototype in the Kafu repo (blsmohamme972-lab/MCQs-Mountain-). Spend credits
carefully without lowering quality: do the work yourself in this session, read only the files you need, and use at
most one or two helper agents for the independent reviews at the end (no large multi-agent workflows).

Where the work is:
- Branch ccr-027f1300-5q5swg holds everything so far (it includes the older branch ccr-efb5e2bb-wvj576). Fetch it
  first. If your session has a different designated branch, merge this one into yours; do not lose its commits.
- Read: game-lab/PLAN.md (STATUS at the top), game-lab/DECISIONS.md D18-D24, game-lab/README.md (harness contract and
  how to run v2). Open game-lab/research/05-assets-scouting.md only for asset choices. Do not redo the engine spike or
  the asset search.

What exists (all measured in the cloud container, 360x740, 4x CPU):
- D24: PixiJS 8.22.0 with its Canvas 2D renderer, pixel art at 1 canvas px per CSS px, scaled by CSS
  (image-rendering: pixelated); ?gl=1 switches to WebGL for phone tests. tools/fetch_engine.py fetches the pinned
  engine into game-lab/vendor/ (git-ignored).
- game-lab/v2/: index.html (CSS, DOM, LAB_CONFIG), questions.js (the 8 draft questions, verified identical), app.js
  (flow, MCQ sheet, grading, modes, summary, Telegram, harness, sound manager, strip), world.js (the PixiJS world:
  floating islands over the sea, two parallax mountain ranges drawn by our build script, clouds, water glints, hops
  with dust, two lifts, coins that fly to the hero after grading, "+10 XP" labels, trophy and confetti at the summit,
  night palette with stars for dark mode, reduced motion as instant cuts, ?low=1 tier, ?hero=captain|frog|pink|guy|mask).
- Test art: tools/fetch_assets.py downloads 133 CC0 files (Pixel Frog "Treasure Hunters" and "Pixel Adventure") from
  commit-pinned GitHub raw URLs with SHA-256 checks (tools/assets-lock.json), then tools/build_assets.py (Pillow)
  builds game-lab/assets-test/build/ (atlas 1024x712, layers, night versions, kit.json). All git-ignored.
- tools/measure.mjs accepts a URL (serve game-lab/ with python3 -m http.server 8765), throttles before load and
  reports game_ready_ms / game_load_to_ready_ms (marks lab:game-load, lab:game-ready).
- v2 numbers so far: Story p95 16.7 / p99 16.8 ms, Next to first frame about 5 ms, Next to next MCQ about 1.12 s
  (1.6 s on lifts), game load 0.49 s; Strip 138 ms; Classic 22-35 ms; zero console errors in every mode.

Your task, in order:
1. Speed gap: Strip and Classic have frame p99 33.4 ms at 4x (target 33) and p95 33.3 at 6x. Likely cause: drawStrip()
   calls getComputedStyle twice per draw, plus the page swap in activate(); cache the colours (re-read on theme
   change) and keep World work off the tap frame (World.place/sign already defer with renderLater). Re-measure.
   Story: about 1.12 s per MCQ; trim to about 1 s if it costs no quality (hop 195 ms, walk 110 ms in world.js planMove).
2. Assets: pick the final hero (the default "captain" wears a skull hat, which can read badly in a medical app; the
   Pixel Adventure heroes are the alternatives). Decide whether the mountain background should come from ansimuz
   "Super Mountain Dusk" (CC0, very strong, but a dusk palette next to Pixel Frog's outlined art; see
   research/05-assets-scouting.md) or stay with our generated ranges. Add sound: one CC0 music loop (ansimuz Sunny Land
   collection music, for example "Going Up", mirror Deepmj13/FoxyGame, see research/05) and CC0 sound effects (Kenney
   audio packs on a GitHub mirror). Put them in tools/assets-lock.json ("files" plus the "sounds" key map, which
   build_assets.py encodes to MP3 with ffmpeg), and make app.js read the sound list from kit.json (LAB_CONFIG.sounds
   still lists placeholder .ogg names). Sound stays off by default and loads only after the player turns it on.
3. Write game-lab/ASSETS.md: every pack and file group, author, original URL, GitHub mirror and commit, exact
   licence with the evidence (Pixel Frog's itch pages say CC0; OpenGameArt lists Pixel Adventure as CC-BY 4.0, so
   note it and credit Pixel Frog anyway), "TEST ONLY: replace before any release" where it applies, and our own lab
   art (the two mountain ranges, signs, night versions, star field made by build_assets.py and world.js).
4. The four reviews from game-lab/climb/SPEC.md against v2 (speed incl. 6x; QA across modes, question types, rapid
   taps, skip, resize and rotation, reduced motion, dark mode, keyboard, 320 px to iPad 820x1180 and 1280x800; rules and
   learning; visual quality against world-class 2D games). One helper agent can run QA plus rules, another speed plus
   visual. Fix confirmed blockers and majors. Then a fresh agent that did not fix anything re-measures every mode at
   --cpu 1,4,6 --q 8 (JSON to game-lab/results/v2-final-<mode>.json) and takes screenshots (send them in chat, never
   commit them).
5. Phone link (Gate 1): load the artifact-design skill, then publish a private claude.ai Artifact titled
   "MCQs Mountain": the v2 page with its document wrapper removed, Google Fonts Fredoka and Nunito, the engine from
   https://cdnjs.cloudflare.com/ajax/libs/pixi.js/8.22.0/pixi.min.js with a Subresource Integrity hash of the npm file
   and a jsDelivr fallback (D24 promises both; app.js's loader needs integrity, crossorigin and fallback support), and
   app.js, world.js, questions.js plus assets-test/build/* as supporting files with assetBase 'assets/'. Write the
   generator as game-lab/tools/make_artifact.py. The repo files stay the source of truth.
6. Update the STATUS line in game-lab/PLAN.md, the table in game-lab/README.md, D24's numbers if they changed, and this
   file. Commit and push (text only).

Tools: Chromium is preinstalled; install playwright@1.56.1 in a scratch folder and symlink its node_modules into
game-lab/tools/ (git-ignored). Never run "playwright install". WebGL here is software (SwiftShader); Canvas 2D is the
path that is measured. Only npm and GitHub are reachable from the container.

Rules:
- Work only inside game-lab/. Do not touch app/, worker/, tools/, CI or deployment. Nothing is integrated into the app
  without the owner's written go-ahead.
- Lean storage: commit text only (code, Markdown, JSON). No images, audio, packs, engine files, ZIPs or node_modules.
- Never use Nintendo or other franchise assets; no medical characters. Do not create bots, hosting or deployments. Do
  not open a pull request unless asked.
- At the end, report to the owner in simple Iraqi Arabic: the engine and why (with numbers), screenshots, the phone
  link, the speed numbers per mode, and what remains.
```
