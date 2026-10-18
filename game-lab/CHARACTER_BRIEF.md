# MCQs Mountain: character and world brief

PROTOTYPE MATERIAL. Not part of the app. Nothing here is drawn yet; this brief comes first so every later drawing
can be judged against it.

## Who it is for

Medical students in Iraq, about 18 to 26, studying for exams on a phone inside Telegram, often tired, often on a
cheap Android phone (86% of Iraqi mobile traffic is Android; Honor, Infinix, Samsung, Tecno and Xiaomi lead). They are
adults. The game must feel like a calm climbing partner, not a cartoon for children and not a slot machine.

Three words for the whole game: **steady, warm, clever.**

## The story

- A book is a mountain. A chapter is one climb. Each MCQ is a ledge with a sign.
- The climber reaches the sign, the MCQ opens, and the coin on that ledge is earned only after the answer is scored.
- Correct: a gold coin (+10 XP). Wrong: a silver coin (+5 XP) and a small flag "saved for review". The climber always
  moves on. Nobody falls, nothing is lost.
- Flags are where the path loops back later. That ties the story to Review Due (spaced review) instead of to luck.
- Every 10 to 20 MCQs: one short story beat (a lift, a rope bridge, a camp). Skippable with one tap.
- The summit closes the chapter.

## Rules the art must follow

From `docs/DESIGN_STYLE.md` and `docs/DESIGN.md`, plus the research for this lab:

- Arcade-Clean, not pixel art: chunky rounded shapes, 2-3 px ink outline (`#182032`), hard offset shadow `0 4px 0`,
  flat bright fills from `app/design/tokens.css` only (primary `#5B4CFF`, accents `#FFB703` and `#00AFA0`).
- Original work only. Never prompt or brief "Mario-like", "like Duolingo's owl" or any existing character. Run a
  reverse-image search (Google Lens, TinEye) on the final character.
- Wrong answers get a supportive pose, never a sad, mocking or falling one.
- The MCQ screen stays calm. The character never appears on top of the question text.

## The main character (one, for now)

One main character carries the whole game. Other characters can come later only if the first one works.

- Working description: a young climbing medic. Round head, white coat, a backpack in the primary colour, a small
  stethoscope. Add one signature shape that is readable from far away (for example a head-lamp or a backpack shaped
  like a medical bag). The owner names the character.
- Must read as a solid black silhouette at 88 CSS px tall on a 360 px wide phone.
- Mostly round and square shapes (friendly, stable). Few small details: they vanish at phone size.
- 3 fill colours plus the ink outline. Shadows are baked into the art, never drawn as blur at runtime.

## What to produce, in order (the rawest material first)

1. **This brief.** Agree on it before any drawing.
2. **Silhouettes.** 20 to 50 tiny solid-black shapes. Pick 2 or 3.
3. **Silhouette test.** Show the 2 or 3 at phone size to 5 students who have never seen them. Keep the one they
   recognise and describe best.
4. **Model sheet.** Front, three-quarter, side and back views, with proportions. The side view matters most because
   this is a side-scroller; every animation frame is drawn from it.
5. **Expression and pose sheet.** Neutral, focused (reading an MCQ), happy (correct), supportive (after a wrong
   answer), determined (climbing).
6. **Key poses.** Rough extreme poses first, timed inside the prototype (`game-lab/climb/`) before any polish:
   walk = contact, down, passing, up (then mirrored); step up; lift ride; cheer.
7. **In-betweens and clean-up**, only after the key poses feel right in the prototype.
8. **Atlas export.** 2x resolution, packed into one atlas no bigger than 1024 x 1024 (about 4 MiB once decoded).

Reference for the movement: film a real person walking, climbing three stairs and stepping into a lift, then step
through the video frame by frame. That is rawer and more truthful than copying another game's animation.

## First vertical slice: the asset list

| Asset | Frames | Speed | Notes |
|---|---|---|---|
| Idle (breathing, blink) | 4 | 6-8 fps | Shown only while waiting at START |
| Walk | 8 | 10-12 fps | Contact, down, passing, up, mirrored |
| Step up | walk + 2 | | Stairs reuse the walk |
| Lift ride | idle + 1 | | "Looking up" pose |
| Coin collect and cheer | 6 | 12 fps | After a correct answer |
| Supportive pose | 1-2 | | After a wrong answer, never sad or mocking |
| Focused pose | 1 | | As the MCQ opens |
| **Character total** | **about 28-30** | | One atlas, 1024 x 1024 or smaller |

World kit (one atlas, 128 px tiles at 2x): ground left/middle/right/fill, one step block (stairs are built from it),
lift platform and cable, checkpoint sign, START sign, summit flag, 3-5 original props, gold and silver coin, review
flag. Sky is a CSS gradient (no texture). Far and mid layers: two horizontally tileable strips about 2048 x 512.

## Free tools (checked October 2026)

| Job | Tool | Licence or price | Watch out |
|---|---|---|---|
| Character and world art | Inkscape | GPL, free | Draw each body part on its own layer, pose by moving parts ("cut-out"), export frames |
| Backgrounds, frame-by-frame | Krita | GPL, free | No sprite-sheet export, export frames instead |
| Rare pixel badges only | LibreSprite or Piskel | GPL / Apache, free | Aseprite costs $19.99; compiling it yourself is for personal use only |
| Packing frames into an atlas | free-tex-packer | MIT, free | TexturePacker's free tier is non-commercial only |
| Level layout (optional) | LDtk or Tiled | MIT / free | |
| Sound effects | jsfxr, ChipTone | Unlicense / CC0 output | Sound stays off by default; no audio files in the app today |
| Placeholders only | Kenney packs | CC0 | Recognisable style; never ship it as Kafu's own look |

Avoid for this project: Spine (paid editor licence needed to use its runtime), Rive (free exports show a splash
screen; removing it is a paid seat), DragonBones (editor unmaintained), OpenGameArt CC-BY-SA or GPL art, and itch.io
packs whose licence text you have not saved.

## AI images

- Good for: 20-50 early concepts, silhouettes, one style frame, background paintings to simplify by hand.
- Bad for: animation frames (details drift between frames), tilesets (seams), a character that stays identical.
- A human vector redraw is what ships. Under current US Copyright Office guidance a prompt alone does not make you the
  author, so a raw AI character may not be protectable and others can generate look-alikes.
- Any ChatGPT image prompt follows the repo's rule for image prompts (the `kafu-queue` tools).

## Asset register

Keep one row per shipped file: file, author, source URL, licence, whether AI was used, date. Commit the register, not
the images (lean storage rule).

## How we will know the character works (not our opinion)

- 5 new students pick it out as a black shape at phone size and describe it with words close to "steady, warm, clever".
- Reverse-image search finds no look-alike.
- In the prototype on the reference cheap Android phone, the frame budget still holds (p95 at or under 16.7 ms).
- The character atlas stays at or under 1024 x 1024.
