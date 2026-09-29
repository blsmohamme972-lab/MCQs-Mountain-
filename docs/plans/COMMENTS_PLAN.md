# Kafu per-question comments plan

Status: plan only. No implementation is authorized by this document.

## 1. Goal and non-negotiable boundaries

Build a per-question student discussion system that feels native to Kafu's Arcade-Clean study screen, remains fast on low-end phones, protects the offline-first study path, and costs $0/month within the current Cloudflare free-tier guardrails.

This feature must not modify, rename, migrate, delete, or depend on existing saved study progress. Normal answering, grading, review, downloads, resume, favorites, achievements, FSRS, time tracking, and Telegram CloudStorage sync must continue to work if the comments service, Worker, or D1 is unavailable.

Implementation constraints:

- Shared online comments data lives in the existing D1 social-data store.
- D1 schema changes are additive only.
- No existing saved-progress schema changes.
- The comments offline outbox uses a separate, comments-only local store/database and is namespaced by the current Telegram account. It must not reuse or mutate the study-progress record.
- All comments APIs sit behind a feature flag. First rollout is owner-only.
- Every comments API request that represents a student identity must verify Telegram Mini App `initData` server-side using Telegram's HMAC verification algorithm. Client-provided Telegram user IDs, names, roles, scores, ownership, moderation status, or rate-limit identity are never trusted.
- Raw Telegram ID is not stored in comment rows. The server derives a stable pseudonymous `actor_key` using a dedicated server secret and the verified Telegram user ID. The raw Telegram name is never the default public identity.
- The English UI remains English, but user-generated comments may be Arabic, English, or mixed text.
- Plain text only. No HTML, Markdown rendering, images, attachments, executable links, or rich embeds.
- No implementation PR may merge until the existing same-phone A→B→A personal-state isolation test remains green.

## 2. Product behavior

### 2.1 Entry point and spoiler lock

The question screen feedback/tool panel gains a **Discussion** action next to the existing Report/Share controls. Opening it uses the same bottom-sheet visual language and focus behavior as Kafu's existing sheet.

The discussion is locked until the student has answered that question at least once on the current local account. Before answering, the action is visible but disabled/locked with copy such as:

> Answer this question to unlock student discussion.

**This spoiler lock is intentionally client-side.** Kafu's authoritative answer history is local/offline-first and is not sent to D1. Making the Worker enforce the lock would require uploading answer/progress state, which would violate the current privacy/cost architecture and make ordinary study depend on the backend. The client therefore checks the existing local answer record for the permanent question ID before enabling the sheet.

This is acceptable because the lock is a learning UX guardrail, not a security boundary. A determined technical user could call the discussion endpoint directly after valid Telegram authentication, but that reveals only student discussion that authenticated Kafu users are otherwise allowed to read. It does not expose another student's private data, answer history, credentials, or protected admin data.

### 2.2 Lazy loading

Comments must add zero network dependency to the normal grading path.

- No thread request on question render.
- No thread request on answer submission.
- The thread loads only when Discussion is tapped.
- Comment counts for every question in the current chapter load in **one request**.
- Counts are cached client-side.
- Threads use cursor pagination, **20 top-level comments per page**.
- One reply level only.
- Replies are fetched with their parent page; replies cannot have replies.
- Default sort is **Most helpful**, with **Newest** as an alternate sort.
- Re-opening a recently viewed thread should paint cached content immediately and refresh in the background if stale.

### 2.3 Medical-safety framing

Every thread starts with a persistent label:

**Student discussion — not verified**

This label remains visible even if individual replies are verified.

The owner may pin one reply per thread and mark it:

**Verified by Kafu**

A verified reply is an owner action, not a crowd vote. It must never be inferred from helpful votes.

If a student reports a comment or posts a comment asserting that the official answer is wrong, the UI offers a structured **"I think the answer is wrong"** action. That action creates a normal comments moderation report and also feeds the existing Kafu question-report pipeline using the permanent question ID. The future implementation must preserve the owner-approved report minimization policy: question ID, book ID/version, reason, optional note <=300 characters; Telegram user ID only for rate limiting and not retained in the report record.

Discussion must never present crowd consensus as medical verification.

## 3. Permanent question identity and book lifecycle

Comments are keyed by Kafu's permanent question ID format:

