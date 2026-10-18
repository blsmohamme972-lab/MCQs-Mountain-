# Kafu code map for a game layer

> Research saved from the session of 2026-10-18 (Claude Code). Each report was written by one agent and then
> fact-checked claim by claim by a second, independent agent; the corrections are at the end and **override the
> report text**. Paths under `/tmp/...` were scratch files of that session and no longer exist.

# Kafu code map: how a future 2D game mode would attach, and what a standalone prototype must copy to be faithful

Repo HEAD `6e4750a` (branch `ccr-efb5e2bb-wvj576`), 2026-10-18. No tracked file was changed (`git status` is clean). All scratch output is under `<scratch>/code-map/`.

## 0. Headline findings

1. **Almost no start-up budget is left.** JS+CSS measured exactly as CI does it: **153,244 / 153,600 B, so 356 B are left (0.23%)**. A loader stub as small as `comments-loader.js` (468 B gzip) would already fail CI. Integrating a game later first needs another PR that moves inline code to lazy loading.
2. **There is a clean place to attach.** Every module replaces core globals (`render`, `nextQuestion`, `VIEWS.study`, `recordAnswer`, `ACTIONS`, `back`) through `KafuEnhancements` installers. A game layer would be one more installer plus files loaded lazily, the same pattern as `leaders-loader.js` and `comments-loader.js`.
3. **In Telegram, "Next question" is Telegram's own MainButton, not the button on the page.** `.tg .actionbar{display:none}` is at `app/design/layout.css:101`; the MainButton is set at `app/index.html:1195-1205` and wired at `:1351`. A game must take over both buttons, the way the MotionCards standalone player does.
4. **The owner's order "collect coin, then MCQ" breaks a written rule.** `docs/DESIGN.md:9` says "Never celebrate before an answer is actually scored." The reward has to come after grading.
5. **A Mario-like pixel world breaks the approved style.** `docs/DESIGN_STYLE.md:7` says "Pixel art is a rare reward accent only… not a general UI texture." Use Arcade-Clean vector art, or get an explicit owner exception.
6. **There is no consistent mascot that could drive a side-scroller.** Nothing has walk cycles or turnarounds (front/side/back views). The closest set is the chibi doctors in the branch art (raster, one pose each) plus the vector organ emblems in `fallbacks.js`.
7. **Only `./app` is deployed.** A new top-level folder (recommended: `game-lab/`) is never served, and no workflow path filter picks it up.

---

## 1. How the question screen renders and advances

### Core globals and functions (`app/index.html`)

| Item | Line | Notes |
|---|---|---|
| `S` (personal state) | 466-476 | `answers{qid:{c,n,t,b}}`, `fav`, `favBooks`, `resume`, `time`, `active`, `reports`, `dl`, `settings` |
| `saveState()` | 478-482 | debounced 300 ms `DB.put('meta','state',S)`; replaced by sync-bridge.js:66 |
| `TG`, `IN_TG`, `tgAt(v)`, `haptic` | 486-493 | |
| `PACKS`, `QI` (qid → `{q,b,ch}`) | 547-548 | `indexPack` 664 |
| `fetchPack` / image ZIP → IndexedDB → `pack.img[name]` object URLs | 603-663 | |
| `downloadChapter(b,ch)` | 666-689 | |
| `STACK`, `SESSION`, `SHEET`, `ACTION`; `go`, `back`, `tab` | 728-747 | |
| `newResp(q)` | 761-763 | `sel`: an index (sba/emq), an array of T/F (mtf), an array of indexes (multi) |
| `startSession(opts)` | 764-768 | `go("study")` pushes a STACK entry |
| `startChapter(bookId, chId, qid)` | 769-778 | downloads if needed, picks the index, calls `startSession` |
| `orderFor` (shuffle unless `no_shuffle` or emq) | 779-785 | |
| `isComplete` / `grade` | 786-800 | mtf gives partial `score`, correct only when all match; multi needs the exact set; sba/emq compare one letter |
| `recordAnswer(q,r)` | 801-806 | writes `S.answers[qid]={c,n,t,b}` and `S.active[day]` |
| `submitCurrent()` | 807-815 | grade, record, haptic, `render()`, then scrolls to `.explain` |
| `nextQuestion()` | 816-821 | `SESSION.index++; render(true)`, or ends the session |
| `VIEWS.study()` | 1028-1104 | options 1041-1058; explanation 1060-1069 (only when `r.done && !exam`); images 1071; `S.resume` set 1035; `action` 1100-1102 ("Check answer" → `submitCurrent`, "Next question"/"Finish" → `nextQuestion`) |
| `render(scrollTop)` | 1178-1193 | **replaces `#app` innerHTML on every call**; renders `<button class="btn" data-a="action">` |
| `syncTelegramButtons` | 1195-1205 | MainButton = `ACTION.label` on every render |
| `ACTIONS` (`pick`, `tf`, `fav-q`, `jump-go` 1285-1296, `prev`/`skip` 1298-1299, `action` 1300) | 1257-1309 | single click handler: 1310-1315 |
| Study-time timer (`cur().v==='study'`) | 1327-1332 | a game overlay sitting over the study view would count as study time |
| boot: `TG.ready(); TG.expand()`, `themeChanged`, BackButton/MainButton | 1344-1351 | deep link `start_param` 1364 |

