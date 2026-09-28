# Kafu Arcade-Clean design style

Owner-approved visual direction for Kafu. This document and `app/design/tokens.css` define DESIGN 1/10. The token file is the single source of truth for visual values; this document explains intent and constraints.

## Direction

**Arcade-Clean** is a premium mobile-game shell around a calm study core: chunky rounded shapes, thick outlines, hard offset shadows, pressable 3D buttons, bright saturated colour and brief playful motion. The study surface stays quiet and highly readable. Pixel art is a rare reward accent only (badges, level-up, streak); it is not a general UI texture.

This is original work. Inspiration from game-interface craft is allowed; copied assets, characters, logos, distinctive trade dress or traced artwork are not.

## Tokens

### Colour

Light theme:
- Primary `#5B4CFF`; accents `#FFB703` and `#00AFA0`.
- Background `#FFF8E8`; surface `#FFFFFF`; alternate surface `#FFF0CC`.
- Text `#182032`; muted text `#526079`.
- Success `#177D4E`; error `#C93E4A`; warning `#9A5800`.

Dark theme:
- Primary `#6A4CFF`; accents `#FFD166` and `#45D7C8`.
- Background `#111522`; surface `#1B2132`; alternate surface `#272E44`.
- Text `#F8F7FF`; muted text `#BEC5D8`.
- Success `#65D998`; error `#FF818C`; warning `#FFD166`.

Measured WCAG contrast for normal text is at least 4.5:1 in the intended pairs: light text/background 15.37:1, light muted/background 6.00:1, white/primary 5.35:1, white/error 4.92:1, white/success 5.15:1, dark text/background 17.10:1, dark muted/background 10.54:1, dark background/primary 5.76:1. Do not invent new colour pairs without checking contrast.

Colour is never the only signal. Correct, error, warning, sync and offline states pair colour with an icon and explicit text.

### Shape and depth

Use the token radius scale only: 8, 12, 16, 22 and 30 CSS px plus pill. Standard ink outline is 2 px; strong outline is 3 px. Cards use a hard `0 4px 0` ink shadow in both themes. Primary buttons use a darker 5 px bottom edge and press by translating 4 px downward. A press moves the control toward its edge rather than adding blur.

The study core uses less depth than navigation and reward UI. Medical imagery must sit on the neutral `--color-medical-image` background and must never be filtered, tinted, colour-shifted or used as decoration.

### Typography

All font files are OFL-licensed, self-hosted WOFF2 Latin subsets, integrity-pinned by `tools/vendor-lock.json`, and cached by the existing offline shell.

- **Fredoka 600** — every screen title, card title, score/streak/goal/XP number and short game-like label. Screen/card titles are 28 px on phone and 34 px on iPad; large display numbers are 44–56 px.
- **Nunito 400/700** — all questions, answers, explanations, body copy and controls.
- **Pixelify Sans 500** — tiny rare accents only.

Hard rule: question stems, options, explanations, medical source text and long reading never use Fredoka or Pixelify Sans. The combined shipped WOFF2 payload must stay at or below **100 KB**.

### Spacing and touch

Use the spacing token scale: 4, 8, 12, 16, 20, 24, 32, 40 and 48 CSS px. Every interactive target is at least **44 × 44 CSS px**. Do not shrink critical actions to fit a crowded layout.

### Motion

Motion tokens are 80, 120, 180 and 320 ms with the token easings. UI animation uses **transform and opacity only**. Avoid continuous motion in study views. `prefers-reduced-motion: reduce` sets motion durations to zero and disables gallery demonstration animation.

### Game feel

`app/design/game-feel.js` provides a safe foundation:
- Key taps may call Telegram `HapticFeedback.impactOccurred('light')`; outside Telegram this is a no-op.
- Optional feedback sounds are synthesized with WebAudio oscillators; there are **no audio files**.
- Sound is **OFF by default** and the foundation stores no sound preference. A future persistent preference requires separate owner-approved additive-data work.

