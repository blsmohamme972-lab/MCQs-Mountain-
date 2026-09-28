# Onboarding: additive local record and rollback contract

Owner approval received 2026-09-28, conditional on all four checks below and green exact-head Content and Visual/Flow CI. This does not authorize unrelated data or infrastructure changes.

1. **Additions only.** Existing `medmcq` version 2 / `meta` gets one new device/profile-scoped key `ui_onboarding_user_<numeric Telegram id>` (or `ui_onboarding_user_browser`), with `{schema:1, complete:boolean, specialty:string|null}`. No field in existing state is renamed, moved or deleted. No database, store, sync payload or version change.
2. **Returning users.** Existing answers, favorites, book favorites, downloads, resume or education acknowledgement auto-complete onboarding. New users may Skip on any screen. The key is not part of `S`, answer events, downloaded packs or Telegram CloudStorage. Unknown schemas are preserved, not overwritten.
3. **Rollback.** The previous app reads its existing keys and ignores the additive UI key. Rollback must leave that key in place. It is safe to return to the current version afterward.
4. **Tests.** `tools/tests/js/onboarding.test.cjs` covers nonmutation, idempotence, account scoping and forward safety. `tools/ui/flows/03_onboarding.py` covers once-only completion, Skip and offline reload in phone/iPad light/dark. `03_compatibility.py` runs the actual pre-PR31 app from commit `239c800452e11eb6d42873ad9d35a8e10e35d07a`, upgrades and rolls back at the SAME isolated origin, compares every existing IndexedDB key/value including sync replica, packs and image bytes, checks the only addition is the onboarding key, and opens the saved chapter in the old app.

Visual evidence from run 36400522757 / artifact 10960595329 was inspected in all four device/theme combinations. Expected hashes are deliberate approvals, never generated as expectations inside CI. A fresh exact-head check must pass before merge.
