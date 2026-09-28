# Kafu - PROGRESS

Updated: 2026-09-28. Authoritative Night 1 tracker; historical reports remain in docs/reports/.

## Verified baseline

M2 publishing and the M3 Telegram upload path work. Owner screenshots show KAFU-UPLOAD-TEST v1 published, 4 questions, 1 chapter, both image types, answer feedback and Library entry. PRs #9-#11 resolved queue authentication diagnostics, failed-upload recovery and uninstrumented preview HTTP calls. Drain run 36364200827 published the test; live catalog proof 36364313439 confirmed it. Do not remove or republish this book during Night 1.

The app must stay English-only. Preserve non-empty Library fallback, immutable content URLs, permanent question IDs and existing local progress. D1 stores operational metadata, not the MCQ library. Existing synthetic content must remain intact.

## Night 1, in order

1. Security: implemented on night1/01-security; source scanner, HTTP redaction/redirect/size regression tests and docs/ROTATE_SECRETS.md. Await CI/review before merge. No credential values, scopes, bindings or account settings changed. Historical logs/chats still require owner rotation.
2. M3 automated acceptance: pending.
3. Full personal CloudStorage sync: pending.
4. Pinned FSRS Review Due: pending.
5. Invisible/offline downloads: pending.
6. Small UX/full-screen diagnostics: pending.
7. Offline app shell: pending.
8. Privacy/disclaimer: pending.
9. Weekly D1 backup: pending; leave infrastructure/security-sensitive changes open for review.
10. Parser library/batch production/bulk moderation: pending.
11. Final handoff/admin docs/morning report: pending.

## Safety and execution

One task per branch/PR. Merge only tested changes with green CI, without changing credentials or infrastructure settings. No production test commands, temporary triggers, account settings, BotFather work or new secrets. Verify the latest Deploy Kafu and live app/content after each merge; document when a docs/tools-only merge does not trigger a deployment. CI/tests must not call production. Push progress after every task. Final delivery: docs/reports/NIGHT_1.md.
