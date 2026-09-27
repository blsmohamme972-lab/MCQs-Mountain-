# Kafu — PROGRESS

Last updated: 2026-09-28

## Current milestone

**M3 — Bot upload layer**

Status: **M2 Step 2 DONE; M3 Step 3 merged with CI green; Deploy Kafu #9 green; Setup Kafu Bot #1 green; basic Telegram Mini App smoke test passed; queue/admin phone acceptance still pending**

Current documentation branch:
`docs/m3-account-secret-empty`

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

[Deploy Kafu #9](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36359745068) completed **successfully** after the workflow was changed to upload Worker secrets with an explicit `wrangler.app.jsonc` config. D1 migrations, Worker secret upload, and Worker deployment all passed.

[Setup Kafu Bot #1](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36359890053) completed **successfully**, registering the secure `/bot` webhook and owner commands.

The owner then opened Kafu inside Telegram and confirmed the Mini App loads and Continue studying works. This is a basic live smoke test only; the full Step 3 queue/admin acceptance checklist in `docs/reports/M3_DEPLOY_RETRY.md` is still pending.

Earlier failures:
- Deploy Kafu #8 failed at D1 with Cloudflare 7403 because `CLOUDFLARE_ACCOUNT_ID` was empty in Actions.
- A retry fixed D1 but exposed a separate `wrangler-action` secret-upload issue where the custom config was not used and the Worker name was therefore missing.
- The direct Wrangler workflow now avoids that issue.

## Next

Run the remaining Step 3 owner phone acceptance in `docs/reports/M3_DEPLOY_RETRY.md`: owner admin commands, synthetic ZIP queue publish, duplicate handling, invalid package repair report, multipart release, moderation, rollback/remove, and non-owner silence. Remove synthetic fixture books with `/remove` before public launch.
