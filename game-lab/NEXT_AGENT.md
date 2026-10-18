# Next agent: the task prompt

The owner can paste the block below into a new Claude Code session on this repository. It is kept up to date with
the STATUS line in `PLAN.md`. Last updated: 2026-10-18, after the owner's new direction (D18-D23).

```text
Continue the "MCQs Mountain" 2D game prototype in the Kafu repo (blsmohamme972-lab/MCQs-Mountain-).

Where the work is:
- Branch ccr-efb5e2bb-wvj576 holds everything so far. Fetch it first (git fetch origin ccr-efb5e2bb-wvj576). If your
  session has a different designated branch, merge this one into yours; do not lose its commits.
- Read in this order: game-lab/README.md, game-lab/PLAN.md (STATUS line at the top), game-lab/DECISIONS.md (above all
  D18-D23, the owner's new direction), game-lab/CHARACTER_BRIEF.md, game-lab/climb/SPEC.md. Open game-lab/research/
  only when you need evidence. Do not redo the research.

The owner's direction (D18-D23), in short:
- The first draft (game-lab/climb/index.html) works: flow, MCQ sheet, grading, three modes, harness hooks, speed. Its
  LOOK was rejected: the characters are "very silly". No medical characters at all.
- The owner wants a professional game in a professional engine, with the atmosphere and quality of world-class 2D
  games such as Super Mario, even if it is only a test. "Like Super Mario" means that quality level and the genre's
  conventions, never Nintendo's characters, art, music, sounds or look.
- Non-commercial or evaluation tools and assets are allowed for the test only.
- It must be fast, and the app's speed must stay untouched.

Your task, in order:
1. Engine spike (D21). Build the same small scene in Phaser 4 and in PixiJS 8 (pinned exact versions): 4-5 parallax
   layers, an animated hero from a sprite sheet, a coin with particles, camera follow, one MCQ sheet as DOM on top.
   Measure each at --cpu 1,4,6: gzip size of the engine plus scene code, time from starting to load the game code
   until the first frame, frame p95/p99, long tasks, JS heap. Pick one. Record the choice and the numbers as a new
   decision (D24) in game-lab/DECISIONS.md and the raw JSON in game-lab/results/.
   Do not commit the engine file itself: fetch it with a small script that pins the version and checks a SHA-256,
   into a git-ignored folder (the same idea as tools/vendor_frontend.py for the app).
2. Test assets (D22). Choose world-class-looking 2D platformer art, a hero with a full animation set (idle, run,
   jump, fall, land, climb, celebrate; not medical), backgrounds with depth, a coin, signs, stairs and a lift, plus
   music and sound effects. Read and save each licence. Write game-lab/ASSETS.md (file or pack, author, source URL,
   exact licence, "TEST ONLY: replace before any release" where non-commercial or evaluation). Write a download
   script that puts them in game-lab/assets-test/ (git-ignored). Never use Nintendo or other franchise assets.
3. Rebuild the game at world-class quality in a new folder game-lab/v2/, keeping from the draft: the flow (START,
   "First MCQ" arrow, walk to a "?" sign, MCQ opens, coin earned only after grading, Next, climb or lift, summit), the
   DOM MCQ sheet with the same grading and the four question types, neutral wrong answers (silver coin +5 and a review
   flag, the hero still moves on), skip by tapping the world, reduced motion as instant cuts, the three modes (Story,
   Strip, Classic), the summary card, the Telegram behaviour, and the exact harness contract from game-lab/README.md
   (window.__lab, data-lab buttons, lab:* performance marks). Add a lab:game-ready mark when the first frame is drawn,
   so the engine's load time is measured. Keep game-lab/climb/ as it is, for comparison.
   Engines load textures with fetch/WebGL, which fails from file://. Serve game-lab/ with a local static server
   (python3 -m http.server) and extend game-lab/tools/measure.mjs to accept a URL; keep its contract and output.
4. Speed (D23). Exit targets from PLAN.md Gate 0: at 4x CPU, movement frame p95 <= 16.7 ms and p99 <= 33 ms; no long
   task over 50 ms during transitions; Next to first frame < 100 ms; Story Next to next MCQ about 1 s (about 1.6 s on
   lift beats); Strip and Classic < 150 ms; the game's load time reported. A richer world that misses these is not
   done. Use ?low=1 as a lighter tier for weak phones.
5. Run the four reviews from game-lab/climb/SPEC.md against v2 (speed incl. 6x CPU; QA bug hunt across modes,
   question types, rapid taps, skip, resize, reduced motion, dark mode, keyboard, 320 px to iPad; rules and learning;
   visual quality judged against world-class 2D games). Fix confirmed blockers and majors. Then an agent that did not
   do the fixes re-measures (JSON to game-lab/results/v2-final-<mode>.json) and takes screenshots.
6. Phone link for the owner (Gate 1): publish a private claude.ai Artifact (title "MCQs Mountain"). Load the engine
   from cdnjs with an exact pinned version and publish the art and audio as the artifact's supporting files. The repo
   files stay the source of truth.
7. Update the STATUS line in game-lab/PLAN.md, the status table in game-lab/README.md, and this file
   (game-lab/NEXT_AGENT.md) for whoever comes after you. Commit and push to the branch.

Tools: Chromium is preinstalled in the cloud container. Install playwright@1.56.1 in a scratch folder (it matches that
Chromium). Never run "playwright install".

Rules:
- Work only inside game-lab/. Do not touch app/, worker/, tools/, CI or deployment. Nothing is integrated into the app
  without the owner's written go-ahead.
- Lean storage: commit text only (code, Markdown, JSON). No images, audio, packs, engine files, ZIPs or node_modules.
  Send screenshots to the owner in chat.
- Do not create Telegram bots, hosting or deployments (owner decisions). Do not open a pull request unless asked.
- At the end, report to the owner in simple Iraqi Arabic: the engine chosen and why (with numbers), screenshots, the
  phone link, the speed numbers per mode, and what remains.
```