### Wrapper chains (installers run in `app/modules/manifest.json` order; the last one installed is outermost)

- **`recordAnswer`:** base → `sync-bridge.js:67` (event log in `meta`, CloudStorage) → `review-bridge.js:12` (FSRS `S.fsrs`) → `delight.js:22` → `xp-ledger.js:22` (outermost).
- **`nextQuestion`:** base → `review-bridge.js:57` (due-mode rating guard) → `design/study.js:5-16`. On the last question, study.js shows `chapter-complete` and dispatches `kafu:session-complete` (`study.js:15`), carrying `KafuStudyCore.summarize` plus `xp`.
- **`VIEWS.study`:** `download-bridge.js:103` (blocks while an image is missing) → `review-bridge.js:35` → `study.js:41` → `delight.js:29` ("Correct — Kafu!").
- **`submitCurrent`:** `download-bridge.js:114`.
- **`startChapter`:** `usability.js:48`.
- **`render`:** `foundation.js:30`, `usability.js:78`, `study.js:133` (`decorateStudy` 56-127: question card, HUD with combo + XP chip, `.k-feedback-panel`), `gallery.js:99`, `comments-loader.js:6`, `motioncards-player.js:303`.

### Where the attached features hook in

- **Explanation.** `.explain` is built inside `VIEWS.study` (1068). It also carries `explanation_images` (1064) and the source line.
- **Comments.**
  - `comments-loader.js:6` wraps `render`. On any `.k-study` screen it lazily injects `modules/comments.js`, which pulls in `comments-core.js` and `leaders-core.js` (`comments.js:17-18`), then calls `KafuComments.place()` (`comments.js:272-303`).
  - A count-only bar goes before `.k-question-head` (anchor at 271; no spoilers before answering). An entry row goes right after `.explain` (301).
  - The sheet sets `SHEET=MARK` (210), turns off Telegram vertical swipes while open (231-238), and prefetches the next question's comments (306).
- **MotionCards / image lessons (`motioncards-player.js`).**
  - `current()` (15-23) needs `cur().v==='study'` and no unfinished exam.
  - `refreshAvailability()` (115) reads `${MC.CONTENT_BASE}/indexes/<book>/v<ver>/index.json` (`motioncards-core.js:5`). A record must match `questionHash(q)`.
  - `placeSlot()` (79-95) inserts a "Watch the lesson" poster after `.explain`, or after the last option before answering (`slotAnchor` 73-78).
  - `openPlayer()` (250) runs a sandboxed iframe plus Opus voice (`motioncards-voice.js`; the voice drives the clock).
  - The `render` wrapper closes the player when the question changes (303-312).
  - `#kafu-motioncards-root` lives **outside `#app`** (`ensureRoot` 129). That is the right model for a persistent game canvas, because `render()` replaces `#app` contents every time.

### What a game layer would call

