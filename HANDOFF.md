# Kafu handoff

Updated: 2026-09-28 (Asia/Baghdad)

## Start here

Read in order: this file, `PROGRESS.md`, `MCQ_PLATFORM_FINAL_PLAN.yaml`, `BUILD_PROMPT.md` if present, then `docs/reports/`. `BUILD_PROMPT.md` is absent on main as of this handoff. The plan is the architecture source of truth; explain migration impact before changing storage roles, identity, publishing flow, or free-tier guardrails.

Repository: `blsmohamme972-lab/MCQs-Mountain-` (private). Telegram bot: `@KafuMcqsbot`. App: `https://kafu.blsmohamme97.workers.dev`. Content: `https://kafu-content-1.blsmohamme97.workers.dev`.

## State

- M2 Steps 1–2 are merged and complete. The owner verified all four question types and both image types on a phone and in Airplane Mode. Synthetic fixture books are published; see `docs/reports/M2_STEP2.md`.
- M3 Step 3 (owner-only `/bot` webhook, D1 ZIP queue, Actions drain, admin commands) was merged in PR #4; Kafu Content Contract CI passed.
- Latest [Deploy Kafu run #8](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36353748871) **failed** at `wrangler d1 migrations apply` with Cloudflare 7403. PR #6 replaced hardcoded account IDs in deploy and queue workflows with `secrets.CLOUDFLARE_ACCOUNT_ID`, but run #8's Actions environment summary showed this secret **empty**. The Worker deployment step was skipped. Prior run #7 attempt 2 failed with 7403 using the hardcoded account.
- **Setup Kafu Bot has not run.** Do not register the webhook until Deploy Kafu is green. Step 3 phone acceptance has not been performed. See `docs/reports/M3_DEPLOY_RETRY.md` for the exact run result and checklist.
- The bot token was exposed in a previous agent log. The owner intends to rotate it before public launch. Do not print or log credentials.

## Next actions

1. Confirm `CLOUDFLARE_ACCOUNT_ID` is an Actions **repository secret** in this exact repository, with the intended account ID, and is available to the workflow. Run #8 received an empty value. Check that `D1_DATABASE_ID` identifies a database in that account and `CLOUDFLARE_API_TOKEN` has D1 Edit plus Worker deployment access there. Inspect only names and status, never values. Rerun Deploy Kafu; require green migration and Worker deployment.
2. Run **Setup Kafu Bot** (`.github/workflows/setup-bot.yml`) and confirm its workflow succeeds. It calls `tools/setup_bot.py` to set the secure `/bot` webhook and owner-scoped commands.
3. Ask the owner to run the Step 3 phone checks in `docs/reports/M3_DEPLOY_RETRY.md`. Record results under `docs/reports/`; do not mark Step 3 done before webhook and phone proof pass.
4. Before public launch, rotate the exposed bot token, update the corresponding repository secret and deployment, and remove synthetic fixture books through `/remove`. Verify the new webhook state after rotation.

## Architecture and operations

The `kafu` Worker serves the Mini App, `/api/*`, and `/bot`; `kafu-content-1` serves immutable JSON/ZIP/WebP content. D1 holds small shared state and queue metadata, never the full MCQ library. GitHub Releases hold durable master/build state. IndexedDB holds downloaded chapters, image blobs, and study history; normal answers do not call D1. Telegram CloudStorage is compact personal backup. Publishing uploads a candidate content version, smoke-tests it, then promotes it; book rollback builds a new global candidate, preserving other books.

Worker secret names in `worker/bot.mjs`: `BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `WEBHOOK_SECRET`, `QUEUE_API_TOKEN`, `DISPATCH_TOKEN`. `.github/workflows/deploy-app.yml` maps each from the identically named repository secret; `DISPATCH_TOKEN` is correct despite GitHub rejecting a `GITHUB_` prefix. The deployment also uses `D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN`. `DB` and `ASSETS` are bindings. Never put secret values in files, commands, reports, or output.

Admin implementation commands: `/queue`, `/books`, `/status`, `/flags`, `/hold`, `/republish`, `/rollback`, `/remove`, `/help`. The plan's `/retry` label differs from the merged `/republish` command; document or reconcile this deliberately, without an unannounced architecture change.

## Working rules

Use branches and pull requests; never commit directly to main. Keep CI green and `PROGRESS.md` current. Save reports under `docs/reports/`. Never change `tools/validate.py` to make a package pass. Never manually alter the `kafu-content-state` release. Explain architecture changes before implementation. Preserve the non-empty Library fallback. Do not publish a real book until Step 3 is accepted.
