# Characters and world: the professional art pipeline, for free

> Research saved from the session of 2026-10-18 (Claude Code). Each report was written by one agent and then
> fact-checked claim by claim by a second, independent agent; the corrections are at the end and **override the
> report text**. Paths under `/tmp/...` were scratch files of that session and no longer exist.

## Kafu 2D game mode: how professionals make characters and worlds for a small, fast mobile web game, for free (research as of 2026-10-18)

### Bottom line
- **The art side is doable, free and professional.** That holds if the team sticks to five choices:
  1. Use **flat vector art** in the Arcade-Clean style: drawn in a free vector tool and baked into small PNG/WebP sprite atlases.
  2. Make **one main character with about 30 frames** and **one modular world kit**.
  3. Use AI images **for concepts only**, never for the final animation frames.
  4. Use **only CC0 or self-made assets**.
  5. Test on a **cheap Android phone**. Android is 86% of Iraqi mobile traffic.
- **Speed is mostly an engineering question, but art decisions decide it.** Fewer, smaller textures and no per-frame vector drawing keep the game fast. The memory budget below (about 20 MB of GPU memory for the whole slice) is far under every known limit.
- **There is a conflict inside the repo the owner should settle on purpose.** `docs/DESIGN.md` line 7 says a session "should feel encouraging, not like a game demanding attention". `DNAgens/ASSESSMENT.md` line 53 warns against adding a character "without owner direction".
  - A professional would treat the game as an **opt-in mode**.
  - They would design the character for **tired adult medical students**, not children.
  - They would write the owner's decision into the design docs before any art is made.
- **The owner's flow already protects learning.** The MCQ screen fully replaces the game world. Research on "seductive details" (interesting but irrelevant content) shows that content next to the learning material reduces learning. So the game must never appear on the question screen.

---

### 1. The rawest starting material, and why each piece comes before polished art

| Material | What it is | Why it comes before polished art | What Kafu should produce |
|---|---|---|---|
| **Brief and pillars** | One page: who the character is, the audience (Iraqi medical students, tired, studying on a phone), 3 adjectives, the story, and rules ("never tease a wrong answer", "MCQ screen stays calm") | Every later drawing is judged against it, which stops style drift and endless redraws | Story idea: the student climbs a teaching hospital or a mountain (the repo is literally named "MCQs-Mountain"). Floors or levels are chapters, the stairs and lift are the progress, the coin is the question. Include kill criteria (see section 10). |
| **Silhouettes and thumbnails** | 20 to 50 tiny solid-black shapes of possible characters | Readability at small size depends on the outline, not the details. Valve's TF2 team approved its characters in the concept phase by showing they could be recognised "only in silhouette with no internal shading". They left out high-frequency detail and made interior details echo the silhouette. | Pick 2 or 3 silhouettes that read at 80 to 96 CSS px tall on a phone |
| **Shape language** | Circles feel friendly, squares feel stable, triangles feel energetic or dangerous | Gives the personality before colour or detail | Mostly round and square shapes fit Arcade-Clean's "chunky rounded" rule |
| **Model sheet / turnaround** | Front, three-quarter, side and back views, plus proportions, construction notes, hands and feet | Keeps the character "on-model" when more than one person (or more than one AI prompt) draws it | The side view matters most for a side-scroller. It becomes the reference for every frame. |
| **Expression and pose sheet** | The set of faces and body poses | Defines exactly which emotions the game needs before any animation is made | Neutral, happy (correct answer), focused or thinking, determined, and a supportive reaction to a wrong answer (no shame, per the design rules) |
| **Colour script** | A strip of small colour thumbnails that maps the emotional arc. Ralph Eggleston pioneered it at Pixar on *Toy Story*. | Fixes the colour of the whole journey cheaply, before scenes are painted | For example, each floor or chapter gets a shift in time of day or tint, all inside the tokens.css palette |
| **Animation keyposes** | Extreme poses first, in-betweens later. A walk is contact, down, passing and up, repeated and mirrored: 8 frames. | Timing and feel can be tested with rough poses. Polishing in-betweens too early wastes work. | Rough keyposes for walk, idle, jump, climb and celebrate, timed in the prototype |
| **Modular kit / tileset** | Small reusable pieces on a shared grid. Skyrim's kits were "typically snapped to a grid", with sub-kits on the same grid or a multiple of it. Two kit artists made 7 kits for 400+ cells. | A few pieces build unlimited levels, and they batch well on the GPU | One ground set, one block or step, one lift, signs and props, all on one grid unit (for example 64 CSS px) |
| **Greybox** | The level built from plain rectangles | Layout and feel change after testing, and boxes are free to throw away | Build the whole START → coin → MCQ → next floor loop with boxes first |

---

### 2. Style choice for speed and consistency

| Style | Production speed | Frame-to-frame consistency | Fits Arcade-Clean | Runtime cost on low-end phones | Scaling on varied phone screens |
|---|---|---|---|---|---|
| **Flat vector, baked to atlases** (recommended) | Fast. Limbs on separate layers, so most new frames are moved parts rather than redraws. | High. Same shapes and colours every frame. | **Best.** Thick 2–3 px ink outlines, flat bright fills and hard offset shadows are native to vector. | Low, once baked to sprites | Re-export at any resolution; no integer-scaling constraint |
| Vector drawn live every frame (SVG/canvas paths) | Same | Same | Same | **High.** PixiJS warns that "100s of graphics complex objects can be slow… use sprites". | Perfect |
| Pixel art | Fast for small sprites | High | **Conflicts** with the owner's rule that pixel art is a rare reward accent only | Very low | Crisp only at whole-number scale. Phone aspect ratios vary, so you get letterbox bars or blur. |
| Hand-drawn raster | Slowest | Lowest (redrawn every frame) | Partly | Low | Must be drawn large and scaled down |
| Skeletal / cut-out (Spine, DragonBones, Rive) | Fast after rigging | High | OK | Adds a runtime library | Good |