`Q#########` — literal `Q` followed by exactly 9 digits.

This matches the existing publisher's `id_map` behavior. When a book is re-uploaded and the publisher reuses the same permanent ID, its discussion survives automatically. Comments are not keyed to local question number, chapter ordinal, book version, stem text, or pack filename.

Proposed invariant:

- `qid` is the durable thread key.
- `book_id` and `chapter_id` are thread metadata used for visibility/count batching, not identity.
- A new book version that preserves a QID preserves that thread.
- A retired/deleted question is not shown in normal student UI.
- When `/remove BOOK-ID` completes and the existing `published_books.active` state becomes 0, all threads for that book become hidden from student reads immediately through the active-book visibility check. The comments are retained for rollback/audit unless the owner explicitly deletes them.
- If that book is later restored/rolled back to an active version and the QIDs are again active, retained discussions may become visible again after validation.

The Worker must validate QID shape and resolve/validate the QID's book/chapter mapping from server-controlled content before creating the first thread row. It must never accept a client-supplied `book_id`, `chapter_id`, or version as authoritative for ownership or visibility.

## 4. Proposed additive D1 data model

This is a design for a future migration; this plan does not create it.

### 4.1 `comment_users`

| column | type | purpose |
|---|---|---|
| `actor_key` | TEXT PRIMARY KEY | HMAC-derived stable pseudonymous identity |
| `display_name` | TEXT NULL | optional student-chosen nickname |
| `anonymous_no` | INTEGER NOT NULL | stable display number used as `Student #1234` |
| `role` | TEXT NOT NULL DEFAULT 'student' | `student`, later `trusted_moderator`, `owner` |
| `banned_until` | TEXT NULL | null or moderation expiry |
| `created_at` | TEXT | audit timestamp |
| `updated_at` | TEXT | profile/moderation timestamp |

Rules:

- Never populate from Telegram first name by default.
- Default public label is `Student #1234` derived from a stable server-side value.
- A student may opt into a nickname, with a short length limit and plain text only.
- Nicknames are presentation only; authorization always uses `actor_key`.

### 4.2 `comment_threads`

| column | type | purpose |
|---|---|---|
| `qid` | TEXT PRIMARY KEY | permanent QID |
| `book_id` | TEXT NOT NULL | server-validated book |
| `chapter_id` | TEXT NOT NULL | server-validated chapter |
| `visible_count` | INTEGER NOT NULL DEFAULT 0 | fast chapter counts |
| `total_count` | INTEGER NOT NULL DEFAULT 0 | includes hidden/deleted for audit accounting |
| `pinned_comment_id` | INTEGER NULL | owner-verified pinned reply |
| `last_activity_at` | TEXT | cache/sort aid |
| `created_at` | TEXT | timestamp |

Indexes:

- `INDEX comment_threads_book_chapter ON comment_threads(book_id, chapter_id)`
- primary key already indexes `qid`

The chapter count endpoint reads this compact table rather than scanning all comments.

### 4.3 `comments`

| column | type | purpose |
|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | comment ID |
| `qid` | TEXT NOT NULL | thread key |
| `parent_id` | INTEGER NULL | one-level reply; null for top-level |
| `actor_key` | TEXT NOT NULL | pseudonymous author |
| `body` | TEXT NOT NULL | plain text |
| `helpful_count` | INTEGER NOT NULL DEFAULT 0 | denormalized sort count |
| `status` | TEXT NOT NULL DEFAULT 'visible' | `visible`, `hidden_pending`, `hidden_owner`, `deleted_author`, `deleted_owner` |
| `is_kafu_verified` | INTEGER NOT NULL DEFAULT 0 | owner-only |
| `created_at` | TEXT | timestamp |
| `updated_at` | TEXT | edit/moderation timestamp |

Constraints:

- body 1–600 Unicode characters after trimming; exact limit should be enforced both client and server.
- `parent_id` may reference only a top-level comment in the same QID.
- Students cannot set `status`, `helpful_count`, `is_kafu_verified`, author identity, timestamps, or parent ownership.
- Initial version should not allow general editing after posting; deletion is simpler and safer. If edits are added later, preserve an audit-safe moderation model.

Indexes:

