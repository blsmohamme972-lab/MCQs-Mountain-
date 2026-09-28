# Kafu - PROGRESS

Updated: 2026-09-28. Night 1 tracker. Protected book: KAFU-UPLOAD-TEST v1, 4 questions, 1 chapter, 2 images. No production upload/retry/remove tests. English-only, local-first, unchanged D1 roles and permanent IDs.

1. Security merged PR #12; CI 36365428074, Deploy #13 / 36365507996 green. Source scanning/redaction; owner must rotate earlier chat/log-exposed credentials via docs/ROTATE_SECRETS.md. No tokens changed tonight.
2. M3 merged PR #13; CI 36365955918, Deploy #14 / 36365997924 green. Real SQLite/offline package acceptance, atomic recovery and protected completion.
3. Personal sync merged PR #14; CI 36366998955, Deploy #15 / 36367150537 green. Compact complete personal state, device merge/tombstones, safe 716-key snapshots and account isolation.
4. Review Due merged PR #15; CI 36367815492, Deploy #16 / 36367874408 green. Hash-pinned ts-fsrs 5.4.2, offline rating sessions and real SDK/UI tests.
5. Invisible downloads merged PR #16; CI 36368466085, Deploy #17 / 36368505401 green. Text-first, background images, next-only prefetch, whole-book save/size, persistent offline marks and bundled safe ZIP decoding.
6. UX merged PR #17; CI 36368718204, Deploy #18 / 36368782663 green. Me version/commit/source, offline banner, opt-in iPad fullscreen diagnostics; live guard checks exact build commit too.
7. Offline shell merged PR #18; CI 36369148074, Deploy #19 / 36369225189 green including app/build/protected-book guard. Atomic shell/public assets cache, network-first valid catalog, API/auth exclusion, no forced update, graceful unsupported Telegram/iOS fallback.
8. Privacy/disclaimer merged PR #19; CI and Deploy #20 green. Me → Privacy and About, once-per-device/account acknowledgement, permanent educational-only notice, explicit local-only report limitation and honest deletion/provider-backup scope.
9. Weekly backup remains prepared in open PR #20 with green CI 36369953015. GitHub still shows it unmerged and there is no backup workflow run; owner activation and first-run verification are pending.
10. Content-production tooling merged PR #21; CI green and Deploy Kafu green with exact-build/app/protected-book verification. Includes tools/parsers, package_batch PDF→audit→validate flow, reusable parser delivery in MASTER_PROMPT, docs/CONTENT_TEAM.md, and confirmed /flags bulk warning approval.
11. Owner docs merged in PR #22; main CI 36387443669 green. `docs/ADMIN.md` covers publishing, every owner command, and ❌ recovery.
12. Owner selected “All passed” for the latest phone tests on 2026-09-28; no individual check details or screenshots were supplied in this update, so no specific failure is identified. Combined report: `docs/reports/NIGHT_1.md`.

One task per branch/PR; green tested code only without secret/account/infrastructure setting changes. Verify deployment/read-only app/build/book guard after each merge. No temporary production triggers. Push each task. Final morning report: docs/reports/NIGHT_1.md.
