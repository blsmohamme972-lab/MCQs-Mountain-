# Owner review required: local onboarding record

This task is deliberately not self-merged. It introduces an additive local UI record, not a new IndexedDB database, store or version.

## Shape and scope

Existing `medmcq` version 2 / `meta` gets key `ui_onboarding_user_<numeric Telegram id>` (or `ui_onboarding_user_browser`). Value: `{schema:1, complete:boolean, specialty:string|null}`. This key is local to the device/profile; it is not added to `S`, answer events, downloaded packs, favorites, or Telegram CloudStorage.

## Migration

`app/design/onboarding-core.js` exports a pure migration plan. A missing record for a returning student (existing answers, downloads, favorites, resume or educational acknowledgement) is initialized as complete so the tour does not interrupt studying. A fresh profile gets the three-screen tour and writes only when skipped or finished. Existing valid records are retained; unknown schemas or malformed data are preserved, not replaced. Known extra fields survive completion. When storage is unavailable, completion is session-only and the app says so.

The migration never mutates or deletes old student records. Removing the UI module rolls back presentation without touching the additive record. Do not delete or repurpose the new key during rollback.

## Proof

`node --test tools/tests/js/onboarding.test.cjs` checks preservation, idempotence, scope, fresh/returning behavior and unknown-version safety. `tools/ui/flows/03_onboarding.py` checks the three real screens in phone/iPad light/dark, once-only skip/completion, specialty discovery, offline operation and preserved saved progress.

Owner decision: approve this small device-local record to enable once-only onboarding. No account, token, infrastructure, publisher or BotFather action is required.
