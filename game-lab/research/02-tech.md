# Technology for a fast, free 2D layer in a Telegram Mini App

> Research saved from the session of 2026-10-18 (Claude Code). Each report was written by one agent and then
> fact-checked claim by claim by a second, independent agent; the corrections are at the end and **override the
> report text**. Paths under `/tmp/...` were scratch files of that session and no longer exist.

## Kafu "Game Mode" (2D side-scroller between MCQs): technology research, as of 2026-10-18

### Short verdict for the orchestrator
Yes, this can be built, and it can be fast, free and professional. The condition is that the game layer stays tiny and the existing DOM MCQ screen stays as it is.
- **Recommended stack:**
  - one persistent `<canvas>`: a hand-written Canvas 2D loop, or PixiJS v8 if WebGL effects are wanted;
  - sprite-sheet characters packed into one atlas;
  - the existing MCQ DOM shown on top of the canvas, animated with transform/opacity only;
  - the game loop paused while the MCQ is open.
- **What to avoid:**
  - Heavy engines. Phaser 4 alone is ~345 KB gz, which is about 3x Kafu's whole current frontend (~107 KB gz, measured). Unity and Godot web builds are megabytes.
  - Paid animation runtimes: Spine needs a paid editor licence; Rive needs a paid seat to remove its splash screen.
- **Where Kafu stands now:** it already uses `HapticFeedback` (app/design/game-feel.js), `requestFullscreen` (app/modules/ux-core.js) and `disableVerticalSwipes` (app/modules/comments.js). The platform side is therefore already familiar.

---

### 1. Telegram Mini App platform features for games (source: core.telegram.org/bots/webapps)

| Feature | API | Bot API version |
|---|---|---|
| Fullscreen | `requestFullscreen()`, `exitFullscreen()`, `isFullscreen`, events `fullscreenChanged` / `fullscreenFailed` | 8.0 (Nov 17, 2024) |
| Orientation lock | `lockOrientation()`, `unlockOrientation()` | 8.0 |
| Swipe-to-close conflict | `disableVerticalSwipes()`, `enableVerticalSwipes()`, `isVerticalSwipesEnabled` ("disables vertical swipes to close or minimize the Mini App"; the user can still close or minimize by swiping the header) | 7.7 (Jul 7, 2024) |
| Safe areas | `safeAreaInset` (system: notch, nav bar), `contentSafeAreaInset` (Telegram UI overlap) | 8.0 |
| Haptics | `HapticFeedback.impactOccurred / notificationOccurred / selectionChanged` | 6.1 |
| Lifecycle | `activated` / `deactivated` events, `isActive` (minimized or inactive tab) | 8.0 |
| Storage | `DeviceStorage` (up to 5 MB per user), `SecureStorage` (up to 10 items per user); `CloudStorage` | 9.0 (Apr 11, 2025); CloudStorage 6.9 |
| Home screen | `addToHomeScreen()`, `checkHomeScreenStatus()` | 8.0 |
| Sensors | `Accelerometer`, `Gyroscope`, `DeviceOrientation` | 8.0 |

Other Mini App facts that matter here:
- **Device performance class.** On Android the User-Agent carries a performance class: `Telegram-Android/{ver} ({manufacturer} {model}; Android {v}; SDK {n}; {LOW|AVERAGE|HIGH})`.
- **Telegram's design guidelines:** animations "smooth, ideally 60fps"; on low-performance Android devices, minimise animations and effects. This is a ready-made switch for quality tiers.
- **New restriction, Bot API 10.2 (July 14, 2026).** Telegram blocks "the usage of Mini App methods from origins different from the original Mini App domain". It was switched on for all Mini Apps on July 20, 2026, and a bot can opt out via the @BotFather Mini App. The practical point: a prototype hosted on another domain and opened from a link inside Kafu would lose the Telegram APIs. So the prototype should be its own Mini App: a separate free test bot with its own URL. That also fits the owner's "do not integrate yet" rule.

**Telegram Games (sendGame / HTML5 games) vs a Mini App** (core.telegram.org/bots/games):
- A Telegram Game is a message with a "Play" button. Pressing it opens the URL the bot supplies in the in-app browser.
- It gets per-chat high-score tables and a share button.
- The only JS API it documents is `TelegramGameProxy` (`shareScore()`, `initParams`). Fullscreen, haptics, safe areas, storage and lifecycle events are not documented for Games.
- Kafu is already a Mini App, and the MCQ screen depends on Mini App features. A Mini App is therefore clearly better here. Telegram Games only add the chat leaderboard, which Kafu already has (leaders-loader).

### 2. WebViews per client and canvas-game pitfalls
**Which engine each client uses:**
- **Android:** the system WebView, which is Chromium. This is inferred from Telegram's own debug steps: "Enable WebView Debug" and then `chrome://inspect/#devices`.
- **iOS/iPadOS:** WKWebView. Debugging is via "Allow Web View Inspection" plus the Safari Develop menu.
- **Telegram Desktop:** the lib_webview source has `webview_windows_edge_chromium` (WebView2) and legacy `webview_windows_edge_html` on Windows, and `webview_linux_webkitgtk` on Linux.
- **macOS app:** WKWebView (from memory, consistent with its "Inspect Element" flow).
- **Telegram Web:** runs the Mini App in an `<iframe>` and talks to it with `postMessage`. Desktop and mobile clients inject `TelegramWebviewProxy.postEvent` instead.

**Pitfalls (sources in claims):**
- **iOS canvas memory.** WebKit enforces a per-page canvas memory budget:
  - reported as 224 MB on iOS 12 and 384 MB on iOS 15 (device-specific);
  - Safari keeps released canvases around for a while;
  - workaround: set width and height to 1 before dropping a canvas;
  - separate per-canvas area limit of 16,777,216 px.
  - **Rule:** keep one canvas alive and never create one per question.