- **Open the first question:** `await startChapter(bookId, chId, qid)`.
- **Open question N later:** `SESSION.index = N; render(true)`, exactly like `ACTIONS['jump-go']` (1285-1296). Do not call `startChapter` again; it pushes duplicate `study` entries onto `STACK`.
- **Read the current question:** `QI[SESSION.qids[SESSION.index]].q`. Answered state: `SESSION.resp[qid].done/.correct` (CI uses both: `tools/ui/check.py:269, 304`).
- **On "Next MCQ":** wrap `nextQuestion` the way `study.js:5` does.
  - Call the original first. It advances the index and renders the next MCQ **behind** the game layer, so coming back to the question screen later costs almost nothing.
  - Then show the game overlay and play the climb.
  - For the final question, listen for `kafu:session-complete`.
- **Reward amount:** the difference in `KafuXP.session(SESSION)` before and after `submitCurrent`.
- **Telegram chrome:** hide and restore MainButton/BackButton like the standalone player (`motioncards-player.js:174-180, 273-276, 309`). Wrap `back` as at `motioncards-player.js:302`.

### Next-question budget

- `tools/ui/check.py:300-307` clicks `[data-a=action]` and resolves on the next rAF, for sba→mtf→multi on the DESIGN-CARDIO fixture with `reduced_motion='reduce'` (`check.py:165`).
- Pass condition: `max<=100` ms (323); CI fails otherwise (403).
- Past measurements: 2.1–14.4 ms (`docs/reports/DAY_1_TASK6.md:9`).
- `docs/DESIGN.md:62`: "measure click-to-next-question DOM update separately from optional decoration."
- The question-enter animation is 80 ms (`tokens.css:110`, `study.css:28-29`).
- **The game must be off by default, or outside this measured path.**

---

## 2. Lazy loading, the budget and offline caching

**Pattern.**
- `leaders-loader.js`: an inline stub registers `VIEWS.leaders` and injects the `<link>` and `<script>` tags on first open, with a 10 s timeout and a retry of only what failed (6-15). It prefetches when idle 3 s after start-up, skipped on saveData or 2G (24-25).
- `comments-loader.js`: loads on the first `.k-study` render or when a download finishes (5-8).

**Do lazy files count?** No.
- `budget()` (`check.py:326-345`) gzips only the **inline** `<script>`/`<style>` blocks of the assembled `index.html`. Injected `modules/leaders*.js|css`, `comments*.js|css` and `assets/fallbacks.js` are not counted.
- `docs/LEADERS.md:12-15` describes it the same way ("start-up budget").
- Caveat: `docs/DESIGN.md:60` is worded more strictly ("inline, modules and shipped vendor scripts"). The owner should confirm the exclusion.

**Measured today.**
- `tools/vendor_frontend.py` was run through `install(root=<scratch copy>)` so it did not write into `app/vendor`. All pinned hashes matched.
- Then `tools/build_frontend.py --source <scratch>/root/app --out <scratch>/build`.

| Build | JS gzip | CSS gzip | Total | Limit | Headroom |
|---|---|---|---|---|---|
| Plain build | 127,753 | 25,442 | 153,195 | 153,600 | **405 B** |
| CI-exact (`site()` changes: commit `d`×40, content base set to localhost, Telegram script swapped for an inline comment) | 127,802 | 25,442 | **153,244** | 153,600 | **356 B** |
| Fonts (raw WOFF2) | — | — | 57,124 | 102,400 | 45,276 B |

- **Largest inline files (gzip):** ts-fsrs 14,771; fflate 12,586; motioncards-player 8,856; sync-core 5,822; mcq-export 5,473; study.css 4,545; study.js 4,091.
- **Already lazy (not counted):** leaders.js 8,083, leaders-core 6,748, leaders.css 4,592, comments.js 8,448, comments-core 2,520, comments.css 3,191.
- **Where room could come from:** code only the owner uses is inline for every student. `mcq-export.js` + core + css is about 8,938 B; `admin-usage.js` + css about 2,590 B; the hidden `#gallery` (js + css) about 4,411 B. Making these lazy would need its own PR with behaviour unchanged.

