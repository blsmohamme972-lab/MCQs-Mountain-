# v2 reviews after D27 (chapters of 1 to 200 MCQs)

Independent reviewers, both tiers, read-only; the builder fixes afterwards. Round 1 (2026-10-18, 22:36-22:54 UTC):
speed and rules/learning. Round 2 (QA and visual) is next. Screenshots and raw JSON stayed in the session scratchpad
(not committed).

Severity: blocker / major / minor. Status: fixed (commit), open (next work hour), owner (needs the owner's decision).

## Speed (round 1)

Verdict: the light tier meets the D27 move budgets at 1x, 4x and 6x (Story step 0.88-0.93 s, lift about 1.62 s,
stage change 2.48-2.55 s, 0.99-1.14 s added per MCQ; Classic 22-33 ms; Strip 128-148 ms); load flat with N. The HD
main thread is acceptable with res=0.5&fx=0 (step 1.04-1.07 s, lift 1.58-1.62 s, 1.12-1.15 s per MCQ, Next to
first frame 25 ms average at 6x); full-filter frame rate is GPU-bound here and judged on a phone (D25).

| # | Tier | Sev. | Finding | Status |
|---|---|---|---|---|
| S1 | HD | major | The Story stage change builds the next stage inside one frame (buildMs 44-65 ms at 6x, a 97 ms task; the first render after it 52 ms) | open: build the next stage ahead, in idle time, while its last MCQ is read; swap containers under the clouds |
| S2 | light | major at 6x | The same (a 60 ms task at 6x; buildMs 16-19 ms) | open: as S1 |
| S3 | HD | major | Strip at a stage boundary: the deferred build (71 ms at 6x) ran inside the cross-fade, and sleep() redrew the hidden world | fixed (a112d49): the build waits until the next MCQ is open; Strip/Classic do not redraw on sleep |
| S4 | both | major | Strip had about 3 ms of headroom under 150 ms (120 ms cross-fade + 1-2 frames) | fixed (a112d49): 100 ms cross-fade; light 4x now 108 ms average, 120 max |
| S5 | HD | major | Story kept the world running at 30 fps after the chapter (and while an MCQ was open) | fixed (a112d49): only the start screen breathes; 0 ticks while reading and on the summary |
| S6 | light | major | The start card ran an uncapped 60 fps loop | fixed (a112d49): 12 fps while idle (its pixel animations run at 6-7 fps) |
| S7 | light | minor | Light frames over 33 ms at 6x are mostly the software canvas commit in this container | phone check (chrome://gpu) |
| S8 | both | minor | Story built the next MCQ's DOM during the climb; scrollTop forced a layout in the transition | fixed (b764c34) |
| S9 | both | minor | Reduced motion still wakes the loop and renders several times per MCQ | open |
| S10 | HD | minor | Per-frame allocations (pose closures and arrays, busy() twice, texture name strings); culling walks every child each frame; script p95 over 8 ms | open |
| S11 | both | minor | The harness's frame log skewed the heap; the heap check was missing | fixed (b764c34) in the harness; heap check open |
| S12 | HD | minor | A new GlowFilter per last-stage build and per resize, never destroyed | fixed (a112d49): one filter, made once |
| S13 | HD | info | Load at 6x flat with N (about 2.0-2.2 s with res=0.5&fx=0) | - |

Heap, checked by the builder: three 200-MCQ chapters back to back grow the heap after GC by 0.1-0.3 MB per chapter;
heap snapshots show the growth is V8 compiled code and the browser's layout-shift entries, not game objects; the
reviewer counted 94 (light) / 266 (HD) destroyed-but-reachable sprites, the same at 50 and 200 MCQs (bounded).

## Rules and learning (round 1)

Verdict: rewards only after grading, wrong answers neutral and still moving forward, reduced motion, sound loading
and skipping all pass; violations below.

| # | Tier | Sev. | Finding | Status |
|---|---|---|---|---|
| R1 | HD | major | Continuous ambient motion (30 fps) while the MCQ is open, against "avoid continuous motion in study views" | fixed (a112d49): the world is still while an MCQ is open; the reading pose settles first |
| R2 | both | major | At 320 px the top bar pushed the sound button under 44 px and off screen (three-digit counters) | fixed (a112d49): the button never shrinks; "Ledge" drops under 360 px; the same visible text with reduced motion |
| R3 | light | major | The "saved for review" badge read as a capital F | fixed (a112d49): a pennant on a pole |
| R4 | both | major | "Your answer" on a wrong option was 4.13:1 in the light theme | fixed (a112d49): --error-text #B4203F (5.49:1) |
| R5 | both | major | Stage progress hard to follow in Story and with reduced motion; not announced | fixed (a112d49): "Stage s of S" in the question header; a new stage is announced to screen readers |
| R6 | both | major (200 MCQs) | No break or resume point in a long chapter | fixed: the place is kept after every MCQ; the start card of the same chapter offers "Continue at Q57 of 200" |
| R7 | both | minor | Summary time lines awkward for long and short chapters | fixed (a112d49) |
| R8 | both | minor | The app's fonts are not loaded in the repo copy (system fallback); Nunito 600/800 used | open (the phone copy loads Fredoka and Nunito from Google Fonts) |
| R9 | both | minor | Some literal colours and timings outside the tokens; the token copy drifts from app/design/tokens.css | open |
| R10 | both | minor | Buttons transition box-shadow on press (as the app does) | open |
| R11 | both | minor | Reduced motion did not zero the duration tokens; read once at load | fixed (a112d49) for the tokens; the change listener is open |
| R12 | both | minor | The Strip showed correct vs wrong by coin colour alone | fixed (b764c34): a tick or a pennant on each coin |
| R13 | both | minor | Sound uses audio files and looping music, against D13 | owner: D19 asked for music and sound; a decision should supersede D13 for the lab |
| R14 | HD | minor | The summit celebration was larger than one burst | fixed (a112d49): confetti and one firework |
| R15 | light | minor | The pirate hero has a skull on its hat; the "?" bubble reads like a 2 | owner / visual review |
| R16 | both | minor | "Tap to skip" was not a button | fixed (b764c34) |
| R17 | both | minor | Story is pre-selected (the research rates its per-item loop weakest) | owner: D5 keeps Story as the owner's idea; counterbalance in a pilot |