- **Frame rate on iOS.** WKWebView is effectively capped at 60 fps. WebKit bug 294338, "Allow WKWebView to Support 120Hz", is still NEW; the Safari 120 Hz flag affects Safari only. In Low Power Mode, iOS deliberately throttles rAF to 30 fps (WebKit bug 215745).
- **High refresh rates on Android.** rAF frequency "generally matches the display refresh rate", so motion must be time-based or the game "will run faster on high refresh-rate screens" (MDN). Typical Iraqi budget phones have 90–120 Hz LCDs (Honor X5b 90 Hz; Infinix Smart 9 and Tecno Spark Go 1 120 Hz).
  - Android 15's 60 Hz default applies to *games* (developer.android.com), and Telegram is not a game app. So assume the Mini App's rAF may fire at 90/120 Hz on these phones (inference; measure it).
  - Use delta time and consider capping work to 60 fps, or 30 fps on the LOW class.
- **Background pausing.** rAF is paused in background tabs and hidden iframes (MDN). Also pause on Telegram `deactivated`, because a minimized Mini App may not count as hidden.
- **devicePixelRatio cost.** 360×800 CSS px is 17% of Iraqi mobile screens. At DPR 3 that is 1080×2400 ≈ 2.6 Mpx per frame; capping DPR at 2 gives ≈1.15 Mpx, 2.25x less fill. Cap at 2, or 1.5 on the LOW class (arithmetic).
- **WebGL context loss.** It happens on iOS backgrounding and under memory pressure. Browsers keep about 16 live WebGL contexts and drop the oldest (WebKit commit). Handle `webglcontextlost` / `webglcontextrestored`. Phaser 4's renderer has "context restoration built in"; for PixiJS v8 the behaviour is not verified.
- **Audio on iOS.**
  - Resume the `AudioContext` inside a tap handler.
  - Under the Audio Session API's "auto" type, `AudioContext` defaults to "ambient", which the ringer switch mutes.
  - `navigator.audioSession.type = "playback"` is experimental and not Baseline (MDN).
  - Kafu's sound is off by default already, which is the safest choice.
- **Thermal throttling and GC hitches** (memory, not separately sourced):
  - Avoid allocating per frame: pool objects and reuse arrays.
  - Keep the loop idle when nothing moves. Rendering only during walks also avoids thermal throttling over long study sessions.

### 3. Rendering options: real sizes (measured 2026-10-18 from the npm tarballs, gzip -9, plus esbuild 0.25.10 tree-shaken "minimal app" builds)

| Option | Version / licence | Full min+gz | Minimal app gz (measured) | Fit |
|---|---|---|---|---|
| Hand-written Canvas 2D loop | own code | – | **0.4 KB** (loop + DPR cap + visibility pause) | Best for one character, a coin and parallax |
| DOM/CSS transforms + SVG / CSS `steps()` sprite sheets | own code | 0 | 0 | Simplest integration with the DOM MCQ screen; fine for a few moving layers |
| PixiJS 8.22.0 (Oct 10, 2026) | MIT | 232 KB (pixi.min.js) | **~167–170 KB** (Application + Assets + Sprite + AnimatedSprite) | If WebGL effects or filters are wanted |
| Phaser 4.2.1 (Jul 9, 2026; v4.0.0 Apr 10, 2026) | MIT | 345.7 KB (README: "345 KB"); arcade 313 KB | 362 KB (no tree-shaking) | Overkill; triples the app payload |
| Kaplay 3001.0.19 | MIT | 68 KB | 68 KB (no tree-shaking) | Easy API; the benchmark shows weak sprite throughput |
| LittleJS 1.27.2 | MIT | 148 KB (all plugins) | **52 KB** | Small and capable |
| Excalibur 0.32.0 | BSD-2-Clause | 144 KB | 122.5 KB | Full engine, TypeScript |
| Cocos Creator 3.8 web | free (engine licence not re-verified) | ~2–4 MB build (third-party estimate) | – | Editor-driven; too heavy |
| Unity 6 Web | proprietary | ~5–7 MB runtime, ~8 MB recommended first load (FRVR guide); ~200 MB memory even when empty (forum) | – | Violates "instant" |
| Godot 4.7 web | MIT | default ~42 MB; custom-stripped ~5.4 MB (blog) | – | Compatibility renderer only; C# cannot export to web |

**Benchmark caveat (Shirajuki js-game-rendering-benchmark: 10k sprites, Ryzen 5 4500U, Edge 109):**
- Pixi 47 fps, Phaser 43 fps, Kaboom/Kaplay 3 fps.
- This test is irrelevant at our scale (fewer than 50 sprites). The real test is the floor device.

**What popular Telegram games used:**
- Not documented publicly.
- Raw evidence: fetching the public pages on 2026-10-18 showed Hamster Kombat's clicker (`/_nuxt/`, telegram-web-app.js `defer`) and Blum are **Nuxt/Vue DOM apps, not canvas engines**.
- Playgama's 2024–25 web-games data (not Telegram-specific) shows Unity in ~85% of idle and casual games and Phaser in 44.8% of match-3.

### 4. Character animation runtimes

| Runtime | Runtime size (measured gz) | Cost / licence | Verdict |
|---|---|---|---|
| Sprite sheets (atlas PNG/WebP + JSON) | 0 KB (drawImage / CSS steps) | Free; packers such as free-tex-packer have Pixi and Phaser3 presets | **Recommended** |
| Spine 4.3.13 | spine-core 54 KB, spine-pixi-v8 66 KB (+Pixi) | Editor: Essential $69 or $99, Professional $379 or $449 (two prices shown; the lower may be a sale), Enterprise $2,499 + $379/user/yr above $500k revenue. Integrating the runtime requires an editor licence. The Runtimes License (Apr 5, 2025) otherwise requires "each user of the Products" to hold a licence | Not free |
| Rive 2.45.0 | canvas-lite: 107 KB JS + 321 KB wasm; canvas: 124 KB + 856 KB wasm (rive.js ships unminified) | Runtimes MIT, no runtime fee. Editor exports moved to paid on Oct 20, 2025. The pricing page now says Free "ship with a Rive splash screen"; Cadet $9/seat/month removes it | Not free without a splash screen; heavy wasm |
| Lottie (lottie-web 5.13.0, last published May 2025) | light (SVG) 45.5 KB; full 74.5 KB | MIT. Free editor: Glaxnimate (GPL-3.0) exports Lottie | OK for UI flourishes (coin burst); SVG Lottie can be CPU-heavy on low-end phones |
| dotLottie-web 0.81.0 | 32 KB JS + 487 KB wasm | MIT | Too heavy |
| DragonBones | community Pixi v8 runtimes, last published 2025 | Free; official repo has no releases and 68 open issues, its README recommends "LoongBones", and a fork's README says Egret "seems to have abandoned" it | Avoid |
| CSS/SVG/WAAPI | 0 | Free | Fine for UI; GSAP 3.15.0 (27.7 KB gz) uses a "Standard no-charge" licence, not MIT |