**Service worker (`app/sw.js`).**
- **What is cached:** same-origin `/(modules|vendor|icons|fonts)/….(js|css|svg|png|ico|woff2?|txt)` counts as `asset` and is served cache-first (22, 71-74). Lazy files are cached on their first online fetch.
- **Not cached:** `.webp`, `.json` and audio extensions, and everything under `/assets/` except `assets/avatars/aNN.webp`, which has its own long-lived cache (8-10, 21, 64-69).
- **Consequence for a game:** sprites as `.webp`, or anything under `/assets/game/`, would not work offline unless `sw.js` changes. Its tests are `tools/tests/js/service-worker*.test.cjs` and `test_service_worker_build.py`.
- **Limits:** one 48-entry limit for all assets (7, 54).
- **After each deploy:** the cache is named per deploy commit and `activate()` deletes the old ones (92-95). Lazy files must be fetched online again after every deploy before they work offline.
- There is no `skipWaiting` (`docs/OFFLINE_SHELL.md`).

---

## 3. Telegram WebApp APIs

**Used now:**

| API | Where |
|---|---|
| `ready()`, `expand()` | index.html:1347 |
| `isVersionAtLeast` | index.html:488; ux-core.js:19 |
| `themeParams`, `colorScheme`, `onEvent('themeChanged')`, `setHeaderColor`, `setBackgroundColor` | index.html:494-501, 1349; foundation.js:13 |
| `HapticFeedback.selectionChanged` / `notificationOccurred` | index.html:489-493 (suppressed under reduced motion: delight.js:11) |
| `HapticFeedback.impactOccurred('light')` | game-feel.js:5-9 |
| `BackButton` show/hide/onClick | index.html:1199, 1350; leaders.js:191-196; motioncards-player.js:178 |
| `MainButton.setParams/hide/onClick` | index.html:1201-1204, 1351; motioncards-player.js:177, 275, 309 |
| `CloudStorage` (6.9) | index.html:503-545; sync-core/sync-bridge |
| `requestFullscreen` / `exitFullscreen`, `isFullscreen`, `fullscreenChanged` / `fullscreenFailed` | **only the hidden developer diagnostic** (ux-core.js:9-40; ux-bridge.js:16-17; unlocked by 7 taps). No automatic call. |
| `contentSafeAreaInset.top`, `contentSafeAreaChanged` | ux-bridge.js:23-28 → `--kafu-tg-safe-top` (ux.css:4) |
| `disableVerticalSwipes` / `enableVerticalSwipes`, `isVerticalSwipesEnabled` | only while the comments sheet is open (comments.js:231-238) |
| `showConfirm`, `openTelegramLink` | index.html:749, 1294 |
| `initData`, `initDataUnsafe.user.id`, `start_param`, `version`, `platform` | account keys (xp-ledger.js:8, delight.js:4, motioncards-player.js:8); deep links 1364; ux-core.js:21 |

**Not used yet, but a game would need:**
- `requestFullscreen` on a user tap, plus `fullscreenChanged`.
- `safeAreaInset` and `safeAreaChanged` (device insets; only the content inset is used today).
- `viewportChanged` / `viewportStableHeight` / `isExpanded`, to size the canvas.
- `activated` / `deactivated` and `isActive` (Bot API 8.0), to pause the game loop. Today only `visibilitychange` is used (index.html:1339; motioncards-player.js:334).
- `lockOrientation` / `unlockOrientation` (8.0).
- `disableVerticalSwipes` for the whole game scene, so a drag does not minimise the Mini App.
- `HapticFeedback.impactOccurred('medium'|'rigid'|'soft')` for landing or coin events.
- `SecondaryButton` and `setBottomBarColor` (7.10).
- `enableClosingConfirmation` (optional).
- `shareToStory` (optional milestone share).

---

## 4. XP, coins and progress safety

**The ledger (`app/modules/xp-ledger.js`).**
- XP per answer: new question 10, or 5 if wrong; a return on a later day 12, or 4 if wrong; the same question again on the same day 0 (1-4, 26).
- Baghdad calendar day (7).
- Stored in IndexedDB `meta` as `xp_ledger_user_<tgid>` = `{v:1,days,last}` (9-11, 20).
- XP per session in a `WeakMap` (28).
- API: `KafuXP.total/between/day/session/ledger` (31-35).
- It is not synced; on a new phone XP is rebuilt at 10 per answer (`docs/LEADERS.md:71-73`).