- `INDEX comments_thread_helpful ON comments(qid, status, helpful_count DESC, id DESC)`
- `INDEX comments_thread_newest ON comments(qid, status, id DESC)`
- `INDEX comments_parent ON comments(parent_id, status, id)`
- `INDEX comments_actor ON comments(actor_key, id DESC)`

### 4.4 `comment_votes`

| column | type |
|---|---|
| `comment_id` | INTEGER NOT NULL |
| `actor_key` | TEXT NOT NULL |
| `created_at` | TEXT |

Primary key: `(comment_id, actor_key)`.

A helpful action inserts/deletes this row and updates `comments.helpful_count` in the same D1 transaction/batch. Self-voting is rejected.

Index:

- primary key covers duplicate prevention
- `INDEX comment_votes_actor ON comment_votes(actor_key, created_at)` for rate limiting

### 4.5 `comment_reports`

| column | type |
|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT |
| `comment_id` | INTEGER NOT NULL |
| `reporter_key` | TEXT NOT NULL |
| `reason` | TEXT NOT NULL |
| `created_at` | TEXT |
| `status` | TEXT NOT NULL DEFAULT 'pending' |

Unique: `(comment_id, reporter_key)`.

Indexes:

- `INDEX comment_reports_pending ON comment_reports(status, created_at)`
- `INDEX comment_reports_comment ON comment_reports(comment_id, status)`

A comment auto-hides to `hidden_pending` after **3 unique pending reports** as the proposed default. It remains available to owner moderation. Owner can restore, hide, delete, or ban. The threshold must be server-side and unique-reporter based.

### 4.6 Optional future `comment_moderation_log`

A small append-only moderation audit table is recommended once trusted moderators are enabled:

`id, moderator_actor_key, action, target_comment_id, target_actor_key, reason_code, created_at`.

Do not add it merely for launch if owner-only moderation already has adequate bot evidence; add it with the moderator role.

## 5. Authentication and pseudonymous identity

Every `/api/comments/*` request sends Telegram `initData` in an authorization header or equivalent standard request header.

Worker flow:

1. Parse raw `initData`.
2. Remove `hash` from the data-check set.
3. Sort remaining key/value pairs exactly as Telegram specifies.
4. Derive the Telegram WebApp secret from the bot token and verify the HMAC in constant-time.
5. Validate `auth_date` freshness to reduce replay abuse.
6. Parse the verified user object only after signature success.
7. Derive `actor_key = HMAC(COMMENT_USER_KEY, telegram_user_id)`.
8. Use `actor_key` for ownership, rate limits, votes, reports, delete-my-comments, bans, and moderator role.
9. Never trust a client-submitted Telegram ID or actor key.

Tests must prove:

- valid initData succeeds;
- forged hash fails;
- changed user ID after signing fails;
- stale initData fails according to the chosen age window;
- fake owner/moderator role from client fails;
- one user's actor key cannot delete another user's comment.

A dedicated `COMMENT_USER_KEY` is preferable to using the bot token directly so routine bot-token rotation does not orphan comment ownership. Key rotation needs a documented migration strategy before implementation.

## 6. API design

All responses are JSON, small, cache-aware, and bounded.

### Reads

**GET `/api/comments/counts?book=...&chapter=...`**

- one request per chapter
- requires verified initData
- returns sparse `{qid: visible_count}` map plus `generated_at`
- server checks the book is active
- query reads `comment_threads` through indexed `book_id, chapter_id`
- no comments bodies returned

Alternative acceptable shape: client sends the current chapter's bounded QID list and server returns counts only for validated QIDs. The server must still not trust client metadata for writes.

**GET `/api/comments/thread/:qid?sort=helpful&cursor=...`**

- 20 top-level comments per page
- one reply level included for those parents
- cursor is opaque and encodes stable sort position, never a raw offset
- `sort=helpful`: cursor contains `helpful_count + id`
- `sort=newest`: cursor contains `id`
- hidden/deleted rows are filtered or represented as minimal tombstones only when necessary to preserve reply context
- returns whether the current actor has marked each visible comment helpful
- pinned verified reply is returned separately at the top

**GET `/api/comments/mine`**

- paginated list used only by Privacy/Delete my comments
- indexed by `actor_key`

### Writes

**POST `/api/comments/thread/:qid`**

Body: `{body, client_nonce}`.

