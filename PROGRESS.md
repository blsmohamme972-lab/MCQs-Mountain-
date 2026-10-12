# Kafu - PROGRESS

Updated 2026-09-30. Protected production book: KAFU-UPLOAD-TEST v1 (4 questions, 1 chapter, 2 images). No production queue tests during design. English-only/offline-first; no credential/account/infrastructure changes.

## Leaders tab and XP ledger — 2026-10-12

- Merged #129 (Leaders tab, leagues, profiles), #130 (studying-now count), #131 (fair leagues and the specialist
  review fixes), #132 (XP ledger), #133 (idle prefetch, offline pictures). Each passed Content Contract and Visual/Flow
  CI and deployed through the normal Deploy Kafu run. Details, costs and the next steps: `docs/LEADERS.md`.

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
8. **DESIGN 1/10 Arcade-Clean approved and merged in PR #40** as squash commit `13cdf3d2341fa24c591f41aac5d662182e3037c7`. Owner approved all 29 reviewed visual changes; baseline commit `2b0e03072136c64fd7b13c1c34805705e59f2f34` used the exact reason `DESIGN 1 Arcade-Clean approved by owner`. Final PR head `a3d3cb016d14e5c532c92b6c8b855ec1abdb0474` passed Content Contract run 36468810717 and Visual/Flow run 36468810686 with zero visual differences, same-phone A->B->A isolation passing, next-question budget passing, JS+CSS 116,858/153,600 gzip bytes, and WOFF2 57,124/102,400 bytes. The approved 29-state before/after sheet is `docs/design/design1-approved/contact-sheet.webp`.

Four owner safeguards apply to every later saved-data addition. Before/after phone390 and iPad820 light/dark evidence and green Content + Visual/Flow CI are required for each UI merge. Never silently regenerate expected screenshots. Physical-phone first-open 4G remains unverified. No secrets, infrastructure or production queue experiments.

## DESIGN 1 deployment evidence

- Staged deployment workflow correction merged directly to `main` as `492f71bdbaadc94c528c8068dcefc096b81499ac` so app deployment follows the documented order: Worker version upload -> exact Version URL smoke -> 100% promotion -> production smoke.
- Deploy run 36469423661 uploaded Worker version `61399cd9-5046-4d0d-b4be-1c2f069d861b`, smoke-tested `https://61399cd9-kafu.blsmohamme97.workers.dev`, promoted it to 100%, then passed production smoke on `https://kafu.blsmohamme97.workers.dev` with protected `KAFU-UPLOAD-TEST v1` (4 questions).
- Next owner-gated design task: **DESIGN 1b — question screen parity**. Do not begin it until the owner gives that explicit go-ahead.

## Oxford MCQ book conversion — 2026-09-30

- Source: uploaded `OXFORD.pdf`, *SBA MCQs for the MRCS Part A*, Oxford University Press, 2013.
- Prepared `OXFORD-MRCS-A_v1.zip` for owner upload to the Telegram bot. Specialty/card: General Surgery. Edition is not stated in the source and was not inferred.
- Extracted 350 SBA questions: 50 questions in each of Chapters 1–7. All 350 printed answers matched by chapter and source question number. No questions skipped.
- Preserved stems, option text/order and printed answer keys. Copied explanation excerpts; Chapters 5 Q43 and 7 Q30 have empty explanation fields because the source supplies lists rather than enough complete prose. Their original source text is retained in `source_explanation`.
- Included seven linked explanation images: two diagram figures (Ch5 Q21 cardiac action potential; Ch6 Q15 facial nerve) and five tables (Ch1 Q38; Ch3 Q19; Ch5 Q33, Q34; Ch7 Q24). The owner was shown both diagram-linked questions, options, printed answers and extracted figures for review.
- Source audit: 350 matches, 0 mismatches. Rendered question pages were OCR-checked for numeric values; 18 OCR discrepancies were reviewed against page-image crops. Copied explanation words were checked against source word order.
- Ran the unchanged repository `tools/validate.py --require-audit` against the completed ZIP: PASS, 0 errors, 11 warnings. Package size: 400,169 bytes.
- Eight source/conversion flags were explained to the owner:
  - Ch1 Q3: printed key E; option C also conflicts with the book explanation.
  - Ch1 Q9: unusual printed creatinine unit, 89 mmol/L.
  - Ch5 Q2: unusual WCC threshold/unit combination in option E.
  - Ch5 Q6: source explanation states 10 mmol chloride in normal saline.
  - Ch5 Q19: source explanation does not explicitly justify keyed FNAC option D against radionuclide scanning.
  - Ch5 Q43: insufficient complete explanatory prose; original source list retained.
  - Ch6 Q32: duplicate printed D option labels; original text/order and source labels retained.
  - Ch7 Q30: TNM explanation is a classification list; original source text retained.
