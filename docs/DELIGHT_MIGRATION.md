# Task 5: synced evidence, local celebration preferences

Owner refinement: achievements and streaks must survive a phone change wherever the existing personal backup provides the evidence. The badge shelf now derives its result from `S.answers`, `S.active` and current catalog chapter QIDs. It does not consult local badge flags and makes no network request or write when rendering.

## Definitions and limits

- First chapter: an answer with a positive attempt count for every current chapter QID, in the matching book.
- Seven steady days: the longest consecutive sequence of valid synced active study dates reaches seven. The Home flame shows the current run through today or yesterday. Future/invalid dates do not count.
- 100 questions: at least 100 distinct valid permanent QIDs with positive attempt counts.
- Chapter mastered: a known correct answer for every question in a chapter (`correct_count > 0`, or a known correct latest answer). Unknown legacy attempts never count as correct. This replaces the draft's single-session perfect badge: the compact backup does NOT record enough information to prove a historical perfect session. The chapter-complete screen still grades the actual session and never reports skipped questions as perfect.

Same synced state and chapter metadata give the same badges on a fresh device. Chapter badges need the current catalog's complete QID list; metadata may need to load once. Retired/revised catalog chapters can change these derived results. A deliberate synchronized progress reset also resets derived milestones. A phone change cannot recover progress that never reached Telegram; the existing sync-status/capacity messages remain authoritative.

## Four safeguards

1. Only a device/account-scoped `ui_delight_user_<id>` meta key may be added, with `{schema:1,shown:{id:date}}`, to suppress repeat celebrations. Loading does not write it. The draft's old `earned` field and all unknown extra fields are preserved if present, but never used as achievement evidence. Unknown record versions remain read-only. No old saved field, store, database version, sync replica or CloudStorage format changes.
2. Existing answers, favorites, downloads, sync and onboarding behavior are unchanged. Returning users are not blocked by new UI. Badge/streak computation is read-only, including after a cloud pull.
3. The actual prior app (`87eb5e544afe7b39bd952323cd385f06d6df9e74`) is used in the old/new/old browser test. It ignores/preserves the added cosmetic key and still opens a downloaded chapter.
4. Unit tests check purity, additive/idempotent cosmetics, unknown schemas, valid QID evidence, legacy correctness and calendar boundaries. Browser compatibility compares every old IndexedDB key/value. The new-device test uses two empty browser contexts and the production sync bridge/CloudClient with a shared test CloudStorage SDK adapter: earn, push, restore, render all four badges and seven-day streak with NO copied local state, then reload offline. Another account stays empty.

No new cloud keys or cloud writes for achievements. Existing 716-key/4096-character limits and manifest-last sync are untouched. Browser contexts are device simulations, not a claim of a physical Telegram phone-transfer test. No production queue, credentials, infrastructure or account settings touched.
