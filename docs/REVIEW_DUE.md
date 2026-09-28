# Review Due

Kafu bundles the unmodified MIT **ts-fsrs 5.4.2** UMD scheduler. The version and downloaded file SHA-256 are pinned in tools/vendor-lock.json; production builds reject unpinned/mismatched files. The license is served at /vendor/ts-fsrs-LICENSE.txt. No optimizer, WASM or runtime CDN is loaded.

Normal study/practice answers introduce or update a card: wrong -> Again, correct -> Good. In Review Due, answering records the attempt once; the student then chooses Again, Hard, Good or Easy to schedule the next review. Pressing a rating twice is ignored. Skipping an unanswered card leaves it due. Previously answered questions without an FSRS card join the schedule only when answered again; no historical schedules are invented.

Home and Review show the number of valid reviewed cards due now. The review session uses downloaded questions offline. When online and explicitly requested, missing due chapters can be downloaded from the published catalog. Unavailable cards remain due; they are not deleted. The scheduler runs entirely on-device; its serializable state is included in personal sync, with the deterministic latest-device state rule documented in PERSONAL_SYNC.md.

Settings: target retention 0.9, maximum interval 36,500 days, learning 1m/10m, relearning 10m, no random fuzz for deterministic tests and cross-device diagnostics. New short-term reviews may become due again later the same day. Incorrect saved scheduler objects are preserved and reported, not silently reset.

Test: study a question, return Home, inspect Review Due. A wrong answer is usually due after the first learning step. Open Review Due, answer, choose a rating, and confirm it leaves the current due list. Repeat with internet disconnected after the chapter is saved. Do not change your device clock to force a test.

Sources: https://github.com/open-spaced-repetition/ts-fsrs/tree/v5.4.2 and https://open-spaced-repetition.github.io/ts-fsrs/ (checked 2026-09-28).
