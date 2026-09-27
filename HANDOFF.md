# Kafu handoff

Updated: 2026-09-28 (Asia/Baghdad)

## Start here

Read in order: this file, `PROGRESS.md`, `MCQ_PLATFORM_FINAL_PLAN.yaml`, `BUILD_PROMPT.md` if present, then `docs/reports/`. `BUILD_PROMPT.md` is absent on main as of this handoff. The plan is the architecture source of truth; explain migration impact before changing storage roles, identity, publishing flow, or free-tier guardrails.

Repository: `blsmohamme972-lab/MCQs-Mountain-` (private). Telegram bot: `@KafuMcqsbot`. App: `https://kafu.blsmohamme97.workers.dev`. Content: `https://kafu-content-1.blsmohamme97.workers.dev`.

## State

- M2 Steps 1–2 are merged and complete. The owner verified all four question types and both image types on a phone and in Airplane Mode. Synthetic fixture books are published; see `docs/reports/M2_STEP2.md`.
- M3 Step 3 (owner-only `/bot` webhook, D1 ZIP queue, Actions drain, admin commands) was merged in PR #4; Kafu Content Contract CI passed.
- [Deploy Kafu #9](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36359745068) is **green**. D1 migrations, Worker secret upload, and Worker deployment all passed.
- [Setup Kafu Bot #1](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36359890053) is **green**. The secure Telegram webhook and owner commands were registered.
- The owner opened the Mini App in Telegram and confirmed the app loads and Continue studying works. Full Step 3 queue/admin phone acceptance is still pending; see `docs/reports/M3_DEPLOY_RETRY.md`.
- The bot token was exposed in a previous agent log. The owner has chosen not to rotate it at this stage. Do not print or log credentials.

## Next actions

1. Complete the remaining Step 3 phone acceptance in `docs/reports/M3_DEPLOY_RETRY.md`: `/help`, `/status`, `/queue`, `/books`, a synthetic valid ZIP upload, duplicate handling, invalid ZIP repair report, multipart release, moderation, rollback/remove, and non-owner silence.
2. Record screenshots and queue workflow links in `docs/reports/`.
3. Before public launch, remove synthetic fixture books through `/remove`.
4. If credentials are rotated later, update repository secrets, redeploy Kafu, rerun Setup Kafu Bot, and verify the webhook again.

## Architecture and operations

The `kafu` Worker serves the Mini App, `/api/*`, and `/bot`; `kafu-content-1` serves immutable JSON/ZIP/WebP content. D1 holds small shared state and queue metadata, never the full MCQ library. GitHub Releases hold durable master/build state. IndexedDB holds downloaded chapters, image blobs, and study history; normal answers do not call D1. Telegram CloudStorage is compact personal backup. Publishing uploads a candidate content version, smoke-tests it, then promotes it; book rollback builds a new global candidate, preserving other books.

Worker secret names in `worker/bot.mjs`: `BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `WEBHOOK_SECRET`, `QUEUE_API_TOKEN`, `DISPATCH_TOKEN`. `.github/workflows/deploy-app.yml` maps each from the identically named repository secret; `DISPATCH_TOKEN` is correct despite GitHub rejecting a `GITHUB_` prefix. The deployment also uses `D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN`. `DB` and `ASSETS` are bindings. Never put secret values in files, commands, reports, or output.

Admin implementation commands: `/queue`, `/books`, `/status`, `/flags`, `/hold`, `/republish`, `/rollback`, `/remove`, `/help`. The plan's `/retry` label differs from the merged `/republish` command; document or reconcile this deliberately, without an unannounced architecture change.

## Working rules

Use branches and pull requests; never commit directly to main. Keep CI green and `PROGRESS.md` current. Save reports under `docs/reports/`. Never change `tools/validate.py` to make a package pass. Never manually alter the `kafu-content-state` release. Explain architecture changes before implementation. Preserve the non-empty Library fallback. Do not publish a real book until Step 3 is fully accepted.