- server validates QID and active book
- server validates body as plain text and length
- server rate-limits by actor key
- `client_nonce` provides idempotency for offline retries; repeated nonce from the same actor returns the original result without creating a duplicate
- first post creates the validated thread row if absent
- updates thread counters/activity atomically

**POST `/api/comments/:id/replies`**

- same limits
- parent must be top-level, visible, same QID
- reply-to-reply rejected

**PUT/DELETE `/api/comments/:id/helpful`**

- idempotent set/unset
- self-vote rejected
- atomic vote row + denormalized counter update

**POST `/api/comments/:id/report`**

- one pending report per reporter/comment
- bounded reason enum plus optional short note if owner approves it
- at threshold N=3 unique reports, auto-hide pending owner review
- `answer_wrong` reason additionally enters the existing question-report path for that QID

**DELETE `/api/comments/:id`**

- author may soft-delete own comment
- owner/moderator permissions separate
- reply children are retained with a deleted-parent tombstone if necessary

**DELETE `/api/comments/mine`**

- delete-my-comments operation
- authenticated actor only
- batched/continuable server-side to stay within Worker CPU and D1 limits
- marks comments deleted and removes public body
- removes actor's votes/reports where policy requires
- client shows completion honestly; no claim that provider backups disappear instantly

### Owner/trusted-moderator endpoints

Owner bot is preferred over building a new admin dashboard.

Future owner commands:

- `/comments [pending]` — newest moderation queue
- `/comment COMMENT_ID` — details + actions
- `/comment hide COMMENT_ID`
- `/comment restore COMMENT_ID`
- `/comment delete COMMENT_ID`
- `/comment verify COMMENT_ID` — pin and mark Verified by Kafu
- `/comment unverify COMMENT_ID`
- `/comment ban COMMENT_ID 1d|7d|30d|forever` — ban author without exposing raw Telegram ID
- `/comment unban COMMENT_ID`

When trusted student moderators are later enabled, they may hide/restore and triage reports but **cannot** mark a reply Verified by Kafu, change official answers, access raw Telegram identity, or permanently delete accounts/comments. Owner retains those actions.

## 7. Input safety and anti-abuse

### Content rules

- plain Unicode text only
- escape all rendered text
- no `innerHTML` insertion of user content
- strip/reject control characters except normal whitespace
- normalize line endings
- reject zero-width abuse if it materially defeats limits/moderation
- no clickable URL rendering in V1
- no HTML/Markdown interpretation
- 600-character limit
- optional nickname <=24 characters
- client validation is convenience; server validation is authoritative

### Rate limits

Proposed server-side launch limits, adjustable without schema changes:

- comments/replies: 5 per 10 minutes, 30/day per actor
- helpful toggles: 60/day per actor
- reports: 10/day per actor
- delete operations: 30 individual deletes/day; delete-all runs in bounded batches
- burst protection per Worker isolate may supplement but never replace the indexed D1 actor checks

Rate-limit checks use indexed recent-row queries and verified `actor_key`; no raw Telegram ID is persisted.

### Auto-hide

Proposed N = **3 unique reports**. A single student cannot trip the threshold repeatedly. Auto-hidden comments show no body to students while pending owner review. Owner may restore; abusive reporters can be rate-limited/banned separately if necessary.

## 8. Arabic and bidirectional text

The application chrome remains English. Comment bodies support Arabic and mixed Arabic/English naturally.

Rendering requirements:

- each comment body uses `dir="auto"`
- do not force the whole sheet to RTL
- preserve English UI control ordering
- allow browser Unicode bidi handling for mixed strings
- text alignment follows the resolved direction for the body only
- author/time/helpful controls remain layout-stable
- never concatenate untrusted body text into directional HTML attributes

Typography:

Kafu's current Nunito Latin subset does not provide Arabic glyphs. Comments need a self-hosted Arabic-capable fallback, preferably a compact WOFF2 subset such as **Noto Sans Arabic** or another OFL-compatible Arabic font, after license/hash/budget review. The implementation must preserve the existing global WOFF2 <=100 KB design budget or explicitly obtain owner approval for a revised budget; it must not silently add a large font.

Test strings must include:

- Arabic only: `أعتقد أن الإجابة الصحيحة هي ب بسبب...`
- English only
- mixed: `The finding هنا مهم لأن PaCO₂ مرتفع`
- Arabic with numbers and medical abbreviations
- punctuation and parentheses in mixed direction
- long wrapping at phone width

