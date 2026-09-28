# Kafu - PROGRESS

Updated 2026-09-28. Protected production book KAFU-UPLOAD-TEST v1 (4 questions, 1 chapter, 2 images). No production queue tests during design. English-only/offline-first; no credential/account/infrastructure changes.

## Earlier work

Night 1 PRs #12-19 and #21-23 merged: secure publishing, atomic recovery, sync, FSRS Review Due, background downloads, offline shell, privacy, content tools and owner report. Weekly backup #20 merged with owner approval; first run 36389139180 passed. CI minute reduction #28 merged. Content tooling merged PR #21. Owner docs merged PR #22. Combined Night 1 report merged PR #23. See HANDOFF.md and docs/reports/ for evidence. Prior exposed credentials require owner rotation, skipped during design.

## Day 1 ordered mission

1. Design system #29 merged; Content 36394630895 and Visual/Flow 36394630889 passed.
2. Ease of use #30 merged; Content 36399013132 and Visual/Flow 36399012848 passed. Continue, feedback, sheet keyboard behavior and 6-second Undo.
3. Onboarding #31 merged with four conditional owner safeguards including actual old/new/old DB preservation. Content 36403447538 and Visual/Flow 36403447528 passed. Only additive local key; no sync changes.
4. Study polish #32 merged; Content 36405085144 and Visual/Flow 36405085192 passed. Readable study and honest completion/mistake review; no new saved fields.
5. Delight #33 merged (2d1e03ec449c51a526b8875cf562b4b5611d54a1); exact-head Content 36410090318 and Visual/Flow 36410090320 passed. Badges/streak derive from synced answers/active dates. Fresh-device roundtrip and rollback proof passed. Local key only suppresses celebrations. Chapter mastered is known-correct-per-question, not a historical perfect-session claim.
6. Home/Library #34 merged (22afa6a416c6d8eca91fbf7a8ab5b69eb1b00921); exact head b13a241839ddfb7f1073d1695c0648516705f3e9 Content 36413005498 and Visual/Flow 36413005462 passed. Reviewed artifact 10964832631. Stable title-search covers, specialty filters, honest progress/offline labels, Continue, daily goal and Review Due. No new saved fields. Reviewed measurement 90,743 gzip bytes; next question 2.1-14.4ms in CI.
7. Accessibility in progress on day1/07-accessibility: computed contrast, meaningful boundaries, names/focus, all existing text-size settings and 200% text-only reflow. No new saved preference values. Browser/evidence and both exact-head CIs required before merge; manual screen-reader checks remain distinct.
8. Next: centralized strings/config, change recipes, final test coverage and DAY_1_DESIGN.md.

Four owner safeguards apply to all later saved-data additions. Every UI merge requires inspected before/after phone390/iPad820 light/dark evidence and exact-head Content+Visual/Flow success. Never auto-approve expected screenshots in CI. Physical-phone first-open 4G remains unverified. No secrets, infrastructure or production queue experiments.
