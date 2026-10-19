# Next agent: the task prompt

The owner can paste the block below into a new Claude Code session on this repository. It is kept up to date with
the STATUS line in `PLAN.md`. Last updated: 2026-10-19, when D27 (chapters of 1 to 200 MCQs), the four reviews and
the phone link were done, and a fresh agent's final re-measure (`results/v2-final-*.json`); Gate 1 (the owner's phone
test) is waiting on the owner. The owner's newest direction, D28 (a fantasy world per stage), is being built.

```text
Continue the "MCQs Mountain" 2D game prototype in the Kafu repo (blsmohamme972-lab/MCQs-Mountain-). The game has two
tiers (game-lab/DECISIONS.md D25-D27): the LIGHT tier (v2/world.js, Canvas 2D pixel art, for weak phones) and the HD
tier (v2/world-hd.js, WebGL, the default). A chapter can have 1 to 200 MCQs (D27): it is cut into stages of about 10,
one mountain each; each tier builds the next stage ahead, in idle time while an MCQ is open, and swaps it in at the
stage change. Spend credits carefully: do the building yourself, read only the files you need, use helper agents only
for independent reviews (at most two at a time). The owner may ask you to pace the work (for example "work an hour,
rest an hour and a half"): commit and push before each rest and schedule your own wake-up with send_later. Measure
only while the session is active: the container is reclaimed a few minutes after a turn ends, which kills any
background job.

Where the work is:
- Branch ccr-eec99ecd-hm7ool holds everything. Fetch it first; if your session has another designated branch, merge
  this one into yours and do not lose its commits.
- Read: game-lab/PLAN.md (STATUS at the top), game-lab/DECISIONS.md D24-D27 (D26 and D27 hold the numbers),
  game-lab/README.md (harness contract, flags, how to run both tiers), game-lab/results/reviews-v2-d27.md (every
  review finding, its fix and what is still open), game-lab/results/d27-*.json and, once step 0 is done,
  v2-final-*.json (the numbers).
- Phone link (the owner's private claude.ai Artifact "MCQs Mountain"): https://claude.ai/artifact/7qFj5GrYC3qrYJZhUG2FDD
  Rebuild it after any code change with python3 game-lab/tools/make_artifact.py <scratch>/artifact and republish the
  same page with the same files (load the artifact-design skill first; pass the artifact's URL when publishing from a
  new session, after reading it).

Setup (the container is fresh each session; nothing below is committed):
- python3 game-lab/tools/fetch_engine.py, then python3 game-lab/tools/fetch_assets.py (builds both tiers' art).
- Install playwright@1.56.1 in a scratch folder and symlink its node_modules into game-lab/tools/ (git-ignored).
  Never run "playwright install".
- Serve game-lab/ with python3 -m http.server 8765. Flags: ?tier=light|hd, ?n=<1..200>, ?mode=story|strip|classic,
  ?rm=1 (reduced motion: the fastest way through a long chapter), ?gov=0 (HD full quality for screenshots), ?res=0.5
  and ?fx=0 (HD without the GPU load). This container has no GPU: judge HD on main-thread numbers; its frame rate is
  judged on a phone (D25).

Your task:
0. Done (2026-10-19), kept for a later re-measure: a fresh helper agent that has fixed nothing re-measures, one
   browser at a time and nothing else running: from game-lab/tools, node measure.mjs '<url>' --mode <story|strip|
   classic> --cpu 1,4,6 --q 8 --json ../results/v2-final-<tier>-<mode>.json for both tiers (HD Story also with
   ?res=0.5&fx=0 into v2-final-hd-story-nogpu.json), and the same at --cpu 4 --n 200 --q 12 into
   v2-final-<tier>-<mode>-n200.json; it checks them against the D27 budgets, looks at tools/shots.mjs screenshots
   (day and night, --n 25; send them in chat, never commit them) and reports. Then commit the JSON and update D26/D27.
1. Ask the owner for the result of the phone test (Gate 1): both tiers, Story / Strip / Classic, chapters of 8, 50
   and 200 MCQs (the lab row on the start card switches them), on a mid-range phone; also the checks this machine
   cannot make: the light tier's frame times (review S7) and the HD Classic time (QA #7). Fix what they report first.
2. The owner's open decisions (results/reviews-v2-d27.md): R13 sound and music (D19 asked for them, D13 said no
   audio files: a decision should supersede D13 for the lab), R15 the light tier's pirate hero (a skull on the hat),
   R17 Story pre-selected (the research rates its per-item loop weakest; counterbalance in a pilot). Ask; do not decide.
3. Open minors from the reviews, if the owner wants them: the light tier's small Strip coin, the climber behind the
   top bar or the sheet in landscape and after a rotate, R9 tokens (settle them from app/design/tokens.css when the
   game is integrated), R8 (the repo copy does not load the app's fonts; the phone copy does), the rest of S10 (the
   HD pose code allocates per frame and culling walks every child).
3b. D28 (DECISIONS.md, "Built so far" lists what is done and what is next): fetch the packs with
   python3 game-lab/tools/fetch_worlds.py, build with python3 game-lab/tools/build_worlds_hd.py; continue with the
   painted worlds, the worlds' particles, the light tier's pixel worlds, then a visual and a speed review.
4. A 9/10 look needs paid art (D26): an original hero designed and rigged by an artist (Spine or Rive, the full move
   set) and a premium or commissioned prop and tile set (about 25 props). Agents never buy anything; the owner decides.
5. Gate 1 continues in Telegram through a test bot only when the owner sets one up; agents do not create bots,
   hosting or deployments.

Rules:
- Work only inside game-lab/. Do not touch app/, worker/, tools/, CI or deployment. Nothing is integrated into the app
  without the owner's written go-ahead, and the app's start-up and MCQ speed stay untouched (D23).
- app.js, the flow, the MCQ sheet, grading, modes and the harness contract stay shared by both tiers and unchanged in
  behaviour (bug fixes excepted).
- Lean storage: commit text only (code, Markdown, JSON). No images, audio, packs, engine files, ZIPs or node_modules.
- Never use Nintendo or other franchise assets or look-alikes; no medical characters. Never buy anything. Do not open
  a pull request unless asked.
- Report to the owner in simple Iraqi Arabic.
```
