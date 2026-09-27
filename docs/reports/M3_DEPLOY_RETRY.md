# M3 deployment retry and phone acceptance

Date: 2026-09-28 (Baghdad). This report supplements [M3_STEP3.md](M3_STEP3.md).

## Deployment verification

[Deploy Kafu #9](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36359745068) completed **successfully**.

The earlier Cloudflare 7403 issue was resolved after the correct `CLOUDFLARE_ACCOUNT_ID` and token/account relationship became available to the workflow. A subsequent retry passed D1 but failed during Worker secret upload because `cloudflare/wrangler-action` invoked `wrangler secret bulk` without the custom `wrangler.app.jsonc` config, so Wrangler could not see the Worker name.

The deploy workflow was changed to use Wrangler directly with the explicit config for both Worker secret upload and Worker deployment. In run #9:
- Configure D1 binding: PASS
- Apply D1 migrations: PASS
- Upload Worker secrets: PASS
- Deploy Kafu to Cloudflare Workers: PASS

The deploy workflow sends Worker secrets `BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `WEBHOOK_SECRET`, `QUEUE_API_TOKEN`, and `DISPATCH_TOKEN`. The Worker reads `DISPATCH_TOKEN` under that exact name. `DB` and `ASSETS` are bindings, not secrets. `GITHUB_REPOSITORY` and `CONTENT_BASE` have code defaults.

## Webhook status

[Setup Kafu Bot #1](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36359890053) completed **successfully**. It registered the secure `/bot` webhook and owner commands.

The owner then opened Kafu inside Telegram and confirmed the Mini App loads and Continue studying works. This confirms the deployed app is reachable in Telegram, but it does not replace the queue/admin acceptance below.

## Step 3 owner phone acceptance

Remaining checks in a private chat with @KafuMcqsbot:

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
