# Weekly private D1 backup — owner approval required

Night 1 prepared this workflow but **did not enable it or export production D1**. A weekly production schedule and backup access are infrastructure-sensitive, so the PR stays open even if its offline tests are green.

## What the proposed workflow does

Every Sunday at 01:17 UTC (04:17 Baghdad), or when manually started, it checks that the GitHub repository is private, exports the existing `kafu-db` with the existing Cloudflare token, restores the SQL into a temporary local SQLite database to verify it, compresses it, and saves a checksum manifest plus `.sql.gz` in the private **d1-backups** release. It uses only the automatic workflow GITHUB_TOKEN for release writes; no bot/queue/webhook/dispatch tokens are exposed to the backup job.

Exports are capped at 64 MiB raw SQL, run at most ten minutes, and never print SQL, table rows, credentials or signed download URLs. Temporary files are removed. New assets are downloaded and checksum-verified before the four newest complete backup pairs are retained. Partial/unrelated assets are not deleted automatically. Existing content-state and book releases are untouched.

Cloudflare documents that a running D1 export blocks other database requests. Schedule the first run when nobody is publishing/moderating. The app's normal locally saved study does not depend on D1, but bot/queue requests can wait during export. Do not remove virtual tables or alter schemas just to force an export; if export permissions or compatibility fail, stop and review privately.

## Activate, tap by tap

1. Open the Night 1 weekly-backup PR. Review `backup.yml`, the retention rule and the existing Cloudflare account/D1 scope. The code does not ask for a new secret.
2. Confirm the repository remains **Private**. Do not make the d1-backups release public or share SQL exports with helpers.
3. After review and green CI, tap **Merge pull request → Confirm merge**. This activates the weekly schedule; Night 1 did not merge it for you.
4. GitHub → Actions → **Weekly Kafu D1 Backup → Run workflow → main → Run workflow**. Run once off-peak.
5. Wait for green, then repository → Releases → **Private Kafu D1 backups**. Confirm a timestamped SQL gzip and matching JSON manifest exist. The workflow verifies both uploads by checksum.
6. If it fails with a Cloudflare permission error, do not paste the error's credentials or SQL into chat. Verify the existing token's D1 export/edit access in your account. Changing token permissions is an owner action, not part of Night 1.

## Restore is deliberately manual

A backup is not permission to overwrite live D1. Download the matching pair privately; verify the archive SHA-256 from the manifest, decompress, and test restoration into a disposable local SQLite database first. Confirm the intended timestamp and coordinate with anyone publishing. Production restore requires a separately reviewed procedure; this workflow never imports into production.

This backup includes D1 owner queue/moderation/publication metadata. It does **not** back up Worker secrets, Telegram CloudStorage, local student answer history, PDFs or the master content SQLite kept in the separate content-state GitHub release.

## Budget

Four weekly exports per month add approximately four short Linux jobs and four retained compressed backup pairs. Actual size/time is measured only after the first authorized run. D1 export permission and live duration were not tested tonight. No billing plan, paid runner or account setting was changed.

References checked 2026-09-28:
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://docs.github.com/en/rest/releases/assets
- https://docs.github.com/en/rest/releases/releases
