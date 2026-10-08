# MotionCards illustration brief (shared by all cards)

You are authoring ONE Kafu MotionCards scene: a deterministic 8-second SVG animation (viewBox 640x440,
playback driven by a host-owned timeline) that teaches the single concept behind one exam MCQ.
The v1 attempt (flat boxes/circles/arrows) was rejected by the owner as "bad quality, not what I expected".
Your job is a genuinely good ANATOMICAL ILLUSTRATION with meaningful MOTION - think a polished medical-education
animation (shaded bones, muscle bellies with fibre lines, glowing nerves, signal propagation, real joint motion),
NOT a labelled diagram of rectangles.

## Files / tools (all under `generator/`)
- `kit.py`  - the art kit. READ IT FIRST. Do NOT edit it (shared). Per-scene extras go in `sc.extra_defs`.
- `scenes/q9325.py` - the finished exemplar (brachial plexus). READ IT: it shows the house style, the
  veil-dimming trick, glow routes, time-driven text, rings. Match or exceed its polish.
- `render.py` - `python3 generator/render.py <module> [times] [WxH]` e.g. `python3 render.py q9327 0,1500,3000,4500,6000,8000`
  Builds scenes/<module>.py -> make(), validates with the REAL MotionCards compiler (rejects unsafe custom code,
  limits), serves the trusted preview host, screenshots frames, writes `out/<QID>_sheet.png`.
  READ that PNG (Read tool) after every iteration. Expect to iterate at least 4-6 times; look hard at overlap,
  clipping, legibility, awkward anatomy, empty space, timing.  Also check a narrow phone framing once:
  `python3 render.py q9327 0,4500,8000 390x780`.
- Your deliverable: `scenes/<your module>.py` exposing `make() -> dict` (use `Scene.build(QID, TAKEAWAY)`),
  plus constants QID and TAKEAWAY. Create scratch files only under `out/` with your QID in the name.

## Hard constraints (enforced by the validator; render.py reports violations)
- <= 80 layers AFTER keyframe expansion (each keyframe segment = one layer). Plan the budget: group many
  subpaths into ONE path layer `d` (<=2000 chars each). Use `tube()` sparingly (3 layers each x segments).
- custom_renderer <= 12000 chars total (kit generates it). No network, storage, timers, eval, Function, document.
- Layers animate only opacity / x / y / rotate / scale, linearly between keyframes (use kit `ease()` for smooth
  motion). rotate/scale pivot on the SVG ORIGIN: to rotate a shape about a joint (px,py), author the path with
  the joint at (0,0) and animate x=px, y=py, rotate=deg.  This is how you do real joint motion (forearm
  rotation, hand drooping at the wrist, scapula lifting, fingers fanning, humerus rotating).
- A layer is invisible outside [start_ms,end_ms]; kit `Scene.add(layer, kfs)` handles hold-until-8000.
  Static things that must be visible at t=0: pass default kfs (visible whole time).
- The first frame (t=0) must NOT be blank: backdrop + title + some anatomy visible immediately.
- The final frame (t=8000) must be a clean, fully composed illustration (host overlays a Takeaway/Answer panel
  below and shrinks the stage on phones - so essential labels need font size >= 17 in viewBox units,
  titles ~22-24, never below 15 for anything).  <= ~10 text labels total; leave breathing room, no overlaps.
- Do not draw the answer as text before ~4.5 s unless the stem requires it (the host shows the answer panel
  at the end); reveal mechanism first, name the structure when the signal/emphasis lands on it.
- Use ONLY original geometry you draw yourself. Do not look at, copy from, or depend on the repo folder
  `Animations and illustrations/` (forbidden). Do not edit anything in the git repo. Do not publish/upload anything.
- Never edit scene JSON by hand; the generator module is the source of truth.

## House style
Dark teal stage (kit `backdrop`), ivory shaded bones (`url(#bone)`/`url(#boneV)` + `BONE_LINE` outline),
muscle = `url(#musc)` red gradient with thin darker fibre lines + a lighter highlight stroke; tendons pale;
nerves gold tubes (`tube()`), lit with glow routes (`sc.glow`) so a signal visibly travels; arteries red with
`sc.flow` particles; skin tones `url(#skin)`/`url(#skinF)` (faint context silhouettes, low opacity).
Use `tube()` / subtle highlight strokes / gradients so shapes read as 3-D, not flat. Soft context anatomy
may be dimmed with a veil (see exemplar) to focus attention. Add `sc.extra_defs` for custom gradients.
Colour language: GOLD = the nerve/structure the question is about; CYAN = a contrasting nerve; RED = injury/artery.

## Storytelling / timing (8000 ms)
0-0.8s context anatomy visible; 0.8-2.5s build/identify the relevant structures; 2.5-5s MOTION that explains the
mechanism (signal travels, muscle contracts, joint moves, injury occurs); 5-7s consequence / emphasis lands on the
answer structure with a ring/pulse and a short label; 7-8s calm hold. Prefer movement + direction to text.
Teach only the key relationship needed for the correct answer (see your card's brief). No invented medical facts:
keep to standard anatomy and to the supplied question/answer/explanation.

## Report back (final message, concise)
Path of your module, what each phase shows, the final render sheet path, layer count and custom-renderer size,
anything you could not make good and why. If you spot a problem in kit.py, describe it - do not edit it.
