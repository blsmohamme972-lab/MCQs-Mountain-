# Kafu - PROGRESS

Updated: 2026-09-28. Night 1 tracker; historical reports remain in docs/reports/.

## Protected baseline

Owner verified KAFU-UPLOAD-TEST v1: 4 questions, 1 chapter, both image types, answer feedback and Library entry. Do not remove or republish it tonight. Preserve non-empty Library fallback, permanent IDs and existing local progress. English-only UI. D1 remains operational metadata, not the question library.

## Night 1, in order

1. **Security merged: PR #12.** CI 36365428074 green. Deploy Kafu #13 / 36365507996 green, including the read-only app-shell and protected-book check. Current tracked-source/workflow/report scanner passed. Known previous chat/log credential exposure is not erased: owner must use docs/ROTATE_SECRETS.md. No credential values, scopes, account settings or bindings changed. Added a read-only verification step to the existing deploy workflow, not a new production trigger.
2. **M3 automated tests implemented on night1/02-m3-tests; awaiting CI/review.** Real in-memory SQLite executes the production queue SQL; all network requests are mocked. Covers invalid metadata, duplicate/no-op, reverse two-part assembly, failed replacement, changed multipart layout, /retry, /clear, /hold, /flags, moderation callbacks, /rollback, /remove, non-owner/group silence and stale/identity-mismatched completion. Offline Python integration tests cover broken ZIP + repair report + red result, SHA-256 duplicate detection, multipart validation/publishing and rollback/remove ID preservation. Fixed atomic failed replacement/clear and stale completion bugs. No schema/settings/secrets changes or production commands.
3. Full personal CloudStorage sync: pending.
4. Pinned FSRS Review Due: pending.
5. Invisible/offline downloads: pending.
6. Small UX/full-screen diagnostics: pending.
7. Offline app shell: pending.
8. Privacy/disclaimer: pending.
9. Weekly D1 backup: pending; infrastructure-sensitive changes remain open for owner review.
10. Parser library/batch production/bulk moderation: pending.
11. Final handoff/admin docs/morning report: pending.

## Execution rules

One task per branch/PR. Merge only covered changes with green CI and no credential/infrastructure setting changes. All acceptance tests run offline; no temporary production triggers. Verify deployment and app/catalog after merges. Tools/docs-only changes may not trigger a new deployment; record the last verified unchanged app deployment. Push progress after every task. Final report: docs/reports/NIGHT_1.md.
