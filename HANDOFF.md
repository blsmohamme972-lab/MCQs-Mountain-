# Kafu handoff

Updated: 2026-09-28 (Asia/Baghdad)

## Start here

Read `PROGRESS.md`, `docs/ADMIN.md`, `MCQ_PLATFORM_FINAL_PLAN.yaml`, then the reports under `docs/reports/`.

Repository: `blsmohamme972-lab/MCQs-Mountain-` (private)  
Telegram bot: `@KafuMcqsbot`  
App Worker: `https://kafu.blsmohamme97.workers.dev`  
Content Worker: `https://kafu-content-1.blsmohamme97.workers.dev`

Protected deployment-check book: `KAFU-UPLOAD-TEST v1` — 4 questions, 1 chapter, 2 images. Do not remove it while the deployment smoke test depends on it.

## Current product state

The main study/publishing path is working end to end:

- owner uploads a validated ZIP to the private Telegram bot;
- D1 stores queue/admin metadata;
- GitHub Actions downloads, validates, audits, builds, smoke-tests and publishes content;
- `kafu-content-1` serves immutable catalog/book/chapter/image assets;
- the Mini App studies from downloaded content and remains local/offline-first;
- Telegram CloudStorage keeps a compact cross-device personal backup.

Night 1 work merged:
- PR #12 security scan, safe diagnostics, credential-rotation guide;
- PR #13 M3 offline/queue/admin acceptance tests and failed-item recovery fixes;
- PR #14 compact personal sync with deterministic two-device merges;
- PR #15 pinned `ts-fsrs 5.4.2` Review Due sessions;
- PR #16 background chapter downloads, next-chapter prefetch and whole-book offline save;
- PR #17 Me version/source info, offline banner and iPad fullscreen diagnostic;
- PR #18 safe offline app shell/service-worker fallback;
- PR #19 privacy/about and educational-use disclaimer;
- PR #21 reusable PDF parser library, deterministic `package_batch.py`, content-team guide and confirmed bulk audit-warning approval.

Each merged code task passed CI. The latest code deployment after PR #21 passed the exact-build/app/protected-book read-only verification.

## Backup state

PR #20 merged on 2026-09-28 after owner approval and green PR/main CI. Weekly Kafu D1 Backup run #1 (36389139180) passed. The private `d1-backups` release contains matching `kafu-d1-20260928T065829Z-36389139180.sql.gz` and `.json` assets. The weekly Sunday 01:17 UTC schedule is active. See `docs/BACKUPS.md` for verification and restore limits.

Credentials exposed earlier in setup conversations/logs still require owner rotation. Follow `docs/ROTATE_SECRETS.md`; do not rotate ad hoc.

## Publishing a real book

Use `docs/CONTENT_TEAM.md` to prepare the ZIP and parser, then `docs/ADMIN.md` to publish it.

Important rules:
- never edit `validate.py` or `audit.py` to force a package through;
- answers come from the source, never medical guessing;
- save the parser used for each layout;
- a failed queue item can be replaced by a corrected ZIP, retried, or cleared;
- GitHub release operations use the workflow `GITHUB_TOKEN`, not `DISPATCH_TOKEN`;
- normal answer/study activity must not depend on D1.

## Bot commands

Current owner commands:
`/help`, `/status`, `/queue`, `/books`, `/warnings BOOK-ID`, `/flags`, `/flags QID`,
`/flags approve-all BOOK-ID CONFIRM`, `/hold QID PAGE`, `/retry BOOK-ID_vN`,
`/clear BOOK-ID_vN`, `/republish BOOK-ID_vN`, `/rollback BOOK-ID VERSION`, and `/remove BOOK-ID`.

See `docs/ADMIN.md` for exact behavior and recovery steps.

## Before a 20–50 student pilot

1. Rotate all previously exposed credentials and verify Deploy Kafu + Setup Kafu Bot + Drain Kafu.
2. Check subsequent weekly backup runs and private release pairs; the first run passed.
3. Package the first real book with a committed/tested parser and a clean audit/validator result.
4. Publish it, check `/queue`, `/books`, the Mini App, images, Review Due, and offline chapter/book save.
5. Test personal sync on two Telegram devices/accounts as intended.
6. Run the iPad fullscreen diagnostic documented in `docs/IPAD_FULLSCREEN_TEST.md`.
7. Keep the pilot small (20–50 students), watch Cloudflare/GitHub free-tier usage, queue failures, and content reports before wider launch.

## Security

Runtime secrets: `BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `WEBHOOK_SECRET`, `QUEUE_API_TOKEN`, `DISPATCH_TOKEN`. Deployment also uses `D1_DATABASE_ID`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN`.

Never print secret values in commands, reports, screenshots, logs or chat.

## Day 1 design continuation

Read docs/DESIGN.md before UI edits. Task 1 merged PR #29; task 2 PR #30 adds one-hand feedback, modal keyboard behavior and cancellable deletion without altering saved formats. Undo uses a 6-second in-memory grace period before destructive writes, not restoration after deletion. Its timer defaults must preserve the global browser receiver. Browser tests and screenshots are required for each UI PR, including phone/iPad light/dark. Expected raw-pixel hashes in tools/ui/visual-baselines.json require deliberate inspection; never automatically approve them in CI.

Continue tasks 3-8 in order, each on a separate branch/PR. A new persistent onboarding or preferences record requires migration tests and an open owner-review PR; continue independent tasks on main rather than merging storage changes. Do not operate the production publish queue during design. Do not change credentials or deployment bindings. End-of-day evidence belongs in docs/reports/DAY_1_DESIGN.md.

## Arcade-Clean design series

Owner selected **Arcade-Clean** for DESIGN 1/10: premium mobile-game shell (chunky rounded shapes, thick outlines, hard offset shadows, pressable 3D controls, saturated colour and restrained playful motion) around a calm study core. Pixel art is rare accent only. `docs/DESIGN_STYLE.md` and `app/design/tokens.css` are the visual source of truth. Owner gave explicit full DESIGN 1 visual approval and PR #40 squash-merged as `13cdf3d2341fa24c591f41aac5d662182e3037c7`. Final PR CI was green (Content 36468810717; Visual/Flow 36468810686), including A->B->A isolation and budgets. Approved before/after evidence is retained at `docs/design/design1-approved/contact-sheet.webp`. Every later design prompt uses tokens only, adds component/state coverage to `#gallery`, preserves behavior/progress, keeps JS+CSS <=150 KB gzipped and WOFF2 <=100 KB, and remains open for owner review; design PRs never self-merge.

Deployment now follows the staged order in `MCQ_PLATFORM_FINAL_PLAN.yaml`: upload a Worker version, smoke its exact Version URL, promote only after PASS, then smoke production. Run 36469423661 passed this sequence for build `492f71bdbaadc94c528c8068dcefc096b81499ac`; Worker version `61399cd9-5046-4d0d-b4be-1c2f069d861b` was promoted to 100% and production smoke passed with protected `KAFU-UPLOAD-TEST v1`.

**Stop point:** DESIGN 1 is complete. Do not start the next owner-gated task until the owner says: `DESIGN 1b — question screen parity`.
