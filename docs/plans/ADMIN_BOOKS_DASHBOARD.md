# Admin Books Dashboard

## Owner-authorized scope

Implement a read-only, server-authorized Books dashboard on `feature/admin-books-dashboard`. No content, validator, import/publish pipeline, leaderboard, student-progress format, existing visual baseline, or other agent branch changes. Only merge after all checks pass on the latest main; otherwise retain the PR with evidence and blockers. No new paid service.

## Initial inspection

- Base: `898cc20d9635f82342a9ce6ea03dc14f970c911b`.
- The requested feature branch existed and was identical to main before this commit.
- Open PRs inspected: #35 (accessibility), #38 (question reports), #43 (comments plan). Shared integration surfaces include the frontend module manifest and Worker entry; avoid broad edits and preserve those agents' changes.
- Prefer new isolated frontend/server/test files; scope all dashboard styling under `.kafu-admin`.
- GitHub connector read/write access is available. Direct network access from the execution container failed DNS resolution; use connector reads and CI artifacts as the alternative. Never expose credentials.

## Non-negotiable contracts

1. Verify Telegram initData before consulting the runtime `ADMIN_IDS` secret. No administrator ID in repository code, fixtures, screenshots or logs. All `/admin/` responses use `Cache-Control: private, no-store`; deny unauthorized callers without book data.
2. The Me entry is absent until a server capability response authorizes the current session. No admin data in localStorage, service-worker caches or another Telegram account's session.
3. Read-only endpoint(s), with one aggregated books response. Source counts from current D1 records and actual published pack questions; independently compare published counts and display discrepancies. Missing/unsupported metadata is explicitly unavailable, never guessed or silently zero.
4. Inventory every uploaded book, group versions deliberately, and expose chapter counts, warnings, held/skipped questions, report availability, source provenance and alerts. Identify test books without altering their visibility.
5. Filter/search/sort and safely escaped CSV export. Internal horizontal table scrolling, sticky name column, no page overflow and no bottom-nav occlusion.
6. Cover normal/held/skipped/flagged/multi-version/test/multi-branch fixtures, authentication attacks, ordinary-user absence, account changes, read-only behavior, CSV safety, and 360/390/430 layouts. Existing screenshots must remain unchanged.
7. Use only confirmed deployment capabilities. Secret setup and deployment must not print values. Record previous/new Worker version IDs and separate signed API verification from a real interactive Telegram-session test.

## Progress

- [x] Repository and collision inspection; branch claim.
- [ ] Data-source mapping and accuracy limitations.
- [ ] Server authentication and aggregated read model.
- [ ] Phone-first UI and CSV/detail tools.
- [ ] Unit, integration, account, geometry, budget and visual tests.
- [ ] Latest-main reconciliation and full green CI.
- [ ] Merge, staged deploy, production authorization/consistency verification.
- [ ] Evidence and final report.
