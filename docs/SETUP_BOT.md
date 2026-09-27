# Owner setup — Kafu upload bot

Do these steps **before merging Step 3**. Keep tokens and IDs in secret fields; do not send them in Telegram or a PR comment.

1. **Find your numeric Telegram ID.** In Telegram, open `@KafuMcqsbot` and send `/start`. Before setting the webhook, open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` privately in your browser, replacing the placeholder with the token from BotFather. Copy `message.from.id` for your own message. Close that browser tab. Use this exact number for `OWNER_TELEGRAM_ID`.
2. **Get the bot token.** In Telegram open `@BotFather` → `/mybots` → `@KafuMcqsbot` → **API Token**. Copy it into a password manager. If the token was ever exposed, revoke and regenerate it in BotFather.
3. **Create D1.** In Cloudflare Dashboard → **Storage & databases** → **D1 SQL Database** → **Create database**, name it `kafu-db`. Open it and copy its **Database ID** UUID. The Actions deploy will apply `migrations/0001_publish_queue.sql`.
4. **Create the GitHub dispatch token.** GitHub profile → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**. Choose the account and only `MCQs-Mountain-` under repository access. Grant **Actions: Read and write**. Set an expiry, generate, and copy it once. Save it as a GitHub Actions repository secret named `GITHUB_DISPATCH_TOKEN`.
5. **Create two random secrets.** Make separate, long random strings using a password manager: `WEBHOOK_SECRET` (letters, numbers, `_` and `-`, 1–256 chars) and `QUEUE_API_TOKEN`. Never reuse the bot token as the webhook secret.
6. **GitHub Actions secrets.** In `blsmohamme972-lab/MCQs-Mountain-` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, enter each name and value: `BOT_TOKEN` (BotFather token), `OWNER_TELEGRAM_ID` (numeric ID), `WEBHOOK_SECRET`, `QUEUE_API_TOKEN`, `D1_DATABASE_ID` (D1 UUID), and `GITHUB_DISPATCH_TOKEN` (the fine-grained GitHub token). Check that `CLOUDFLARE_API_TOKEN` already exists. Save each with **Add secret**.
7. **Worker secrets deploy automatically.** The **Deploy Kafu** workflow copies `BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `WEBHOOK_SECRET`, `QUEUE_API_TOKEN`, and `GITHUB_DISPATCH_TOKEN` from GitHub Actions secrets to the Cloudflare Worker. You do not need to type them a second time in Cloudflare.
8. **Merge the PR after CI is green.** In GitHub open its PR, see green **Kafu Content Contract CI**, tap **Merge** → **Confirm merge**. In **Actions**, open **Deploy Kafu** and wait for a green check. The deployment binds D1 and applies the migration.
9. **Register the webhook.** In the repository tap **Actions** → **Setup Kafu Bot** → **Run workflow** → choose `main` → **Run workflow**. Wait for green. This registers `https://kafu.blsmohamme97.workers.dev/bot` with Telegram's secret header and sets owner command shortcuts. If **Run workflow** is hidden in the phone GitHub app, use GitHub in a mobile browser with **Desktop site** enabled.

## Phone test

1. Send three distinct, valid small release ZIPs rapidly as **files** to `@KafuMcqsbot` in your private chat. Each should say `📥 received`. Check `/queue`, then wait for three ✅ replies in the order sent with nonzero question/chapter counts. Check `/books` and the Library. If you only have the two fixtures, use those plus another independently named validated test book; do not send an identical ZIP under a new name.
2. Send a ZIP with a deliberately broken cover or image. Expect `📥 received`, then ❌ and attached `repair_report.md`. No broken book should enter the Library.
3. From another Telegram account, send a ZIP or command; there should be no bot response and no queue entry.
4. Send `/flags`; for a held ID, tap **Show source page**, **Approve** or **Reject**, and verify the corresponding moderation job. Try `/hold Q000000001 1` with a real ID from a published book.
5. Test `/republish BOOK-ID_vN`, `/rollback BOOK-ID VERSION` (where both releases exist), then `/remove BOOK-ID`. Check the Library updates. Keep at least one sample or published book visible. Remove fixture books before launch.
6. Download a chapter, answer several questions and view images. Close Telegram, turn on airplane mode, reopen Kafu and verify the chapter, images and answers persist.
