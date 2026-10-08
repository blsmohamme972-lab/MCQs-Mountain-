# MotionCards content — MRCS-UPPERLIMB-CH3 (revision 2)

Kafu MotionCards for **MRCS Part A: 550 SBAs and EMQs**, chapter 3 *Upper limb and breast*:
8 cards, Q000009325–Q000009332, 8000 ms each. This is content-batch source only; it does not change platform code.

| QID | Source answer | What the card shows |
|---|---|---|
| Q000009325 | Musculocutaneous | Brachial plexus; a signal climbs C5–C7 through the lateral cord into the musculocutaneous nerve |
| Q000009326 | Long thoracic nerve of Bell | Posterior torso; serratus holds the scapula flat, a nerve lesion lets it wing |
| Q000009327 | Subscapularis | Anterior shoulder; subscapularis drives internal rotation, a tendon tear stalls it |
| Q000009328 | Radial | Radial nerve in the spiral groove; shaft fracture injures it, hand droops (wrist drop) |
| Q000009329 | Flexor carpi ulnaris | Forearm flexors; only the ulnar-fed FCU contracts, the rest are tagged median |
| Q000009330 | Ulnar | Ulnar nerve behind the medial epicondyle; dislocation silences the interossei |
| Q000009331 | Median nerve | Carpal tunnel section; swollen tendons squeeze the median nerve, 3½ digits tingle, thenar wastes |
| Q000009332 | Internal thoracic artery | Breast arterial supply; flow via internal-thoracic perforators plus weaker secondary routes |

## Layout
- `source/` — the `kafu_mcq_text_export` used (reconstructed from the owner's pasted export; the tooling verified every
  question's `content_hash` and `publisher_fingerprint` against it).
- `generator/` — the source of truth: `kit.py` (shared art kit), `scenes/q93NN.py` (one module per card),
  `BRIEF.md` (house style and constraints), `build.py`, `render.py`, `shoot2.js`.
- `scenes/` — the generated `*.scene.json` exactly as packaged (do not hand-edit; regenerate with `build.py`).
- `selection.json` — selection/duration/content-hash record from the scaffold.

## Rebuild
```bash
python motioncards-content/MRCS-UPPERLIMB-CH3/generator/build.py --revision 2
# -> dist/MCARDS_MRCS-UPPERLIMB-CH3_r2.zip, validated; also refreshes scenes/*.scene.json
```
Rebuilding at revision 2 reproduces the delivered ZIP byte-for-byte
(SHA-256 `5dc2b2ad0fb11821a4c4041f9f40e55f326d15eb0e505da6814d69badd533263`). Bump `--revision` for any change.

## Preview a card
```bash
python motioncards-content/MRCS-UPPERLIMB-CH3/generator/render.py q9327 0,3000,6000,8000
```
Needs node with Playwright and ImageMagick `montage`; set `PLAYWRIGHT_MODULE` / `CHROMIUM_PATH` if they are not on the
default paths. Writes `generator/out/<QID>_sheet.png` (git-ignored).

A validator PASS is not a medical review; have the anatomy checked before publishing.