**Can coins use it without a schema change? Yes, if coins are only a view of XP already earned.**
- Coin value = the XP change for that answer.
- Total coins = `KafuXP.total()`.
- Where the character stands (stair or floor) comes from `SESSION.index`, or from the count of answered questions in the chapter (`bookStats` index.html:708-710) plus `S.resume`.
- No new writes are needed.
- Do **not** add a separate coin balance or change the XP rules; Leaders fairness depends on them (`LEADERS.md:51-57`).
- Anything persisted beyond that (chosen character, world unlocks) needs an additive `meta` key with an owner-approved migration. The precedent is `delight-core.js`: key `ui_delight_user_<id>`, with `migrate()`/`valid()` keeping unknown records.

**Rules, quoted exactly:**
- `DESIGN_STYLE.md:94`: "**Behavior unchanged:** design work must not change grading, downloads, sync semantics, question IDs, content contracts or saved progress unless the owner separately approves that behavior/data change."
- `DESIGN_STYLE.md:95`: "**Progress safety:** never rename/delete existing personal-data fields, IndexedDB stores, sync keys or unknown data. Cosmetic work must be read-only with respect to progress."
- `DESIGN.md:52`: "Do not change IndexedDB database names, versions, object stores, question IDs, saved answer/favorite/download shapes, sync snapshot format or tombstones in a UI task. Do not delete or overwrite unknown keys."
- `DESIGN.md:54`: "…require a new persistent format must have an explicit, additive, tested migration and stay in an open PR for owner review. Do not sneak a schema change into a cosmetic feature."
- `DNAgens/README.md` constitution: "Never break saved student progress. Data-format changes are additive-only and need owner approval."
- CloudStorage limit: 716 keys / 4,096 characters (`docs/PERSONAL_SYNC.md`).

---

## 5. Design rules a game layer must respect (exact quotes)

- **Direction** (`DESIGN_STYLE.md:7`): "…a calm study core… Pixel art is a rare reward accent only (badges, level-up, streak); it is not a general UI texture."
- **Originality** (`:9`): "copied assets, characters, logos, distinctive trade dress or traced artwork are not [allowed]." Also `:99`. So no Mario likeness.
- **Motion** (`:53`): "Motion tokens are 80, 120, 180 and 320 ms… UI animation uses **transform and opacity only**. Avoid continuous motion in study views. `prefers-reduced-motion: reduce` sets motion durations to zero…" (tokens.css:109-115, 219-226).
- **Haptics and sound** (`:58-62`): "Sound is **OFF by default**… there are **no audio files**… Haptics and sound are supplementary only."
- **Study-core hard rules** (`:66-71`):
  1. "Study text never uses display or pixel fonts."
  2. "Medical images use a neutral background and are never filtered."
  3. "Colour is never the only signal."
  4. "…arcade decoration never crowds stems, options or explanations."
  5. "Wrong answers receive clear, neutral feedback—no teasing, shame or punitive effects."
  6. "No animation on every study event; correctness and navigation remain understandable with reduced motion."
- **Tokens only** (`:92`): "no new hard-coded design colours, radii, shadows, spacing, type sizes, motion timings or target sizes in components. Add a semantic token first…"
- **Gallery coverage** (`:93`): every new component and state goes into `#gallery`.
- **Budget** (`:97`): "≤150 KB gzipped… WOFF2 fonts ≤100 KB total."
- **Low-end smoothness** (`:98`): "transform/opacity motion only; no layout-thrashing animation… or heavy framework. Record low-end Android evidence before claiming physical-device smoothness."
- **Owner review gate** (`:100`): "Design PRs never self-merge… the PR stays open until the owner explicitly approves it."
- **Brand promise** (`DESIGN.md:7`): "A successful session should feel encouraging, not like a game demanding attention."
- **Celebration rules** (`DESIGN.md:9`): "Never tease a wrong answer. Never celebrate before an answer is actually scored… one brief confetti burst… reduced motion respected. No surprise sounds, shame or lost-streak warnings."
- **Performance** (`DESIGN.md:63`): "No framework rewrite, new paid service, analytics dependency or background polling. Pin and integrity-check dependencies."
- **Touch targets** (`DESIGN_STYLE.md:49`): "at least 44 × 44 CSS px."
- **DNAgens constitution:** "Healthy habit loops only: no guilt-trip streaks, spam notifications or fake urgency." and "English-only app."

**Where the owner's idea conflicts:**

