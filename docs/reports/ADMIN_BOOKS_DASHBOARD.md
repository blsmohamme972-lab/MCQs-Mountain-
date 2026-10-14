# Admin Books Dashboard implementation record

## Scope and authorization

Owner authorized a read-only, server-enforced admin Books dashboard, tests, isolated branch/PR, and deployment only after every required check passes. The admin allowlist must be a Worker secret named `ADMIN_IDS`; no real Telegram ID or credential is committed. Branch: `feature/admin-books-dashboard`.

## Starting point and isolation

Starting main and feature branch both point to `898cc20d9635f82342a9ce6ea03dc14f970c911b`.
Open PRs inspected before changes: #38 (reports), #35 (accessibility), #43 (comments plan). Reports owns changes in app/index.html and worker/bot.mjs; accessibility owns manifest/accessibility files. Dashboard implementation will use new modules and minimal independent integration hooks, with no edits to those agents' branches or feature logic. Content branches and the leaderboard branch are excluded. Recheck active branches and latest main before integration/merge. Never change existing visual baselines.

## Required data semantics

Read current published assets and authoritative D1 metadata. Never turn unavailable or absent historical information into a numeric zero or invented timestamp. Show explicit unavailable/inconsistent states, provenance, and independent published-question comparisons. One aggregated authenticated endpoint; no admin payload for rejected requests. Read-only view, detail, filters, sorting, CSV. No new student tracking or saved-progress changes.

## Gates

Content Contract, existing Visual/Flow, account separation, budgets, 360/390/430 overflow/bottom clearance, admin authentication/authorization/count fixtures, and unchanged existing screens must all pass on the exact latest-main-based PR head. Deployment additionally requires safely configured ADMIN_IDS, version IDs, staged smoke checks, production signed admin success and non-admin denial.

## Progress

- GitHub read/write access confirmed.
- Target branch already exists at main; no other branch changed.
- Direct local clone failed because this runtime cannot resolve github.com. Continuing through authorized GitHub connector and CI artifacts; no credentials requested or printed.
- Implementation and verification remain in progress. This checkpoint is not a completion or test-pass claim.