Visual tests cover phone/iPad, light/dark, 200% text where applicable, and `prefers-reduced-motion`.

## 9. Client caching and offline behavior

### Counts cache

Key: `comments:counts:{book_id}:{chapter_id}`.

- memory cache for current session
- optional comments-only IndexedDB cache
- TTL target: 5 minutes
- stale-while-revalidate when online
- invalidate the affected QID count after successful post/delete/moderation response
- zero-count questions are implicit; sparse payload reduces bytes

### Thread cache

Key includes `qid + sort + cursor`.

- paint last cached first page immediately if available
- background refresh after 2 minutes
- later pages can use longer TTL because they are less visible
- invalidate first page and affected parent after post/reply/vote/delete
- cap stored pages (for example 20 recent threads) to avoid unbounded device storage

### Offline writing

A separate comments-only local outbox stores:

`actor_namespace, client_nonce, qid, parent_id?, body, created_at, retry_state`.

It must be isolated from existing study-progress data and from other Telegram accounts.

When offline:

- user may write a comment/reply after spoiler unlock
- UI immediately shows **"Saved — will send when online"**
- queued item appears locally as pending, clearly not yet public
- reconnect triggers retry with the same `client_nonce`
- success replaces pending item with server response and removes outbox entry
- permanent rejection (banned, deleted book, invalid QID, over length) becomes a visible error with edit/copy/discard choices
- auth failure pauses the queue; never sends under a different Telegram account
- switching A→B must never flush A's queue as B
- returning to A restores A's pending queue

No offline queue is copied into Telegram CloudStorage in V1.

## 10. Arcade-Clean UI

Discussion opens as a bottom sheet from the existing question feedback/tool area.

Visual rules:

- use design tokens only
- calm study-core typography for comment text
- 2px/3px outlines and hard shadows only where existing sheet/component patterns call for them
- no confetti or continuous animation for comments
- no rapid flashing
- motion limited to transform/opacity token durations
- `prefers-reduced-motion: reduce` removes nonessential motion
- all tap targets >=44×44 CSS px
- color never carries moderation/offline/verified state alone; use icon + text
- medical safety label remains visually clear but not alarmist

### UI states

**Locked**
- Discussion control visible
- lock icon + "Answer this question to unlock student discussion"
- no network request

**Loading**
- sheet opens immediately
- header and safety label render first
- skeleton rows or a restrained progress indicator
- no blank full-screen takeover

**Empty**
- "No discussion yet. Start the thread."
- composer available
- safety label remains

**Loaded**
- pinned Verified by Kafu reply, if any
- sort control: Most helpful / Newest
- top-level comments with Helpful, Reply, Report
- one-level replies visually nested without excessive indentation

**Offline with cache**
- cached thread visible with "Offline — showing saved discussion"
- composer queues with "Saved — will send when online"

**Offline without cache**
- safety/header shown
- "Discussion isn't saved on this device yet."
- composer may still queue a new comment if QID is locally known and spoiler lock is open

**Queued send**
- local pending card
- status "Saved — will send when online"
- edit/discard allowed before first successful send

**Error**
- preserve typed text
- concise retry control
- never dismiss composer text on transient failure

**Removed/retired question**
- thread hidden from normal access
- queued send fails safely with "This question is no longer available."

**Banned/rate-limited**
- reading remains allowed unless separately blocked
- composer disabled with a factual retry/ban message
- no shaming language

## 11. Request and free-tier budget

Current source-of-truth limits:

- Worker dynamic requests: **100,000/day shared across the entire Kafu Worker**
- D1 rows read: **5,000,000/day**
- D1 rows written: **100,000/day**

The Worker request cap is **not per feature**. Bot, internal publishing/admin APIs, report sending, future leaderboard traffic, comments, and any other `/api/*` traffic all consume the same 100k/day pool.

No `docs/plans/LEADERBOARD_PLAN.md` exists on current `main` at plan time, so this plan uses the owner's requested conservative leaderboard envelope of **<=10 requests per active student/day** until that plan is available.

### 11.1 Shared Worker request table

Planning envelope, not measured production telemetry:

