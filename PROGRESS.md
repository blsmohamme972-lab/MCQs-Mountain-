# Kafu - PROGRESS

Updated: 2026-09-28. Night 1 tracker. Protected live book: KAFU-UPLOAD-TEST v1, 4 questions, 1 chapter, 2 images. No production upload/retry/remove tests. English-only, local-first, unchanged D1 storage roles and permanent IDs.

1. Security merged PR #12; CI 36365428074, Deploy #13 / 36365507996 green. Current-source scanner/safe diagnostics. Owner must rotate earlier chat/log-exposed credentials using docs/ROTATE_SECRETS.md; none changed tonight.
2. M3 merged PR #13; CI 36365955918, Deploy #14 / 36365997924 green. Real SQLite bot + offline package/report/red-result tests and atomic recovery/completion guards.
3. Personal sync merged PR #14; CI 36366998955, Deploy #15 / 36367150537 green. Compact complete personal summaries, device merges/tombstones, 716-key budget, manifest-last snapshots and account separation.
4. Review Due merged PR #15; CI 36367815492, Deploy #16 / 36367874408 green. Hash-pinned ts-fsrs 5.4.2 with real offline UI tests.
5. Invisible downloads merged PR #16; CI 36368466085, Deploy #17 / 36368505401 green. Text-first, background images, next-only prefetch, whole-book save/size, verified persistent offline marks, bundled fflate and safe ZIP extraction.
6. UX merged PR #17; CI 36368718204, Deploy #18 / 36368782663 green. Me build/source info, offline banner and safe user-invoked fullscreen diagnostic. Postdeploy guard verifies exact deployed commit, app shell and protected book. See docs/IPAD_FULLSCREEN_TEST.md.
7. Offline app shell implemented on night1/07-offline-shell; awaiting CI/review. Versioned root SW caches atomic HTML/inline JS/icon/public fonts/SDK, network-first valid catalog, strict API/auth exclusion, bounded caches and no forced reload. Feature-detected registration never blocks unsupported Telegram/iOS clients. Physical cold-offline launch is not guaranteed on those clients; docs/OFFLINE_SHELL.md explains.
8. Privacy/disclaimer: pending.
9. Weekly backup: pending; infrastructure-sensitive changes stay open.
10. Parser/batch/content-team/bulk moderation: pending.
11. Final docs/report: pending.

One task per branch/PR; merge only covered green changes without secret/account/infrastructure settings changes. Verify Deploy Kafu and the read-only app/build/book guard after every merge. No temporary production triggers. Push progress each task. Final report: docs/reports/NIGHT_1.md.
