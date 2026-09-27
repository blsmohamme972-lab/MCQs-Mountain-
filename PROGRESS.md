# Kafu — PROGRESS

Last updated: 2026-09-27

## Current milestone

**M3 — Bot upload layer**

Status: **M2 Step 2 DONE; M3 Step 3 implemented on branch, awaiting CI, credentials, deploy and phone test**

Branch:
`m3-bot-upload-queue`

## Library safety

Students must never see an empty or broken Library.

Current Step 2 logic:
- non-empty live published catalog → show published books
- empty live catalog → built-in sample books
- live request failure + non-empty cached published catalog → cached books
- otherwise → built-in sample books

CI locks this behavior.

## Automated proof complete

- all four question types: PASS
- question + explanation images: PASS
- image ZIP contract: PASS
- multipart release: PASS
- deliberately broken package: FAIL as expected
- repair_report.md artifact: PASS
- exact duplicate detection: PASS
- v2 stable permanent IDs: PASS
- simulated student progress survives v2: PASS
- live v1 publish: PASS
- live v2 publish: PASS
- catalog rollback: PASS
- takedown / removed_books: PASS
- final fixture state restored for phone testing: PASS
- Kafu Content Contract CI: PASS

Successful workflow:
https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36343339056

Report:
`docs/reports/M2_STEP2.md`

## Real phone proof complete

- PRs #1, #2, and #3 merged.
- Owner screenshots on 2026-09-27 show the fixture chapter in Telegram.
- SBA, MTF, multi-select, and EMQ screens render.
- Question and explanation WebP images render after replacing header-only fixture files.
- Airplane Mode screenshots show downloaded questions, both image types, an answered question, and a starred question after reopening.
- M2 Step 2 is DONE.

## Next

Owner-only secret-protected bot webhook, D1 queue, serialized Actions drain, full image decoding, success/failure reports and admin controls are implemented on `m3-bot-upload-queue`. Automated tests cover queue order and a broken WebP. Setup and owner phone acceptance remain; see `docs/SETUP_BOT.md` and `docs/reports/M3_STEP3.md`. Remove fixture books with `/remove` before public launch.
