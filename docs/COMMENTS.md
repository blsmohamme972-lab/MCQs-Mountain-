# Question comments (October 2026)

Comments open like a comments screen in Telegram or Facebook: a **sheet** slides up over the question with every thread.
Two ways in: a **bar above the question** (three faces, the number of comments and reactions, how recently it was
active, a green dot when within a day), which never shows a comment's words and stays locked (🔒) until the question
is answered, and an **entry row after the explanation**. A book shows the comments section only once it has comments;
then a question without any shows "No comments yet". The comments are written by the **Kafu characters**: the same
names, pictures and tags as the Leaders personas (`app/modules/leaders-core.js`). The app does not say so: the owner
removed the label on each comment (it distracted students) and then the "By Kafu characters" line too. Students cannot post: the "Add a comment…" field at the bottom shows "التعليقات مغلقة مؤقتاً" when tapped. The owner adds a note to the terms of use as well.

How to write comments for a book: `docs/COMMENTS_PROMPT.md`. Owner commands: `docs/ADMIN.md` → Question comments.

## The ZIP

`COMMENTS_<BOOK-ID>_r<N>.zip`, up to 2 MB, holding exactly one file, `comments.json`:

```json
{
  "schema": 1,
  "format": "kafu-comments",
  "book_id": "BOOK-ID",
  "revision": 1,
  "questions": {
    "Q000000123": [
      {"author": "<persona name>", "text": "…", "kind": "tip",
       "replies": [{"author": "<persona name>", "text": "…"}]},
      {"author": "<persona name>", "text": "…", "at": "2026-10-15T18:40:00Z", "likes": 7, "react": ["❤️", "🔥"]}
    ],
    "Q000000124": []
  }
}
```

- A pack changes **only the questions it lists**: their comments are replaced; `[]` removes a question's comments.
  Other questions keep theirs, so a book can be covered chapter by chapter (r1, r2, r3 …).
- `revision` must be newer than the last one published for that book; the same ZIP sent again changes nothing.
- Every published revision can be **restored** (the last 20 per book): students then see exactly what they saw right
  after it. `/comments BOOK-ID` shows **↩️ Restore rN** and **🚫 Remove from students** buttons (each asks to confirm),
  or use `/comments-restore BOOK-ID rN CONFIRM`.
- `author` must be a persona name exactly (`python tools/comments.py personas`).
- `text`: 2–600 characters, line breaks allowed, no links. Up to 12 comments per question and 6 replies per comment
  (replies have no replies). `kind` is optional: `note` (default), `tip`, `mnemonic`, `clinical`, `exam`.
- `at`, `likes`, `react` are optional and writers normally leave them out: `pack` fills them on every comment and
  reply, seeded by the question and the comment (the same file and `--now` give the same ZIP; editing one comment
  leaves the others as they were). `at` is a real posting date in UTC (`YYYY-MM-DDTHH:MM:SSZ`), fixed in the pack, so
  comments age naturally after publishing. Each question gets its own stretch of weeks to months, ending 4 days to 4
  months before `--now` (default: the start of the current hour), and its comments fall anywhere in it: never all in
  one week, nothing from the last 4 days, nothing older than 18 months. A reply follows its comment by hours to a
  month, the next replies by up to two weeks, and never comes before its comment. Older comments get more likes.
  `likes` is 0–20; `react` is 1–3 different of Telegram's 👍 ❤️ 🔥 👏 🤣 🤔 🤯 🙏 💯 🤓 👀 (more when a comment has more
  likes). Filled values fit what the comment says (`tone()`): a question gets 🤔, a thank-you ❤️ 🙏 and few likes, a
  joke 🤣, a correction 💯, a surprise 🤯, otherwise its kind (a pearl 💯 👏, a mnemonic 🔥 🤓, an exam trap 🔥 💯 👀);
  an emoji the comment itself uses leads. Given values are kept and checked; packs made before these fields still
  publish and show without them.
- Every question ID must be a published question of that book.

Make and check a ZIP:

```
python tools/comments.py pack comments.json --out work/comments --catalog https://kafu-content-1.blsmohamme97.workers.dev/catalog.json
python tools/comments.py validate work/comments/COMMENTS_BOOK-ID_r1.zip --export kafu-export.json
```

`pack` writes the same bytes for the same input and refuses a bad file with every problem listed. It also warns (and
still packs) when "ال" stands right before an English term ("الـ PCT", "بالـ ECG"): Iraqi students write "PCT". Commit only the
`comments.json` text if it should be kept; send the ZIP in chat (lean storage).

## Publishing path

1. The bot (`worker/comments-queue.mjs`) records the upload in D1 `comment_jobs` (migration `0007`) and starts the
   publish run (`publish-queue.yml`). It never reads the ZIP.
