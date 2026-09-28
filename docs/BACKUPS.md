# Weekly private D1 backup

Activated with owner approval on 2026-09-28: PR #20 merged after green CI. Manual run #1 (`36389139180`) succeeded. The private `d1-backups` release contains `kafu-d1-20260928T065829Z-36389139180.sql.gz` (1,113 bytes) and its matching `.json` manifest (429 bytes). The weekly schedule is active.

## What the workflow does

Every Sunday at 01:17 UTC (04:17 Baghdad), or when manually started, it checks that the GitHub repository is private, exports the existing `kafu-db` with the existing Cloudflare token, restores the SQL into a temporary local SQLite database to verify it, compresses it, and saves a checksum manifest plus `.sql.gz` in the private **d1-backups** release. It uses only the automatic workflow GITHUB_TOKEN for release writes; no bot/queue/webhook/dispatch tokens are exposed to the backup job.

Exports are capped at 64 MiB raw SQL, run at most ten minutes, and never print SQL, table rows, credentials or signed download URLs. Temporary files are removed. New assets are downloaded and checksum-verified before the four newest complete backup pairs are retained. Partial/unrelated assets are not deleted automatically. Existing content-state and book releases are untouched.

Cloudflare documents that a running D1 export blocks other database requests. Schedule the first run when nobody is publishing/moderating. The app's normal locally saved study does not depend on D1, but bot/queue requests can wait during export. Do not remove virtual tables or alter schemas just to force an export; if export permissions or compatibility fail, stop and review privately.

## Verify the scheduled backups

GitHub → Actions → **Weekly Kafu D1 Backup** shows each run. A green run should have one matching timestamped `.sql.gz` and `.json` pair in the private **d1-backups** release. If a run fails, inspect its job steps without sharing credentials or SQL. For Cloudflare permission errors, review the existing token's D1 export/edit scope privately. Do not change schema to force export.

## Restore is deliberately manual

A backup is not permission to overwrite live D1. Download the matching pair privately; verify the archive SHA-256 from the manifest, decompress, and test restoration into a disposable local SQLite database first. Confirm the intended timestamp and coordinate with anyone publishing. Production restore requires a separately reviewed procedure; this workflow never imports into production.

This backup includes D1 owner queue/moderation/publication metadata. It does **not** back up Worker secrets, Telegram CloudStorage, local student answer history, PDFs or the master content SQLite kept in the separate content-state GitHub release.

## Budget

Four weekly exports per month add approximately four short Linux jobs and four retained compressed backup pairs. The first authorized run took under one minute and produced a 1,113-byte compressed SQL export plus a 429-byte manifest. No billing plan, paid runner or account setting was changed.

References checked 2026-09-28:
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://docs.github.com/en/rest/releases/assets
- https://docs.github.com/en/rest/releases/releases
