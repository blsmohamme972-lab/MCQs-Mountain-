# Kafu owner guide

This is the short operating guide for the private owner bot and book publishing flow. Kafu stays English-only.

## Publish a book

### Prepare the ZIP

Preferred repeatable path for a known PDF layout:

```bash
python tools/package_batch.py SOURCE.pdf \
  --parser YOUR_PARSER_NAME \
  --metadata metadata.json \
  --out-dir dist/packages
```

The parser lives in `tools/parsers/`. The command extracts, audits, creates the ZIP, and runs both validators. Do not publish until it ends with PASS.

For a new book layout, use `tools/MASTER_PROMPT.md` with the PDF. The AI must deliver both the validated ZIP and the parser it used. Save and test that parser before treating the book as reproducible.

### Send it to Kafu

1. In Telegram, open the private owner chat with `@KafuMcqsbot`.
2. Send the ZIP as a **document**, with the exact filename `BOOK-ID_vN.zip` or multipart names such as `BOOK-ID_vN_part1of2.zip`.
3. Wait for the bot to say it received the upload.
4. Send `/queue`. It should move through `ready` / `running` to `published`.
5. Send `/books`. Confirm the book/version/counts appear.
6. Open the Mini App and test at least one chapter, one image if present, and one correct/incorrect answer.
7. For a real launch, also test the saved-offline path before inviting students.

Do not upload PDFs to the bot. The bot accepts prepared ZIP packages only.

## Every owner command

- `/help` — show the command summary.
- `/status` — show queue counts by state.
- `/queue` — show recent publish/admin jobs and safe failure details.
- `/books` — show active published books.
- `/warnings BOOK-ID` — list warnings recorded for future publishes; optional review only.
- `/flags` — list legacy pending held questions.
- `/flags Q000000001` — open one flagged question's review actions: approve, reject, or show source page.
- `/flags approve-all BOOK-ID` — preview a bulk approval count only; makes no changes.
- `/flags approve-all BOOK-ID CONFIRM` — approve all currently pending warnings for that book and queue one moderation publish. Use only after checking the preview count.
- `/hold Q000000001 PAGE` — hold a question and record the PDF source page; queues moderation.
- `/retry BOOK-ID_vN` — requeue a **failed** complete upload. It does not republish an already published release.
- `/clear BOOK-ID_vN` — delete a **failed** queue item so it can be uploaded fresh.
- `/republish BOOK-ID_vN` — force a completed/failed stored release through publishing again. Use only when you intentionally want a republish.
- `/rollback BOOK-ID VERSION` — rebuild that book from its saved historical release at the requested version without rolling back unrelated books.
- `/remove BOOK-ID` — remove a book from the active catalog. Historical release data remains available for rollback/audit.
  
The bot ignores non-owner users and group-chat commands.


## Kafu MotionCards owner management

MotionCards remain separate from the book publisher and its queue/state.

- `/motioncards Q000000001` — inspect one published/known card. The response shows book/version, chapter, QID, current package revision, duration and status, with inline management actions.
- **Preview** — opens the trusted Kafu player route for that QID; never use a raw MotionCards child HTML URL as the management preview.
- **Replace** — upload a validated MotionCards ZIP containing only the intended replacement card(s). The bot lists exact replacement targets and requires explicit confirmation after validation. Confirmation expires and is bound to the owner/private chat, candidate digest, and expected active package/revision/digest.
- **Remove from students** — reversible soft-unpublish for that QID only. It leaves the MCQ, progress, answers, other cards and historical bytes untouched.
- **Restore previous compatible version** — restores only the selected QID after revalidating its current published question identity/content hash.
- `/motioncards-status` — concise MotionCards queue status.
- `/motioncards-retry PACKAGE-ID_rN` — requeue a failed complete MotionCards upload.
- `/motioncards-clear PACKAGE-ID_rN` — clear failed MotionCards queue state only; it is not a published-card delete command.

