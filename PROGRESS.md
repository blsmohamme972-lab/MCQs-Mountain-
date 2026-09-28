# Kafu - PROGRESS

Updated: 2026-09-28. Protected deployment-check book: KAFU-UPLOAD-TEST v1, 4 questions, 1 chapter, 2 images. No production upload/retry/remove tests during design. English-only, local-first, unchanged D1 roles and permanent IDs.

## Completed before Day 1 design

1. Security merged PR #12; CI 36365428074, Deploy #13 / 36365507996 green. Source scanning/redaction; owner must rotate earlier chat/log-exposed credentials via docs/ROTATE_SECRETS.md.
2. M3 merged PR #13; CI 36365955918, Deploy #14 / 36365997924 green. Real SQLite/offline package acceptance, atomic recovery and protected completion.
3. Personal sync merged PR #14; CI 36366998955, Deploy #15 / 36367150537 green. Compact complete personal state, device merge/tombstones, safe 716-key snapshots and account isolation.
4. Review Due merged PR #15; CI 36367815492, Deploy #16 / 36367874408 green. Hash-pinned ts-fsrs 5.4.2, offline rating sessions and real SDK/UI tests.
5. Invisible downloads merged PR #16; CI 36368466085, Deploy #17 / 36368505401 green. Text-first, background images, next-only prefetch, whole-book save/size, persistent offline marks and bundled safe ZIP decoding.
6. UX merged PR #17; CI 36368718204, Deploy #18 / 36368782663 green. Me version/commit/source, offline banner, opt-in iPad fullscreen diagnostics; live guard checks exact build commit too.
7. Offline shell merged PR #18; CI 36369148074, Deploy #19 / 36369225189 green including app/build/protected-book guard. Atomic shell/public assets cache, network-first valid catalog, API/auth exclusion, no forced update, graceful unsupported Telegram/iOS fallback.
8. Privacy/disclaimer merged PR #19; CI and Deploy #20 green. Me Privacy/About, once-per-device/account acknowledgement, permanent educational-only notice, explicit local-only report limitation and honest deletion/provider-backup scope.
9. Weekly D1 backup: PR #20 merged after owner approval and green CI. First manual run #1 (36389139180) succeeded; private d1-backups release has matching SQL and JSON assets. Weekly schedule is active.
10. Content tooling merged PR #21; CI and exact-build/app/protected-book deployment verification green. Parser library, package_batch, content-team guide and confirmed bulk audit-warning approval.
11. Owner docs PR #22 and combined Night 1 report PR #23 merged with green CI. Owner selected “All passed” on 2026-09-28 for latest phone tests; no new itemized screenshot evidence in that update.
12. CI minute reduction PR #28 merged: PR/main only, docs-only path exclusion and same-branch cancellation. September snapshot 148 Actions minutes through 06:39 UTC (93 Content Contract CI). See docs/reports/ACTIONS_USAGE_2026-09.md.

## Day 1 design mission

1. Design system: draft PR #29 on day1/01-design-system. docs/DESIGN.md was committed before UI changes. Semantic tokens, shared components, hidden styleguide and self-hosted-font build are under test. The artifact-only bootstrap did not constitute visual/flow coverage. The replacement read-only CI job runs isolated browser journeys and screenshot checks; missing or changed baselines fail until screenshots have been inspected and deliberately approved. Local Chromium is administrator-policy blocked, so browser validation runs in Actions. No production state, hosting bindings or personal-state format changes.

Tasks 2-8 follow in order, each on its own branch/PR. Persistent-format/infrastructure changes stay open for owner review. Final evidence and unresolved requirements belong in docs/reports/DAY_1_DESIGN.md. Keep HANDOFF.md current. No temporary production triggers.
