# Night 1 — Kafu implementation and acceptance checkpoint

Date: 2026-09-28 (Asia/Baghdad). Repository: `blsmohamme972-lab/MCQs-Mountain-`.

## What was delivered

| Task | Result | Evidence |
|---|---|---|
| Security and safe diagnostics | PR #12 merged; credential-rotation procedure in `docs/ROTATE_SECRETS.md` | CI 36365428074; Deploy 36365507996 green |
| Bot queue and admin recovery | PR #13 merged; real SQLite/offline acceptance, atomic failed-item recovery and protected completion | CI 36365955918; Deploy 36365997924 green |
| Personal sync | PR #14 merged; compact cross-device state, deterministic merge and tombstones | CI 36366998955; Deploy 36367150537 green |
| Review Due | PR #15 merged; pinned `ts-fsrs 5.4.2` and offline rating sessions | CI 36367815492; Deploy 36367874408 green |
| Background downloads | PR #16 merged; text-first images, next-chapter prefetch, whole-book save and offline marks | CI 36368466085; Deploy 36368505401 green |
| Me diagnostics | PR #17 merged; version/source and opt-in iPad fullscreen diagnostic | CI 36368718204; Deploy 36368782663 green |
| Offline shell | PR #18 merged; safe shell/assets cache and catalog fallback | CI 36369148074; Deploy 36369225189 green |
| Privacy and educational notice | PR #19 merged | CI and Deploy 36369479456 / 36369479431 green |
| Reusable content production | PR #21 merged; `tools/parsers/`, `tools/package_batch.py`, parser delivery in `tools/MASTER_PROMPT.md`, `docs/CONTENT_TEAM.md`, two-step `/flags approve-all` | CI 36387139489; main CI 36387183500; Deploy 36387183574 green |
| Owner documentation | PR #22 merged; `HANDOFF.md`, `PROGRESS.md`, `docs/ADMIN.md` | main CI 36387443669 green |

The latest app deployment checked here is [Deploy Kafu 36387183574](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36387183574), successful after PR #21. The subsequent PR #22 changed documentation and its [main CI 36387443669](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36387443669) passed. The protected `KAFU-UPLOAD-TEST v1` book (4 questions, 1 chapter, 2 images) remains the read-only deployment guard. No production upload, retry or remove test was performed for this report.

## Owner phone acceptance

On 2026-09-28, the owner selected **“All passed”** for the latest phone tests. The message did not itemize checks or provide new screenshots, so this records the owner's overall result; it does not claim an independent reproduction of every device scenario. No failed phone test was reported to fix. If a specific failure is later supplied, fix it before the first real book.

## Weekly D1 backup

[PR #20](https://github.com/blsmohamme972-lab/MCQs-Mountain-/pull/20) is **open**, despite the placeholder statement that it had merged. Its [CI 36369953015](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36369953015) passed. The proposed weekly workflow is not on main, and no backup workflow run exists. `docs/BACKUPS.md` on that PR describes the intended private export, bounded verification and retention. Merging it activates a scheduled production D1 export; the owner must make that choice, then check the first run. No backup is recorded as successful.

## Still needed before the first real book

1. Rotate the previously exposed credentials using `docs/ROTATE_SECRETS.md`; then run Deploy Kafu, Setup Kafu Bot and Drain Kafu and verify each result. Do not copy credentials into reports or logs.
2. Use `docs/CONTENT_TEAM.md` and a committed, tested layout-specific parser to create a real-book ZIP. Check rights, source wording and answers, skipped/flagged counts, images, audit, both validators and a sample of source pages.
3. Publish the validated ZIP through the private owner chat using `docs/ADMIN.md`. Verify `/queue`, `/books`, the Mini App, images, answer/explanation, Review Due and offline save. Keep `KAFU-UPLOAD-TEST` while the deployment guard uses it.
4. Decide whether to activate PR #20 and verify a successful private backup. Confirm an off-GitHub copy of source PDFs and important content state.
5. Complete the iPad fullscreen check in `docs/IPAD_FULLSCREEN_TEST.md` if that device matters to the pilot.

## Before 20–50 students

Complete the first real book checks above, test personal sync on two intended devices/accounts, inspect privacy notice and permissions, and monitor queue failures plus Cloudflare/GitHub usage during a small pilot. Normal offline studying must remain available even if D1 is unavailable. Do not manually alter the `kafu-content-state` release, and do not weaken `validate.py` or `audit.py` to pass content.