A successful remove/restore is published through the MotionCards state/deployment pipeline. The public index cache is 30 seconds and the app's bounded availability refresh is 35 seconds by default, so an already-open question should update within that window after successful publication. Do not promise deletion of bytes already cached/downloaded on a client.

MotionCards queue recovery is lease/token protected and bounded. Do not manipulate `motioncards_` D1 rows, release assets, or hashes manually to force a replacement or restoration.

## Question comments

Comments under the explanation are written by the Kafu characters (the Leaders personas), with one "By Kafu
characters" line on the card; see `docs/COMMENTS.md`. Send `COMMENTS_BOOK-ID_rN.zip` (up to 2 MB, one `comments.json`) to the bot like a book. It goes
through the same publish run, after books and admin jobs, and the bot reports the result.

- `/comments` — the last ten comment packs and their results.
- `/comments BOOK-ID` — how many comments a book has now, which revision students see, and the next file name to use (`COMMENTS_BOOK-ID_r<N+1>.zip`). Its buttons: **↩️ Restore rN** (any of the last six published revisions) and **🚫 Remove from students**; each asks to confirm first.
- `/comments-restore BOOK-ID rN` — preview; `/comments-restore BOOK-ID rN CONFIRM` brings back the book's comments exactly as right after rN (the last 20 revisions are kept). Works after `/comments-off` too.
- `/comments-retry COMMENTS_BOOK-ID_rN` — requeue a **failed** comment pack. Sending a corrected ZIP with the same name also replaces a failed one.
- `/comments-off BOOK-ID` — preview only; `/comments-off BOOK-ID CONFIRM` takes every comment of that book away from students (phones remove their saved copy the next time they are online).

A pack only changes the questions it lists. A revision must be newer than the last one published for that book; the same
ZIP again is a no-op. Removing a book (`/remove`) removes its comments too; a kept revision can be restored once the
book is published again.

## When you see ❌

1. Send `/queue` and read the failing `step=...`, method, host, path and status. These diagnostics intentionally contain no secrets.
2. If the bot attached `repair_report.md`, read it before changing anything.
3. If the package itself is bad, fix the PDF parser/output and build a new validated ZIP. Sending a corrected ZIP for the same book/part automatically replaces a failed item.
4. If the package was valid and an external step failed temporarily, use `/retry BOOK-ID_vN` after the cause is fixed.
5. If the failed item is wrong or stale, use `/clear BOOK-ID_vN`, then upload the corrected ZIP.
6. If a GitHub Actions drain run is red, open that run and find the same safe failing step. Do not paste secrets into logs or chat.
7. Never solve a release-upload 403 by putting `DISPATCH_TOKEN` into release code. Release operations use the automatic workflow `GITHUB_TOKEN`.
8. Never edit `validate.py` or `audit.py` merely to make a book pass.
9. Never remove the protected `KAFU-UPLOAD-TEST` book while it is being used as the deployment guard.

## Moderation

Future publishes do not create new held questions from audit warnings or parser flags. Those questions publish with the book's original answer and are recorded for optional inspection with `/warnings BOOK-ID`.

The legacy `/flags` and `/hold` controls remain for questions that were already held or that the owner explicitly holds. This change does not alter any existing held status.

Audit mismatches are never student-visible: packaging must fix them before delivery; if one reaches the server anyway, only that question is skipped and the bot lists it in the publish reply.

## Credentials and backups

- Credential rotation: follow `docs/ROTATE_SECRETS.md` exactly.
- Content helper workflow: `docs/CONTENT_TEAM.md`.
- Personal sync: `docs/PERSONAL_SYNC.md`.
- Backup proposal: PR #20 is still owner-controlled and must not be assumed active until it is actually merged and a backup run is verified.

## Kafu MotionCards first production rollout safety

A merge of PR #67 is **not production-neutral**. The existing `.github/workflows/deploy-app.yml` watches matching pushes to `main`, applies remote D1 migrations, uploads app Worker secrets, stages the app Worker, and promotes it after smoke tests. The MotionCards publisher workflow also has an hourly schedule.

