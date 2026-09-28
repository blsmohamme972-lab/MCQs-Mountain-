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
11. Owner docs merged PR #22; combined Night 1 report merged PR #23 with green CI. Owner selected “All passed” on 2026-09-28 for latest phone tests; no new itemized screenshot evidence in that update.
12. CI minute reduction PR #28 merged: PR/main only, docs-only path exclusion and same-branch cancellation. September snapshot 148 Actions minutes through 06:39 UTC (93 Content Contract CI). See docs/reports/ACTIONS_USAGE_2026-09.md.

## Day 1 design mission

1. Design system merged PR #29 at 4807941a990e768ac0590f6332623ec7cfd60a81. Content CI 36394630895 and Visual/Flow CI 36394630889 green. DESIGN.md first, semantic tokens/shared components, hidden styleguide and pinned self-hosted fonts. Inspected phone/iPad light/dark evidence. Initial app JS 74,413 bytes gzip; physical 4G performance remains unverified.
2. Ease of use merged PR #30 at 239c800452e11eb6d42873ad9d35a8e10e35d07a. Exact-head Content CI 36399013132 and Visual/Flow CI 36399012848 green. One-tap Continue, helpful feedback, modal focus/Escape and a separate 6-second Undo notice; browser tests exercise cancellation/expiry and unchanged saved progress.
3. Onboarding merged PR #31 at d3febcf0e39e05a94b4def02ea71e8bc168ee03c after explicit conditional owner approval. All four conditions confirmed: additions only; returning users skip; old version ignores the new key; actual old/new/old browser test compares every previous IndexedDB record including sync/pack/image bytes. Content CI 36403447538 and Visual/Flow CI 36403447528 passed on exact head 913442285099b7ec884385aae933d55ea3d04509. Approved phone/iPad light/dark screenshots. New key only: ui_onboarding_user_<id> in existing meta store; no database/store/version or sync changes.
4. Study polish in progress on day1/04-study-polish. Comfortable reading column, labelled correct/wrong options, accessible question progress, reduced-motion-aware transitions, new session/complete score screen and session-only Review mistakes. Summary is in memory only; resumed/skipped questions cannot falsely earn perfect. No saved format changes. New unit/Playwright tests must pass alongside all previous journeys and screenshot comparison before merge.
5-8. Next: tasteful delight; Library/Home; accessibility; centralized configuration/strings and change recipes, then final report.

Owner's four migration conditions apply to ALL later data additions today. Do not self-merge any non-additive/unproven change. No production queue tests, credential/account changes or infrastructure changes. Final evidence and remaining requirements belong in docs/reports/DAY_1_DESIGN.md.