Haptics and sound are supplementary only. No essential information or action may depend on them.

## Study-core hard rules

1. Study text never uses display or pixel fonts.
2. Medical images use a neutral background and are never filtered.
3. Colour is never the only signal: use icon + text + colour.
4. Reading width stays comfortable; arcade decoration never crowds stems, options or explanations.
5. Wrong answers receive clear, neutral feedback—no teasing, shame or punitive effects.
6. No animation on every study event; correctness and navigation remain understandable with reduced motion.

## Hidden Design Gallery

Open the Mini App with `#gallery` (for example, `/\#gallery`). The gallery is intentionally hidden from normal navigation. It shows:
- light/dark colours;
- type roles;
- shape, outline, shadow and spacing;
- primary, secondary, destructive, pressed and disabled buttons;
- cards, chips, progress;
- success/error/warning states with icon + text;
- selected/correct/wrong study options;
- medical-image neutral stage;
- motion and game-feel examples.

The gallery is render-only. It must not write IndexedDB, localStorage, CloudStorage, sync state, study progress or preferences.

## RULES FOR ALL DESIGN PROMPTS

These rules are binding for every later design task:

- **Tokens only:** no new hard-coded design colours, radii, shadows, spacing, type sizes, motion timings or target sizes in components. Add a semantic token first when a genuinely new value is required.
- **Gallery coverage:** every new component and every meaningful state (default, pressed, selected, loading, disabled, success, error, empty, focus where applicable) must be added to `#gallery`.
- **Behavior unchanged:** design work must not change grading, downloads, sync semantics, question IDs, content contracts or saved progress unless the owner separately approves that behavior/data change.
- **Progress safety:** never rename/delete existing personal-data fields, IndexedDB stores, sync keys or unknown data. Cosmetic work must be read-only with respect to progress.
- **Tests stay green:** existing unit/content/flow tests must pass; add tests for new design behavior where it can regress.
- **Budget:** total shipped app JavaScript + CSS must remain **≤150 KB gzipped** using the CI measurement, and self-hosted WOFF2 fonts **≤100 KB total**.
- **Low-end smoothness:** transform/opacity motion only; no layout-thrashing animation, runtime filters on medical media or heavy framework. Record low-end Android evidence before claiming physical-device smoothness.
- **Original work only:** inspiration is fine; do not copy assets, characters, logos, illustrations or distinctive proprietary UI artwork.
- **Design PRs never self-merge:** exact-head CI and screenshots are evidence for owner review; the PR stays open until the owner explicitly approves it.


### Visual determinism and viewport evidence

Visual hashes are strict single hashes. Library search behavior still retains keyboard focus as an accessibility/interaction requirement, but the screenshot harness blurs the focused control only after that behavior is asserted so Chromium focus-ring rasterization cannot create alternate iPad hashes.

Full-page screenshots remain useful for overflow/layout auditing, but fixed navigation is judged from viewport-only captures. Every normal student screen is captured at the top and at a representative scroll position, then assembled into four contact sheets: phone light, phone dark, iPad light and iPad dark.

### Signature test

The final DESIGN 1 review includes a **two-second signature test**: show one representative student viewport without explanation. If a neutral viewer would not immediately describe it as a game-style study app, the design is not ready. The automated proxy requires the visible HUD, pixel level badge, XP bar, filled streak flame, hard outlined/shadowed surfaces, collectible book cover and victory rewards; the viewport contact sheets are the human visual gate.

## Evidence required for DESIGN 1/10

Before owner approval:
- Content Contract CI green at exact head.
- Visual/Flow CI green at exact head.
- Phone `#gallery` screenshots in light and dark inspected.
- Phone/iPad light/dark viewport contact sheets checked with the two-second signature test while confirming the calm study core remains readable.
- Font WOFF2 total measured ≤100 KB and JS+CSS gzip measured ≤150 KB.
- No saved-progress/schema changes.

