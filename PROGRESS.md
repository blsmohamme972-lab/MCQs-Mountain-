# Kafu - PROGRESS

Updated 2026-09-28. Protected production book: KAFU-UPLOAD-TEST v1 (4 questions, 1 chapter, 2 images). No production queue tests during design. English-only/offline-first; no credential/account/infrastructure changes.

## Earlier work

Night 1 PRs #12-19 and #21-23 merged: secure publishing, atomic queue recovery, personal sync, FSRS Review Due, background downloads, offline shell, privacy, content tools and owner report. Weekly backup PR #20 merged with owner approval; initial backup run 36389139180 passed. CI cost reduction PR #28 merged. Content tooling merged PR #21. Owner docs merged PR #22. Combined Night 1 report merged PR #23. See HANDOFF.md and docs/reports/ for exact earlier evidence. Previously exposed credentials require owner rotation, skipped during design.

## Day 1 ordered mission

1. Design system merged #29 (4807941a990e768ac0590f6332623ec7cfd60a81), Content 36394630895 and Visual/Flow 36394630889 green. Tokens/components/styleguide/self-hosted fonts and inspected phone/iPad light/dark evidence.
2. Ease of use merged #30 (239c800452e11eb6d42873ad9d35a8e10e35d07a), Content 36399013132 and Visual/Flow 36399012848 green. One-tap Continue, feedback, sheet focus and 6-second Undo.
3. Onboarding merged #31 (d3febcf0e39e05a94b4def02ea71e8bc168ee03c), owner four safeguards confirmed with actual old/new/old DB proof. Content 36403447538 and Visual/Flow 36403447528 green. Only additive local key, no sync changes.
4. Study polish merged #32 (87eb5e544afe7b39bd952323cd385f06d6df9e74), Content 36405085144 and Visual/Flow 36405085192 green. Readable study, labelled grading and honest completion/mistake review. No new saved fields.
5. Delight merged #33 (2d1e03ec449c51a526b8875cf562b4b5611d54a1), exact head e364c2cec6079fed5414486da2fe0bcc98728768: Content 36410090318 and Visual/Flow 36410090320 green. Badges/streak now derive from synced answers/active dates, not local flags. Actual empty-new-device CloudStorage roundtrip restores four badges and seven-day streak; old/new/old DB preservation passes. Cosmetic celebration suppression only in ui_delight. Fourth badge honestly labelled Chapter mastered; old sync cannot prove a historical perfect session. Reviewed artifact 10963463906. App JS 86,529 gzip bytes; next question 2.2-15ms in CI, not physical phone certification.
6. Home/Library in progress on day1/06-home-library: title search, specialty filters, cover/progress/offline states, one-tap Continue, 10-minute goal derived from synced study time and real Review Due. Filters are session-local; no saved fields or sync change. Unit tests pass; all prior plus new browser journeys, reviewed screenshots and both exact-head CIs required before merge.
7. Prior accessibility work remains unmerged/open and is not current-main evidence.
8. **DESIGN 1/10 Arcade-Clean foundation is open for owner visual approval in PR #40:** owner-selected premium mobile-game shell around a calm study core; token source of truth, Fredoka/Nunito/Pixelify self-hosted fonts, hidden `#gallery`, haptic/WebAudio foundation, and explicit design-prompt rules. This design PR must not self-merge. Exact-head CI + phone light/dark gallery screenshots are required before owner OK.

Four owner safeguards apply to every later saved-data addition. Before/after phone390 and iPad820 light/dark evidence and green Content + Visual/Flow CI are required for each UI merge. Never silently regenerate expected screenshots. Physical-phone first-open 4G remains unverified. No secrets, infrastructure or production queue experiments.
