# M3 deployment retry and phone acceptance

Date: 2026-09-28 (Baghdad). This report supplements [M3_STEP3.md](M3_STEP3.md).

## Deployment verification

## Latest result after account workflow change

PR #6 changed both the deploy and queue publisher workflows to use the repository secret `CLOUDFLARE_ACCOUNT_ID` instead of a hardcoded account ID. Its CI passed and it was merged. [Deploy Kafu run #8](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36353748871) then failed at the D1 migration with Cloudflare 7403; Worker deployment was skipped. The Actions environment summary for the migration shows `CLOUDFLARE_ACCOUNT_ID` **empty**. GitHub did not supply a value to that step. `CLOUDFLARE_API_TOKEN` and `D1_DATABASE_ID` were masked as present, but their relationship to the intended account is not independently verified.

Confirm that `CLOUDFLARE_ACCOUNT_ID` was saved under this repository's **Settings → Secrets and variables → Actions → Repository secrets**, spelled exactly as shown, rather than only as a repository variable or environment secret. Do not expose its value. Once available, rerun Deploy Kafu. If 7403 remains, verify the D1 database and token belong to the selected account.

The earlier Deploy Kafu run was [#7, attempt 2](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36352381336). The rerun was requested after the owner reported adding D1 Edit. It completed **failure**. The "Apply D1 migrations" step failed while querying D1 with Cloudflare error 7403: "The given account is not valid or is not authorized to access this service." The Worker deployment step was skipped. The previous attempt failed at the same step. Kafu Content Contract CI on the merged commit passed.

Check that the D1 database belongs to the configured Cloudflare account, that the repository's `D1_DATABASE_ID` identifies that database, and that the `CLOUDFLARE_API_TOKEN` repository secret is the intended token with Account → D1 → Edit for that account. Preserve its Worker deployment permissions. Do not print secret values while diagnosing. Once corrected, rerun Deploy Kafu and confirm both migration and deployment steps pass.

The deploy workflow sends Worker secrets `BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `WEBHOOK_SECRET`, `QUEUE_API_TOKEN`, and `DISPATCH_TOKEN`. The Worker reads `DISPATCH_TOKEN` under that exact name. `DB` and `ASSETS` are bindings, not secrets. `GITHUB_REPOSITORY` and `CONTENT_BASE` have code defaults.

## Webhook status

Setup Kafu Bot has no Actions run as of this report. Run it only after Deploy Kafu succeeds. Confirm it registers the `/bot` webhook and owner commands without exposing credentials. If setup fails, inspect the Actions step before phone testing.

## Step 3 owner phone acceptance

After both workflows succeed, use a private chat with @KafuMcqsbot:

1. Send `/help`, `/status`, `/queue`, and `/books`; confirm readable owner responses and that the existing fixture books remain available in the Mini App.
2. Send a small **synthetic, valid** single-part ZIP named `BOOK-ID_vN.zip` (use a fresh fixture identity). Confirm the immediate `📥 received` acknowledgement and a ready/running queue entry.
3. Wait for Publish Kafu Queue to complete. Confirm a ✅ summary with question, chapter, image, skipped, and held counts; then open the book and download a chapter in the Mini App.
4. Reopen the downloaded chapter in Airplane Mode. Check question text, answer, explanation, question image, and explanation image.
5. Send the exact same ZIP again; confirm duplicate handling without a second publication. Send a deliberately invalid synthetic ZIP and confirm ❌ plus a repair report, while the existing books still open.
6. Send a two-part synthetic release in separate messages. Confirm it waits after part one and publishes only after part two.
7. Check `/flags` and, if a synthetic held item exists, inspect its source page and approve/reject flow. Use `/republish` only on a known test release if needed.
8. Exercise `/rollback BOOK-ID VERSION` on a synthetic test book and verify another book remains unchanged. Exercise `/remove BOOK-ID` for the synthetic test book and verify it leaves the catalog.
9. Confirm a non-owner account and a group chat get no admin response. Do not upload real or licensed books for this test.

Record screenshots, queue run links, and any failure in a new report under `docs/reports/`. Fixture books `KAFU-FIXTURE-ALLTYPES` and `KAFU-FIXTURE-MULTIPART` are still synthetic and must be removed via `/remove` before public launch. Never alter the `kafu-content-state` release manually.

## Documentation differences

The original architecture plan lists `/retry`, while the merged Step 3 implementation exposes `/republish BOOK-ID_vN`. The older M2 Step 1 report says PR #1 awaits merge and describes an empty Library; later reports and PROGRESS.md supersede those status statements.
