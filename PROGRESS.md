# Kafu - PROGRESS

Updated 2026-09-28. Protected production book: KAFU-UPLOAD-TEST v1 (4 questions, 1 chapter, 2 images). No production queue tests during design. English-only/offline-first; no credential/account/infrastructure changes.

## Earlier work

Night 1 PRs #12-19 and #21-23 merged: secure publishing diagnostics, atomic queue recovery, personal sync, FSRS Review Due, background downloads, offline shell, privacy, content tools and owner report. Weekly backup PR #20 merged with owner approval; initial backup run 36389139180 passed. CI cost reduction PR #28 merged. See HANDOFF.md and docs/reports/ for exact earlier evidence. Previously exposed credentials still require owner rotation, skipped during design.

## Day 1 ordered mission

1. Design system: merged #29 (4807941a990e768ac0590f6332623ec7cfd60a81). Content 36394630895 and Visual/Flow 36394630889 green. Tokens/components/styleguide/self-hosted fonts; inspected phone/iPad light/dark screenshots.
2. Ease of use: merged #30 (239c800452e11eb6d42873ad9d35a8e10e35d07a). Content 36399013132 and Visual/Flow 36399012848 green. One-tap Continue, helpful states, sheet focus and separate 6-second Undo before deletion.
3. Onboarding: merged #31 (d3febcf0e39e05a94b4def02ea71e8bc168ee03c). Owner's four conditions confirmed, including actual old/new/old browser DB preservation. Exact head 913442285099b7ec884385aae933d55ea3d04509: Content 36403447538 and Visual/Flow 36403447528 green. Only new account-scoped local meta key; no old field/store/version/sync changes.
4. Study polish: merged #32 (87eb5e544afe7b39bd952323cd385f06d6df9e74). Exact head 278a822ba69027806ef1e4e40de588e8dd948dde: Content 36405085144 and Visual/Flow 36405085192 green. Readable column, labelled grading, reduced-motion transitions and honest session completion/Review mistakes. No persistence additions. App JS 82,787 gzip bytes; next question 2.2-7.6ms on CI browser, not physical 4G certification.
5. Tasteful delight: PR #33 on day1/05-tasteful-delight in progress. Owner refinement implemented: badges/streak derive from existing synced answers and active days. Only celebration suppression is local. Chapter mastered uses known-correct-per-question evidence, not an invented historical perfect session. Pure sync roundtrip tests pass locally; actual new-device/upgrade/rollback browser tests and exact-head CI/evidence still required before merge. No sync format changes.
6. Next: Library/Home search, specialty filters, progress and goal.
7. Next: accessibility/AA contrast/text size/iPad pass.
8. Next: centralized strings/config, recipes, final coverage and DAY_1_DESIGN.md.

Every UI PR needs inspected before/after phone390 and iPad820 light/dark evidence and both exact-head CIs. Never automatically regenerate expected screenshots inside CI. Real-device first-open 4G measurement remains pending. No secrets, formats or infrastructure may change without the specified approval/tests.