| Shared Worker traffic | Requests / active student / day | Notes |
|---|---:|---|
| Existing student-facing APIs / report sending reserve | 1.0 | current normal study is static/local; reserve covers occasional report/API use |
| Leaderboard reserve | <=10.0 | conservative owner-provided ceiling until leaderboard plan exists |
| Comments: chapter counts | 1.0 | one batched counts request for the day's main chapter |
| Comments: thread reads/pages | 3.0 | lazy; only when discussion is opened |
| Comments: posts/replies | 0.5 | population average, not every student posts daily |
| Comments: Helpful/report/delete writes | 0.5 | population average |
| **Combined planning envelope** | **<=16.0** | shared cap |
| Non-student bot/publish/admin reserve | **2,000 requests/day fixed** | protects operational headroom |

At the conservative 16 requests/student/day envelope:

`(100,000 - 2,000) / 16 = 6,125 active students/day`

Therefore the **Worker request limit is planned to become the first shared ceiling at about 6,125 DAU** if leaderboard traffic actually consumes its full 10-request allowance and comments use the envelope above.

Without leaderboard traffic, the same comments+existing envelope is roughly 6 requests/student/day:

`98,000 / 6 ≈ 16,333 DAU`.

This is why comments must stay lazy and leaderboard traffic must be batched/cached. Before broad rollout, production telemetry should measure actual per-DAU request counts and require at least 30% safety headroom. If combined usage approaches 70,000 dynamic requests/day, do not add polling; reduce requests by cache/batching first.

### 11.2 Comments D1 read math

Conservative active commenter/browser day:

- one chapter count query: assume up to 100 thread-stat rows read
- three thread pages: 20 top-level rows each = 60 rows
- replies/vote-state/pinned metadata allowance: ~40 rows
- rate-limit/profile/ownership lookups allowance: ~20 rows

Planning envelope: **~220 D1 rows read per active student/day attributable to comments**.

`5,000,000 / 220 ≈ 22,727 students/day`.

This is well above the 6,125 DAU shared Worker ceiling under the combined-request envelope. Indexes and thread stats are still mandatory because a full-table scan could destroy this assumption.

### 11.3 Comments D1 write math

Typical row-write costs:

- top-level comment/reply: 1 comment row + 1 thread counter row = ~2 writes
- Helpful set/unset: 1 vote row + 1 helpful counter row = ~2 writes
- report: ~1 report row, plus 1 comment status write only when auto-hide triggers
- author delete: comment status/body + thread counter = ~2 writes

Example at **10,000 new comments/day**:

- comments: ~20,000 row writes
- assume average 2 Helpful actions per new comment: ~40,000 row writes
- assume 2% get one report: ~200–400 writes depending on auto-hide
- moderation/deletes/profile changes reserve: 5,000 writes
- total planning example: roughly **65,400 writes/day**, below 100,000 but no longer spacious

At this scale, votes are the dominant write risk. If measured writes approach 70,000/day, tighten vote limits, batch moderation, and reassess before growth. Do not silently move to a paid service.

### 11.4 Storage

Plain-text comments are small; D1's 5 GB total storage is unlikely to be the first constraint. Nonetheless:

- no duplicated Telegram profile data
- no media
- no rendered HTML
- short bodies
- soft-deleted body erasure when policy permits
- periodic owner-visible storage metrics

Storage must be measured before claiming "millions of comments" indefinitely. A rough 1 KB effective row/index footprint would put 1 million comments around 1 GB before votes/reports/index overhead; actual D1 measurements, not this rough estimate, govern rollout.

## 12. Moderation flow

1. Student taps Report on a comment and chooses a reason.
2. Server verifies initData, reporter identity, rate limit, and uniqueness.
3. Report is stored pending.
4. At 3 unique reports, comment changes to `hidden_pending`.
5. Owner bot queue shows the comment ID, QID, safe plain-text body, report reasons/count, age, and pseudonymous author label.
6. Owner chooses restore, hide, delete, verify/pin another reply, or ban.
7. If report reason is `answer_wrong`, create/forward a question report through the existing Kafu report workflow as well.
8. Student UI never promises that a reported answer is medically wrong until owner verification changes the official content through the established publishing/moderation path.

### Owner workload estimate

Assumptions for planning:

