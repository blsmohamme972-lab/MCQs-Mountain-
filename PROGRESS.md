# Kafu - PROGRESS

Updated: 2026-09-28. Night 1 tracker; historical reports remain in docs/reports/.

## Protected baseline

Owner verified KAFU-UPLOAD-TEST v1: 4 questions, 1 chapter, 2 images. Do not remove or republish it tonight. Preserve non-empty Library fallback, permanent IDs and existing local progress. English-only UI. D1 remains operational metadata, not the question library.

## Night 1, in order

1. **Security merged: PR #12.** CI 36365428074 green. Deploy Kafu #13 / 36365507996 green including app/protected-book GET checks. Tracked-source scanner passed. Earlier chat/log exposure still requires the owner-only docs/ROTATE_SECRETS.md procedure. No credential values, scopes, account settings or bindings changed.
2. **M3 tests and fixes merged: PR #13.** CI 36365955918 green. Deploy Kafu #14 / 36365997924 green, including live app and protected catalog checks. Real SQLite bot tests plus offline Python package tests cover broken ZIP/report/red result, duplicate, multipart, failed replacement, retry/clear, hold/flags, moderation, rollback/remove and owner/private gates. Queue writes are atomic and stale completions cannot alter active books. No production test commands or triggers.
3. **M5 personal sync implemented on night1/03-personal-sync, awaiting CI/review.** Per-writer compact counters and deterministic registers; stars/unstar tombstones, FSRS state, time/streak/resume; immutable chunk manifests with checksums and 716-key/4096-char safeguards. Local full answer events and account-isolated personal state; legacy counts preserved without inventing missing historical correct answers. Reset explicitly affects all synced devices and retains stars. Added deterministic frontend assembly that inlines reviewed modules with the original HTML, avoiding partial module loads. Only the existing deploy's code-build step changes; no settings/scopes/bindings. Tests include mocked CloudStorage, actual base-app integration and assembled script syntax.
4. Pinned FSRS Review Due: pending.
5. Invisible/offline downloads: pending.
6. Small UX/full-screen diagnostics: pending.
7. Offline app shell: pending.
8. Privacy/disclaimer: pending.
9. Weekly D1 backup: pending; infrastructure-sensitive changes remain open for owner review.
10. Parser library/batch production/bulk moderation: pending.
11. Final handoff/admin docs/morning report: pending.

## Execution rules

One task per branch/PR. Merge only tested changes with green CI and no credential/infrastructure setting changes. No temporary production triggers. Verify Deploy Kafu's read-only app/catalog guard after merges. Tools/docs-only changes may not trigger a new deployment; record the last verified unchanged app. Push progress after every task. Final report: docs/reports/NIGHT_1.md.
