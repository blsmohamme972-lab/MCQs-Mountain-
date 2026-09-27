# Kafu — PROGRESS

Last updated: 2026-09-27

## Current milestone

**M3 — Bot upload layer**

Status: **M2 Step 2 DONE; M3 Step 3 merged with CI green; Deploy Kafu retry attempt 2 failed at D1 7403; webhook and phone test pending**

Current documentation branch:
`docs/m3-deploy-handoff-20260928`

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

## Latest deployment check (2026-09-28 Baghdad)

[Deploy Kafu run #7, attempt 2](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36352381336) failed again at D1 migrations with Cloudflare 7403 (account invalid or unauthorized for the D1 query); Worker deployment was skipped. The owner had reported adding D1 Edit before this retry. Setup Kafu Bot has no run yet. Step 3 phone acceptance remains pending. Detailed report and checklist: `docs/reports/M3_DEPLOY_RETRY.md`. Operational handoff: `HANDOFF.md`.

## Next

PR #4 merged on 2026-09-28 with owner-only webhook, D1 queue, serialized Actions drain, image decoding, reports and admin controls. CI passed. Deploy Kafu run 36352381336 failed at D1 migration with Cloudflare 7403 (account unauthorized); Worker deploy skipped. Check D1 account and grant Account → D1 → Edit to the Cloudflare API token in the same account, update `CLOUDFLARE_API_TOKEN`, then rerun Deploy Kafu. Run Setup Kafu Bot only after the deploy succeeds. Phone acceptance remains; see `docs/reports/M3_STEP3.md`. Remove fixture books with `/remove` before public launch.