**Recommended approach: "cut-out authoring, sprite-sheet runtime".**
- Draw the character in Inkscape with each body part on its own layer.
- Pose each keyframe by moving the parts, then export the frames.
- Pack the frames into an atlas.
- The game then only draws sprites. This avoids paid skeletal tools and runtime libraries.

**Scaling and resolution**
- Design on a CSS-pixel grid. Export textures at **2x** and cap devicePixelRatio at 2. That is crisp enough on phones and halves memory compared with 3x.
- PixiJS can load an SVG as a texture with a `resolution` option, rasterised once at load. Such textures are capped at 4096×4096.
- If pixel accents are used (badges): set `image-rendering: pixelated`. MDN says it scales with nearest-neighbour "to the nearest integer multiple" and then smooths the rest. Also set `ctx.imageSmoothingEnabled = false` on canvas, because the default is `true` and blurs pixels.

**Atlas sizes**
- WebGL `MAX_TEXTURE_SIZE` of 4096 is supported on effectively 100% of devices. 8192 reaches only about 76% of Android devices in the fetched web3dsurvey snapshot. Another snapshot in search results was lower.
- WebGL Fundamentals: "2048 or 4096 seems to be reasonable limits."
- TexturePacker's default maximum is 2048.
- **Rule: atlases of 2048×2048 or smaller.**

**Memory budget**
- A decoded texture costs about width × height × 4 bytes, whatever the file size on disk.
  - 1024×1024 = 4 MiB
  - 2048×1024 = 8 MiB
  - 2048×2048 = 16 MiB
- iOS Safari caps total canvas memory: 384 MB on iOS 15, lower on earlier versions; one Apple forum thread cites 224 MB. Safari keeps canvases alive, so shrink a canvas to 1×1 to release it.
- Low-end GPUs "probably" have under 1 GB of memory.
- **Target: about 20 MiB of textures for the whole vertical slice.**

**Batching (PixiJS)**
- Sprites batch with "up to 16 different textures (dependent on hardware)".
- "Use Spritesheets where possible."
- Filters are expensive and sprite masks are "really expensive". Avoid both: Arcade-Clean's hard shadows can be baked into the art instead of drawn as blur filters.

**Free renderers (only if a library is wanted)**
- PixiJS v8: 8.18 and 8.19 shipped June 2026; more than 500k weekly npm downloads.
- Phaser 4: MIT; 4.0.0 on 10 April 2026, 4.2.1 on 9 July 2026.
- A scene this simple could also be plain Canvas 2D.

**Telegram specifics**
- Bot API 8.0 (17 November 2024) added `requestFullscreen`, `safeAreaInset` and `lockOrientation`.
- It also added the device's **performance class** to the Android user agent.
- Telegram's guidelines advise reducing animations on low-performance devices. Use the performance class to turn off parallax on low-end phones.

---

### 3. Free tools: licences and prices

| Tool | Licence / price | Trap or note |
|---|---|---|
| **Aseprite** | $19.99 (official FAQ minimum; Steam price also $19.99, updates through v1.9). The source code is on GitHub. | EULA §2(g): you may compile it only "for your own personal purpose" or to propose a contribution. §2(b): no sharing copies. The FAQ says art made with a compiled build can be used commercially, and since August 2016 compiled builds cannot be redistributed. |
| **LibreSprite** | GPLv2, free | A fork of the last GPLv2 commit of Aseprite, made before Aseprite went proprietary on 26 August 2016 |
| **Piskel** | Apache-2.0, free, runs in the browser | "There is no support for mobile." Good for quick pixel badges. |
| **Krita** | GPLv3, free | "What you create with Krita is your sole property." It has a timeline, onion skin and frame-sequence render. Docs suggest 12 fps for early work and note that Krita keeps every frame in memory. No spritesheet export is mentioned. |
| **Inkscape** | GPL (binaries GPLv3+), free | Artwork belongs to you (forum answers, not an official page). **Main recommended tool** for Arcade-Clean vector art. |
| **Blender Grease Pencil** | GPL, free | "What you create with Blender is your sole property." Blender 4.3 (November 2024) shipped Grease Pencil 3, a full rewrite. Powerful but heavy for this job. |
| **Tiled** | Free and open source (donations welcome) | Version 1.12.2 (27 May 2026). Exports JSON. |
| **LDtk** | MIT, "free without any limitation", version 1.5.3 | Made by Deepnight Games (the Dead Cells director). Has auto-tiling rules and JSON export. |
| **free-tex-packer** | MIT, web app plus desktop builds | Exports for Pixi and Phaser, with trim and rotation. The author says he will fix only critical bugs from now on. |
| **TexturePacker** | The free Essential tier is **"Free for non-commercial use"** only | **Trap:** a commercial project needs a paid licence. Use free-tex-packer instead. |
| **DragonBones** | The runtime (DragonBonesJS) is MIT and supports Pixi and Phaser | Editor status is unclear. Old sources say the editor is free; a 2013 review says it needed Flash; a forum post says saving requires an online login. Avoid. |
| **Spine** | Essential $69, Professional $379. Businesses with more than $500k revenue need Enterprise ($2,499 + $379 per user). | Paid, not free. Integrating the runtimes needs an editor licence. |
| **Rive** | Free tier $0 | **Trap:** "Free exports play a Rive splash screen." Removing it costs $9 per seat per month (Cadet). The web runtime is MIT; `canvas-lite` is the smallest package. |
| **jsfxr** | Unlicense. sfxr.me lists "Unrestricted commercial use". | Works as a JS library: `sfxr.generate('pickupCoin')`, `sfxr.play`, `sfxr.toAudio`, `sfxr.toWave`. Sounds are made at runtime with **no audio files**, which fits Kafu's existing no-audio-files rule. |
| **sfxr** | MIT, by DrPetter | Made for Ludum Dare #10 in December 2007 |
| **Bfxr (bfxr2)** | Software is MIT | The licence of the sounds it makes is not stated. Prefer jsfxr or ChipTone. |
| **ChipTone** | Free (name your own price) | Sounds are CC0: "FREE to use for any purpose, commercial or otherwise." |
| **Audacity** | GPL, free | For trimming and normalising sounds |
| **LMMS** | GPL-2.0, free | The licences of its bundled samples are not stated on the homepage. Check before shipping. |
| **BeepBox** | MIT, free | It "does not claim ownership over songs created with it". Good for a 3-second level-complete jingle. |

