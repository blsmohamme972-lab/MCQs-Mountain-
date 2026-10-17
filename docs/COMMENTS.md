# Question comments (October 2026)

A **Comments** card sits at the end of the study screen, after the explanation, once a question is answered. The
comments are written by the **Kafu characters**: the same names, pictures and tags as the Leaders personas
(`app/modules/leaders-core.js`). Every comment and reply carries a small **Kafu character** label. Students cannot
post yet: the "Add a comment…" field shows "Writing comments opens soon." when tapped.

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
       "replies": [{"author": "<persona name>", "text": "…"}]}
    ],
    "Q000000124": []
  }
}
```

- A pack changes **only the questions it lists**: their comments are replaced; `[]` removes a question's comments.
  Other questions keep theirs, so a book can be covered chapter by chapter (r1, r2, r3 …).
- `revision` must be newer than the last one published for that book; the same ZIP sent again changes nothing.
- `author` must be a persona name exactly (`python tools/comments.py personas`).
- `text`: 2–600 characters, line breaks allowed, no links. Up to 12 comments per question and 6 replies per comment
  (replies have no replies). `kind` is optional: `note` (default), `tip`, `mnemonic`, `clinical`, `exam`.
- Every question ID must be a published question of that book.

Make and check a ZIP:

```
python tools/comments.py pack comments.json --out work/comments --catalog https://kafu-content-1.blsmohamme97.workers.dev/catalog.json
python tools/comments.py validate work/comments/COMMENTS_BOOK-ID_r1.zip --export kafu-export.json
```

`pack` writes the same bytes for the same input and refuses a bad file with every problem listed. Commit only the
`comments.json` text if it should be kept; send the ZIP in chat (lean storage).

## Publishing path

1. The bot (`worker/comments-queue.mjs`) records the upload in D1 `comment_jobs` (migration `0007`) and starts the
   publish run (`publish-queue.yml`). It never reads the ZIP.
2. `tools/drain_queue.py` claims comment jobs **after** books and admin jobs, so a book sent with its comments is
   published first. `tools/comments.py publish` validates the ZIP, checks every QID against the active catalog,
   stores the comments per question in the content state database (`question_comments`, `comment_uploads`) and
   rebuilds the book's files.
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
comment files and rows; `/comments-off BOOK-ID CONFIRM` deletes them but keeps the upload history.

## In the app

| File | Role |
|---|---|
| `app/modules/comments-loader.js` | inline, ~0.5 KB gzipped: loads `comments.js` on the first study screen or finished chapter download |
| `app/modules/comments.js` | data (index, shards, Cache Storage `kafu-comments-v1`) and the view |
| `app/modules/comments-core.js` | pure checks and view model (`tools/tests/js/comments-core.test.cjs`) |
| `app/modules/comments.css` | study-screen tokens, light and dark |
| `leaders-core.js` `person(name)`, `people()` | the persona's picture, colours, initials and tag |

- **No spoilers:** nothing shows before the answer, or during an exam; the data is fetched while the question is open,
  so the card appears with the explanation.
- Three threads show, then **Show N more comments**. The state survives re-renders; the entrance animation plays once.
- **Offline:** every index and shard fetched is kept in Cache Storage (also when a chapter download completes, and once
  per session for chapters saved earlier). A cached shard is used only if its SHA-256 matches the index.
- **Taken away:** when a book's index answers 404, the phone deletes its saved comments for that book. Deleting the
  last saved chapter of a book deletes them too.
- Anything malformed, or by an author who is not a persona, is left out rather than shown.
- Start-up budget: the loader is the only inline part (limit 153,600 B; 153,244 B with it).

## Tests

`tools/tests/test_comments.py` (pack format, every rejection, publish/upsert/clear/remove), `test_drain_comments.py`
(publisher job, candidate check, failure report), `worker/bot.test.mjs` (upload, commands, claim order, finish),
`tools/tests/js/comments-core.test.cjs`, and the browser flow `tools/ui/flows/12_comments.py` (after-answer only,
labels and pictures, show more, composer, re-render, exam, offline copy, taken away, 360–430 px, AA contrast in light
and dark).
