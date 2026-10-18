# MCQs Mountain: character and world brief

PROTOTYPE MATERIAL. Not part of the app. Nothing here is drawn yet; this brief comes first so every later drawing
can be judged against it.

> **Updated 2026-10-18 after the owner saw the first draft** (`DECISIONS.md` D18-D23): no medical characters; the
> quality bar is world-class 2D games such as Super Mario, even for tests; non-commercial or evaluation tools and
> test assets are allowed for testing only (registered in `ASSETS.md`, never shipped). The professional process below
> (brief, silhouettes, model sheet, key poses) is unchanged; it now produces Kafu's own original hero for Gate 3.

## Who it is for

Medical students in Iraq, about 18 to 26, studying for exams on a phone inside Telegram, often tired, often on a
cheap Android phone (86% of Iraqi mobile traffic is Android; Honor, Infinix, Samsung, Tecno and Xiaomi lead). They are
adults and they know real games. The game must look and feel like a world-class 2D game they would play for fun, not a
study tool with a cartoon on top, and not a slot machine.

Three words for the whole game: **polished, playful, rewarding.**

## The story

- A book is a mountain. A chapter is one climb. Each MCQ is a ledge with a sign.
- The climber reaches the sign, the MCQ opens, and the coin on that ledge is earned only after the answer is scored.
- Correct: a gold coin (+10 XP). Wrong: a silver coin (+5 XP) and a small flag "saved for review". The climber always
  moves on. Nobody falls, nothing is lost.
- Flags are where the path loops back later. That ties the story to Review Due (spaced review) instead of to luck.
- Every 10 to 20 MCQs: one short story beat (a lift, a rope bridge, a camp). Skippable with one tap.
- The summit closes the chapter.

## Rules the art must follow

From the owner's direction (D18-D23), `docs/DESIGN.md` and the research for this lab:

- World-class 2D quality: a layered world with depth (several parallax layers), appealing animation with squash and
  stretch, anticipation and follow-through, particles, polished transitions, music and sound effects (sound still off
  until the player turns it on). The style (painted, vector or pixel) is chosen by what reaches that bar on a cheap
  phone. The old Arcade-Clean requirement no longer binds the game world; it still binds the MCQ sheet.
- Original work only. "Like Super Mario" means the quality and the genre's conventions, never Nintendo's characters,
  names, designs, levels, music or look. Never brief or prompt a copy of any existing character. Run a reverse-image
  search (Google Lens, TinEye) on the final character.
- Not medical: no doctors, nurses, organs, pills or hospital props as characters (owner, D18).
- Wrong answers get a supportive pose, never a sad, mocking or falling one.
- The MCQ screen stays calm. The character never appears on top of the question text.

## The main character (one, for now)

One main character carries the whole game. Other characters can come later only if the first one works.

- Working description: an original platformer hero with the appeal of a world-class 2D game star. Not medical. One
  signature shape readable from far away (a hat, a scarf, a tail, a backpack, an unusual silhouette). The owner names
  the character. The rejected "young climbing medic" of the first draft is not a starting point.
- Must read as a solid black silhouette at 88 CSS px tall on a 360 px wide phone.
- Clear shape language and a limited palette; few small details, because they vanish at phone size.
- Shadows and lighting baked into the art where possible, not computed per frame, so the game stays fast.
- Full animation set at world-class smoothness: idle, walk or run, jump, fall, land, climb, ride, celebrate, a
  supportive reaction, and a "reading" pose while the MCQ is open.

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

**For tests only (owner allowed it, D22):** Spine's free evaluation of its runtimes and examples (a release would
need a paid editor licence), Rive's free plan (splash screen), TexturePacker's free tier, and asset packs licensed for
non-commercial use, CC-BY or CC0. Each goes into `ASSETS.md` with its exact licence, marked "TEST ONLY: replace before
any release" where needed, and is downloaded by a script into the git-ignored `assets-test/`, never committed.

**Never, not even in tests:** Nintendo or any other franchise's characters, art, music or sounds; packs whose licence
text you have not read and saved; anything copied into `app/`.

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