---

### 4. Free asset sources and licence traps
- **Kenney: CC0.** Commercial use is fine and no credit is required, but don't use the Kenney logo. Example: Pixel Platformer has 200 files, 18×18 tiles, CC0. Kenney's style is recognisable, so use it for **greybox placeholders only**; Kafu's art must look original.
- **OpenGameArt**
  - CC0 is fine.
  - CC-BY needs credit and forbids DRM distribution. The OGA FAQ names iOS among DRM platforms.
  - CC-BY-SA adds share-alike.
  - GPL art: GNU has given no specific guidance for game art.
  - The FAQ says Apple's App Store terms have been found to conflict with GPL, LGPL, CC-BY-SA and **CC-BY**.
  - **For a closed commercial product, use CC0 only, or get written permission.**
- **itch.io**: no single standard. Each creator writes their own terms. Common clauses:
  - no resale or redistribution of the raw files
  - no AI training
  - some packs have **no licence text at all**
  - example: Pixel Frog's "Pixel Adventure" is CC0
  - Rule: read the licence on the store page and inside the download, keep a copy, and don't rely on comment replies.
- **Fonts**
  - Google says its fonts can be used commercially, "even… within a product that is sold".
  - OFL fonts can be modified and redistributed. Reserved Font Names may force a modified font to be renamed.
  - Kafu already self-hosts Fredoka, Nunito and Pixelify Sans under OFL.
- **What a commercial product can safely use:**
  - self-made art
  - CC0 assets
  - MIT or Unlicense code
  - OFL fonts
  - tool output from GPL tools (Krita and Blender say the output is yours)
  - Keep an **asset register**: file, author, source URL, licence, and whether AI was used.

---

### 5. AI image generation for game sprites in 2026

**Works well**
- Concept exploration and silhouettes.
- Style frames (one mock screenshot that sets the look).
- Single static sprites, items and pickups.
- Parallax backgrounds, which don't tile or animate.
- UI and icons, though small icons need clean-up.
- Source: Summer Engine guide, June 2026.

**Fails**
- **Animation frames.** "Details drift between frames" and the "silhouette wobbles".
- **Tilesets** are the weakest area. Models don't understand grids, so seams appear.
- **Consistency.** Each generation is "a fresh roll": line weight and palette drift.

**Transparent backgrounds**
- The OpenAI API has `background: transparent|opaque|auto`, and transparency needs `png` or `webp` output.
- Support depends on the model, and for `gpt-image-2` it is listed as "in preview". This is fast-moving; recheck before relying on it.
- In practice, still check edges and halos by hand.

**Character consistency**
- Google promotes Gemini 2.5 Flash Image (August 2025) for keeping a character consistent across edits.
- That helps concept sheets. It does not give pixel-exact animation frames.

**Professional workflow**
1. Use AI for 20 to 50 concepts and silhouettes.
2. A human picks one and **redraws it as clean vector** (Inkscape) on the model sheet.
3. Animate by moving the vector parts.
4. Optionally use AI for background paintings, then simplify them to flat Arcade-Clean shapes.
5. Never ship raw AI frames as the animation.

**Copyright caveats**
- US Copyright Office, AI report Part 2 (29 January 2025): prompts alone do not make the user the author. Human-made modifications or arrangement can be protected.
- The Supreme Court denied certiorari in *Thaler v. Perlmutter* on 2 March 2026 (No. 25-449), leaving the human-authorship rule in place.
- OpenAI's terms assign output rights to the user "to the extent permitted", but say output "may not be unique".
- Consequence: a **raw AI mascot may be unprotectable**, and other people can get similar images. A human vector redraw gives Kafu a character it can actually own.
- Models can also reproduce famous characters. Disney and Universal sued Midjourney in June 2025 over this.
  - Never prompt with "Mario-like" or similar.
  - Run a reverse-image search on the final character.
- These rulings are US law; other countries differ.

---

### 6. Minimal asset list for the first vertical slice
Assumptions: a portrait phone, a 64 CSS px grid, textures exported at 2x, a character shown about 88 CSS px tall in a 96×96 CSS cell (192×192 px per frame).

**Character atlas (target ≤ 2048×1024, about 8 MiB; trimmed packing usually fits 1024×1024)**

| Animation | Frames | Speed | Notes |
|---|---|---|---|
| Idle (breathing and blink) | 4 | 6–8 fps | |
| Walk | 8 | 10–12 fps | Contact, down, passing, up, then mirrored |
| Jump | 4 | — | Crouch, launch, apex, land. A tween handles the arc. |
| Climb a step | Walk frames + 2 step-up poses | — | A ladder would need its own 4 frames; stairs are cheaper |
| Lift ride | Reuse idle + 1 "look up" pose | — | |
| Coin grab and celebrate | 6 | 12 fps | |
| Supportive wrong-answer reaction | 1–2 poses | — | No teasing |
| Focused or "entering question" pose | 1 | — | |
| **Total** | **about 28–30 frames** | | For comparison, the CC0 Pixel Adventure pack animates at 20 fps |

**World kit (one 1024×1024 atlas, 4 MiB; 128 px tiles at 2x)**
- Ground tiles: left edge, middle, right edge and fill (4–6 tiles).
- One step block; stairs are built from it.
- Lift: platform, cable or shaft, door frame (3 pieces), plus a "ding" light.
- START sign or flag, numbered checkpoint signs ("Q1", "Q2"…), finish gate.
- 3–5 original props (bench, plant, lamp, a hospital-themed sign).

