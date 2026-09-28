# Kafu - PROGRESS

Updated: 2026-09-28. Night 1 tracker. Protected: KAFU-UPLOAD-TEST v1, 4 questions, 1 chapter, 2 images. English-only, local-first. No overnight production upload/retry/remove tests or token/account changes.

1. Security merged PR #12; CI and Deploy #13 green. Source scanner, safe diagnostics and docs/ROTATE_SECRETS.md. Earlier chat/log-exposed credentials still require owner rotation.
2. M3 merged PR #13; CI and Deploy #14 green. Real SQLite/offline package tests, atomic failed replacement/clear and completion guards.
3. Personal sync merged PR #14; CI and Deploy #15 green. Compact full personal summaries, two-device merge/tombstones, safe 716-key snapshots and account separation.
4. Review Due merged PR #15; CI and Deploy #16 green. Pinned ts-fsrs 5.4.2, offline review sessions, real SDK/UI tests.
5. Invisible downloads merged PR #16; CI and Deploy #17 green. Text-first/background images, next-only prefetch, whole-book save/size, honest persistent offline marks and pinned fflate.
6. UX merged PR #17; CI and Deploy #18 green. Me build/source, offline banner and opt-in iPad fullscreen diagnostic; exact build/app/book postdeploy verification.
7. Offline shell merged PR #18; CI and Deploy #19 green. Versioned public shell, network-first valid catalog, API/auth exclusions and unsupported-iOS fallback.
8. Privacy merged PR #19; CI 36369408980 green. Deploy #20 / 36369479431 initially missed the exact-build propagation check; a new deploy job attempt completed green including exact build, app shell and protected book. No code/account/secret changes were needed. The privacy page and once-only educational notice are live.
9. Weekly backup prepared on night1/09-weekly-backup; awaiting offline CI, then leave PR OPEN. It introduces a weekly production schedule and uses existing D1 access, so owner review/first off-peak run is required. No production export, permission changes or backup uploads performed tonight. See docs/BACKUPS.md.
10. Parser/batch/content-team/bulk moderation: next.
11. Final owner docs/morning report: next.

One branch/PR per task; merge only green tested code without secret/account/infrastructure settings changes. Deployment build/GET verification steps preserve existing triggers/bindings. No temporary production triggers. Push progress each task. Final report: docs/reports/NIGHT_1.md.