### 5. "Instant" canvas ↔ DOM transitions, and how pros measure them
**Techniques:**
1. **Keep one canvas alive** behind the MCQ layer. Never destroy or recreate it: iOS canvas memory release lags, WebGL contexts are limited, and context creation is slow.
2. **Stop the rAF loop while the MCQ is open** (last frame stays painted). Restart it with the delta time reset so the character does not "jump".
3. **Animate the MCQ layer with transform and opacity only.** These are the only compositor-only properties (web.dev). Use `will-change` sparingly, because every layer costs memory.
4. **Pre-render the next MCQ hidden.** `content-visibility: hidden` keeps its rendering state and renders faster than `display:none`; it is Baseline 2024.
5. **Prefetch the next MCQ's data while the student reads the current explanation,** and `await img.decode()` its images so inserting them does not stall a frame.
6. **The walk/climb animation (~0.6–1.2 s) doubles as the loading screen** that hides network latency. This is a standard game technique.
7. **Batch DOM reads and writes; no layout reads in the same frame.** Don't allocate per frame.

**Measurement:**
- **Android:** remote-debug the real phone. In Telegram, press-and-hold the version number twice, choose Enable WebView Debug, then open `chrome://inspect/#devices`. Use the DevTools Performance panel.
- **iOS:** in Telegram, tap Settings 10 times and turn on Allow Web View Inspection. In Safari Web Inspector, the Timelines tab's Frames / Rendering Frames view draws 30 and 60 fps guide lines (33 and 16 ms).
- **In-app telemetry:**
  - log rAF deltas and report frame-time p50/p95/p99 and the count of frames over 33 ms;
  - Long Animation Frames API: Chrome 123+, observer type `long-animation-frame`, 50 ms threshold; not available in Safari or Firefox;
  - INP: good ≤200 ms, poor >500 ms, at p75.

**Suggested budget (my recommendation, not a standard):**
- tap to first visual change under 100 ms;
- game scene p95 ≤16.7 ms and p99 ≤33 ms on the floor device;
- no long animation frames (>50 ms) during transitions;
- game-mode JS ≤~50 KB gz, lazy-loaded;
- first atlas ≤~300 KB.

### 6. Iraqi phone market (raw input for choosing test devices)
**StatCounter, Iraq, September 2026:**
- **Mobile vendors:** Honor 16.0%, Infinix 15.06%, Samsung 13.66%, Apple 13.64%, Tecno 13.07%, Xiaomi 10.09%. A variant StatCounter page shows a different order and a large "Unknown" bucket, so treat these as approximate.
- **OS:** Android 86.34%, iOS 13.64%.
- **Android versions:** 15 at 22.9%, 16 at 20.45%, 14 at 18.5%, 13 at 16.77%, 11 at 6.9%, 12 at 6.75%.
- **Top screen resolution:** 360×800 (17.04%).

**Floor device candidates (GSMArena):**
- **Honor X5b:** Helio G36 (8× Cortex-A53, PowerVR GE8320), 4 GB, 720×1612 at 90 Hz, ~80 EUR.
- **Infinix Smart 9:** Helio G81 (Mali-G52 MC2), 3/4 GB, 120 Hz, Android 14 Go edition.
- **Tecno Spark Go 1:** Unisoc T615 (Mali-G57 MP1), 3/4 GB, 120 Hz, Android 14 Go edition.
- Android Go needs only 2 GB RAM from Android 13 onward.

**Realistic test set:**
- one Helio G36/G81-class Honor or Infinix phone as the floor;
- one mid-range Samsung A-series phone;
- one older iPhone for WKWebView's 60 fps cap.

**Rawer than StatCounter:** Kafu's own request logs. The Telegram-Android User-Agent carries the model and LOW/AVERAGE/HIGH class, so logging that distribution (anonymised) for a week shows the real floor.

### 7. Free tools for profiling and testing
- **Lighthouse:** default mobile throttling is 150 ms RTT, 1.6 Mbps and a 4x CPU slowdown, aimed at "a mid-tier mobile device". It is relative to the host machine, so check `benchmarkIndex` and calibrate.
- **Chrome 134+ DevTools:** "Calibrate" creates low-tier and mid-tier mobile CPU presets for your machine.
- **Playwright + CDP:** `page.context().newCDPSession(page)`, then `Emulation.setCPUThrottlingRate {rate: 4–6}` (an experimental "slowdown factor").
  - Limits (inference): it slows only the CPU. It does not emulate a weak GPU, fill-rate, thermal throttling, low RAM or WKWebView, so it is a proxy and never a pass or fail.
- **WebPageTest Starter:** free, 300 runs/month on the official page (150 elsewhere). Mobile is emulated, not real devices.
- **BrowserStack:** free only for open-source projects (aggregator claim, unverified) plus a short trial.
- **Telegram test environment:**
  - separate test accounts, created from the mobile apps;
  - Mini App links can be HTTP or even an IP address there (production requires HTTPS);
  - Desktop: Shift+Alt+right-click "Add Account" and choose Test Server;
  - iOS: tap Settings 10 times, then Accounts, then Test.
- **Debug switches on other clients:** Telegram Desktop Beta has Settings › Advanced › Experimental › Enable webview inspection. On macOS, click Settings 5 times and turn on "Debug Mini Apps".
- **Free hosting:** Cloudflare Workers static-asset requests are "free and unlimited", so atlases and audio can be served at no cost.

