# Kafu - PROGRESS

Updated: 2026-09-28. Night 1 tracker. Protected: KAFU-UPLOAD-TEST v1, 4 questions, 1 chapter, 2 images. No production upload/retry/remove tests. Preserve English UI, stable IDs, non-empty fallback Library, local progress and D1 roles.

## Night 1, in order

1. Security merged PR #12; CI 36365428074, Deploy #13 / 36365507996 green. Scanner/redaction/redirect/size tests; old chat/log exposure requires owner docs/ROTATE_SECRETS.md. No credentials rotated.
2. M3 merged PR #13; CI 36365955918, Deploy #14 / 36365997924 green. Real SQLite and offline package acceptance; atomic recovery, owner/private gates and stale-completion protection.
3. Personal sync merged PR #14; CI 36366998955, Deploy #15 / 36367150537 green. Compact history/stars/FSRS/time/streak/resume, per-device merge, manifest-last checkpoints, 716-key budget and account isolation. Full events stay local; old unknown history is not fabricated.
4. Review Due merged PR #15; CI 36367815492, Deploy #16 / 36367874408 green including protected-book/app guard. Real ts-fsrs 5.4.2 bundled with SHA-256 and MIT license, due count, explicit offline review ratings and actual UI lifecycle tests. No runtime CDN/backend.
5. Invisible downloads implemented on night1/05-invisible-downloads, awaiting CI/hash review. Text opens before image ZIP; next-chapter prefetch only, sequential whole-book save with size/partial progress, persistent-only offline mark, bounded ZIP extraction, retry and version-aware offline fallback. fflate 0.8.3 bundled locally. All tests synthetic/mocked.
6. UX/fullscreen diagnostics: pending.
7. Offline shell: pending.
8. Privacy/disclaimer: pending.
9. Weekly backup: pending; infrastructure-sensitive changes stay open.
10. Parser/batch/content-team/bulk moderation: pending.
11. Final docs/report: pending.

One branch/PR per task; green covered code only, no account/secrets/infrastructure setting changes. Deployment code-build/read-only checks preserve existing permissions, bindings and triggers. Verify live app/protected catalog after every merge. Push progress each task. Final report: docs/reports/NIGHT_1.md.
