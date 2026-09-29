# Kafu per-question Community — live implementation plan

This document supersedes the stale plan-only PR #43 for the shipped implementation branch `feature/question-comments-live`.

## Product rules implemented

- Community is optional and never part of grading, FSRS, downloads, resume, achievements, streaks or CloudStorage sync.
- Thread key is only the permanent `Q#########` ID.
- Discussion is visibly locked until the current local account has answered the question at least once.
- The spoiler lock is client-side only. It is a learning guardrail, not an authorization boundary.
- Locked Discussion causes zero Community API requests.
- Unlocked threads are fetched only when the user opens Discussion. There is no polling and no request per question render or answer.
- Initial top-level page is capped at 20 comments. One reply level only; the included reply payload is bounded.
- Plain Unicode text only, 1–600 Unicode code points after trimming. No HTML, Markdown, media, previews or rich embeds.
- Comment bodies use `dir="auto"`; UI chrome remains English/LTR.
- Cached thread reading and per-account saved drafts are separate from progress. V1 intentionally does not auto-send an offline outbox; this avoids cross-account write risk while preserving typed text.

## Identity and privacy

Owner-approved visible identity replaces the old pseudonymous proposal.

Visible on comments:
- verified Telegram `first_name + last_name` display name when available;
- verified safe HTTPS Telegram profile photo when available;
- polished initials fallback otherwise.

Never publicly exposed:
- Telegram username;
- Telegram numeric ID;
- phone number;
- internal `user_key`.

Every student request verifies Telegram Mini App `initData` server-side using the already-tested leaderboard verifier. Comments derive an independent HMAC ownership key using the `comments:` namespace. Client-supplied identity, author, ownership, moderation and verification fields are ignored.

## Medical safety and moderation

Every thread states **“Student discussion — not verified”**. Helpful votes never alter official content or imply verification.

Three unique reports temporarily move a comment to `hidden_pending`. Duplicate reports by the same reporter/comment are ignored.

Owner-only server authorization supports:
- restore;
- hide;
- delete;
- verify/pin one reply;
- unverify;
- ban author.

Only a reply can receive **Verified by Kafu**. The server clears any previous verified/pinned reply for that QID before marking the selected reply.

Report reason `answer_wrong` is stored with the permanent QID for owner review. Community never changes the official question, answer, explanation or book content.

## D1 schema

Additive migration: `migrations/0004_question_comments.sql`.

Isolated tables:
- `comment_users`
- `comment_threads`
- `comments`
- `comment_votes`
- `comment_reports`

All student hot paths have explicit indexes:
- top-level thread read by QID/status/order;
- reply read by parent;
- author rate-limit reads;
- Helpful user/rate reads;
- report queue/reporter/QID reads.

The implementation includes `EXPLAIN QUERY PLAN` tests for hot-path index use.

Removed/inactive content is checked against the active content catalog before normal student thread reads/creates. Discussion rows are not destroyed when content becomes inactive.

## Rate limits

Authoritative server limits:
- comments/replies: 5 per 10 minutes, 30/day/user;
- Helpful: 60/day/user;
- reports: 10/day/user.

Self-Helpful is rejected.

## Shared free-tier cost model

Current source-of-truth limits:
- Worker dynamic requests: 100,000/day shared by all Kafu dynamic traffic;
- D1 reads: 5,000,000 rows/day;
- D1 writes: 100,000 rows/day;
- D1 storage: 5 GB account total, with the current free-tier **500 MB per-database** ceiling applying to Kafu's shared database.

Launch model for **1,000 active commenting students/day**:

| Traffic | Conservative model | Requests/day |
|---|---:|---:|
| Existing non-Community API/bot/admin reserve | fixed | 2,000 |
| Leaderboard reserve | <=10/student/day | <=10,000 |
| Community thread opens/refreshes | 3.0/student/day | 3,000 |
| Community pagination | 0.8/student/day | 800 |
| Comments/replies | 0.6/student/day | 600 |
| Helpful | 1.0/student/day | 1,000 |
| Reports/delete/moderation student actions | 0.1/student/day | 100 |
| **Combined envelope** |  | **17,500/day** |

17,500/day uses 17.5% of the 100k shared Worker allowance and leaves 82.5% gross headroom. The rollout safety gate is 70,000 shared dynamic requests/day, preserving the requested >=30% headroom.

Community D1 read model:
- thread page: <=20 top-level rows + <=60 included replies, plus indexed per-user Helpful lookups and profile joins;
- conservative allowance: 140 rows/read request;
- 3.8 thread/page reads per active commenter/day => about **532,000 rows/day** at 1,000 active commenters;
- mutation/auth/rate-limit allowance: **~80,000 rows/day**;
- Community total planning envelope: **~612,000 rows/day**, about 12.2% of the 5M D1 read allowance.

Community D1 write model at the 1,000-user launch envelope counts index maintenance conservatively, not just logical rows:
- 600 comments/replies × ~7 D1 rows written including indexes = ~4,200;
- 1,000 Helpful actions × ~7 rows including vote/counter index maintenance = ~7,000;
- 100 report/delete actions × ~6 rows = ~600;
- profile refresh allowance = ~2,000;
- total planning envelope: **~13,800 D1 rows written/day**, about 13.8% of the 100k allowance.

Storage planning:
- no media and bodies capped at 600 Unicode characters;
- conservative effective comment+index footprint ~2 KB/comment before vote/report growth;
- 10,000 new comments/day therefore adds roughly 20 MB/day of comment/index data before votes/reports. Because Kafu's current shared free D1 database has a 500 MB database ceiling, sustained heavy-comment retention would become a storage constraint quickly and must be measured well before that workload.

Heavy scenario: **10,000 new comments/day**
- comment rows plus index maintenance: ~70,000 D1 rows written;
- if average 2 Helpful actions/comment: ~140,000 more rows written;
- reports/profile/moderation reserve: ~12,000;
- total planning envelope: **~222,000 D1 rows written/day**.
That exceeds the current free write allowance. It identifies D1 write amplification—especially Helpful counter/index maintenance—as the next bottleneck. Kafu must optimize reaction/counter storage before approaching this workload; it must not silently move to a paid service.

## Performance and offline behavior

- No Community HTTP request during normal question render, grading or answer submission.
- Discussion cache is namespaced by current Telegram account and QID/sort.
- Reopening a <5 minute cached thread uses local cache without a network request.
- Offline cached threads remain readable with an explicit offline message.
- Drafts are stored separately by current Telegram account/QID and never in the progress object or Telegram CloudStorage.
- V1 does not auto-flush drafts while switching accounts.

## Arabic font

Community uses a self-hosted IBM Plex Sans Arabic subset from `@fontsource/ibm-plex-sans-arabic` under SIL OFL 1.1. PR CI measures its exact WOFF2 bytes and total font budget. Production pinning requires the exact SHA-256 and the existing <=100 KB total shipped WOFF2 budget to stay green.

## Rollback

Community is isolated behind its frontend module/API routes. If production verification finds a serious issue:
1. remove/disable the Community frontend registration;
2. keep the additive D1 tables intact;
3. preserve normal study behavior;
4. deploy the previous safe Worker version through the existing staged workflow;
5. fix on branch and redeploy only after green CI.