2. `tools/drain_queue.py` claims comment jobs **after** books and admin jobs, so a book sent with its comments is
   published first. `tools/comments.py publish` validates the ZIP, checks every QID against the active catalog,
   stores the comments per question in the content state database (`question_comments`, `comment_uploads`), keeps a
   compressed snapshot of the whole book's comments for restore (`comment_snapshots`, `comment_books` = what students
   see now) and rebuilds the book's files. A restore job (`tools/comments.py restore`) swaps in a snapshot.
3. The content candidate is uploaded, its catalog/chapters **and** comment files are checked on the preview URL, then
   it is promoted and the state is saved. A failure changes nothing for students; the bot sends `repair_report.md`
   with every problem.

Files on `kafu-content-1`:

| Path | Cache |
|---|---|
| `/comments/<BOOK-ID>.json` — revision, totals, one entry per shard (URL + SHA-256) | revalidated (default) |
| `/packs/_comments/<BOOK-ID>/<Q0000xx>.<sha12>.json` — up to 100 questions' comments | immutable (`/packs/*`) |

Shards follow the question ID (first 7 characters), not chapters, so a new book version never moves them; questions
retired from the book drop out the next time the book's comments are rebuilt. `/remove BOOK-ID` deletes the book's
comment files and rows; `/comments-off BOOK-ID CONFIRM` deletes them too. Both keep the snapshots, so a revision can be
restored later (once the book is published again).

## In the app

| File | Role |
|---|---|
| `app/modules/comments-loader.js` | inline, ~0.5 KB gzipped: loads `comments.js` on the first study screen or finished chapter download |
| `app/modules/comments.js` | data (index, shards, Cache Storage `kafu-comments-v1`) and the view |
| `app/modules/comments-core.js` | pure checks and view model (`tools/tests/js/comments-core.test.cjs`) |
| `app/modules/comments.css` | study-screen tokens, light and dark |
| `leaders-core.js` `person(name)`, `people()` | the persona's picture, colours, initials and tag |

- **No spoilers:** before the answer only the bar shows (counts, faces, time; tapping it says to answer first), and
  nothing at all during an exam. The data is fetched while the question is open (and the next question's in the
  background), so the bar is there at once. A bar that would arrive more than 1.2 s after the question opened is not
  pushed in above a question being read; it shows after the answer.
- **The sheet:** a modal (`role="dialog"`, the page behind is inert and does not scroll) with a header (Comments, the
  count, all reactions, ✕), the threads in their own scroll and the composer at the bottom. It closes with ✕, Escape,
  a tap outside, a pull down on its top, or the app's Back (Telegram's Back button), which closes sheets first; the
  question stays where it was and focus goes back to the bar or row that opened it. While it is open Telegram's main
  button is hidden. A full-screen sheet on phones, a centred panel on iPad.
- Each comment is a bubble (name, training, kind, text) with its reactions on the corner, and under it its time ("3d",
  "9w", "5mo", "1y": weeks up to 11w, then months; "now", "5m", "3h" exist for writer-given times), **Like** and **Reply** (Reply shows that posting is
  closed). Counts from 1,000 read "1.2K". A student's like adds one and a 👍 and is kept on that phone only
  (`localStorage` `kafu-comment-likes-v1`, the last 500).
- A thread shows two replies (three if that is all), then **View N more replies**. Likes and opened threads survive
  re-renders and keep the list's scroll; the bar's entrance animation plays once.
- **Offline:** every index and shard fetched is kept in Cache Storage (also when a chapter download completes, and once
  per session for chapters saved earlier). A cached shard is used only if its SHA-256 matches the index.
- **Taken away:** when a book's index answers 404, the phone deletes its saved comments for that book. Deleting the
  last saved chapter of a book deletes them too.
- Anything malformed, or by an author who is not a persona, is left out rather than shown.
- Start-up budget: the loader is the only inline part (limit 153,600 B; 153,244 B with it).

## Tests

`tools/tests/test_comments.py` (pack format, every rejection, publish/upsert/clear/remove), `test_drain_comments.py`
(publisher job, candidate check, failure report), `worker/bot.test.mjs` (upload, commands, claim order, finish),
`tools/tests/js/comments-core.test.cjs` (times, likes, reactions, replies), and the browser flow
`tools/ui/flows/12_comments.py` (locked bar above the question without spoilers, entry row after the answer, the
sheet: pictures and the title line, times, reactions, the student's like, more replies, closed composer, re-render,
closing by Escape, back, the scrim and a pull down, focus return; a question without comments; exam,
offline copy, taken away, 360–430 px, AA contrast in light and dark). Activity fields: `ActivityTests` in
`test_comments.py`. Restore: `test_comments.py`, `test_drain_comments.py`, `bot.test.mjs`.