- 2% of comments generate a moderation case
- one case takes ~45 seconds to read context and choose an action
- daily fixed queue/admin overhead grows slowly with scale

| New comments/day | Estimated cases/day at 2% | Triage time | Fixed overhead | Owner time/day |
|---:|---:|---:|---:|---:|
| 100 | 2 | ~1.5 min | ~2 min | **~4 min/day** |
| 1,000 | 20 | ~15 min | ~5 min | **~20 min/day** |
| 10,000 | 200 | ~150 min | ~10 min | **~160 min/day (~2.7 h)** |

The 10,000-comment/day level is not sustainable as owner-only moderation.

### Later trusted student moderator role

Trigger for designing the role: sustained >30–45 minutes/day owner moderation or >50 pending cases for multiple days.

Trusted moderators:

- are manually promoted by owner
- see only pseudonymous user identity
- can triage reports, hide pending content, and restore obvious false positives
- cannot mark "Verified by Kafu"
- cannot alter official MCQ answers/explanations
- cannot access bot tokens, raw Telegram IDs, publishing queue secrets, or private progress
- cannot permanently delete without owner policy approval in the first version
- every action is audit logged
- owner can revoke instantly

## 13. Privacy behavior

Default identity is anonymous/pseudonymous:

- `Student #1234` by default
- optional nickname chosen by the student
- never Telegram first name/photo/username by default
- never phone number
- raw Telegram ID used transiently after HMAC verification, then converted to `actor_key`
- no saved study history uploaded for comments
- no answer choice uploaded merely to unlock discussion

Privacy page implementation update must state:

- comments are public to authenticated Kafu students while the related book/question is active
- default identity is pseudonymous; chosen nicknames are visible
- comments, votes, reports, moderation status, and pseudonymous ownership live in D1
- study progress remains separate/local/CloudStorage as already documented
- Delete my comments removes public comment bodies/visibility according to the defined deletion semantics
- provider backups/audit retention limits are described truthfully
- no patient-identifiable information should be posted

"Delete my comments" must be available in Privacy/Me and require confirmation.

## 14. Test plan

### Server authentication/security

- valid Telegram initData accepted
- forged initData rejected
- tampered user ID rejected
- stale initData rejected
- missing initData rejected
- fake actor key ignored
- fake owner/trusted moderator role rejected
- client cannot set `is_kafu_verified`
- client cannot delete another actor's comment
- client cannot helpful-vote as another actor
- self-vote rejected
- report deduplicated per actor/comment
- rate limits enforced on server
- HTML/script input is returned only as escaped text
- URLs stay inert text
- over-length Unicode rejected server-side

### Data and lifecycle

- QID regex only accepts `Q\d{9}`
- re-upload preserving id_map QID preserves thread
- changed local/source numbering with same permanent QID preserves thread
- new QID starts empty
- retired QID hidden
- successful `/remove` active=0 hides book threads/counts
- rollback/reactivation restores only valid active-QID threads
- pagination has no duplicates/gaps under stable cursor ordering
- one reply level enforced
- helpful count transaction remains consistent
- idempotent offline `client_nonce` creates one comment after repeated retries

### Cost/query tests

- EXPLAIN/query-plan checks show hot paths use intended indexes
- chapter counts are one HTTP request
- chapter counts do not scan comments table
- page size hard-capped at 20 top-level comments
- request-budget unit test uses combined existing + leaderboard reserve + comments budget, not per-feature 100k assumptions
- stress fixture with 1M synthetic comments demonstrates bounded query shape before any claim of million-comment readiness

### UI/accessibility

- spoiler lock before answer; unlock after local answer
- opening locked discussion causes zero comments API calls
- opening unlocked sheet performs lazy request
- loading/empty/error/offline/cached/queued/removed/banned/rate-limited states
- reduced motion
- keyboard focus trap/return and Escape/Back behavior follow existing sheet accessibility rules
- phone and iPad, light/dark
- Arabic `dir="auto"`
- mixed Arabic/English visual order
- Arabic fallback font renders without tofu boxes
- 200% text does not clip controls
- 44px targets
- user comment text cannot inject DOM

### Offline

- post offline -> exact status "Saved — will send when online"
- reload preserves pending outbox
- reconnect sends once
- network retry sends once via nonce
- switch account while pending does not send under wrong account
- removed question turns pending item into recoverable permanent error
- auth expiration pauses rather than discards draft