| Owner's idea | Rule it conflicts with | Fix |
|---|---|---|
| Coin collected before the MCQ | DESIGN.md:9 | the character reaches a "?" block, chest or door that opens the MCQ; the coin pops only after grading |
| Mario-like world | DESIGN_STYLE.md:7, :99 | Arcade-Clean vector style, original art |
| Falling or losing on a wrong answer | study-core rule 5 | every answer moves the character forward (a wrong answer still earns 5 XP) |
| A living world loop | DESIGN_STYLE.md:53 ("avoid continuous motion in study views") | pause the loop while the MCQ is open; reduced motion gives instant cuts |

---

## 6. Existing visual assets and characters (images opened and checked)

| Path | What it is | Look | Fit for a game |
|---|---|---|---|
| `app/assets/branches/23402-23407.webp` (1024×1536) and `*.png` (172×182, 9 files), `optimized/<id>@1x/2x/3x.webp` (15 specialties) | Library branch cards (`BRANCH_ART` index.html:866-882) | Glossy 3D-render chibi young doctors with big eyes, one per specialty, each holding a smiling organ (heart, pill, microbe, lungs, stomach, bone, teddy, brain, X-ray). Consistent style, **different character per branch, one static pose, no sprite sheets.** No provenance file ("The ZIP's branch art", index.html:865). `23404.webp` and `23405.webp` are byte-identical (md5 `88d0df9c…`), so neurology and microbiology show the same picture (also `optimized/neurology@1x == microbiology@1x`). | Style reference or cast inspiration; not animatable as they are |
| `app/assets/fallbacks.js` (5.3 KB) | Fallback branch emblems | **Vector kawaii organs** (lungs, stomach, microbe, pill, heart, brain) with gradient fill and a face. Rendered headless: they look clean. They reference a `#clay` SVG filter that is not defined anywhere in the current app; Chromium renders them unfiltered. | **Best existing seed for collectibles**: original, vector, tiny |
| `app/index.html:899-913` `genericBranchArt()` | Fallback card art | Flat vector young doctor: brown hair, white coat, stethoscope | Possible base for an original player character |
| `app/design/study.js:23` | Chapter-complete mascot | Purple rounded blob with two arms and a smile ("original SVG mascot placeholder", DESIGN.md:9) | Placeholder only |
| `app/assets/avatars/a01-a47.webp` (96 px) + `SOURCES.txt` | Leaders and comments personas ("Kafu characters") | **Photos of landscapes and objects, no people** (Unsplash, Openverse CC). Personas are simulated Telegram users with names (`leaders-core.js:7-13`, `person()` 198-201). | Not illustrated characters |
| `work/*/lessons/<QID>.png` (65 tracked, about 1672×941, about 1.8 MB) + `.lesson.json` (shots, lines) | Image lessons | E.g. `Q000000033.png`: cartoon classroom, young female doctor at a chalkboard, labelled boxes, answer banner. The rule (branch `kafu-queue`, `kafu_queue/head_prompts.py:29-31`, `STORY_RULES`) is **one MAIN CHARACTER per question** (patient, organ or molecule), so characters change every question. | No recurring mascot |
| `Animations and illustrations/` | **RETIRED** medical SVG mechanism library (35 templates), standalone `index.html`, own CI job (ci-tools.yml:136-162) | — | Precedent for a non-deployed standalone folder only |
| `DNAgens/` | Review-board documents | — | No art |
| `motion starts/` | One retired MP4 + scene JSON | — | Retired |
| `motioncards-content/MRCS-UPPERLIMB-CH3/` | Retired scenes + source export | — | Retired |
| `app/icons/kafu.svg` | App icon | — | — |

**Conclusion:** no consistent mascot, turnaround or animation set exists. Characters would be new original work.

---

## 7. Where the prototype can live without being deployed or linked

- **Deployed directories:**
  - Main app: only `./app` (`wrangler.app.jsonc:5-8`). Everything under `app/` is public; `app/styleguide/` is served, and CI fetches it at `check.py:280`.
  - Content worker: `./content-worker/dist/content`.
  - MotionCards worker: `./motioncards-worker/dist`.
