# Local achievements: four-condition migration contract

Task 5 uses the owner's conditional approval rule for later additions. Self-merge only with all four proven and both exact-head CIs green.

1. Adds only `ui_delight_user_<id>` (or browser) in existing medmcq v2/meta: `{schema:1,earned:{badge_id:YYYY-MM-DD}}`. No database version/store, previous field, downloaded pack, answer, favorite or sync payload changes. Empty records are not written. Unknown versions are preserved read-only; extra fields/earned keys survive.
2. Returning users continue normally without any new blocking UI; existing onboarding skip behavior remains. Badge qualification reads existing activity/answers. First/perfect chapter badges require the actual full chapter's question IDs graded in one new session. Never infer an old perfect session from incomplete history.
3. Rollback to the actual previous app (87eb5e544afe7b39bd952323cd385f06d6df9e74) ignores and preserves the additive key. Achievement dates are local, not part of Telegram backup. Normal progress reset does not repurpose/delete the new local record.
4. Pure migration/earning tests cover nonmutation, idempotence, unknown versions, scope and invalid perfect sessions. Real browser flow 05_delight.py loads old/new/old at the same isolated origin and compares every existing database record, plus proves the old app still opens a saved chapter. Separate actual chapter completion/offline reload tests verify badges persist and progress/favorites/sync/downloads are unchanged.

Physical haptic feel requires device testing. Calls safely no-op outside a supported Telegram host and when Reduce Motion is enabled. No secrets, production queue operations, account settings or infrastructure changes.
