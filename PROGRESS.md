# Kafu - PROGRESS

Updated: 2026-09-28. Night 1 tracker. Protected: KAFU-UPLOAD-TEST v1, 4 questions, 1 chapter, 2 images. No production upload/retry/remove acceptance tests. Preserve English UI, permanent IDs, fallback Library, local progress and D1 roles.

1. Security merged PR #12; CI 36365428074, Deploy #13 / 36365507996 green. Current-source scanner and safe HTTP logging; owner rotation still required for previous chat/log exposure, docs/ROTATE_SECRETS.md. No credentials changed.
2. M3 merged PR #13; CI 36365955918, Deploy #14 / 36365997924 green. Real SQLite/offline ZIP acceptance and atomic recovery/completion protection.
3. Personal sync merged PR #14; CI 36366998955, Deploy #15 / 36367150537 green. Compact complete personal summaries, deterministic device merge, tombstones, history limits, 716-key budget and safe immutable checkpoints.
4. Review Due merged PR #15; CI 36367815492, Deploy #16 / 36367874408 green. Hash-pinned ts-fsrs 5.4.2, offline due sessions, explicit ratings, real SDK/UI tests.
5. Invisible downloads merged PR #16; CI 36368466085, Deploy #17 / 36368505401 green with app/protected-book guard. Text-first study, background images, next-only prefetch, whole-book save with honest size, persistent-only offline mark, ZIP size/name safety and image-dependent grading guard. fflate 0.8.3 version/hash pinned.
6. UX diagnostics implemented on night1/06-ux-diagnostics; awaiting CI. Me version/commit/catalog source, offline banner and temporary user-invoked fullscreen diagnostic with version/platform/state/result, no private data or automatic fullscreen. Tests cover unsupported clients and real Me view.
7. Offline app shell: pending.
8. Privacy/disclaimer: pending.
9. Weekly backup: pending; infrastructure-sensitive changes stay open.
10. Parser/batch/content-team/bulk moderation: pending.
11. Final docs/report: pending.

One task per branch/PR. Merge only tested green changes without secrets/account/infrastructure setting changes; verify Deploy Kafu and read-only protected app/book check after each merge. No temporary production triggers. Tools/docs-only changes retain the last verified deployment. Push each task. Final report: docs/reports/NIGHT_1.md.