**Coin or prize**
- One vector image. A scaleX tween fakes the spin; this is the cheapest option. A 6-frame spin is the alternative.
- A 3–4 frame sparkle, or procedural particles.

**"First MCQ" arrow**
- Make it an **HTML/CSS overlay**, not part of the canvas: Fredoka label, token colours, the pressable button style, at least 44×44 px.
- Text stays crisp and accessible.

**Parallax (2–3 layers)**
- Sky: a CSS gradient, which uses zero texture memory.
- Far layer (skyline or mountains) and mid layer (building or hill fronts), each about 2048×512 px, horizontally tileable (about 4 MiB each).
- Turn parallax off on Telegram's low-performance class.

**Sounds, all OFF by default as in the existing DESIGN_STYLE**
- Generated by jsfxr presets at runtime, or by ChipTone with CC0 output.
- Set: coin pickup, jump, a soft step (optional), lift "ding", MCQ open/close whoosh, short level-complete jingle (BeepBox).

**Transitions**
- Reuse Kafu's motion tokens (80/120/180/320 ms) for MCQ in and out, using transform and opacity only.
- Reduced motion makes them instant.
- Pause the game loop while the MCQ is open.

**Total texture budget:** about 20 MiB. Flat-colour art compresses well, so downloads should be small (an estimate, not measured).

---

### 7. What a top professional would do that you are not asking for
1. **Kill criteria before any art.** For example: kill or rework the idea if the game ⇄ MCQ transition adds more than about 300 ms, misses 60 fps on the reference phone, or lowers MCQs answered or accuracy per session.
2. **Greybox the whole loop first** (START → walk → coin → MCQ → next → climb) with plain rectangles, and test speed and feel. Art comes last.
3. **Lock the style before animating:** one style frame, one model sheet, a palette taken only from tokens.css.
4. **Design for the real audience:** adult, tired medical students, with a domain story (the hospital tower or mountain; floors are chapters). This also settles the repo's own "no childish mascot / not a game demanding attention" tension.
5. **Make it skippable:**
   - tapping during the walk jumps straight to the MCQ
   - a "study mode" switch bypasses the game
   - a question is never blocked behind an animation
6. **Use a reference device and a performance budget:** one cheap Android phone, devicePixelRatio capped at 2, the Telegram performance class to downgrade effects.
7. **Keep provenance and a licence register**, including which assets used AI.
8. **Measure learning, not only fun.** Gamification meta-analysis (Sailer & Homner 2020): cognitive g = .49, motivational .36, behavioural .25; game fiction moderated the behavioural effect. Seductive details reduce learning (WSU meta-analysis, 58 studies, more than 7,500 students). So the game sits **between** questions, never on the question screen.

### 8. The rawest material to start from (instead of finished packs or AI sprites)
- **For the character:** the written brief; black silhouette thumbnails; **video of a real person** walking, climbing stairs and stepping into a lift, stepped through frame by frame; a mirror for expressions.
- **For the world:**
  - Reference photos of real Iraqi college and hospital stairs, lifts and corridors, for mood only, not to copy brands.
  - Kafu's own session data. The number of MCQs per session sets level length.
  - The screen-size distribution of users.
  - The tokens.css palette.

### 9. Methods and tools
- **Methods:**
  - silhouette test, shape language, model sheet, expression sheet, colour script
  - keypose-first animation (contact, down, passing, up)
  - grid-based modular kit
  - greybox, then a vertical slice
  - "juice", used sparingly: tweening, squash and stretch, small impact effects (Jonasson and Purho's "Juice it or lose it" talk), within Kafu's calm-study rules
- **Tools (all free):**
  - Art: Inkscape (vector art), Krita (backgrounds and frame-by-frame), LibreSprite or Piskel (rare pixel badges)
  - Packing and levels: free-tex-packer (atlases), LDtk or Tiled (level layout)
  - Sound: jsfxr, ChipTone, Audacity, BeepBox
  - Engine: PixiJS, Phaser 4 or plain Canvas 2D
  - Testing: Chrome DevTools Performance panel

### 10. What, other than you or me, would show the result is right
- **The device and the profiler:**
  - Chrome DevTools Performance with 4x CPU throttling, though Chrome itself says a real phone is the gold standard.
  - Targets: RAIL's "each frame in 10 ms or less" (16 ms is the 60 fps ceiling) and a response within 100 ms of a tap.
  - Run on a real low-end Android phone inside Telegram.
- **Students:** usability rounds of 5 students. Nielsen: five users find about 85% of problems; run 3 rounds of 5 rather than one big test.
  - Tasks: start, answer 3 MCQs, find "next".
  - Measures: time-to-first-MCQ, errors, comments.
- **A silhouette and recognition test** with students: can they recognise the character as a black shape at phone size?
- **Reverse-image search** (Google Lens or TinEye) to confirm the character is not a lookalike.
- **A licence audit** against the asset register.
- **Later, only after the owner is convinced:** an A/B test in the app comparing game mode with control on MCQs per session, return rate and accuracy at later review. Accuracy is the guard against seductive details.

### Uncertain or fast-moving items
- OpenAI image model names and transparency support (the page text changes often).
- DragonBones editor status.
- The Inkscape artwork-ownership point (forum answers, not an official page).
- TexturePacker paid price (not found).
- The Sailer & Homner numbers (taken from the abstract via search results).
- web3dsurvey percentages (they vary between snapshots).
- Telegram Android using the system WebView and iOS using WKWebView, and the 12 animation principles (from memory).

---

## Fact-check result

72 of 74 claims confirmed by the independent checker. Corrections (these win over the text above):

- **C34 (corrected)**: itch.io asset licences are set per creator; examples include bans on resale/redistribution of raw files and on AI training, and some packs carry no licence text.
  - Correct: The cited itch.io post is one creator's informal comment reply about a Roblox script pack. It allows commercial use and asks only that the asset files are not redistributed or resold on their own, and it links no formal licence text. It says nothing about AI-training bans or packs with no licence. The general point (terms vary by creator, so read each pack) is reasonable, but this source supports only the no-redistribution/resale clause and the informal-terms point.
  - Source: https://itch.io/post/15952755
- **C56 (corrected)**: Colour scripts are strips of small images mapping a film's emotional arc through colour; Ralph Eggleston pioneered them at Pixar on Toy Story.
  - Correct: The cited StudioBinder page does not mention Eggleston or Toy Story. It says Pixar is 'often credited' and points to A Bug's Life. Eggleston did not invent colour scripts: he first used the technique as art director of FernGully (1992). He then created the colour script for Toy Story at Pixar, after which Pixar made one for every film. 'Introduced colour scripts to Pixar on Toy Story' is accurate; 'pioneered' overstates it.
  - Source: https://www.cartoonbrew.com/rip/ralph-eggleston-a-cornerstone-of-pixars-visual-style-dies-at-56-220781.html

### What the checker said was missing or misleading

1) THE REPO'S OWN SIZE BUDGET RULES OUT PIXI/PHASER FOR INTEGRATION. docs/DESIGN_STYLE.md:97 says 'total shipped app JavaScript + CSS must remain ≤150 KB gzipped'; HANDOFF.md:103 repeats the rule. I measured the libraries from jsDelivr:
- pixi.js 8.22.0 min: 840,663 B raw, about 237 KB gzip.
- phaser 4.2.1 min: 1,375,976 B raw, about 352 KB gzip.
Either one alone is larger than the whole app's budget. A separate prototype can use them. For a fast integration on Iraqi mobile networks the realistic paths are plain Canvas 2D (0 KB of library) or a lazily loaded game chunk with an owner-approved budget exception. The report lists 'PixiJS, Phaser 4 or plain Canvas 2D' as if they were equal. (jsfxr is small: about 8.7 KB gzip unminified.)

