# Personal sync v2 (M5)

## What is synchronized

Per-question attempts, known correct counts and last-result/mistake state; question and book stars (including unstar tombstones); reviewed FSRS card state; active seconds per day; active-day/streak inputs; resume and text size. The complete new answer-event log is stored only in IndexedDB, following the architecture plan. PDFs, packs, images, reports and download markers are never put in Telegram CloudStorage.

Older releases kept attempts plus the last result, not every correct attempt. Migration preserves the old total and explicitly records an unknown-history count; it does not invent old correct answers. When two old devices have overlapping pre-v2 history, the larger legacy baseline is used, not their sum. All post-upgrade per-device attempt/correct counters are additive and idempotent.

## Two-device merge rules

Each writer owns its own namespace. A device never overwrites another device's snapshot. Snapshots carry increasing sequence numbers; stale reads cannot roll back a newer cached replica. Attempts/correct counters and active seconds are summed across writers, once per writer. Active days are a union. Simultaneous active sessions on two devices count both sessions' seconds.

Stars, unstars, last-answer state, resume, font size and FSRS use a monotonic logical timestamp with writer ID as a deterministic tie-breaker. Pulling another device advances the next local timestamp. Concurrent independent reviews preserve both attempt counters; the latest deterministic card state wins rather than mixing incompatible scheduler fields. Mistakes derive from that latest answer result. False star tombstones are retained, so an offline device cannot silently resurrect an acknowledged unstar.

The reset control now explicitly says **all synced devices**. After confirmation, a reset epoch clears attempts, mistakes, FSRS, time and resume; stars are retained. Older-epoch snapshots cannot resurrect reset progress. A device with unsynced work from before it learns of a reset intentionally drops that old-epoch study state. Local answer events from before the reset are removed on that device when the epoch is observed.

The browser account namespace uses Telegram's displayed user ID only for local separation, not server authorization. Unbound legacy local state is migrated once to the first account using it. Another account is never allowed to upload that legacy state. Public downloaded content may be shared across local accounts. BroadcastChannel, when supported, separates concurrent browser contexts that discover the same writer ID; separate devices already have independent IDs.

## Storage limits and failed writes

Keys use only A-Z, a-z, 0-9, underscore and hyphen and remain below 128 characters. Compact snapshots are encoded as ASCII JSON and split at 3,800 characters, below the 4,096-character value limit. Encoding preserves Unicode across chunk boundaries without slicing surrogate characters.

The client checks **716 total keys maximum** (floor of 70% of 1,024), counting legacy and unrelated keys. It checks before staging and again before publishing the manifest. If simultaneous writers consume the same spare allowance, an over-budget staged write is abandoned and its uncommitted chunks are removed; there is no global compare-and-swap API in CloudStorage. No committed progress is truncated or evicted to make space. Capacity errors are visible in Me; the full local state remains saved.

Chunks use a fresh immutable revision. A SHA-256-checked manifest is written last and retains the previous generation as a fallback. Missing/corrupt chunks do not replace a good local snapshot. A timed-out manifest acknowledgement may represent a successful write, so its chunks are never deleted until a later pointer read resolves the outcome. Garbage collection touches only this writer's unreferenced chunks. A redundant previous generation can be removed to free space, but the committed current generation is preserved.

Writes are serialized and normally coalesced to at most one per 30 seconds, with best-effort immediate flush on backgrounding, reconnect or Sync now. Closing an app can suspend callbacks; pending changes stay in IndexedDB and retry on a later foreground session. Startup waits at most two seconds for the initial cloud read before allowing study. No backend request occurs for normal answers or FSRS reviews.

## How to test on two devices

Open the same Telegram account on phone and iPad. Answer a question, star another, change text size, advance to another question, then use Me > Sync now. Open the second device, use Sync now and check totals/stars/resume. Unstar on the second device; sync both and confirm it stays unstarred. Answer one question on each device while offline, reconnect and sync both: attempts accumulate without duplication. Download the relevant chapters on each device to review offline; sync does not upload book content.

Do not use Reset as a casual sync test: it deliberately clears synced study progress after confirmation.

Reference: https://core.telegram.org/bots/webapps#cloudstorage (checked 2026-09-28).
