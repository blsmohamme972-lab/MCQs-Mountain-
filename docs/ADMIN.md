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
- `/flags` — list pending held/audit-warning questions.
- `/reports` — list up to ten pending student question reports (question ID, book/version, reason, optional note). Do not paste patient information into replies.
- `/reports resolve REPORT-ID` — permanently delete a report after you have checked the cited book/question and resolved or recorded the correction. This does not change the published content by itself.
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

A non-empty extraction flag or audit concern can hold a question out of student packs. Review it with `/flags`.

Bulk approval is deliberately two-step. The first command only tells you how many pending warnings would be approved. The second requires the literal `CONFIRM` word. Structural validation errors and audit mismatches cannot be bypassed by this command.

## Credentials and backups

- Credential rotation: follow `docs/ROTATE_SECRETS.md` exactly.
- Content helper workflow: `docs/CONTENT_TEAM.md`.
- Personal sync: `docs/PERSONAL_SYNC.md`.
- Backup proposal: PR #20 is still owner-controlled and must not be assumed active until it is actually merged and a backup run is verified.