### Progress/account regression

The existing same-phone **A→B→A** test remains mandatory and must pass unchanged:

1. A studies and has progress/starred/review/resume/achievements.
2. Switch to fresh B.
3. B sees none of A's personal study data.
4. Return to A.
5. A's state is intact.

Add comments-specific isolation alongside it:

1. A has cached threads and an offline queued draft.
2. Switch to B.
3. B sees neither A's draft nor A-specific Helpful state/private cache namespace.
4. B can independently queue.
5. Return to A.
6. A's queue is intact and never sent using B's verified identity.

Critically, implementing comments must not require modifying the existing saved-progress object to make this test pass.

## 15. Rollout

### Phase 0 — implementation behind hard-off flag

- additive D1 migration only
- server auth/tests first
- UI inaccessible to normal users
- privacy copy prepared
- no production comments

### Phase 1 — owner-only dogfood

- owner account allowlisted server-side after verified initData
- create/read/reply/vote/report/delete
- Arabic/mixed-text checks
- offline queue
- remove/reactivate lifecycle
- bot moderation
- inspect D1 query metrics and Worker requests

Exit criteria: no progress regression, no identity/auth failures, no cross-account leakage, all query plans indexed.

### Phase 2 — tiny trusted pilot

- 20–50 students
- comment creation limits conservative
- daily review of Worker requests, D1 reads/writes, moderation queue, abuse, and latency
- no medical-verification delegation

Exit criteria: measured per-DAU API traffic safely below planning envelope and owner moderation manageable.

### Phase 3 — broader rollout

- enable by percentage/cohort via feature flag
- maintain >=30% free-tier headroom
- if combined Worker traffic >70k/day or D1 writes >70k/day, stop expansion and optimize before proceeding

### Phase 4 — trusted moderators only if workload proves need

- separate owner approval
- additive role/audit implementation
- least privilege
- no "Verified by Kafu" power

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Shared Worker 100k/day exhausted by leaderboard + comments | one chapter-count request, lazy threads, client cache, cursor pages, telemetry, 70% growth gate |
| Helpful votes consume D1 writes | strict per-user limits, measure writes, avoid polling, reconsider mechanics before paid tier |
| Medical misinformation | persistent unverified label, owner-only verified pin, answer-wrong report bridge |
| Spoilers | client lock tied to local answered state; clear that it is UX not security |
| Forged Telegram identity | verify initData HMAC server-side every identity-bearing request |
| Raw identity/privacy creep | HMAC actor key, pseudonymous display, optional nickname, no Telegram name default |
| Book re-upload disconnects discussion | Q######### permanent QID as sole durable thread identity |
| Removed book still exposes comments | active-book check on every student read/count; /remove makes existing published_books inactive |
| Arabic renders badly | dir=auto per body, Arabic-capable self-hosted fallback, mixed bidi visual tests |
| Cross-account offline draft leak | separate comments DB/store + account namespace + auth check before flush |
| XSS/link abuse | plain text, escaping, no HTML/Markdown/linkification |
| Owner moderation overload | auto-hide at 3 reports, bot queue, workload trigger for trusted moderators |
| Feature harms study reliability | comments never on answer/grading critical path; failures degrade to unavailable discussion only |
| Font budget regression | subset Arabic fallback and enforce existing design asset budget unless owner explicitly changes it |
| Pseudonym-key rotation breaks ownership | dedicated key and documented migration/dual-key period before rotating |

## 17. Owner decisions still required before implementation

Recommended defaults are included above, but implementation should obtain explicit owner confirmation for:

1. Auto-hide threshold: proposed **3 unique reports**.
2. Comment body limit: proposed **600 Unicode characters**.
3. Nicknames: allow optional nickname vs anonymous-only launch.
4. Dedicated pseudonym secret/key-rotation policy.
5. Exact Arabic fallback font after measuring WOFF2 budget.
6. Whether trusted moderators may ever permanently delete, or only hide/restore/escalate.
7. Final Delete-my-comments retention wording after reviewing actual D1 backup behavior.

Everything else in this plan is designed to preserve the existing Kafu constitution: $0/month, free to students, no saved-progress breakage, offline-first study, Telegram-verified identity, and owner-controlled medical moderation.
