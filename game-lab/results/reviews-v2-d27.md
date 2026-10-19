# v2 reviews after D27 (chapters of 1 to 200 MCQs)

Independent reviewers, both tiers, read-only; the builder fixes afterwards. Round 1 (2026-10-18, 22:36-22:54 UTC):
speed and rules/learning. Round 2 (2026-10-19, 00:14-00:27 and 04:33-04:46 UTC; a usage limit paused the session in
between): visual and QA. Screenshots and raw JSON stayed in the session scratchpad (not committed).

Severity: blocker / major / minor. Status: fixed (commit), open (next work hour), owner (needs the owner's decision).

## Speed (round 1)

Verdict: the light tier meets the D27 move budgets at 1x, 4x and 6x (Story step 0.88-0.93 s, lift about 1.62 s,
stage change 2.48-2.55 s, 0.99-1.14 s added per MCQ; Classic 22-33 ms; Strip 128-148 ms); load flat with N. The HD
main thread is acceptable with res=0.5&fx=0 (step 1.04-1.07 s, lift 1.58-1.62 s, 1.12-1.15 s per MCQ, Next to
first frame 25 ms average at 6x); full-filter frame rate is GPU-bound here and judged on a phone (D25).

| # | Tier | Sev. | Finding | Status |
|---|---|---|---|---|
| S1 | HD | major | The Story stage change builds the next stage inside one frame (buildMs 44-65 ms at 6x, a 97 ms task; the first render after it 52 ms) | fixed (f646e7f, 1157f83): the next stage is built ahead in idle time while an MCQ of the stage is open, then drawn once to the GPU in a second idle task; the stage change only swaps containers (0.2-9 ms at 6x). The builds ahead: 24 ms + 20 ms at 6x |
| S2 | light | major at 6x | The same (a 60 ms task at 6x; buildMs 16-19 ms) | fixed (f646e7f): as S1; swap 0.3 ms, builds ahead 8-16 ms at 6x |
| S3 | HD | major | Strip at a stage boundary: the deferred build (71 ms at 6x) ran inside the cross-fade, and sleep() redrew the hidden world | fixed (a112d49): the build waits until the next MCQ is open; Strip/Classic do not redraw on sleep |
| S4 | both | major | Strip had about 3 ms of headroom under 150 ms (120 ms cross-fade + 1-2 frames) | fixed (a112d49): 100 ms cross-fade; light 4x now 108 ms average, 120 max |
| S5 | HD | major | Story kept the world running at 30 fps after the chapter (and while an MCQ was open) | fixed (a112d49): only the start screen breathes; 0 ticks while reading and on the summary |
| S6 | light | major | The start card ran an uncapped 60 fps loop | fixed (a112d49): 12 fps while idle (its pixel animations run at 6-7 fps) |
| S7 | light | minor | Light frames over 33 ms at 6x are mostly the software canvas commit in this container | phone check (chrome://gpu) |
| S8 | both | minor | Story built the next MCQ's DOM during the climb; scrollTop forced a layout in the transition | fixed (b764c34) |
| S9 | both | minor | Reduced motion still wakes the loop and renders several times per MCQ | fixed: no loop under reduced motion, one render per MCQ (HD 25 MCQs: 23 s -> 6.6 s here) |
| S10 | HD | minor | Per-frame allocations (pose closures and arrays, busy() twice, texture name strings); culling walks every child each frame; script p95 over 8 ms | partly fixed (7936d66): the camera springs, birds and pennants allocate nothing per frame and busy() runs once; the pose code and culling are unchanged. Script p95: see the D27 summaries |
| S11 | both | minor | The harness's frame log skewed the heap; the heap check was missing | fixed (b764c34) in the harness; the D27 summaries check it (heap_flat_with_n: within 3 MB of the 8-MCQ chapter) |
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
| R1 | HD | major | Continuous ambient motion (30 fps) while the MCQ is open, against "avoid continuous motion in study views" | fixed (a112d49): the world is still while an MCQ is open; the reading pose settles first. It regressed when a waterfall was on screen (QA HD1), fixed again (98c61e8) |
| R2 | both | major | At 320 px the top bar pushed the sound button under 44 px and off screen (three-digit counters) | fixed (a112d49): the button never shrinks; "Ledge" drops under 360 px; the same visible text with reduced motion |
| R3 | light | major | The "saved for review" badge read as a capital F | fixed (a112d49): a pennant on a pole |
| R4 | both | major | "Your answer" on a wrong option was 4.13:1 in the light theme | fixed (a112d49): --error-text #B4203F (5.49:1) |
| R5 | both | major | Stage progress hard to follow in Story and with reduced motion; not announced | fixed (a112d49): "Stage s of S" in the question header; a new stage is announced to screen readers |
| R6 | both | major (200 MCQs) | No break or resume point in a long chapter | fixed: the place is kept after every MCQ; the start card of the same chapter offers "Continue at Q57 of 200" |
| R7 | both | minor | Summary time lines awkward for long and short chapters | fixed (a112d49) |
| R8 | both | minor | The app's fonts are not loaded in the repo copy (system fallback); Nunito 600/800 used | open (the phone copy loads Fredoka and Nunito from Google Fonts) |
| R9 | both | minor | Some literal colours and timings outside the tokens; the token copy drifts from app/design/tokens.css | open (to settle when the game is integrated, from the app's own tokens) |
| R10 | both | minor | Buttons transition box-shadow on press (as the app does) | fixed (7936d66): transform only |
| R11 | both | minor | Reduced motion did not zero the duration tokens; read once at load | fixed (a112d49, 7936d66): the tokens; a change of the setting applies on the start card, or at Climb again |
| R12 | both | minor | The Strip showed correct vs wrong by coin colour alone | fixed (b764c34): a tick or a pennant on each coin |
| R13 | both | minor | Sound uses audio files and looping music, against D13 | owner: D19 asked for music and sound; a decision should supersede D13 for the lab |
| R14 | HD | minor | The summit celebration was larger than one burst | fixed (a112d49): confetti and one firework |
| R15 | light | minor | The pirate hero has a skull on its hat; the "?" bubble reads like a 2 | owner / visual review |
| R16 | both | minor | "Tap to skip" was not a button | fixed (b764c34) |
| R17 | both | minor | Story is pre-selected (the research rates its per-item loop weakest) | owner: D5 keeps Story as the owner's idea; counterbalance in a pilot |

## Visual (round 2)

Verdict before the fixes: light 5.5/10 (a solid base; the new D27 pieces broke at the screen's edges), HD 6.5/10 (the
camp, the stage change, the lift tower and the stairs read well; framing bugs). Both: the cards hid the climber.

| # | Tier | Sev. | Finding | Status |
|---|---|---|---|---|
| V1 | light | major | The stage caption ran off a 320 px screen ("TAGE 11 OF 2") | fixed (cb13aba): each line at the largest whole scale that fits |
| V2 | light | major | The camp's flag was off screen and its run-up was covered by the fade | fixed (cb13aba): the flag stands closer, runs up while the climber walks to the camp, and the camera keeps it in view |
| V3 | light | minor/major | The next stage's plate was clipped at the right | fixed (cb13aba): it stands just right of the start and the camera shows all of it; the climber then walks past it |
| V4 | light | major | The Strip ended in the summit trophy on every stage | fixed (cb13aba): a camp flag, the trophy only on the last stage |
| V5 | HD | minor | The camp's tent and pennant were cut at the right edge | fixed (cb13aba): the camera looks further ahead on the way to a camp |
| V6 | HD | minor | "Stage 11" was cut at the left at 320 px | fixed (cb13aba) |
| V7 | both | minor | The start and summary cards hid the climber and the summit | fixed (cb13aba): the climber stands above the card |
| V8 | both | minor | At 320 x 568 with the sheet open the Q plate and the "?" bubble sit under the top bar | fixed (7936d66): the "?" over the open MCQ's sign is put away while it is read; the plate's top can still touch the bar at 320 x 568 |
| V9 | both | minor | The question header left the XP alone on a second line | fixed (cb13aba): under 420 px the header drops its XP (it is in the top bar) when it shows the stage |
| V10 | light | minor | 1 px seams across the sky | fixed (cb13aba): the painted layers sit on whole pixels |
| V11 | light | minor | The coin flash covered the face | fixed (cb13aba): behind the climber |
| V12 | light | minor | A palm behind the camp flag and the trophy | fixed (cb13aba) |
| V13 | light | minor | Smooth-rotating confetti in a pixel-art scene | fixed (cb13aba): quarter turns |
| V14 | light | minor | The font's slashed 0 (Q200 read as Q288) and rounded E | fixed (1157f83): redrawn at build time |
| V15 | HD | minor | "Next mountain" had almost no contrast on the day clouds | fixed (cb13aba): gold with a soft shadow |
| V16 | HD | minor | Q100+ labels are smaller; plate labels dim at night | fixed (7936d66): a size up; the plates keep more light at night |
| V17 | light | minor | In Strip the world's sprites show in the band above the bar | fixed (7936d66): Strip and Classic frame the world low, only sky in the band |
| V18 | both | minor | "about under 0.1 min"; "+1995 XP" broke over two lines | fixed (f646e7f, cb13aba) |
| V19 | both | minor | Strip: ungraded ledges are grey squares; the current coin hides under the climber | fixed (7936d66) for the squares (a faint coin ring); the light tier's small Strip coin reads weaker than the rings: open |
| V20 | both | minor | The top bar shows "Ledge 0/200" beside "Continue at Q57 of 200" | fixed (7936d66 and the next commit): the top bar's pills wait until Continue or First MCQ |

## QA (round 2)

Verdict: grading correct for every question type on both tiers; all modes reach the summary and "Climb again" works
(also after 200 MCQs); skip spam, rotation, dark mode, keyboard play and the stage built ahead pass; no page or console
errors in about 60 sessions. Every round-1 QA finding (qa-v2-partial.md) is fixed except the HD Classic time on this
machine (SwiftShader).

| # | Tier | Sev. | Finding | Status |
|---|---|---|---|---|
| HD1 | HD | major | The world loop never stopped while an MCQ was open (waterfall spray kept it busy) | fixed (98c61e8): the spray runs only while the world moves; 0 frames 2-12 s after the sheet opens |
| Q1 | both | major | A stale "Continue" stayed after a fresh run and brought back the old place | fixed (98c61e8) |
| Q2 | both | major | A double tap on Check could skip the explanation when the main thread was busy | fixed (98c61e8): the guard uses the taps' own times; 0 of 16 skipped with a 500 ms stall |
| HD3 | HD | minor | The first stage build ahead was one 152 ms task at 6x | fixed (1157f83): 24 ms + 20 ms in two idle tasks |
| A1 | both | minor | A resize, a theme change or a deferred build dropped the stage built ahead for good | fixed (98c61e8): planned again |
| M1 | both | minor | The lab switches did nothing when ?n= or ?tier= was in the URL | fixed (98c61e8) |
| M2 | both | minor | After Continue the per-MCQ times were divided by the whole chapter | fixed (98c61e8) |
| M3 | both | minor | Landscape 568 x 320: the summary scrolls inside its card with no hint | fixed (7936d66): a compact summary on short screens; at 568 x 320 the world above it is only about 60 px (the climber sits behind the top bar): open |
| M4 | both | minor | The question header wraps in multi-stage chapters at 390 px or less | fixed with V9 |
| M5 | both | minor | Classic's summary said "Summit reached" | fixed (98c61e8): "Chapter done" |

A last check of these minors (2026-10-19, 05:02-05:13 UTC, two read-only checkers, function and visuals) passed with
no blocker or major. Open from it (minor): in Story, rotating to landscape and back with an MCQ open can leave the
climber mostly behind the sheet (also before these changes); at 568 x 320 the climber sits half behind the top bar.