2) THE REPORT OVERSTATES THE 'CONFLICT' INSIDE THE REPO.
- DESIGN.md:9 does not reject childish mascots: it allows 'an original SVG mascot placeholder'. ASSESSMENT.md:53 and IDEAS.md:260 misquote it.
- DESIGN_STYLE.md:7 makes Arcade-Clean a 'premium mobile-game shell'.
- DESIGN_STYLE.md:111 says the design is not ready unless a viewer 'would immediately describe it as a game-style study app'.
- The owner's request is itself the 'owner direction' ASSESSMENT asks for.
The binding constraints are different:
- 'Avoid continuous motion in study views'; transform and opacity only; reduced motion sets durations to 0 (DESIGN_STYLE.md:53, tokens.css:110-113, 219-224).
- No surprise sounds, never tease a wrong answer (DESIGN.md:9).
- Design PRs never self-merge (HANDOFF.md:103).

3) TELEGRAM GAME APIs THE REPORT MISSED (core.telegram.org/bots/webapps):
- disableVerticalSwipes / isVerticalSwipesEnabled (Bot API 7.7, July 7, 2024). Without it, a downward drag can minimise or close the Mini App mid-game.
- isActive plus the activated/deactivated events (Bot API 8.0). Use them to pause the game loop and audio when the app is minimised.
- The guidelines say 'All included animations should be smooth, ideally 60fps.'
- The performance class (LOW/AVERAGE/HIGH) is Android-only. About 13.6% of Iraqi users are on iOS, so the game also needs its own frame-time-based downgrade.

4) THE MEMORY BUDGET IS OPTIMISTIC.
- Mipmaps add about 33% when generated.
- The game canvas's own backing store at DPR 2 counts toward Safari's total canvas-memory limit (pqina). That is roughly 6 MB per 824x1830 buffer.
- 20 MiB is still small, but 'far under every known limit' should be re-measured on the device.

5) MEASUREMENT CAVEATS.
- Chrome's throttling does not simulate GPU-heavy work (developer.chrome.com, Apr 2025), so a real low-end Android phone inside Telegram (Chromium WebView) is mandatory, not merely the 'gold standard'. Debug it via Telegram's 'Enable WebView Debug' and chrome://inspect.
- RAIL (last updated 2020) is superseded by Core Web Vitals. Use INP ≤200 ms as the field target (web.dev/articles/inp), with RAIL's 16 ms and 100 ms as lab targets.

6) THE EVIDENCE IS FRAMED MORE STRONGLY THAN IT IS.
- Sailer & Homner: only the cognitive effect was stable in high-rigour studies; the motivational and behavioural effects (the ones a game mode targets) were 'less stable', and all three are 'small'.
- The WSU seductive-details meta-analysis studied irrelevant details inside 6–12-minute lessons. The effect was strongest when the details were static or sat next to relevant diagrams. It did not test interstitial game scenes between questions.
- The more direct risk is time added per question (walk and climb animations). Time-to-next-MCQ and MCQs per minute should be the first kill metric, alongside accuracy.

7) LICENCES ARE MORE CONSERVATIVE THAN NEEDED.
- OGA's DRM/iOS warning is about App Store distribution of the work. Kafu is a web page inside Telegram, not an App Store binary, so CC-BY art with credit is usable. 'CC0 only' is a safe choice, not a requirement.
- TexturePacker's trap depends on whether Kafu counts as commercial (CLAUDE.md calls it 'the free app'). free-tex-packer avoids the question, but its author says 'Only critical bugs will be fixed', so it is effectively in maintenance mode.

8) AI IMAGE GENERATION IS NOT FREE THROUGH APIs.
- OpenAI's API is paid; Gemini 2.5 Flash Image costs about $0.039 per image. Newer gpt-image-2.5-sunburst/flare models (2026-09-08) now explicitly support transparency.
- The owner already uses ChatGPT for image lessons with STORY_RULES (one main character, CLAUDE.md). The report ignores that existing pipeline: the same character and story conventions could seed the game's concept stage.
- The Summer Engine source behind the 'AI fails at animation' claims is a vendor blog promoting its own engine.

