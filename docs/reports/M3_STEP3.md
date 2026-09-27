# M3 Step 3 — bot upload and queue

Date: 2026-09-27. Branch: `m3-bot-upload-queue`.

## Implemented

- Telegram webhook at `/bot` requires the configured secret header. Only the configured numeric owner in a private chat receives any response; all other senders are silently ignored.
- ZIP documents up to 19 MiB use `BOOK-ID_vN.zip` or multipart `BOOK-ID_vN_partXofY.zip`. D1 stores Telegram file IDs and ordered queue metadata. The bot acknowledges each upload with `📥 received` before GitHub Actions runs.
- Dispatch and a 15-minute scheduled backup trigger a single serialized Actions drain. Claiming uses first received ZIP's D1 sequence, and each book completes before the next begins. A failed book gets `❌` and `repair_report.md`; later books still run.
- The runner downloads from Telegram, checks ZIP members, fully decodes all `images/` entries and `cover.webp` with Pillow, validates the release and audit, restores active state, publishes, smoke-tests the Cloudflare candidate Version URL, promotes, persists state and owner packages, and reports ✅ counts for questions, chapters, images, skipped, held.
- `/queue`, `/books`, `/status`, `/flags` with Approve / Reject / Show source page, `/hold QID PAGE`, `/republish BOOK-ID_vN`, `/rollback BOOK-ID VERSION`, `/remove BOOK-ID` use the same serialized publisher. Removal updates the catalog and removed-books list while retaining permanent IDs.
- The app Worker keeps static assets serving through its ASSETS binding. Empty live catalog still falls back to built-in sample books in the Mini App.

## Verification

- `python -m unittest tools.tests.test_queue_step3 -v` covers D1 queue order even with equal timestamps, three claims, corrupted header-only WebP, fully decoded fixture images, and continuing after a failed book.
- `node --test worker/bot.test.mjs` covers malformed package names, webhook token, private-owner restriction, and silent non-owner behavior.
- Full existing publishing and Mini App contract tests passed in Kafu Content Contract CI: https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36349245777.

## Live rollout status (2026-09-28, Baghdad)

PR #4 merged as `4e846774f0f690ff8980c422facbf3912a1125e3`; CI passed.

[Deploy Kafu #9](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36359745068) completed **successfully** after replacing the fragile `wrangler-action` secret upload path with direct Wrangler commands using the explicit `wrangler.app.jsonc` config. D1 migration, Worker secrets, and Worker deployment all passed.

[Setup Kafu Bot #1](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36359890053) completed **successfully**, registering the secure Telegram webhook and owner commands.

The owner opened Kafu inside Telegram and confirmed the Mini App loads and Continue studying works. Full queue/admin phone acceptance remains pending and is tracked in `docs/reports/M3_DEPLOY_RETRY.md`. Fixture books must be removed with `/remove` before public launch.

## Operations note

Telegram does not host documents indefinitely. Keep the GitHub `kafu-book-BOOK-ID-vN` release assets for rollback and moderation; `/republish` retries a prior Telegram upload while its file remains available. A damaged upload is rejected before promotion. A candidate deployment or state-release failure requires inspecting the Actions run before retrying.
