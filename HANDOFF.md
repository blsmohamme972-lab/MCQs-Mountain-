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

## Still owner-controlled

PR #20 (weekly D1 backups) is **open** as checked on 2026-09-28. Its CI is green, but no backup workflow run exists. It intentionally stayed outside automatic self-merge because it introduces a scheduled production D1 export.

The owner selected “All passed” for the latest phone tests on 2026-09-28. This is an overall owner report without itemized checks in this update; see `docs/reports/NIGHT_1.md`. Credentials exposed earlier in setup conversations/logs still require owner rotation. Follow `docs/ROTATE_SECRETS.md`; do not rotate ad hoc.

## Publishing a real book

Use `docs/CONTENT_TEAM.md` to prepare the ZIP and parser, then `docs/ADMIN.md` to publish it.

Important rules:
- never edit `validate.py` or `audit.py` to force a package through;
- answers come from the source, never medical guessing;
- every source question is extracted or explicitly skipped;
- save the parser used for each layout;
- a failed queue item can be replaced by a corrected ZIP, retried, or cleared;
- GitHub release operations use the workflow `GITHUB_TOKEN`, not `DISPATCH_TOKEN`;
- normal answer/study activity must not depend on D1.

## Bot commands

Current owner commands:
`/help`, `/status`, `/queue`, `/books`, `/flags`, `/flags QID`,
`/flags approve-all BOOK-ID CONFIRM`, `/hold QID PAGE`, `/retry BOOK-ID_vN`,
`/clear BOOK-ID_vN`, `/republish BOOK-ID_vN`, `/rollback BOOK-ID VERSION`, and `/remove BOOK-ID`.

See `docs/ADMIN.md` for exact behavior and recovery steps.

## Before a 20–50 student pilot

1. Rotate all previously exposed credentials and verify Deploy Kafu + Setup Kafu Bot + Drain Kafu.
2. Decide whether to merge/activate PR #20, then verify the first backup if enabled.
3. Package the first real book with a committed/tested parser and a clean audit/validator result.
4. Publish it, check `/queue`, `/books`, the Mini App, images, Review Due, and offline chapter/book save.
5. Test personal sync on two Telegram devices/accounts as intended.
6. Run the iPad fullscreen diagnostic documented in `docs/IPAD_FULLSCREEN_TEST.md`.
7. Keep the pilot small (20–50 students), watch Cloudflare/GitHub free-tier usage, queue failures, and content reports before wider launch.

## Security

Runtime secrets: `BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `WEBHOOK_SECRET`, `QUEUE_API_TOKEN`, `DISPATCH_TOKEN`. Deployment also uses `D1_DATABASE_ID`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN`.

Never print secret values in commands, reports, screenshots, logs or chat.