9) CURRENCY.
- PixiJS is at 8.22.0 (2026-10-01), with about 832k weekly npm downloads (10–16 Oct 2026). The report's 8.18/8.19 is from June.
- Phaser 4.2.1 (9 July 2026) is still the latest, with about 406k weekly downloads.
- Telegram Bot API is now at 10.1 (June 11, 2026). None of the 9.x–10.1 Mini App additions change the game plan.

### Sources: every claim with its verdict

| ID | Verdict | Claim | Source |
|---|---|---|---|
| C1 | confirmed | Aseprite official FAQ: $19.99 USD is the minimum pledge for the .exe/.dmg; source can be downloaded, compiled and used for personal purposes; compiled versions can create art for personal/commercial purposes; since August 2016 compiled versions cannot be redistributed. | https://aseprite.org/faq/ |
| C2 | confirmed | Aseprite on Steam is listed at $19.99 with updates for the v1.x series up to v1.9. | https://store.steampowered.com/app/431730/Aseprite/ |
| C3 | confirmed | Aseprite EULA section 2(g) allows compiling/modifying source only for your own personal purpose or to propose a contribution; section 2(b) prohibits distributing copies to third parties. | https://github.com/aseprite/aseprite/blob/main/EULA.txt |
| C4 | confirmed | LibreSprite is GPL-2.0, forked from the last GPLv2 commit of Aseprite after Aseprite moved to a proprietary licence on August 26, 2016. | https://github.com/LibreSprite/LibreSprite |
| C5 | confirmed | Piskel is Apache-2.0, browser-based (latest Chrome/Firefox/Edge) and states 'There is no support for mobile.' | https://github.com/piskelapp/piskel |
| C6 | confirmed | Krita is GPLv3 and states 'What you create with Krita is your sole property'; commercial use of art is allowed. | https://krita.org/en/about/license/ |
| C7 | confirmed | Krita animation has timeline, onion skin, animation curves, storyboard, Render Animation to frame sequence or video (FFmpeg); it keeps all frames in memory; docs suggest 12 fps for early work; spritesheet export is not mentioned. | https://docs.krita.org/en/user_manual/animation.html |
| C8 | confirmed | Inkscape binaries are covered by GNU GPL v3 or later (source mostly GPLv2+); community/forum answers say artwork made with Inkscape is the user's and can be sold. | https://bazaar.launchpad.net/~inkscape.dev/inkscape/trunk/view/head:/COPYING |
| C9 | confirmed | Blender is GPL; 'What you create with Blender is your sole property' and output can be used commercially. | https://www.blender.org/about/license/ |
| C10 | confirmed | Blender 4.3 (November 2024) shipped Grease Pencil 3, a complete rewrite of the 2D animation toolset. | https://www.cgchannel.com/2024/11/5-key-features-in-blender-4-3/ |
| C11 | confirmed | Tiled is free and open source, latest version 1.12.2 released 27 May 2026, exports JSON among other formats. | https://www.mapeditor.org/ |
| C12 | confirmed | LDtk 'can be used for free without any limitation', latest download 1.5.3, by Deepnight Games (director of Dead Cells), has rule-based auto-rendering and JSON export; repository licence is MIT. | https://ldtk.io/ |
| C13 | confirmed | LDtk repository is under the MIT license. | https://github.com/deepnight/ldtk |
| C14 | confirmed | free-tex-packer is MIT, has a web app and desktop builds, exports json/xml/css/pixi.js/godot/phaser/cocos2d, supports trim and rotation; the author will only fix critical bugs. | https://github.com/odrick/free-tex-packer |
| C15 | confirmed | TexturePacker's free Essential tier is 'Free for non-commercial use'; commercial projects or advanced features need a paid licence. | https://www.codeandweb.com/texturepacker/licenses-comparison |
| C16 | confirmed | TexturePacker: 'You can use TexturePacker's basic features for free in non-commercial projects. You have to purchase a license if you want to use it in commercial projects.' | https://www.codeandweb.com/texturepacker/knowledgebase/is-texturepacker-free |
| C17 | confirmed | TexturePacker's default max texture size is 2048. | https://www.codeandweb.com/texturepacker/documentation/texture-settings |
| C18 | confirmed | DragonBonesJS runtime is MIT licensed and supports Egret, PixiJS, Phaser, Hilo and Cocos Creator. | https://github.com/DragonBones/DragonBonesJS |
| C19 | confirmed | A 2013 review listed DragonBones as free but requiring Flash Professional CS 5.5+; the editor's current status was not confirmed. | https://kaliko.com/blog/2d-skeletal-animation-tools/ |
| C20 | confirmed | Spine Essential $69, Professional $379, Enterprise $2,499 base plus $379 per user; businesses with more than $500,000 USD annual revenue require Enterprise; integrating Spine Runtimes requires a Spine Editor licence. | https://esotericsoftware.com/spine-purchase |
| C21 | confirmed | Rive free tier ($0) includes editor and .riv export but 'Free exports play a Rive splash screen'; 3 collaborative files; Cadet at $9/seat/month removes the splash screen. | https://rive.app/pricing |
| C22 | confirmed | Rive web runtime repository is MIT; @rive-app/canvas-lite is 'the smallest Rive web package' (drops text, layout, audio, scripting); @rive-app/webgl is deprecated after v2.37.0. | https://rive.app/docs/runtimes/web/canvas-vs-webgl |
| C23 | confirmed | jsfxr is released under the Unlicense and can be used as a JS library: sfxr.generate(preset) with presets including pickupCoin, jump, powerUp, blipSelect; sfxr.play, sfxr.toAudio, sfxr.toBuffer (44100 Hz default), sfxr.toWave(...).dataURI. | https://github.com/chr15m/jsfxr |
| C24 | confirmed | sfxr.me (jsfxr) lists 'Unrestricted commercial use' and free WAV export. | https://sfxr.me/ |
| C25 | confirmed | sfxr was made by DrPetter for the 10th Ludum Dare (December 2007) and is MIT licensed. | https://www.drpetter.se/project_sfxr.html |
| C26 | confirmed | bfxr2 software is MIT licensed; the repository does not state the licence of generated sounds. | https://github.com/increpare/bfxr2 |
| C27 | confirmed | ChipTone is a free (name-your-own-price) tool and 'All sounds created using ChipTone are FREE to use for any purpose, commercial or otherwise' (CC0 linked). | https://sfbgames.itch.io/chiptone |
| C28 | confirmed | Audacity 'has always — and will always — remain free' and is licensed under the GNU GPL. | https://www.audacityteam.org/FAQ/ |
| C29 | confirmed | LMMS is GPL-2.0, free and open source. | https://github.com/LMMS/lmms |
| C30 | confirmed | BeepBox source is MIT, it 'will always be free to use' and 'does not claim ownership over songs created with it.' | https://www.beepbox.co/ |
| C31 | confirmed | Kenney assets are CC0 public domain, usable in commercial projects, attribution not required; do not use the Kenney logo. | https://kenney.nl/support |
| C32 | confirmed | Kenney Pixel Platformer: 200 files, 18x18 tiles, CC0. | https://kenney.nl/assets/pixel-platformer |
| C33 | confirmed | OpenGameArt FAQ: CC0 needs no credit; CC-BY requires credit and no DRM distribution (iOS listed as DRM); CC-BY-SA adds share-alike; GPL suits GPL projects with no specific GNU guidance on game art; Apple's App Store terms have been found to conflict with GPL, LGPL, CC-BY-SA and CC-BY. | https://opengameart.org/content/faq |
| C34 | corrected | itch.io asset licences are set per creator; examples include bans on resale/redistribution of raw files and on AI training, and some packs carry no licence text. | https://itch.io/post/15952755 |
| C35 | confirmed | Pixel Frog's 'Pixel Adventure 1' on itch.io is CC0 1.0, attribution not required, name-your-own-price, animations at 20 FPS (50 ms). | https://pixelfrog-assets.itch.io/pixel-adventure-1 |
| C36 | confirmed | Google Fonts FAQ: fonts can be used commercially, 'even include them within a product that is sold commercially'; conditions are in each licence. | https://developers.google.com/fonts/faq |
| C37 | confirmed | OFL fonts can be freely modified and redistributed; Reserved Font Names may require renaming modified versions. | https://openfontlicense.org/ |
| C38 | confirmed | CSS image-rendering: pixelated scales with nearest neighbour to the nearest integer multiple of the original size, then smooths to the final size; the property is Baseline widely available since January 2020. | https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering |
| C39 | confirmed | CanvasRenderingContext2D.imageSmoothingEnabled defaults to true; set false to keep pixels sharp when enlarging. | https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled |
| C40 | confirmed | web3dsurvey (WebGL1 MAX_TEXTURE_SIZE, snapshot fetched 2026-10-18): 4096 supported by 100% of reports, 8192 by 98% overall but 76% on Android, 16384 by 3% on Android; iOS 8192 at 100%. Other snapshots in search results showed lower 8192 figures. | https://web3dsurvey.com/webgl/parameters/MAX_TEXTURE_SIZE |
| C41 | confirmed | WebGL Fundamentals: '2048 or 4096 seems to be reasonable limits'; 99% of devices support 4096 but only about 50% support more (2020 data); low-end GPUs probably have less than 1 GB. | https://webglfundamentals.org/webgl/lessons/webgl-cross-platform-issues.html |
| C42 | confirmed | iOS Safari total canvas memory limit was 384 MB on iOS 15, lower on earlier versions and possibly device-dependent; max canvas 4096x4096 (64 MB) per canvas; release canvases by setting them to 1x1. | https://www.pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/ |
| C43 | confirmed | An Apple developer forum thread is titled 'Total canvas memory use exceeds the maximum limit (224 MB)'. | https://developer.apple.com/forums/thread/112218 |
| C44 | confirmed | Decoded image data size can be calculated as width*height*4 bytes (RGBA); browsers may differ, so treat it as an estimate. | https://appgamekit.com/documentation/Reference/Memblock/CreateMemblockFromImage.htm |
| C45 | confirmed | PixiJS performance tips: sprites batch with up to 16 different textures (hardware dependent); use spritesheets to minimise textures; hundreds of complex Graphics objects can be slow, use sprites; filters are expensive; sprite masks are 'really expensive'. | https://pixijs.com/8.x/guides/concepts/performance-tips |
| C46 | confirmed | PixiJS v8 loads SVG either as a rasterised texture (capped at 4096x4096, with a resolution option for crispness) or as a GraphicsContext via parseAsGraphicsContext; parsing is costly, so preload and reuse. | https://pixijs.com/8.x/guides/components/assets/svg |
| C47 | confirmed | PixiJS June 2026 update covers v8.18.0 and v8.19.0 (published June 12, 2026) and reports more than 500,000 weekly npm downloads. | https://pixijs.com/blog/june-2026 |
| C48 | confirmed | Phaser 4 releases: v4.0.0 'Caladan' 10 April 2026, v4.1.0 30 April 2026, v4.2.0 19 June 2026, v4.2.1 9 July 2026. | https://phaser.io/download/phaser4 |
| C49 | confirmed | Phaser is distributed under the MIT License. | https://phaser.io/download/license |
| C50 | confirmed | RAIL: produce each animation frame in 10 ms or less (16 ms is the maximum budget at 60 fps because rendering takes about 6 ms); complete input-initiated transitions within 100 ms and process input events within 50 ms. | https://web.dev/articles/rail |
| C51 | confirmed | Chrome DevTools Performance panel offers CPU throttling (4x slowdown), with calibration to match real devices; a real phone remains the gold standard. | https://developer.chrome.com/blog/devtools-grounded-real-world |
| C52 | confirmed | Statcounter: in September 2026 Android had 86.34% and iOS 13.64% of mobile OS market share in Iraq. | https://gs.statcounter.com/os-market-share/mobile/iraq |
| C53 | confirmed | Telegram Bot API 8.0 (November 17, 2024) added requestFullscreen, safeAreaInset/contentSafeAreaInset, lockOrientation, and Android hardware info including the device performance class; the design guidelines advise reducing animations on low-performance devices. | https://core.telegram.org/bots/webapps |
| C54 | confirmed | Valve's TF2 paper: the nine classes were designed to be identifiable 'only in silhouette with no internal shading', which was used to validate character design during the concept phase; high-frequency detail is omitted; interior details echo silhouette shapes. | https://www.cs.princeton.edu/courses/archive/fall07/cos597B/papers/mitchell-team-fortress.pdf |
| C55 | confirmed | A model sheet holds turnarounds, expressions, poses, hands/feet and proportions so multiple artists keep a character consistent ('off-model' when not). | https://en.wikipedia.org/wiki/Model_sheet |
| C56 | corrected | Colour scripts are strips of small images mapping a film's emotional arc through colour; Ralph Eggleston pioneered them at Pixar on Toy Story. | https://www.studiobinder.com/blog/what-is-a-color-script-definition/ |
| C57 | confirmed | A basic walk cycle uses contact, passing, down and up poses, repeated and inverted, for at least 8 frames. | https://openlab.bmcc.cuny.edu/mmp260-pinkas-s2020/week-8/ |
| C58 | confirmed | Skyrim modular level design (GDC 2013): kits are systems 'typically snapped to a grid'; sub-kits on the same grid size or multiples; 2 kit artists, 8 level designers, 7 kits, 400+ unique cells, 30 months. | https://www.slideshare.net/slideshow/gdc2013-kit-buildingfinal/17728576 |
| C59 | confirmed | Grayboxing/blockout builds a rough version of a level from simple boxes so layout can be iterated and tested early, before art. | https://www.blog.radiator.debacle.us/2017/09/how-to-graybox-blockout-3d-video-game.html?m=1 |
| C60 | confirmed | The 'Juice it or lose it' talk by Martin Jonasson and Petri Purho demonstrates tweening/easing, squash and stretch, and screen shake to add game feel. | https://roblog.co.uk/2024/03/juicy-games/ |
| C61 | confirmed | Summer Engine guide (June 6, 2026): AI is good at concepts, single sprites, parallax backgrounds and UI; animation frames drift ('silhouette wobbles'); tilesets are the weakest area; recommended workflow locks a style and handles animation separately. | https://www.summerengine.com/blog/ai-2d-game-asset-generator |
| C62 | confirmed | OpenAI image API reference (fetched 2026-10-18): background accepts transparent, opaque or auto; transparent requires png or webp output; transparent backgrounds are available for supported GPT Image models, and for gpt-image-2 the support is described as in preview. | https://developers.openai.com/api/reference/cli/resources/images/methods/generate/index.md |
| C63 | confirmed | Google introduced Gemini 2.5 Flash Image ('nano-banana') on August 26, 2025, promoting character consistency across edits and multi-image blending. | https://developers.googleblog.com/en/introducing-gemini-2-5-flash-image/ |
| C64 | confirmed | US Copyright Office AI report Part 2 (Copyrightability) was released January 29, 2025; Part 3 pre-publication May 9, 2025. | https://www.copyright.gov/ai/ |
| C65 | confirmed | Copyright Office Part 2 concludes prompts alone do not provide sufficient human control to make users authors; human-authored expression, creative arrangements or modifications of AI output can be protected. | https://www.lowenstein.com/news-insights/publications/client-alerts/us-copyright-office-issues-report-on-copyrightability-of-generative-ai-outputs-ai |
| C66 | confirmed | The Supreme Court denied certiorari in Thaler v. Perlmutter (No. 25-449) on March 2, 2026. | https://www.scotusblog.com/cases/thaler-v-perlmutter/ |
| C67 | confirmed | OpenAI terms of use: to the extent permitted by law, users own Output and OpenAI assigns its rights in Output; output may not be unique and other users may receive similar output. | https://www.openai.com/policies/terms-of-use/ |
| C68 | confirmed | Disney and Universal sued Midjourney in Los Angeles in June 2025 (article dated June 12, 2025), alleging it reproduces their characters. | https://cointelegraph.com/news/disney-universal-sue-midjourney-copyright-infringement |
| C69 | confirmed | Sailer & Homner (2020) meta-analysis of gamification in learning: cognitive g = .49, motivational g = .36, behavioural g = .25; game fiction and social interaction moderated behavioural outcomes. | https://link.springer.com/article/10.1007/s10648-019-09498-w |
| C70 | confirmed | WSU meta-analysis (Sundararajan/Sundar & Adesope, Educational Psychology Review) of 58 studies with more than 7,500 students found seductive details (interesting but irrelevant information) worsen learning; most studies were 6–12 minute sessions and covered only cognitive outcomes. | https://news.wsu.edu/press-release/2020/03/19/seductive-details-inhibit-learning |
| C71 | confirmed | Nielsen Norman Group: a test with 5 users finds about 85% of usability problems; better to run 3 studies with 5 users each; distinct user groups need more participants. | https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/ |
| C72 | confirmed | Kafu's design doc says a successful session should feel encouraging, 'not like a game demanding attention'; DESIGN_STYLE says pixel art is a rare reward accent only, feedback sounds are synthesized with WebAudio with no audio files, and sound is OFF by default; DNAgens/ASSESSMENT.md line 53 warns against adding a character without owner direction. | /home/user/MCQs-Mountain-/docs/DESIGN.md |
| C73 | confirmed | Telegram on Android renders Mini Apps in the system (Chromium) WebView and on iOS in WKWebView. | memory |
| C74 | confirmed | The 12 principles of animation (squash and stretch, anticipation, follow-through, etc.) come from Thomas & Johnston's 'The Illusion of Life' (1981). | memory |
