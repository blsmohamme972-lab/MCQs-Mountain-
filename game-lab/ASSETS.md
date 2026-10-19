# Asset register (TEST ONLY)

Every third-party file the lab uses is listed here (D22). All are downloaded by `tools/fetch_assets.py` (art and
sound) or `tools/fetch_engine.py` (engine and runtimes) into git-ignored folders (`assets-test/`, `vendor/`). Each
download comes from a URL pinned to one commit or one npm version and is checked against a SHA-256 (and the npm
sha512 integrity) in the lock files. Nothing here is committed, and nothing ships to students.

**TEST ONLY: replace before any release.** The packs below are free (CC0 or MIT), so a release would be allowed by
their licences, but they come from third-party GitHub mirrors, not from the authors' own pages (itch.io and kenney.nl
are blocked from the build container). Before any release, download the same packs from the authors, check the
files match, and re-check the licence text there. Original art for the real game is still the plan (D19).

## Engine and runtimes (lock: `tools/engine-lock.json`)

| Package | Version | Licence | Source | Used by | Notes |
|---|---|---|---|---|---|
| pixi.js | 8.22.0 | MIT | npm registry tarball, sha512 integrity + SHA-256 of `dist/pixi.min.js` | both tiers | D24 |
| pixi-filters | 6.1.5 | MIT | npm registry tarball, sha512 integrity + SHA-256 of `dist/pixi-filters.js` | HD tier | light rays (GodrayFilter), colour grading (AdjustmentFilter), beacon glow (GlowFilter); D26 |
| phaser | 4.2.1 | MIT | npm | engine spike only | not used by v2 |

No Spine runtime is used (D26): the hero is a cut-out skeleton animated in code, so no evaluation licence is needed.

## Light tier art (lock: `tools/assets-lock.json`, 133 files)

| Group | Author | Licence | Mirror @ commit | Evidence |
|---|---|---|---|---|
| Treasure Hunters (Captain Clown Nose, Palm Tree Island, Pirate Treasure, Wood and Paper UI) | Pixel Frog (pixelfrog-assets.itch.io/treasure-hunters) | CC0 1.0 | github.com/MarcialBot/Uppy-Bat @ e8098cdd1a0981edda7dad7a4a6afd8aeb4ed421 | author's itch page: "released under a Creative Commons Zero (CC0) license", "Attribution is not required" (read through search summaries; itch.io is blocked here); details in `research/05-assets-scouting.md` |
| Pixel Adventure 1 (heroes, checkpoint, start and end, moving platform, fruits) | Pixel Frog (pixelfrog-assets.itch.io/pixel-adventure-1) | CC0 1.0 | github.com/marpor/PixelAdventure @ fb168c3a1efc859312ce4c16d2a30c91ef796098 | author's itch page: CC0, attribution not required; mirror README credits Pixel Frog |
| Distant mountain ranges | drawn by `tools/build_assets.py` | lab's own | - | generated |

## HD tier art and sound (lock: `tools/assets-hd-lock.json`, 101 files)

All from one mirror of Kenney Game Assets All-in-1: github.com/CraigBuilds/kenney_assets_v2 @
53fc78e81ee0c604fb216d289100ea1bd8516591. Each pack's own `License.txt` is in the lock and is downloaded with it.

| Group | Files used | Author | Licence | Evidence (the pack's License.txt, downloaded with the files) |
|---|---|---|---|---|
| Toon Characters Pack 1, Female adventurer | 11 body parts (Parts HD) for the code skeleton, 3 poses for the Strip icon | Kenney (kenney.nl) | CC0 1.0 | "Toon Characters Pack 1 (1.0) ... License: (Creative Commons Zero, CC0) ... free to use in personal, educational and commercial projects" |
| Platformer Pack Redux | grass and stone tiles, chain, sign, bush, rock, plants, fence, torch, log bridge, coins, flags, star | Kenney | CC0 1.0 | "Platformer Pack Redux (1.0) ... CC0" |
| Background Elements Redux (Retina) | trees, bushes, clouds, moon, fence (tower not used) | Kenney | CC0 1.0 | "Background Elements Redux ... CC0" |
| Particle Pack, Smoke Particles | light, star, spark, circle, smoke, magic; white puffs | Kenney | CC0 1.0 | each pack's License.txt: CC0 |
| Music Loops | "Flowing Rocks" (music, off by default) | Kenney | CC0 1.0 | "Music Loops (1.1) ... CC0" |
| Interface Sounds, Impact Sounds, Music Jingles | click, glass, confirmation, drop, pluck, maximize; grass footsteps, light metal; one pizzicato jingle | Kenney | CC0 1.0 | each pack's License.txt: CC0 |
| Painted layers, rock texture, waterfall, foreground grass, baked faces (blink, happy), book, badges, sign board, birds, confetti, glows | drawn by `tools/build_assets_hd.py` | lab's own | - | generated with fixed seeds |

Not used on purpose: the Kenney male adventurer (green tunic, too close to a famous franchise hero), the red
spotted mushroom and the "!" blocks (too close to a famous platformer), the castle tower (with an end flag it reads
as a famous platformer's level end).

Sound is off by default and the files load only after the player turns sound on (both tiers share the HD sound set).

## Fantasy worlds, one per stage (D28; lock: `tools/worlds-lock.json`, 6 packs)

Fetched by `tools/fetch_worlds.py` from each author's free itch.io page (no payment, no login) into
`assets-test/src/worlds/` (git-ignored), SHA-256 checked. Licences as shipped in each pack and on its page on
2026-10-19; re-check before anything ships. Being built into the HD worlds (not in the game yet).

| Pack | Used for | Author | Licence | Evidence |
|---|---|---|---|---|
| Free Cartoon Forest 2D Backgrounds | enchanted forest, magic night forest | CraftPix (on itch.io by Free Game Assets) | CraftPix file licence: personal and commercial use, no attribution, no resale or redistribution of the files | the pack's `TXT/license.txt` links craftpix.net/file-licenses (read on 2026-10-19; craftpix.net itself answers 403 from the build container) |
| Free Fairy-Tale 2D Backgrounds | jungle lagoon, purple enchanted forest, misty forest | CraftPix (Free Game Assets) | CraftPix file licence | itch page: "use it in your games for commercial purposes"; the pack names its font (Grobold, dafont), not used |
| Free Parallax 2D Backgrounds | castle on the clouds at night, teal hills | CraftPix (Free Game Assets) | CraftPix file licence | itch page, as above |
| Free Winter Holiday 2D Backgrounds | snowy pine forest (scene 1 only) | CraftPix (Free Game Assets) | CraftPix file licence | the pack's `TXT/license.txt` |
| Volcano - Free Platform Tileset | lava-rock tiles, crystals | Franco Giachetti (LudicArts) | CC BY 3.0, credit "LudicArts.com" | the pack's `License.txt` |
| Free Ice Forest - Platformer Tileset | ice-brick tiles, snowy trees and bushes | LudicArts | CC BY 4.0, credit "LudicArts.com" | the pack's `License.txt` |

Left out on purpose: the CraftPix Halloween backgrounds (ghosts, graves with crosses) and the winter scenes with
holiday decorations (not neutral for the audience), the Fairy-Tale mushroom scene (red spotted mushrooms read as a
famous platformer), and AI-made packs.
