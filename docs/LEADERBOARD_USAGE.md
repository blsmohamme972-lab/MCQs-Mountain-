# Leaderboard summaries and daily D1 usage

The leaderboard now reads indexed score summaries, never the answer history. Compact 4096-question attempt buckets retain lifetime first-attempt deduplication, including incorrect answers. An atomic ledger write and SQL trigger update total and current Baghdad-week scores together. The migration backfills existing scores and attempts once. Historical rows and compatibility triggers remain so the previous Worker can receive answers during staged deployment; the new Worker never appends per-question rows.

Top 30 snapshots refresh on demand once per ten minutes. Cached boards make no writes. Own score and tie-ordered rank remain live, and privacy changes immediately invalidate snapshots. Weeks reset Monday 00:00 Baghdad time; old weekly scores do not appear in a new week.

The device retains downloaded books/images, progress and pending submissions. Leaderboard failures never block recording an answer. Submissions send up to 100 first attempts per batch, at 100 queued attempts or once per hour while the app is open. Closing preserves the durable pending queue; reopening resumes scheduling. Submissions are single flight and time out after ten seconds. Offline queues are not truncated at 500 anymore. The saved student-progress format and download/sync code are unchanged.

A 500-answer fixture uses five batches across two buckets: twelve table changes, plus an estimated twelve ranking-index writes, about 24 D1 writes for an existing student. Registration/profile changes, crossing more buckets, and small sessions add overhead. This is a workload model, not a hard daily cap or a measured Cloudflare bill. The dashboard reports actual Cloudflare row metrics.

## Admin usage panel

The dashboard feature branch was inspected and contains only planning documents (draft PR #49), so this PR adds a small read-only inventory/usage view without changing that branch. The Me entry appears only after `/admin/capabilities` verifies signed Telegram initData and the runtime `ADMIN_IDS` allowlist (defaulting to the existing owner). Admin sessions expire after 24 hours. Endpoints use `private, no-store`, and no admin payload is saved to device storage or service-worker caches. Data is cleared when the Telegram session changes.

The D1 panel reads Cloudflare's `d1AnalyticsAdaptiveGroups` rowsRead/rowsWritten, not query counts or estimated student counts. It shows account-wide daily totals over seven UTC dates against 5,000,000 rows read and 100,000 rows written. A warning appears at 70% of either free limit. Daily allowances reset at 00:00 UTC / 03:00 Baghdad. Cloudflare reporting can lag; an absent day's metrics stay unavailable rather than being shown as zero. Analytics responses are reused for five minutes per Worker isolate.

Deployment passes the existing Cloudflare account ID and a server-only analytics token. `D1_ANALYTICS_TOKEN` is preferred; if absent, the existing deployment `CLOUDFLARE_API_TOKEN` is used. The token must have account analytics read access. If permission is missing, the panel explicitly shows analytics unavailable; it never invents counts. No token, administrator ID or account analytics payload is public or committed.

Sources: https://developers.cloudflare.com/d1/observability/metrics-analytics/ and https://developers.cloudflare.com/d1/platform/pricing/.

Publishing still dispatches immediately for uploads and existing owner publishing actions. Only the recovery cron changes, from every 15 minutes to once daily at 03:00 UTC.

Validation includes migration/legacy overlap, duplicate/concurrent retries, score preservation, weekly boundaries, cached-vs-live rank, privacy invalidation, workload/write modelling, admin access denial and analytics errors, offline pending durability, single-flight submission, and 360/390/430 light/dark admin layout/account-isolation journeys. Existing visual baselines are unchanged.
