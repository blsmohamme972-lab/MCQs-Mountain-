# Kafu - PROGRESS

Updated: 2026-09-28. Night 1 tracker. Protected production book: KAFU-UPLOAD-TEST v1, 4 questions, 1 chapter, 2 images. Never remove or republish it during these tasks. English-only, local-first, unchanged D1 roles and permanent IDs.

## Night 1 in order

1. Security: merged PR #12; CI 36365428074, Deploy #13 / 36365507996 green, app/protected-book GET check passed. Tracked-source scanner and safe HTTP diagnostics added. Old chat/log exposure still requires owner rotation via docs/ROTATE_SECRETS.md; no credentials changed tonight.
2. M3: merged PR #13; CI 36365955918, Deploy #14 / 36365997924 green including app/book checks. Real SQLite bot acceptance and offline package/report/red-run tests; atomic failed replacement/clear, protected running/published work, identity/stale completion guards. No production tests.
3. Personal sync: merged PR #14; final CI 36366998955, Deploy #15 / 36367150537 green including assembled app and protected book. Compact complete personal summaries, correct/unknown history, stars/tombstones, FSRS, time/streak/resume, per-device merge, 716-key reserve, immutable manifests, account isolation and local answer events. See docs/PERSONAL_SYNC.md.
4. Review Due: implemented on night1/04-review-due; awaiting pinned dependency hash review and CI. Unmodified ts-fsrs 5.4.2 bundled into HTML, offline due sessions, explicit review ratings, deterministic tests against the real scheduler. No runtime CDN or backend calls. See docs/REVIEW_DUE.md.
5. Invisible/offline downloads: pending.
6. UX/fullscreen diagnostics: pending.
7. Offline app shell: pending.
8. Privacy/disclaimer: pending.
9. Weekly backup: pending; leave infrastructure-sensitive changes open.
10. Parser/batch/content team/bulk moderation: pending.
11. Final owner docs and morning report: pending.

## Rules

One task per branch/PR; merge only covered green changes without secret/account/infrastructure setting changes. After merge verify Deploy Kafu and its read-only app/book guard. Code-build/verification steps do not add production triggers or change bindings. Keep tools/docs-only merge verification explicit. Push progress each task. Final report: docs/reports/NIGHT_1.md.
