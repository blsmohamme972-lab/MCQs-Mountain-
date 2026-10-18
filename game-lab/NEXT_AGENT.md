# Next agent: the task prompt

The owner can paste the block below into a new Claude Code session on this repository. It is kept up to date with
the STATUS line in `PLAN.md`. Last updated: 2026-10-18, when the owner paused the HD-tier work (D26) before the final
reviews.

```text
Continue the "MCQs Mountain" 2D game prototype in the Kafu repo (blsmohamme972-lab/MCQs-Mountain-). The game now has
two tiers (game-lab/DECISIONS.md D25, D26): the LIGHT tier (Canvas 2D pixel art, for weak phones) and the HD tier
(WebGL, the default, aimed at mid-range and high-end phones). The previous session built the HD tier, ran three visual
review rounds and stopped at the owner's request before the final reviews. Finish the job. Spend credits carefully:
do the building yourself, read only the files you need, use helper agents only for the independent reviews (at most
two at a time, no large multi-agent workflows).

Where the work is:
- Branch ccr-be53cbba-utrxso holds everything (it includes ccr-027f1300-5q5swg and ccr-efb5e2bb-wvj576). Fetch it
  first. If your session has a different designated branch, merge this one into yours; do not lose its commits.
- Read: game-lab/PLAN.md (STATUS at the top), game-lab/DECISIONS.md D24-D26 (D26 has the HD tier's design and all
  numbers so far), game-lab/README.md (harness contract, how to run both tiers, harness flags), game-lab/ASSETS.md,
  game-lab/results/qa-v2-partial.md (unverified QA findings). Do not redo the engine spike, the art direction or the
  visual quality loop: three rounds are done (best 5-6.5 of 10; the reviewers' ceiling with free and procedural art is
  about 7.5; a 9 needs an artist-made hero and premium props, already reported to the owner, who decides).

What exists (v2, 360 x 740):
- game-lab/v2/index.html (CSS, DOM, LAB_CONFIG with both tiers), questions.js, app.js (flow, MCQ sheet, grading,
  modes, summary, Telegram, harness, sound, strip, tier choice and the script loader with integrity and fallback),
  world.js (light tier), world-hd.js (HD tier: code-rigged Kenney hero, painted parallax and cliffs, cloud bank,
  waterfalls, gantry lift, checkpoint pennants, cairn and star at the summit, filters, particles, day and night).
- Tools: tools/fetch_engine.py (PixiJS 8.22.0 and pixi-filters 6.1.5 from npm, pinned and hashed, into vendor/),
  tools/fetch_assets.py (light and HD art and sound from pinned GitHub mirrors into assets-test/, then builds them with
  build_assets.py and build_assets_hd.py; needs Pillow, numpy and ffmpeg; about a minute), tools/measure.mjs (speed
  harness; for the HD tier it reports script_ms_* and uses SwiftShader flags), tools/shots.mjs (five review screens,
  day and night; it already adds ?gov=0), tools/make_artifact.py (the phone copy, ready but not yet published).
- Setup: python3 game-lab/tools/fetch_engine.py; python3 game-lab/tools/fetch_assets.py; install playwright@1.56.1 in a
  scratch folder and symlink its node_modules into game-lab/tools/ (git-ignored); never run "playwright install"; serve
  game-lab/ with python3 -m http.server 8765 and open http://127.0.0.1:8765/v2/index.html (HD) or ?tier=light.
- This container has no GPU: HD frames take 0.1-0.75 s here (SwiftShader), which also stretches the timed animations.
  Judge the HD tier on main-thread numbers (script time per frame, long tasks, load to first frame) and leave its
  frame rate to the owner's phone (D25). Measure flow timing with the GPU load removed (?res=0.5&fx=0) as a cross-check.

Your task, in order:
1. Verify and fix the findings in game-lab/results/qa-v2-partial.md (page errors when the theme changes or the page is
   hidden while the HD world loads; a double tap on Check also presses Next and skips the explanation; answer marks
   clipped at 320 px; focus lost after Check; "Ledge 0/8" in Classic; XP counter fallback; canvas stretched after a
   rotation during loading; cards under the top bar in landscape). Then fix the round-3 visual bugs listed in D26:
   the lift's single post and arm read as a gallows (make it a braced lattice tower or an A-frame with a winch and a
   counterweight that moves opposite to the gondola, kept below the top bar); the stair steps render as broken narrow
   columns (draw each staircase as stone blocks on one rock base); the hero has a lavender halo and is not dimmed at
   night (night outline alpha about 0.35, darker hero tint, grass lips darker at night); a leaf seen edge-on draws as a
   line (clamp its flip); the waterfall starts from nothing (give it a source at the lip); "+10 XP" crosses the lift
   ropes (offset it into open sky). Remove the unused "fg" texture from build_assets_hd.py and kit.json. app.js, the
   flow, the MCQ sheet, grading, modes and the harness contract stay shared and unchanged in behaviour (bug fixes
   excepted).
2. Add a small lab-only tier switch so the owner can try both tiers on the phone link without URL parameters (for
   example a "Light version" / "HD version" link on the start card that stores the choice in localStorage, key
   mcqm-tier, and reloads; app.js already reads that key).
3. The four reviews from game-lab/climb/SPEC.md (speed incl. 6x; QA across modes, question types, rapid taps, skip,
   resize and rotation, reduced motion, dark mode, keyboard, 320 px to iPad 820x1180 and 1280x800; rules and learning;
   visual) against BOTH tiers, by independent agents, at most two at a time. Give the HD agents the harness flags from
   README.md. Fix blockers and majors.
4. Then a fresh agent that did not fix anything re-measures every mode for both tiers at --cpu 1,4,6 --q 8 (JSON to
   game-lab/results/v2-final-<tier>-<mode>.json) and takes screenshots with tools/shots.mjs (send them in chat, never
   commit them).
5. Phone link (Gate 1): load the artifact-design skill, run python3 game-lab/tools/make_artifact.py <scratch>/artifact
   (it writes the page without its document wrapper, Google Fonts Fredoka and Nunito, PixiJS and pixi-filters from
   cdnjs with Subresource Integrity hashes and jsDelivr as fallback, and the code, art and sound as supporting files
   under assets/), then publish a private claude.ai Artifact titled "MCQs Mountain" with those files. The repo files
   stay the source of truth. Ask the owner to try both tiers on a mid-range phone and to report how smooth it feels.
6. Update the STATUS line in game-lab/PLAN.md, the table in game-lab/README.md, the numbers in DECISIONS.md D26 (final
   per tier and mode), and this file. Commit and push (text only).

Rules:
- Work only inside game-lab/. Do not touch app/, worker/, tools/, CI or deployment. Nothing is integrated into the app
  without the owner's written go-ahead, and the app's start-up and MCQ speed stay untouched (D23).
- Lean storage: commit text only (code, Markdown, JSON). No images, audio, packs, engine files, ZIPs or node_modules.
- Never use Nintendo or other franchise assets or look-alikes; no medical characters. Never buy anything. Do not
  create bots, hosting or deployments. Do not open a pull request unless asked.
- At the end, report to the owner in simple Iraqi Arabic: what changed (screenshots), the review findings and fixes,
  the sizes and speed numbers per tier and mode, the phone link, and what remains (including the paid-art options for
  a 9/10 look, already listed in D26).
```
