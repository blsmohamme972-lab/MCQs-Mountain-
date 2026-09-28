# Rotate Kafu credentials in one sitting

Owner action only. No credentials were changed during Night 1. Values saved in GitHub and Cloudflare cannot be viewed again. Never put a token in chat, screenshots, URLs, files committed to Git, or a support report.

## Before starting

1. Open GitHub > MCQs-Mountain- > Actions > Drain Kafu Publish Queue. Wait for any running publisher to finish. Open the workflow menu (...) > Disable workflow temporarily. Do not upload or moderate books while rotating.
2. Keep a password manager ready. Open GitHub > repository Settings > Secrets and variables > Actions. For each existing secret, use its pencil/Update button; paste the new value and select Update secret.
3. Keep OWNER_TELEGRAM_ID, CLOUDFLARE_ACCOUNT_ID and D1_DATABASE_ID unchanged. Do not delete/recreate the bot, Worker, database, or published releases.

## Rotate in this order

1. **Cloudflare API token.** Cloudflare profile > API Tokens > Create Token. Create a replacement restricted to the existing Kafu account, with the Worker deployment and D1 edit permissions already required by the working deployment. Save the replacement as GitHub `CLOUDFLARE_API_TOKEN`. Keep the old token only until the new deployment is verified, then revoke it. Do not broaden account/resource access. This token is for GitHub deployment; do not put it in the Kafu runtime secrets table.
2. **GitHub dispatch token.** GitHub profile Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token. Choose only MCQs-Mountain-, grant Actions read/write, choose an expiry, and save the value as repository `DISPATCH_TOKEN`. Release uploads use the automatic workflow GITHUB_TOKEN, not this token. Revoke the old dispatch token after verification.
3. **Queue token.** Generate a new independent random value with at least 32 random bytes in your password manager. Save it as GitHub `QUEUE_API_TOKEN`.
4. **Webhook secret.** Generate a different random value using only A-Z, a-z, 0-9, underscore and hyphen, 1-256 characters; use at least 32 random bytes. Save it as GitHub `WEBHOOK_SECRET`.
5. **Telegram bot token (last, to minimize downtime).** Open official @BotFather > /mybots > @KafuMcqsbot > API Token > Revoke current token, then copy the replacement token (or use /token after revocation if prompted). Save it as GitHub `BOT_TOKEN`. Revocation invalidates the old token immediately. Do not create a new bot.

## Deploy and verify, in this order

1. GitHub Actions > Deploy Kafu > Run workflow > main > Run workflow. Start a new run, not an old failed attempt. Wait for **Upload Worker secrets** and **Deploy Kafu** to be green. This workflow copies BOT_TOKEN, QUEUE_API_TOKEN, WEBHOOK_SECRET and DISPATCH_TOKEN into the existing Worker. No second manual edit in Cloudflare is needed.
2. GitHub Actions > Setup Kafu Bot > Run workflow > main > Run workflow. Wait for green. It registers the webhook with the new BOT_TOKEN and WEBHOOK_SECRET without dropping pending Telegram updates.
3. Cloudflare > Workers & Pages > kafu > Settings > Variables and Secrets: confirm the five named runtime secrets exist; do not try to reveal their values. Under Deployments verify the newly deployed version is active.
4. Telegram > Kafu: send /status and /books. Open the Mini App and confirm KAFU-UPLOAD-TEST is still available. A temporary webhook error during the rotation window is not a reason to delete content.
5. GitHub Actions > Drain Kafu Publish Queue > Enable workflow, then Run workflow > main > Run workflow. Verify the result. Only use /retry BOOK-ID_vN for a release that is actually failed; do not retry/remove the already published test book merely to prove authentication.
6. Revoke the superseded Cloudflare and GitHub dispatch tokens. Retain only the new credentials in the password manager. BOT_TOKEN was already revoked; old queue/webhook strings are invalid after deployment.
7. Delete any known credential-containing Actions runs/logs after saving a non-secret incident note. If a credential was ever committed, rotation is mandatory; deleting it in a later commit does not remove history. History rewriting requires a separately reviewed owner procedure and coordination with all clones.

## On failure

Stop and read the failing step; do not rotate everything repeatedly. Cloudflare deployment failure: verify the new API token's existing account/Worker/D1 scope. Kafu bad_queue_token: complete a new Deploy Kafu first. Telegram webhook failure: run Setup Kafu Bot after deployment with the same repository secrets. Release upload failure: inspect the run's GITHUB_TOKEN permissions (Contents write); never substitute DISPATCH_TOKEN.

## Scope of the Night 1 security audit

Automated CI checks scan the checked-out tracked source, workflows and reports for credential formats and unsafe direct logging. HTTP diagnostics redact known environment/header credentials, Telegram bot-token paths, authorization values and signed URL queries **before** truncation. Cross-origin redirects strip credentials; response sizes are bounded. This is not proof that old chats, Actions logs, unreferenced Git objects, or every historical commit are clean. Earlier setup messages/logs exposed credentials, so rotate all five regardless of a clean source scan.

References (checked 2026-09-28):
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://core.telegram.org/bots/features#generating-an-authentication-token
- https://core.telegram.org/bots/api#setwebhook