- **Workflow triggers:**
  - `ui.yml`: `app/**`, `motioncards/**`, `motioncards-worker/**`, `tools/ui/**`.
  - `ci-tools.yml`: `app/**`, `content-worker/**`, `tools/**`, `worker/**`, `migrations/**`, `.github/workflows/**`, `Animations and illustrations/**`, `motioncards/**`, `motioncards-worker/**`, `voiceover/**`.
  - `deploy-app.yml`: push to main on `app/**`, `worker/**`, `migrations/**`, …
  - `library-auto-merge.yml`: only head branches named `library/*`.
- **A new top-level folder triggers nothing**, so a PR touching only that folder shows no CI checks.
- **Places to avoid:**
  - `test_security_check.py:17` scans every tracked file in later ci-tools runs. Keep the prototype free of secrets; files over 2 MB are skipped.
  - `check.py:365` auto-loads every `tools/ui/flows/*.py`: put no prototype flows there.
  - `unittest discover -s tools/tests` (ci-tools.yml:42) and `tools/tests/js/*.test.cjs` (`test_frontend_modules.py:32`): put no prototype tests there before integration.
- **Recommendation: a new `game-lab/` folder at the repo root** (ASCII, no spaces). Contents:
  - `README.md` marked "PROTOTYPE: not deployed, not linked".
  - A standalone world and character sandbox page.
  - A harness that builds the **real** app into a temp folder with `tools/build_frontend.build` and the `check.py` `site()`/`fixtures()` pattern, and injects the game loader only into that temp output.
  - Its own `.gitignore` for generated sprites.
- Work on a branch and leave the PR open for the owner. Add a dedicated workflow with `paths: ['game-lab/**']` only when needed.

---

## 8. UI language, text direction and fonts

**Language and direction.**
- `app/index.html:2` is `<html lang="en">` with no `dir`.
- UI labels are English: `typeName` (1039), "Check answer" / "Next question" / "Finish" / "Save and next" (1100-1102), "Chapter · Q n/N" (study.js:44), "Correct — Kafu!" (delight.js).
- `DESIGN.md:9`: "The interface remains English-only." So "First MCQ" / "Next MCQ" labels fit.
- Stems are English medical text.
- Arabic appears only in comments (text `dir="auto"` at comments.js:166; the composer note `lang="ar" dir="rtl"` "التعليقات مغلقة مؤقتاً" at :207) and in persona names.

**Fonts.**
- `@font-face` rules are at `tokens.css:2-5`; role tokens are `--font-display/--font-reading/--font-pixel` (66-68).
- Files go to `app/vendor/` (gitignored), fetched by `tools/vendor_frontend.py` from `tools/vendor-lock.json`:

| File | Bytes |
|---|---|
| `fredoka-latin-600.woff2` | 16,484 |
| `nunito-latin-400.woff2` | 16,316 |
| `nunito-latin-700.woff2` | 16,228 |
| `pixelify-sans-latin-500.woff2` | 8,096 |

- The exact set is pinned by `tools/tests/test_design_style.py:43-55`.
- All are **Latin subsets**; Arabic falls back to system fonts.
- `app/assets/fonts/kafu-arabic-700.woff2` (7,744 B) is not referenced anywhere.
- Roles (`DESIGN_STYLE.md:41-45`): Fredoka for titles and numbers, Nunito for all study text, Pixelify for tiny accents. "question stems, options, explanations… never use Fredoka or Pixelify Sans."

---

## 9. Sample questions and the data shape

**Pack shape:** `{schema:1, book_id, chapter_id, version, questions:[…]}`.

**Catalog chapter entry:** `{id, title, questions, qids[], url, image_url|null, bytes}`.

**Production question fields** (live `KAFU-UPLOAD-TEST` v1): `local_id, chapter_id, topic, type ('sba'|'mtf'|'multi'|'emq'), source_number, lead_in, stem, options[], answer, answer_source, explanation, images[], explanation_images[], group_id, no_shuffle, source_page, flag, id ('Q'+9 digits), book_id, status, version`.
- `answer` is `'A'` for sba/emq, `['T','F',…]` for mtf, `['A','C']` for multi.
- `source` is optional.
- Stems can contain tables, rendered by `question-text.js`.
- Images are file names inside the chapter's image ZIP, resolved to `pack.img[name]` (index.html:634-663, 1064-1071).

**Samples:**