This review branch therefore prepares a fail-closed rollout gate without changing any production setting now:

- Repository variable `MOTIONCARDS_ROLLOUT_ENABLED` is expected to be absent/false during review.
- While it is not `true`, `deploy-app.yml` stops before remote D1 migration/deployment unless the owner manually dispatches it with `motioncards_rollout_authorized=true`.
- The hourly MotionCards publisher job is skipped while the variable is not `true`.
- A manual MotionCards publisher run before the gate is enabled requires `production_authorized=true`.
- No one should set the variable, dispatch either production workflow, merge this PR, apply migrations, create the MotionCards service, or operate the real queue without explicit owner production authorization.

### Authorized first-rollout sequence

After review is complete, obtain one explicit production authorization that names the following sequence. Do not treat merge approval alone as sufficient.

1. Confirm the reviewed PR head and both required CI workflows are green.
2. Keep `MOTIONCARDS_ROLLOUT_ENABLED` false/unset.
3. Merge only after the owner explicitly authorizes the production rollout consequences of the merge.
4. Because the automatic push deployment is gated, manually dispatch `deploy-app.yml` with `motioncards_rollout_authorized=true`. This is the authorized step that may apply MotionCards D1 migration(s), stage the app Worker, smoke the exact staged version, promote it, and verify production.
5. Verify the app Worker, D1 schema, owner-only bot management endpoints, and existing book/export/study behavior before enabling any MotionCards publishing.
6. Under the same explicit authorization, create/use the dedicated `kafu-motioncards` service only through the reviewed MotionCards workflow. For a genuinely empty first state, `initialize_state=true` is allowed only when the state release is confirmed absent.
7. Do not upload or claim a real production MotionCards package until the owner explicitly authorizes that acceptance step. When authorized, manually run the publisher with `production_authorized=true` and verify the exact staged/production MotionCards before queue acknowledgement.
8. After the first production acceptance is successful, the owner may explicitly authorize setting repository variable `MOTIONCARDS_ROLLOUT_ENABLED=true`. Only then do hourly recovery/drain and ordinary automatic app deploys resume without the first-rollout manual flag.
9. Record the deployed app SHA, MotionCards state SHA/release, service version/deployment identifier, migration status, and acceptance result in `motioncards/HANDOFF.md`.

If any step fails, leave `MOTIONCARDS_ROLLOUT_ENABLED` false, preserve the previous active MotionCards state, and use the documented recovery path. Do not bypass the gate to make a workflow green.

### Expected CI/deployment statuses around the rollout gate

- **Gated merge, rollout variable false/unset:** Content CI and Visual/Flow local/built checks still run normally. The matching `deploy-app.yml` push run is expected to stop at **Gate MotionCards first production rollout** before remote D1 migration or Worker promotion. Exact-production-SHA UI verification is **not run**, because no deployment occurred. This is an intentional blocked deployment, not a production test failure and not a production PASS.
- **Authorized first rollout:** after explicit owner authorization, manually dispatch `deploy-app.yml` on the reviewed merged `main` commit with `motioncards_rollout_authorized=true`. The workflow must pass staged smoke, promotion, normal production smoke, then `Verify exact production UI SHA after promotion` using that workflow's exact `GITHUB_SHA`. Only then is the production SHA check PASS.
- **Normal enabled rollout:** after the owner explicitly enables `MOTIONCARDS_ROLLOUT_ENABLED=true`, matching pushes to `main` may deploy normally. The exact-production-SHA UI smoke remains in `deploy-app.yml` after promotion and must pass for that deployed SHA.
- **Failed deployment:** if the gate, migration, staged smoke, promotion, or normal production smoke fails, the exact-production-SHA browser smoke is not executed by default step semantics. Do not report it as PASS or relabel a skipped production check as success.

`.github/workflows/ui.yml` deliberately contains only local/built Visual/Flow verification. Production SHA verification belongs to the deployment workflow because only that workflow knows that an authorized promotion actually occurred.

