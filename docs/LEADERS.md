# Leaders tab, leagues and XP (October 2026)

The fifth main tab, **Leaders**, sits between Review and Me. It replaced the server Top 30 board
(`docs/LEADERBOARD_USAGE.md`, now retired on the client) and runs **entirely on the student's phone**.

## Cost and speed

- No network requests at runtime: no Worker, D1 or API calls. The old score upload (`modules/leaderboard.js`) was
  removed, which lowered Worker and D1 usage. The Worker leaderboard endpoints are untouched, ready for real users later.
- The board's files are Cloudflare **static assets** (`wrangler.app.jsonc` has no `run_worker_first`): free, unlimited,
  not counted as Worker requests.
- Start-up: only a tiny loader (`modules/leaders-loader.js`) is inline. The board files load quietly ~3 s after the app
  opens when the phone is idle (skipped on data saver and 2G), so the first tap is instant. JS+CSS start-up budget:
  150,385 B before the XP ledger, ~151.6 KB with it (limit 153,600 B; it was 153,524 B before this work).
- Lazy files: `leaders-core.js` ~6.6 KB, `leaders.js` ~7.9 KB, `leaders.css` ~4.6 KB gzipped. 47 profile pictures,
  96 px WebP, ~86 KB in total, loaded only when the tab is opened and kept offline by the service worker in their own
  cache `kafu-leaders-avatars-1` (rename the cache if a picture file is ever replaced).
- A board is built in about 1–2 ms; the 9 s update timer runs only while the tab is open.

## Files

| File | Role |
|---|---|
| `app/modules/leaders-loader.js` | inline; idle prefetch and loading of the files below; retries only what failed (10 s timeout) |
| `app/modules/leaders-core.js` | pure data: clock (Baghdad, Monday 00:00 weeks), rivals, leagues, cohorts, profiles, studying-now count |
| `app/modules/leaders.js` | the view, live FLIP animation, league settlement, profile card, cheers |
| `app/modules/leaders.css` | styles (app tokens, light/dark) |
| `app/modules/xp-ledger.js` | inline; the single XP ledger (see below) |
| `leaders-core.js` `person(name)` / `people()` | one persona's picture, colours, initials and tag; the question comments (`docs/COMMENTS.md`) use the same faces |
| `app/assets/avatars/` | 47 pictures without people + `SOURCES.txt` (Unsplash licence / Openverse CC0, CC BY credits) |
| `tools/tests/js/leaders-core.test.cjs`, `xp-ledger.test.cjs` | unit tests; UI flows `04_study.py`, `07_account_switch.py`, `09_phone_geometry.py` |

## What students see

- **Weekly league** (Bronze, Silver, Gold, Sapphire, Ruby, Emerald, Diamond): a group of 30 per student and week, top 7
  move up, bottom 5 move down. A result banner shows once on the first visit of the new week. **All time** tab too.
- Top-three cards, one grouped ranking list, promotion/demotion strips, a floating "You" bar with rank and XP to pass the
  next person, "students studying now", and a profile card (tap anyone) with training, city, rank, XP, streak, accuracy,
  a Monday–Sunday chart and a Cheer.
- **Live on opening:** the board first shows where things stood at the last visit, then rows glide to their new places
  and XP counts up; quiet updates every 9 s while open. Reduced motion: a still board.

### Simulated rivals (owner's decision)

The other 59 accounts are **simulated on the device** and deterministic (same week and student → same board): Iraqi
names (Arabic and English), Iraqi Board / Arab Board residencies (surgical specialties weighted) or a stage at a real
Iraqi medical college, a matching city, study pace and streak. "Students studying now" (~1,400 by day, quiet before dawn,
busiest 9–10 pm, lower on Fridays) is also computed. Pictures never show people. The specialist reviewers flagged a
trust risk if students discover this; labelling them "practice rivals" remains an open owner decision.

### Fairness

- Rival pace adapts to the student's own last two weeks: at their usual pace they finish around 7th–10th in Bronze, about
  60% more effort promotes, and each higher league is harder. A newcomer reaches the Bronze top 7 with ~70 questions a week.
- Everyone in the group is listed from Monday and rivals start at 9:00, so nobody starts the week alone at the bottom.
- Settlement runs week by week; a week without study keeps the league (no demotion for being away); a clock moved
  backwards is ignored. Keys are per Telegram account in `localStorage` (`kafu_leaders_<key>_<telegram id>`).

## XP ledger

One ledger feeds the level, home HUD, in-study chip, session-complete screen and Leaders:

| Answer | XP |
|---|---|
| New question, correct | 10 |
| New question, wrong | 5 (the explanation still teaches) |
| Later-day return (reviews, mistakes), correct | 12 |
| Later-day return, wrong | 4 |
| Same question again the same day | 0 |

Stored per Telegram account in IndexedDB `meta` as `xp_ledger_user_<id>` (`{v:1, days:{BaghdadDay:xp}, last:{qid:day}}`).
Answers from before the ledger, or synced from another device, count 10 each on their own day, so nobody loses a level.
The ledger is not synced: on a new phone XP is rebuilt from synced answers at 10 each (review bonuses are not carried).

## Visual baselines

Screens with the tab bar (5 tabs) and the XP screens were re-approved from CI `CANDIDATE_BASELINES` output (PRs #129,
#132). The two known iPad "library no results" renderer variants have extra hashes in `VISUAL_HASH_VARIANTS`.

## History

#129 Leaders tab · #130 studying-now count · #131 fair leagues and the specialist-review fixes (game design, learning
science, visual design, engineering) · #132 XP ledger · #133 idle prefetch and offline pictures.

## Next (from the specialist review, not started)

Streak freeze (earned, applied automatically), daily goal in questions (10/20/40/60), three daily quests tied to good
study (clear due reviews, fix mistakes on a later day, new questions with accuracy), a rising level curve with medical
titles and a level-up moment, a session-end "tomorrow" line, mastery per chapter, keeping mistakes until correct on a
later day, and fixing the small pixel-font labels in the main app.