1. **With an image** (protected, synthetic text, real production shape). From `https://kafu-content-1.blsmohamme97.workers.dev/packs/KAFU-UPLOAD-TEST/v1/chapter-1.v1.1fab41ecfb6b.json`; images ZIP `…/chapter-1.images.v1.0122ecc4fa28.zip` contains `Q000000009_1.webp` (320×120, a teal "QUESTION" placeholder) and `Q000000012_e1.webp`.
   ```json
   {"id":"Q000000009","type":"sba","stem":"Which synthetic option is correct?","options":["Alpha","Beta","Gamma"],"answer":"A","explanation":"Synthetic explanation 1.","images":["Q000000009_1.webp"],"explanation_images":[],"no_shuffle":false,"lead_in":"","group_id":null,"status":"source_verified","book_id":"KAFU-UPLOAD-TEST","chapter_id":1,"version":1}
   ```
2. **sba**, `app/index.html:322-325`: `Q000000006` "Which induction agent best maintains blood pressure in a haemodynamically unstable patient?". Options Propofol / Thiopentone / Ketamine / Midazolam / Methohexitone; `answer:"C"`; ketamine explanation.
3. **mtf**, `app/index.html:308-311`: `Q000000003` "The following shift the oxyhaemoglobin dissociation curve to the right:". Options: temperature rise, 2,3-DPG rise, alkalosis, PaCO₂ rise, carbon monoxide. `answer:["T","T","F","T","F"]`.
4. **multi**, `app/index.html:326-329`: `Q000000007` "Select two drugs that can trigger malignant hyperthermia." `answer:["A","C"]` (suxamethonium, sevoflurane).
5. **emq**, `app/index.html:345-349`: `Q000000011`, with `group_id:"EMQ-1"` and a `lead_in` (types of shock). Stab wound plus Beck's triad, `answer:"C"` (Obstructive).

**Notes on the data:**
- `SAMPLE` QIDs `Q000000001-18` **collide** with production QIDs; for example `Q000000009` is also the upload-test question. Never index both sets in one `QI`.
- The CI fixture DESIGN-CARDIO (`tools/ui/check.py:96-104`, `Q000001001-4`) has synthetic study-skill text, all 4 types and no images. It is what the next-question budget runs on.
- **A live chapter for a faithful demo:** `MRCS-PARTA-550-2E` v1, chapter 8 "Homeostasis, coagulation and bleeding" (`Q000009363-370`).
  - It has live comments (`/comments/MRCS-PARTA-550-2E.json` → shard `Q000009`).
  - All 8 questions have image-lesson MotionCards in the `kafu-motioncards` index.
  - Fetch it at runtime the way the app does. Do not commit the book text (copyrighted).

**Scratch files written for the prototype:**
- `<scratch>/code-map/samples.json`: 6 sample questions plus the full upload-test chapter.
- `<scratch>/code-map/sample-images/`
- `<scratch>/code-map/measure.py`: the budget calculation.
- `<scratch>/code-map/build-ci/`: the CI-exact build.
- `<scratch>/code-map/view/`: thumbnails and rendered emblems.

---

## Implications from the code for the owner's four questions

- **Raw material to start from:** the real assembled app (`build_frontend`) with the real public catalog and packs, on a real low-end Android Telegram client. Not a hand-made copy of the MCQ screen.
- **Methods:**
  - One more installer that wraps `nextQuestion` and `back`.
  - A canvas/DOM overlay outside `#app` that uses transform and opacity only.
  - One rAF loop, paused on `deactivated` and `visibilitychange`.
  - Render the next MCQ behind the overlay before it is needed.
  - Playwright timing flows that copy `check.py:306`.
  - A 4–6× CPU-throttled trace, plus a `chrome://inspect` trace of the Telegram Android WebView.
- **What else would show it is right:**
  - CI `next_question_ms ≤ 100` and `budget()` passing.
  - A flow test showing `S.answers` and the XP rules unchanged.
  - Recorded low-end Android frame-time evidence (DESIGN_STYLE.md:98).
  - The owner's review of the open PR.
  - Real students' questions per session and accuracy, to answer the DESIGN.md:7 worry about "a game demanding attention".

---

## Later correction

- The budget headroom measured here (153,244 of 153,600 gzip bytes, **356 B left**, CI-exact build on 2026-10-18) is the current figure. Older documents quote 116,858 B from DESIGN 1 (PR #40); that number is out of date.