---

### Mapping to the owner's four meta-questions
**1. What a top professional would do that you are not asking for:**
- Write a performance budget and a "floor device" first (above), then build a one-day greybox **vertical slice**: START, arrow, walk, coin, the existing MCQ, Next, climb. Use placeholder rectangles, measured on the floor phone, before any art.
- Make the walk short (≤1 s) and skippable, and keep a "Classic mode" switch. Over 100 MCQs, a 2 s animation each adds more than 3 minutes of waiting.
- Use Telegram's performance class for quality tiers.
- Ship the prototype as a separate test bot. This also avoids the Bot API 10.2 cross-origin block.
- Guard against the learning risk: extra decorative material hurts learning.
  - The seductive-details meta-analysis finds a small-to-moderate negative effect, g = −0.33.
  - The gamification review in health professions (44 studies) found benefits mainly when game elements drive *learning behaviour*, and most studies lacked control groups.
  - So keep the game wrapper around the MCQ, never inside the explanation.

**2. The rawest material to start from:**
- Kafu's own logs: User-Agent model and performance class, time per question, questions per session. The session data sets level length and the floor device.
- A character model sheet plus layered parts or hand-keyed walk-cycle frames packed into an atlas, not finished single illustrations. AI images rarely give consistent frames.
- Frame traces from the real floor phone, not blog benchmarks.

**3. Methods and tools:**
- **Code:** a Canvas 2D loop or PixiJS v8; free-tex-packer atlases; Glaxnimate for any Lottie flourishes.
- **Measurement:** chrome://inspect plus the DevTools Performance panel; Safari Rendering Frames; a frame-time p95/p99 and long-animation-frame logger.
- **Lab checks:** Lighthouse and Playwright with CDP CPU throttling as a pre-check.
- **Testing inside Telegram:** the test environment.

**4. What, other than you or me, would show the result is right:**
- Real-device traces against the budget.
- Frame-time telemetry from beta testers, split by performance class.
- A 5–8 student playtest that times each question.
- An A/B test from Kafu's own analytics (xp-ledger / admin-usage modules): questions per session, D1/D7 return and accuracy, game vs classic.

Note for the integrator: per CLAUDE.md lean-storage practice, keep prototype art binaries out of git and in a separate prototype folder or branch.

**How the sizes were measured:**
- npm tarballs were downloaded to <scratch>/pkgs.
- The tree-shaken builds are in <scratch>/treeshake.
- The measuring script is <scratch>/measure.js.
- The Kafu payload figure (~107 KB gz) is app/index.html plus the manifest styles and scripts. It excludes the two vendor files that are absent from the checkout (ts-fsrs, fflate).

---

## Fact-check result

74 of 80 claims confirmed by the independent checker. Corrections (these win over the text above):

- **C29 (corrected)**: Measured: pixi.js@8.22.0 (MIT, published Oct 10 2026) pixi.min.js 232.3 KB gz; minimal tree-shaken app (Application, Assets, Sprite, AnimatedSprite) about 167-170 KB gz with esbuild 0.25.10
  - Correct: pixi.js 8.22.0 (MIT) was published on 2026-10-01, not Oct 10 (Oct 10 entries in the registry are 8.22.0-dev builds). The sizes check out: pixi.min.js is 232.3 KiB gz (Node zlib level 9). The minimal esbuild 0.25.10 app is 170.0 KiB gz as a single bundle, or 173.8 KiB summed over code-split chunks.
  - Source: https://registry.npmjs.org/pixi.js
- **C30 (corrected)**: Measured: kaplay@3001.0.19 (MIT) 68 KB gz; littlejsengine@1.27.2 (MIT) full min 147.7 KB gz, minimal tree-shaken 51.8 KB gz; excalibur@0.32.0 (BSD-2-Clause) 143.8 KB gz full, 122.5 KB gz minimal
  - Correct: kaplay 3001.0.19 is 68.1 KiB gz, littlejsengine 1.27.2 littlejs.min.js is 147.7 KiB gz, and excalibur 0.32.0 is 143.8 KiB full / 122.5 KiB minimal; all three confirmed. The 51.8 KiB LittleJS minimal figure holds only when esbuild is run with --conditions=production, which resolves to the package's stripped littlejs.esm.min.js. A default esbuild bundle of the same entry is 112.5 KiB gz.
  - Source: https://registry.npmjs.org/littlejsengine
- **C38 (corrected)**: Godot default web export about 42 MB; custom templates and optimisations reach about 5.37 MB
  - Correct: The default Godot web export is about 42.0 MB. The post's 5.37 MB figure is the Windows export, not the web build. For the web build, a custom template plus wasm-opt reaches about 16 MB uncompressed, or about 2.7 MB with Brotli. The author says the web size was mostly unchanged after the 4.5 update.
  - Source: https://forum.godotengine.org/t/how-to-minify-godots-build-size-93mb-6-4mb-exe/104965
- **C65 (corrected)**: WebPageTest Starter (free) lists 300 monthly test runs on the official signup page; mobile testing via emulation
  - Correct: The current official WebPageTest pricing page, now hosted by LogicMonitor, lists the Free Starter plan at 150 monthly test runs (3 runs per test, 30 locations). api.webpagetest.org/signup no longer resolves (DNS ENOTFOUND). Mobile testing is by emulation (confirmed).
  - Source: https://www.logicmonitor.com/pricing/web-performance-optimization
- **C72 (corrected)**: Infinix Smart 9: Helio G81 (2x2.0 A75 + 6x1.7 A55), Mali-G52 MC2, 3/4GB RAM, 6.7in 720x1600 120Hz, Android 14 Go edition
  - Correct: Infinix Smart 9 has a Helio G81 (2x2.0 GHz A75 + 6x1.7 GHz A55), Mali-G52 MC2, 6.7in 720x1600 120Hz IPS and Android 14 (Go edition), all as stated. RAM variants are 3, 4 and 6 GB, not just 3/4 GB. Price is about 70 EUR; it was announced 2024-09-23.
  - Source: https://www.gsmarena.com/infinix_smart_9-13374.php
