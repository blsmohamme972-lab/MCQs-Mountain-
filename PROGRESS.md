# Kafu — PROGRESS

Last updated: 2026-09-27

## Current milestone

**M2 — Step 2: Fixture proof**

Status: **AUTOMATED PASS; real Telegram/offline phone check pending before merge**

Branch:
`m2-fixture-tests`

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

## Manual proof pending

Use Telegram on the phone to:
- see fixture in Library
- download chapter
- verify SBA/MTF/multi/EMQ
- verify question + explanation images
- answer a question
- enable Airplane Mode
- reopen downloaded chapter
- verify study + images + progress work with no network

## Next after phone proof

1. Mark M2 Step 2 DONE.
2. Merge the Step 2 PR.
3. Start **M3 — bot upload layer** on a new branch.
4. Do not publish real books before Step 2 is fully signed off.