- Three additional validator warnings concern preserved line-break hyphens: Ch2 Q27, Ch2 Q30 and Ch3 Q7.
- Status: package delivered; owner intends to upload it personally. Bot upload, publication and live-app verification have not been confirmed.
- Repository access during conversion was read-only. This follow-up records progress only; application/import code and book content in the repository are unchanged.

## Surgery PreTest 14th edition conversion — 2026-09-30

- Source: owner-supplied `PRETEST 14.pdf`, *Surgery: PreTest Self-Assessment and Review*, 14th edition, McGraw-Hill Education, 2020; 335 text PDF pages, 14 chapters, continuous printed numbering 1–482.
- Final delivered package: `PRETEST-SURGERY-14E_v1.zip`; General Surgery; branch Surgery; medicine; textbook; English. Status: prepared, checked and delivered for the owner's own bot upload.
- Included 385 questions: 356 SBA and 29 EMQ. All 385 book-key answers independently matched; every numbered item is included or recorded in `book.json/skipped`.
- Explicitly skipped 97 Quick Fire free-response items because schema 1 has no free-response type and the source has no answer options. No options were invented. This is an illustrated release of all supported MCQs, not a claim that all 482 items are playable.
- Original question wording, option order, keys and copied explanation excerpts preserved. Reader-added notes/answer letters excluded by font evidence. Chemical charges, isotopes and Greek letters restored from original font/baseline evidence. Four source explanation tables retained as Markdown (Q35, Q85, Q114, Q132).
- Initial package omitted 17 unnumbered figures under MASTER_PROMPT section 5. The owner then reviewed an 18-page source review PDF, confirmed all 17 images were sound, explicitly authorized their attachment, and confirmed the source placement between each stem and its options. That explicit instruction overrides the numbered-caption omission for these exact mappings.
- Final package includes 17 question images, 0 explanation images, and the source cover. Images are cropped to the original figure rectangles, retaining overlaid labels; WebP quality 80, width at most 1200 px, each below 1,500,000 bytes. All 17 crops were visually reviewed and decode correctly.
- Confirmed image question IDs: 172, 207, 220, 266, 294, 304, 309, 318, 322, 359, 366, 375, 383, 436, 468, 470, 477. Each image is linked through that question's `images` field. All 17 obsolete image-omission flags cleared; remaining question flags: 0. Q477 retains both source pages 308–309.
- All 385 complete stems and 1,959 options compared with declared source pages; all explanation excerpts/table cells checked against answer pages. Eight source-backed base-parser tests passed. After figure attachment, all original stem/option/key/explanation fields were verified unchanged, all 17 mappings were checked against source stem/option placement, and the audited-source hash guard was tested.
- Unchanged `tools/audit.py` v2: 384 matches, 1 warning, 0 mismatches, 0 unverifiable. Remaining warning: Q224, PDF page 148, where the EuclidSymbol text layer encodes printed α/β as Latin a/b. Printed Greek glyphs were visually confirmed and preserved; source thresholds were not weakened. This question remains subject to the normal audit hold/review policy.
- Unchanged `tools/validate.py --require-audit`: **RESULT: PASS (6 warnings, 0 errors)**. Remaining warnings: three legitimate suspended-hyphen constructions (Q38, Q61, Q188); two symbol-insensitive duplicate-option warnings (Q239 C/D, whose < and > signs genuinely differ); one audit summary warning for Q224. Unchanged `tools/validate_release.py`: **RESULT: PASS**.
- Final measurements: 923,285 compressed bytes; 1,474,292 counted expanded bytes; 22 ZIP entries; maximum member ratio 43.379875:1. The complete illustrated book fits in one ZIP under the actual 19 MiB incoming limit; no split.
- ZIP SHA-256: `dea85f683636c6a44091830a1e3a84837769dea6cb2482801ea1fcb64dd76918`.
- Delivered rebuild artifacts: `pretest_surgery_14e.py`, `pretest_surgery_14e_metadata.json`, `pretest_surgery_14e_parser_note.txt`. The note contains the exact base package_batch command followed by the parser's `--attach-confirmed-figures` stage, which rebuilds the approved image map, source audit, report measurements and validation.
- Bot receipt, publication and live-app rendering have **not** been confirmed. Source placement/mapping verification is not a claim about the app's current display order. No bot upload, content publication, application/import-code edit or production queue operation was performed in this progress-recording task.