- **C80 (corrected)**: Safari 'Prefer Page Rendering Updates near 60fps' flag on by default; an iPhone 14 Pro on iOS 18 reached 120fps with it off
  - Correct: Bug 294338 says Safari reaches 120 Hz on ProMotion devices only when the 'Prefer Page Rendering Updates Near 60fps' flag is turned off, and that this flag does not affect WKWebView. The bug's platform field is iOS 18, but no comment reports an iPhone 14 Pro on iOS 18 reaching 120 fps. One commenter got 120 fps in an iOS 26 home-screen web app with the flag off. WebKit's Simon Fraser got 60 fps with default settings. A July 2026 commenter got 120 fps in WKWebView only by flipping an internal preference, which has no public API.
  - Source: https://bugs.webkit.org/show_bug.cgi?id=294338

### What the checker said was missing or misleading

1) Kafu's size baseline is understated. The ~107 KiB gz figure leaves out ts-fsrs 5.4.2 (14.5 KiB gz) and fflate 0.8.3 (12.4 KiB gz), which are both listed in app/modules/manifest.json. The real payload is therefore about 130 KiB gz, and Phaser is about 2.6x it rather than 3x. The LittleJS '52 KB' figure needs esbuild --conditions=production; a default bundle is 112.5 KiB gz. All of this was re-measured from the npm tarballs with Node zlib level 9, the same method as the original agent (sources: registry.npmjs.org; /home/user/MCQs-Mountain-/app/modules/manifest.json).
2) Telegram's 'hardware info' is thinner than the blog suggests. The blog promises 'processing power and memory capacity', but the documented API only adds LOW/AVERAGE/HIGH to the Android User-Agent. iOS, Desktop and Web get no tier signal, so the quality-tier switch covers Android only (https://core.telegram.org/bots/webapps, 'Additional Data in User-Agent').
3) requestFullscreen can fail. The fullscreenFailed event returns UNSUPPORTED on some platforms, so the game scene must also lay out correctly without fullscreen, using viewportStableHeight and safe-area changes. Telegram Web runs the app in an iframe (https://core.telegram.org/bots/webapps; https://docs.telegram-mini-apps.com/platform/methods).
4) The atlas budget ignores decoded memory. A ≤300 KB WebP or PNG still decodes to width×height×4 bytes: a 2048×2048 atlas is about 16 MB in RAM/GPU. That matters on 3–4 GB Android Go phones (Infinix Smart 9, Tecno Spark Go 1) and against the iOS canvas budget. Pre-upload textures before the first walk to avoid a first-use hitch; PixiJS warns that GPU upload and decode cause lag spikes (https://pixijs.com/8.x/guides/components/textures.md).
5) Browser-support gaps for the recommended techniques:
- content-visibility needs iOS/Safari 18+, so older iPhones need a fallback.
- The Long Animation Frames API is Chromium-only. It works in Android WebView 123+ but not in Telegram iOS, so iOS telemetry has to rely on rAF-delta logging (MDN browser-compat-data 8.1.6).
6) Accessibility. The report never mentions honouring prefers-reduced-motion (walk, parallax and elevator rides can trigger vestibular discomfort). That and the proposed Classic-mode switch should be default behaviour (https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
7) A free, professional-grade art path is missing. Kenney's game assets are CC0: commercial use is allowed and attribution is optional. They are ideal greybox or placeholder art before commissioning a character (https://kenney.nl/support).
8) The learning evidence is weaker for this specific idea than the report implies.
- In the van Gaalen et al. 2021 review, 40 of the 44 studies used assessment attributes, mostly combined with conflict/challenge (27). Kafu already has those through MCQs, XP and leaders. The review offers no direct evidence that a 'game fiction' story/world wrapper adds learning value (https://pmc.ncbi.nlm.nih.gov/articles/PMC8041684/).
- The seductive-details meta-analysis found harm was larger when learners could not control pacing. That is a direct, evidence-based reason to make the walk skippable or instant (https://inspire.acu.edu.au/articles/seductive-details).
9) Some cited evidence is dated.
- The Shirajuki benchmark ran on Edge 109 (early 2023) with older engine versions, so the 'Kaplay 3 fps' figure may not reflect Kaplay 3001.
- The WebKit '16 WebGL contexts' figure dates from 2016, and the later GPU-process architecture changed the limits (https://bugs.webkit.org/show_bug.cgi?id=222411). The 'keep one context' advice still holds.
10) Godot's small build is Windows, not web. The 5.37 MB figure is the Windows export; the heavily customised web build is about 16 MB uncompressed / 2.7 MB Brotli and needs a custom engine compile (https://forum.godotengine.org/t/how-to-minify-godots-build-size-93mb-6-4mb-exe/104965).
11) Bot API 10.2 applies beyond the prototype. Any cross-origin iframe calling Telegram methods is affected, not just a prototype on another domain. Kafu runs separate workers (motioncards-worker, content-worker per the repo's wrangler configs). If the prototype embeds the MCQ or MotionCards UI from another origin and that frame calls Telegram methods, the calls would be blocked unless the bot opts out (https://core.telegram.org/bots/api-changelog, Bot API 10.2).
12) WebPageTest's free tier is now 150 runs per month on the LogicMonitor-hosted pricing page, and the cited api.webpagetest.org host no longer resolves (https://www.logicmonitor.com/pricing/web-performance-optimization). BrowserStack's free real-device access is confirmed for open-source projects only (https://www.browserstack.com/open-source). If the repo is not open source, real-device testing has to be done on physical phones.

### Sources: every claim with its verdict

| ID | Verdict | Claim | Source |
|---|---|---|---|
| C1 | confirmed | requestFullscreen/exitFullscreen/isFullscreen, lockOrientation/unlockOrientation, safeAreaInset, contentSafeAreaInset, activated/deactivated + isActive, addToHomeScreen/checkHomeScreenStatus, Accelerometer, Gyroscope, DeviceOrientation, LocationManager, downloadFile were introduced in Bot API 8.0 | https://core.telegram.org/bots/webapps |
| C2 | confirmed | disableVerticalSwipes/enableVerticalSwipes/isVerticalSwipesEnabled were added in Bot API 7.7; disableVerticalSwipes 'disables vertical swipes to close or minimize the Mini App', and users can still close by swiping the header | https://core.telegram.org/bots/webapps |
| C3 | confirmed | HapticFeedback (impactOccurred, notificationOccurred, selectionChanged) since Bot API 6.1; CloudStorage since 6.9; shareToStory since 7.8 | https://core.telegram.org/bots/webapps |
| C4 | confirmed | DeviceStorage and SecureStorage were added in Bot API 9.0; DeviceStorage allows up to 5 MB per user, SecureStorage up to 10 items per user | https://core.telegram.org/bots/webapps |
| C5 | confirmed | Bot API dates: 6.1 Jun 20 2022; 7.7 Jul 7 2024; 7.8 Jul 31 2024; 8.0 Nov 17 2024; 9.0 Apr 11 2025; 9.1 Jul 3 2025; 9.6 Apr 3 2026; 10.1 Jun 11 2026 | https://core.telegram.org/bots/webapps |
| C6 | confirmed | Android Mini App User-Agent format: Telegram-Android/{app_version} ({manufacturer} {model}; Android {v}; SDK {n}; {performance_class}) with performance class LOW, AVERAGE or HIGH | https://core.telegram.org/bots/webapps |
| C7 | confirmed | Telegram design guidelines: animations should be smooth, ideally 60fps; on Android minimise animations and visual effects on low-performance devices | https://core.telegram.org/bots/webapps |
| C8 | confirmed | Debug mode: iOS tap Settings 10 times and toggle Allow Web View Inspection, then Safari Develop menu; Android press and hold version number two times, Enable WebView Debug, chrome://inspect/#devices; Desktop Beta Settings > Advanced > Experimental settings > Enable webview inspection; macOS click Settings 5 times, enable Debug Mini Apps, right click > Inspect Element | https://core.telegram.org/bots/webapps |
| C9 | confirmed | Test environment login: iOS tap Settings 10 times > Accounts > Login to another account > Test; Desktop Shift+Alt+right click Add Account > Test Server; macOS click Settings 10 times, Cmd+click Add Account | https://core.telegram.org/bots/webapps |
| C10 | confirmed | In the Telegram test environment a Mini App link may use HTTP or even an IP address, whereas production requires HTTPS | https://docs.telegram-mini-apps.com/platform/test-environment |
| C11 | confirmed | Bot API 10.2 (July 14, 2026) disallows Mini App methods from origins different from the original Mini App domain; protection auto-enabled for all Mini Apps on July 20, 2026; opt-out via @BotFather Mini App | https://core.telegram.org/bots/api-changelog |
| C12 | confirmed | Telegram blog (Nov 17, 2024): Mini apps can use the entire screen in portrait or landscape, home-screen shortcuts, device motion, orientation lock, and basic hardware info (processing power, memory) to adjust graphics | https://telegram.org/blog/fullscreen-miniapps-and-more |
| C13 | confirmed | Telegram Games: game message always has an inline Play button that opens the game URL in the in-app browser; only documented JS API is TelegramGameProxy (shareScore, initParams); built-in per-chat high scores | https://core.telegram.org/bots/games |
| C14 | confirmed | Telegram Web displays the Mini App in an iframe and uses window.parent.postMessage; desktop and mobile clients inject window.TelegramWebviewProxy.postEvent | https://docs.telegram-mini-apps.com/platform/methods |
| C15 | confirmed | Telegram Desktop's lib_webview contains webview_windows_edge_chromium and webview_windows_edge_html on Windows | https://github.com/desktop-app/lib_webview/tree/master/webview/platform/win |
| C16 | confirmed | Telegram Desktop's lib_webview uses WebKitGTK on Linux (webview_linux_webkitgtk files) | https://github.com/desktop-app/lib_webview/tree/master/webview/platform/linux |
| C17 | confirmed | iOS Safari canvas memory limited to 384MB on iOS 15 (lower earlier, device specific); Safari holds released canvases; workaround set width and height to 1 | https://www.pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/ |
| C18 | confirmed | A 224 MB canvas memory cap was reported on iOS 12 | https://developer.apple.com/forums/thread/112218 |
| C19 | confirmed | Separate per-canvas area limit of 16,777,216 pixels on iOS Safari | https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/ |
| C20 | confirmed | WebKit bug 294338 'Allow WKWebView to Support 120Hz Refresh Rate on ProMotion Devices' is NEW; commenters say WKWebView is hardcoded to 60fps and the Safari flag only affects Safari | https://bugs.webkit.org/show_bug.cgi?id=294338 |
| C21 | confirmed | iOS throttles requestAnimationFrame to 30fps in Low Power Mode; WebKit called it intentional | https://bugs.webkit.org/show_bug.cgi?id=215745 |
| C22 | confirmed | rAF is paused in background tabs and hidden iframes; callback frequency generally matches display refresh rate (60/75/120/144 Hz); use the timestamp or animation runs faster on high refresh screens | https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame |
| C23 | confirmed | Android 15 sets a default 60Hz refresh rate for games; higher rates must be requested via the Frame Rate API or Swappy; the system may override them | https://developer.android.com/games/optimize/display-refresh-rate-change |
| C24 | confirmed | Audio Session API is experimental and not Baseline; with type 'auto' an AudioContext defaults to 'ambient' | https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API |
| C25 | confirmed | Other browsers limit concurrent active WebGL contexts to 16 and lose the oldest | https://webkit.googlesource.com/WebKit/+/70e10861eb2fbd9d0862fd8702874c25ae5d8bfd |
| C26 | confirmed | Phaser v4.0.0 'Caladan' released 10 April 2026; v4.1.0 30 April 2026; v4.2.0 19 June 2026; v4.2.1 'Giedi' 9 July 2026 | https://phaser.io/download/phaser4 |
| C27 | confirmed | Phaser README: phaser.min.js full is 1.29 MB raw / 345 KB gzip; phaser-arcade.min.js 313 KB gzip; v4 renderer is node-based with context restoration built in; offers WebGL and Canvas rendering | https://cdn.jsdelivr.net/npm/phaser@4.2.1/README.md |
| C28 | confirmed | Measured: phaser@4.2.1 (MIT) phaser.min.js 345.7 KB gz; minimal esbuild app 362 KB gz | https://www.npmjs.com/package/phaser |
| C29 | corrected | Measured: pixi.js@8.22.0 (MIT, published Oct 10 2026) pixi.min.js 232.3 KB gz; minimal tree-shaken app (Application, Assets, Sprite, AnimatedSprite) about 167-170 KB gz with esbuild 0.25.10 | https://www.npmjs.com/package/pixi.js |
| C30 | corrected | Measured: kaplay@3001.0.19 (MIT) 68 KB gz; littlejsengine@1.27.2 (MIT) full min 147.7 KB gz, minimal tree-shaken 51.8 KB gz; excalibur@0.32.0 (BSD-2-Clause) 143.8 KB gz full, 122.5 KB gz minimal | https://www.npmjs.com/package/littlejsengine |
| C31 | confirmed | Measured: a hand-written Canvas 2D loop with DPR cap and visibility pause is 0.4 KB gz | memory |
| C32 | confirmed | Measured: Kafu's current frontend (app/index.html + manifest styles/scripts, excluding missing vendor ts-fsrs and fflate) is about 391 KB raw, 107 KB gz | memory |
| C33 | confirmed | Benchmark at 10,000 sprites: Babylon 56 FPS, Pixi 47, Phaser 43, Kaboom/Kaplay 3 FPS on Ryzen 5 4500U, Edge 109 | https://github.com/Shirajuki/js-game-rendering-benchmark |
| C34 | confirmed | Unity web runtime roughly 12 MB unstripped, ~5 MB empty, ~7 MB minimal; recommended ~8 MB initial download | https://docs.frvr.com/engines/unity/optimization/ |
| C35 | confirmed | Unity 6 Web supports iOS Safari 15+ and Chrome 58+ on Android | https://docs.unity3d.com/6000.0/Documentation/Manual/webgl-browsercompatibility.html |
| C36 | confirmed | A stripped empty Unity 6 release web build still used about 200 MB memory | https://discussions.unity.com/t/web-build-memory-consumption-on-unity-6/1613334 |
| C37 | confirmed | Godot 4.7 web export: requires WebGL 2, Compatibility renderer only, Godot 4 C# projects cannot export to web, single-threaded export is default and works on iOS | https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html |
| C38 | corrected | Godot default web export about 42 MB; custom templates and optimisations reach about 5.37 MB | https://popcar.bearblog.dev/how-to-minify-godots-build-size/ |
| C39 | confirmed | Observed 2026-10-18: Hamster Kombat clicker page is a Nuxt (Vue) SPA loading /_nuxt/ chunks and telegram-web-app.js with defer; Blum page is also Nuxt | https://hamsterkombatgame.io/clicker/ |
| C40 | confirmed | Playgama data on 2024-2025 web games: Unity 85.4% of idle and 85% of casual games; Phaser leads match-3 at 44.8% | https://wnhub.io/news/engines/item-48902 |
| C41 | confirmed | Cocos Creator build size roughly 2-4 MB (third-party estimate, unverified) | https://app.cinevva.com/guides/web-game-engines-comparison |
| C42 | confirmed | Spine prices shown: Essential $99 and $69; Professional $449 and $379; Enterprise $2,499 base plus $379 per user, one year; businesses over $500,000 annual revenue need Enterprise; licensing Spine allows integrating the Spine Runtimes | https://esotericsoftware.com/spine-purchase |
| C43 | confirmed | Spine Runtimes License (updated April 5, 2025): integration permitted under Section 2 of the Spine Editor License, otherwise each user of the Products must obtain their own Spine Editor license | https://raw.github.com/EsotericSoftware/spine-runtimes/master/LICENSE |
| C44 | confirmed | Measured: @esotericsoftware/spine-core 4.3.13 54.2 KB gz; spine-pixi-v8 66.0 KB gz | https://www.npmjs.com/package/@esotericsoftware/spine-pixi-v8 |
| C45 | confirmed | Rive pricing: Free $0 'Build and ship with a Rive splash screen' (Free exports play a splash screen); Cadet $9/seat/month removes splash; Voyager $32; Enterprise $120 | https://rive.app/pricing |
| C46 | confirmed | Rive (Oct 20, 2025): exports moved to paid plans; Cadet $9/month annual; runtimes remain open-source under MIT; no runtime fee; exports keep working forever | https://rive.app/blog/rive-s-new-9-mo-plan |
| C47 | confirmed | Measured: @rive-app/canvas-lite 2.45.0 rive.wasm 320.6 KB gz + rive.js 107.4 KB gz; @rive-app/canvas rive.wasm 856.3 KB gz + rive.js 123.9 KB gz | https://www.npmjs.com/package/@rive-app/canvas-lite |
| C48 | confirmed | Measured: lottie-web 5.13.0 (MIT, last modified 2025-05-21) lottie.min.js 74.5 KB gz, lottie_light.min.js 45.5 KB gz; @lottiefiles/dotlottie-web 0.81.0 wasm 487.4 KB gz | https://www.npmjs.com/package/lottie-web |
| C49 | confirmed | DragonBonesJS repo shows no releases, 68 open issues, 14 open PRs; README suggests using LoongBones | https://github.com/DragonBones/DragonBonesJS |
| C50 | confirmed | A community Pixi v8 DragonBones runtime README says Egret seems to have abandoned DragonBones and its libraries years ago | https://unpkg.com/dragonbones-pixijs@1.0.5/README.md |
| C51 | confirmed | Glaxnimate is GPL-3.0-or-later and supports Lottie | https://flathub.org/apps/org.mattbas.Glaxnimate |
| C52 | confirmed | free-tex-packer-core exporter presets include Pixi, PhaserHash, PhaserArray, Phaser3 | https://cdn.jsdelivr.net/npm/free-tex-packer-core@0.3.8/README.md |
| C53 | confirmed | gsap 3.15.0 licence is "Standard 'no charge' license" (not MIT); gsap.min.js measured 27.7 KB gz | https://www.npmjs.com/package/gsap |
| C54 | confirmed | Only transform and opacity are compositor-only; use will-change for animated elements; every layer costs memory | https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count |
| C55 | confirmed | content-visibility: hidden preserves rendering state and renders faster than display:none; Baseline 2024 | https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility |
| C56 | confirmed | HTMLImageElement.decode() resolves when image is decoded and safe to append, preventing next-frame delay; Baseline widely available since January 2020 | https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode |
| C57 | confirmed | Long Animation Frames API shipped in Chrome 123; 50 ms threshold; observer type long-animation-frame; not supported in Safari or Firefox | https://developer.chrome.com/docs/web-platform/long-animation-frames |
| C58 | confirmed | INP good <=200 ms, needs improvement <=500 ms, poor >500 ms, at 75th percentile | https://web.dev/articles/inp |
| C59 | confirmed | Android WebView remote debugging via WebView.setWebContentsDebuggingEnabled(true), Android 4.4+, listed in chrome://inspect | https://developer.chrome.com/docs/devtools/remote-debugging/webviews |
| C60 | confirmed | Safari Web Inspector Timelines Frames view shows rendering frames with 30 and 60 FPS guide lines (~33 ms and ~16 ms) | https://webkit.org/web-inspector/timelines-tab/ |
| C61 | confirmed | Lighthouse default mobile throttling: 150 ms RTT, 1.6 Mbps down, 750 Kbps up, 4x CPU slowdown emulating a mid-tier mobile device; calibrate using benchmarkIndex | https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md |
| C62 | confirmed | Chrome 134 DevTools CPU throttling calibration creates low-tier and mid-tier mobile presets specific to the machine | https://developer.chrome.com/blog/devtools-grounded-real-world |
| C63 | confirmed | CDP Emulation.setCPUThrottlingRate: 'Enables CPU throttling to emulate slow CPUs'; rate is a slowdown factor (1 none, 2 = 2x); experimental | https://py-cdp.readthedocs.io/en/stable/api/emulation.html |
| C64 | confirmed | Playwright creates raw CDP sessions with page.context().newCDPSession(page) | https://playwright.dev/docs/api/class-cdpsession |
| C65 | corrected | WebPageTest Starter (free) lists 300 monthly test runs on the official signup page; mobile testing via emulation | https://api.webpagetest.org/signup |
| C66 | confirmed | BrowserStack free 'Open Source' tier for open-source projects (aggregator claim, unverified on BrowserStack site) | https://agentdeals.dev/vendor/browserstack |
| C67 | confirmed | StatCounter Iraq mobile vendor share September 2026: Honor 16%, Infinix 15.06%, Samsung 13.66%, Apple 13.64%, Tecno 13.07%, Xiaomi 10.09% | https://gs.statcounter.com/vendor-market-share/mobile/iraq |
| C68 | confirmed | StatCounter Iraq mobile OS September 2026: Android 86.34%, iOS 13.64% | https://gs.statcounter.com/os-market-share/mobile/iraq |
| C69 | confirmed | StatCounter Iraq Android versions September 2026: 15 22.9%, 16 20.45%, 14 18.5%, 13 16.77%, 11 6.9%, 12 6.75% | https://gs.statcounter.com/android-version-market-share/mobile-tablet/iraq |
| C70 | confirmed | StatCounter Iraq mobile screen resolutions September 2026: 360x800 17.04%, 414x896 9.65%, 360x806 8.94%, 360x820 7.92%, 412x915 4.88%, 393x886 3.76% | https://gs.statcounter.com/screen-resolution-stats/mobile/iraq |
| C71 | confirmed | Honor X5b: Helio G36 (12nm, 4x2.2 + 4x1.6 GHz Cortex-A53), PowerVR GE8320, 4GB RAM, 6.56in 720x1612 90Hz, Android 14, about 80 EUR, announced Oct 22 2024 | https://www.gsmarena.com/honor_x5b-13463.php |
| C72 | corrected | Infinix Smart 9: Helio G81 (2x2.0 A75 + 6x1.7 A55), Mali-G52 MC2, 3/4GB RAM, 6.7in 720x1600 120Hz, Android 14 Go edition | https://m.gsmarena.com/infinix_smart_9-13374.php |
| C73 | confirmed | Tecno Spark Go 1: Unisoc T615 (2x1.8 A75 + 6x1.6 A55), Mali-G57 MP1, 3/4GB RAM, 720x1600 120Hz IPS, Android 14 Go edition | https://m.gsmarena.com/tecno_spark_go_1-13274.php |
| C74 | confirmed | Android (Go edition) minimum RAM is 2 GB from Android 13 | https://developer.android.com/guide/topics/androidgo |
| C75 | confirmed | Cloudflare Workers: requests to static assets are free and unlimited | https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ |
| C76 | confirmed | Gamification of health professions education systematic review: 44 of 5,044 studies included; learning outcomes may improve especially with game attributes that improve learning behaviours; most studies lacked control groups and theory | https://pmc.ncbi.nlm.nih.gov/articles/PMC8041684/ |
| C77 | confirmed | Seductive details: Rey (2012) found medium negative effects across 39 effects; Sundararajan & Adesope (2020) found g = -0.33 | https://inspire.acu.edu.au/articles/seductive-details |
| C78 | confirmed | Kafu already calls Telegram HapticFeedback (app/design/game-feel.js), requestFullscreen (app/modules/ux-core.js), disableVerticalSwipes (app/modules/comments.js) and loads telegram-web-app.js (app/index.html) | memory |
| C79 | confirmed | Telegram Android uses a Chromium-based system WebView and iOS uses WKWebView (inferred from Telegram debug instructions using chrome://inspect and Safari Web Inspector); macOS app uses WKWebView | memory |
| C80 | corrected | Safari 'Prefer Page Rendering Updates near 60fps' flag on by default; an iPhone 14 Pro on iOS 18 reached 120fps with it off | https://bugs.webkit.org/show_bug.cgi?id=294338 |
