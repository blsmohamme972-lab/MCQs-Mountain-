# Head Department runbook (Kafu image lessons)

You are the main session ("Head Department"). The owner writes in Iraqi Arabic: answer short, in Iraqi Arabic, always with
numbers (how many done / how many left). When the owner says "stop" (وقف), stop everything. Read this file, `README.md` and
`BUILDER.md` (in `kafu_queue/` on branch `kafu-queue`) before acting.

Owner's rules: never change an answer key; voice Breeze; never secrets in chat; a refused tool call: stop and tell the owner
the exact command, do not retry variations. **NOTHING IS WRITTEN TO GITHUB** (owner's rule, 2026-10-15): no commit, push,
branch, pull request or merge, by you or by any builder. GitHub is only read (the tools on branch `kafu-queue`, the project
code on `main`). A run's data lives in your data folder and travels to builders as one bundle file through the inbox.

Save usage: start a NEW Head session for every run (a short context costs far less on every check than a long one), with
the first message: "You are the Kafu Head. Read kafu_queue/HEAD.md on branch kafu-queue of MCQs-Mountain- and follow it."
Keep checks short (`| tail`), do not reread files you already read, and answer the owner in a few lines.

## Setup (once per Head session)

1. Tools: `git fetch -q origin +refs/heads/kafu-queue:refs/remotes/origin/kafu-queue +refs/heads/main:refs/remotes/origin/main`,
   `git worktree add -q --detach /home/user/kq origin/kafu-queue` (tools, read only) and
   `git worktree add -q --detach /home/user/mm origin/main` (the bot's own checks). Run every tool as
   `python3 /home/user/kq/kafu_queue/<tool>.py ...` with `KAFU_MOUNTAIN=/home/user/mm` where a tool needs project code.
2. Data folder: `python3 /home/user/kq/kafu_queue/bundle.py use <scratchpad>/kafu-data` (never inside a repository). Every
   tool reads and writes the run's data there: exports, packages, ledger, voice scripts, the slot split, the owner's settings.

## The images folder (the owner's choice)

- New Google Drive folder link from the owner: `drive.py set "<link>"` (checks it is shared "Anyone with the link", reads its
  name, saves the choice in the data folder), then make a new master prompt (`gpt_writer.py --master`) and send it: painter
  cards made before the change still point at the old folder. `drive.py show` prints the folder in use and its file count.
- Same folder, emptied for every run (owner's rule). You can only READ it; the owner deletes the files and empties the Drive
  trash himself. Tell him it is safe only when the previous run is finished (every package delivered and the merged parts
  published), because builders download images from the folder. Before a new run, `drive.py show` must list 0 files.

## Stage 0: the exports (nothing else starts before this is OK)

1. The owner sends the same export(s) he gives ChatGPT: one JSON, many JSONs, or ZIPs of them.
2. `KAFU_MOUNTAIN=/home/user/mm python3 /home/user/kq/kafu_queue/preflight.py export <file>` for every JSON must end
   `PREFLIGHT export OK`. Tell the owner the counts it prints (never count by hand). A FAIL: ask for the full app export.
3. Split: `make_queue.py split-all <BOOK> <files or zips>` (each chapter gets the prefix <BOOK>-CH<chapter>, 6 questions per
   package; e.g. BOOK = GT for Get Through), then `make_queue.py check` must be all OK. Below, PREFIX is <BOOK> for the whole
   run (or <BOOK>-CH<N> for one chapter).

## Stage 1: images and voice scripts (ChatGPT)

1. `gpt_writer.py --master --out <scratchpad>/master_prompt.html` and send it (SendUserFile). The owner attaches the exports to
   a new ChatGPT chat and pastes it. ChatGPT first reports files, chapters, questions and batches (compare with Stage 0), then
   works 8 questions per batch: each batch is one painter page with one card = one message that makes 8 images and saves one
   voice text file, `VOICE_<first QID>-<last QID>.txt`, in the Drive folder (9 things). The owner writes "next" for each batch.
2. Progress when the owner asks: `watch.py missing` (question numbers still without an image, and the total).
   Missing images: the owner pastes the same card again in a new chat (it skips what is saved) or writes "continue".
3. Voice scripts: `voice_collect.py drive <PREFIX>` checks every VOICE file (check code, then the same rules as ChatGPT's
   script against the key) and saves them in the data folder. A file missing or rejected: ask the owner for that painter page
   and run `voice_collect.py file <PREFIX> <painter page>`. Questions without a voice script never block: their builder writes
   them. Tell the owner N/M with a voice script.
4. Gate: `preflight.py images <PREFIX>` (downloads and measures every image) must end `PREFLIGHT images OK`: every QID exactly
   once, exact name `<QID>.png`, opens, landscape 3:2, at least 1200 px. Tell the owner exactly which file to delete or rename
   otherwise. **No builder starts before this is OK.**

## Stage 2: readiness (all before any builder)

1. Inbox: Artifact read `zip_inbox_url`. Upload a test (`head -c 3000000 /dev/urandom | base64 -w0 > t.b64.txt`, publish as an
   asset), list `scope "assets"` (EVERY page: follow `next` until none) and download it back by its id; the sha256 must match.
   If the inbox is gone or not the owner's: create a new one (assets capability), test it, and save its url in
   `<data>/config.local.json` as `{"zip_inbox_url": "<url>"}` (merged with the other settings there).
2. Permissions probe: one short session (create_session, source_url this repository, revision main) with the prompt:
   "Permission probe only: read the Artifact <inbox url> with path <the test asset id>, call send_later with delay_minutes 1
   and message 'probe', then answer in one line which of the two worked." Both must work. A refusal: tell the owner the exact
   refused command and the setting to add; wait.
3. Usage: start Stage 3 at the start of a fresh 5-hour window. If the weekly limit shows a warning, tell the owner first.
4. Sessions: the OWNER decides how many (ask if not said). Facts in one line: one session builds about 6 questions per hour;
   more sessions finish sooner, but each pays its setup and all share the 5-hour window, so far more than questions ÷ 25
   does not help. Then `assign.py split <PREFIX> <N>` (nearly equal questions per slot, neighbouring packages; a slot may span
   two chapters and gets both exports).
5. Bundle: `bundle.py pack <scratchpad>/bundle.json`, upload it to the inbox as an asset (Artifact publish, url the inbox,
   asset true, file_path that file, alone in the call) and note its asset id.

## Stage 3: build (the owner's N sessions)

1. For each slot: `create_session` with source_url `https://github.com/blsmohamme972-lab/MCQs-Mountain-`, source_revision `main`,
   title `Kafu · <PREFIX> · slot NN`, tags `["kafu-lessons"]`, `model` set explicitly (a child session silently inherits
   whatever the Head runs on), prompt = the exact output of `assign.py prompt NN --bundle <asset id>`. Start them about one
   minute apart. Keep the session ids in the data folder (`sessions.json`).
2. Keep yourself alive, cheaply: one `send_later` 30 minutes after the launch (setup and voice tests are done by then, so
   broken sessions are replaced early), then one every 60 minutes until every package is delivered. Builders never wait for you.
3. Every check:
   - Inbox: list `scope "assets"`, every page. Download each new ZIP asset (Artifact read with path = asset id, one per call)
     into a NEW folder, then `python3 -I /home/user/kq/kafu_queue/collect_zips.py <in> <scratchpad>/ready` (names each good ZIP
     `MCARDS_<PKG>_r1.zip`) and `KAFU_MOUNTAIN=/home/user/mm preflight.py zips <scratchpad>/ready <PREFIX>`. For every package
     OK there: `watch.py deliver <PKG> "<N> lessons"` (data folder only).
   - Sessions: `get_session` for each. Broken = final message "الصوت معطل" or "export rejected", status failed, or no new
     event for 60 minutes while not limited. Replace at once: `assign.py left`, then `create_session` with
     `assign.py prompt NN --bundle <id> --packages <its left packages> --as <NN>b` (then <NN>c). Never give one package to two
     live sessions.
   - Usage limit: note the reset time, `send_later` for reset + 2 minutes ("Head: wake builders"), then `send_message` each
     unfinished slot "SLOT NN: continue (usage limit is over)". Refused: replace the slot instead (no retries).
4. Tell the owner, short, with numbers: packages delivered N/M, lessons N/M, slots working/broken, next check time.

## Stage 4: delivery to the bot

1. `KAFU_MOUNTAIN=/home/user/mm python3 -I /home/user/kq/kafu_queue/merge_zips.py /home/user/mm <scratchpad>/ready <scratchpad>/merged <PREFIX>`
   (parts of at most 15 MB, members copied byte for byte, each part validated). If it refuses mixed provenance, merge per
   chapter (<BOOK>-CH<N>, with START so the part numbers do not repeat).
2. `KAFU_MOUNTAIN=/home/user/mm preflight.py coverage <scratchpad>/merged <PREFIX>`: every question exactly once; it prints
   each part's byte size and sha256.
3. Send the parts (SendUserFile) with the exact byte size in each caption. Owner: wait for the full download, compare the size,
   forward to @KafuMcqsbot 5 files at a time, about 2 minutes apart.
4. `BadZipFile` from the bot = the file was cut on the way: check the local part (`unzip -t`), send it again with its size; twice:
   merge again with CAP_MB 9 for those questions.
5. A package stuck at "running" in `/motioncards-status`: open the "Publish Kafu MotionCards Queue" run, press "Re-run failed
   jobs". If the bot answers "already received", the owner sends `/motioncards-retry <PACKAGE-ID>_r1`.
6. When everything is published: tell the owner the run is finished and the Drive folder may be emptied now.

## What went wrong before and what prevents it now

| # | Problem | Prevention |
|---|---|---|
| 1 | Usage limit hit twice; nobody woke the sessions | few sessions (the owner's number); fresh window; Head `send_later` at reset + "continue"; builders keep a `send_later` |
| 2 | Export without `question_integrity` stopped 10 sessions | `preflight.py export` in Stage 0 and again in every builder |
| 3 | `add_repo` push refused, 9 of 30 sessions never worked | builders run in their own repository and write nothing to GitHub; permissions probe in Stage 2 |
| 4 | Builders started before the images existed | `preflight.py images` gate |
| 5 | Sessions stopped by themselves, packages forgotten | fixed list in the prompt; "stop only when all delivered"; `assign.py left` + replacement |
| 6 | Breeze failures (download, SHA, AMX not ready, silent stop) | voice smoke test before any work; broken container replaced at once |
| 7 | Dispatcher script died 3 times | no dispatcher: images complete first, fixed split |
| 8 | Head reminders came late | check at +30 min then hourly; builders never depend on the Head |
| 9 | 12 images missing at the end | `watch.py missing` while drawing; images gate |
| 10 | Same package built twice | one package, one live session; replacements get only the left packages |
| 11 | 68 packages of 2 questions | packages of 6 |
| 12 | Merged part arrived cut (`BadZipFile`) | parts of at most 15 MB, byte size and sha256 in the caption |
| 13 | 30 MB asked, system ceiling 19 MB | `merge_part_mb` 15; `merge_zips.py` refuses a bigger part |
| 14 | A message to a session refused; `pkill -f` killed my own shell | replace instead of retrying; no `pkill -f`/`pgrep -f` loops |
| 15 | Inbox listing is paged (50 per page) | always read every page |
| 16 | Old inbox belonged to another account | inbox roundtrip test in Stage 2 |
| 17 | Counting mistakes | numbers only from the tools (`preflight`, `watch.py missing`, `assign.py left`, `coverage`) |
| 18 | ChatGPT redrew old topics, stopped after drawing | fresh chat per card; full prompts inside the card; "generate, check, save, next"; skip-if-saved |
| 19 | Banner answer different from the key | the writer script copies short answers exactly; builders check every image's "Answer -->" |
| 20 | GitHub grew complicated (many PRs and merges) | nothing is written to GitHub; data in the Head's data folder, bundle through the inbox |
