# Head Department runbook (Kafu image lessons, from the 2026-10-14/15 chapter 36 run)

You are the main session ("Head Department"). The owner writes in Iraqi Arabic: answer short, in Iraqi Arabic, always with
numbers (how many done / how many left). When the owner says "stop" (وقف), stop everything. Work on branch `kafu-queue` of
this repository (never on `main`, never a PR for it). Read this file, `README.md` and `BUILDER.md` before acting.

Owner's rules: never change an answer key; lessons commit only `lesson.json` + `selection.json`; voice Breeze; never secrets
in chat or the repo; a refused tool call: stop and tell the owner the exact command, do not retry variations.

Save usage: start a NEW Head session for every chapter (a short context costs far less on every check than a long one),
with the first message: "You are the Kafu Head. Read kafu_queue/HEAD.md on branch kafu-queue of this repository and follow it."
Keep checks short (`| tail`), do not reread files you already read, and answer the owner in a few lines.

## The images folder (the owner's choice)

The owner may send a new Google Drive folder link at any time; it becomes the folder for everything from then on:
`python3 kafu_queue/drive.py set "<link>"` (it reads the folder's name and checks that it is shared "Anyone with the link"),
commit `config.json`, push, then make a new master prompt (`gpt_writer.py --master`) and send it: painter cards made before the
change still point at the old folder. `drive.py show` prints the folder in use. A FAIL means the folder is not shared: tell
the owner to share it as "Anyone with the link" (Viewer) and send the link again.

Set `KAFU_MOUNTAIN` to an up-to-date checkout of `main` when you run `preflight.py` or `merge_zips.py`, so the checks are the
bot's own. In this checkout: `git fetch -q origin +refs/heads/main:refs/remotes/origin/main && git worktree add --detach /home/user/mm origin/main` and `export KAFU_MOUNTAIN=/home/user/mm`.

## Stage 0: the export (nothing else starts before this is OK)

1. Save the owner's app export as `kafu_queue/exports/<BOOK>-ch<N>.export.json` (the full export: `export_metadata.question_integrity`,
   `book`, `source`). Several chapters: one export file per chapter, one package prefix per chapter.
2. `python3 kafu_queue/preflight.py export kafu_queue/exports/<file>` must end `PREFLIGHT export OK`. Count the questions it
   prints and tell the owner that number (do not count by hand). Any number of questions works: every count below comes
   from the export.
3. `python3 kafu_queue/make_queue.py split kafu_queue/exports/<file> --pkg-prefix <BOOK>-CH<N>` (6 questions per package),
   then `make_queue.py check` must be all OK. Commit `kafu_queue/` and push `kafu-queue`.

## Stage 1: images (ChatGPT writes the prompts, then draws)

1. The owner's way (default): `python3 kafu_queue/gpt_writer.py --master --out <scratchpad>/master_prompt.html` and send it once
   (SendUserFile). It is one fixed prompt: the owner attaches the app export to a new ChatGPT chat and pastes it. ChatGPT reads the
   export with the master script, works in batches of 8 (one card of 8 images per batch, the owner's choice), and gives one `painter_batchNN_Q<a>-<b>.html` per batch;
   the owner writes "next" for the next batch. The owner must send the same export to you too (Stage 0).
   Alternative (questions inside each prompt, one chat per 8): `gpt_writer.py --prefix <BOOK>-CH<N> --out <scratchpad>/writer.html`.
2. The owner opens each painter file in Chrome; each card is ONE message for 8 images, pasted into a NEW chat, which draws
   them and saves `<QID>.png` to the Drive folder in `config.json` (`drive_folder_name`).
3. When the owner asks how far it is: `python3 kafu_queue/watch.py missing` (question numbers and QIDs still missing, and the
   total). Missing images: the owner pastes the same set card again in a new chat (it skips images already saved), or writes
   "continue" in the old chat. A whole writer chat lost: `gpt_writer.py --prefix ... --qids Q..,Q.. --out ...` for those QIDs only.
4. Gate: `python3 kafu_queue/preflight.py images <PREFIX>` (downloads and measures every image) must end
   `PREFLIGHT images OK`: every QID exactly once, exact name `<QID>.png`, opens, landscape 3:2, at least 1200 px.
   Duplicates or wrong names: tell the owner exactly which file to delete or rename. **No builder starts before this is OK.**

## Stage 2: readiness checks (all before any builder)

1. Inbox: read `zip_inbox_url` (Artifact read). Upload a test: `head -c 3000000 /dev/urandom | base64 -w0 > t.b64.txt`, publish it
   as an asset, list `scope "assets"` (read EVERY page: follow `next` until there is none) and download it back by its id; the
   sha256 must match. If the inbox is gone or not the owner's: create a new one (assets capability), test it, and update
   `zip_inbox_url` in `config.json` before splitting slots.
2. Permissions probe: one short test session (create_session, source_url this repo, revision main) with the prompt:
   "Permission probe only: run `git push --dry-run origin HEAD:refs/heads/kafu-probe`, read the Artifact <inbox url>, call
   send_later with delay_minutes 1 and message 'probe', then answer in one line which of the three worked." All three must
   work. Any refusal: tell the owner the exact refused command and the setting to add; wait for them.
3. Usage: start Stage 3 at the start of a fresh 5-hour window. If the weekly limit shows a warning, tell the owner before starting.
4. The OWNER decides how many builder sessions to open (ask if they have not said). Give them the facts in one line: each
   session builds about 6 questions per hour (Breeze, one container each); more sessions finish sooner but the setup is paid
   once per session (about 15 minutes of work each) and all sessions share the 5-hour usage window. A reasonable start is
   questions ÷ 25. Then `python3 kafu_queue/assign.py split <PREFIX> <N>`: N slots, nearly equal questions each, neighbouring
   packages. Commit `assignments.json`, push.

## Stage 3: build (the owner's N sessions)

1. For each slot: `create_session` with source_url `https://github.com/blsmohamme972-lab/MCQs-Mountain-`, source_revision `main`,
   title `Kafu · <PREFIX> · slot NN`, tags `["kafu-lessons"]`, `model` set explicitly (a child session silently inherits
   whatever the Head runs on), prompt = the exact output of `python3 kafu_queue/assign.py prompt NN`. Start them about one
   minute apart. Save the session ids in your scratchpad (`sessions.json`).
2. Keep yourself alive, cheaply: one `send_later` 30 minutes after the launch (every session has finished setup and its voice
   test by then, so broken ones are replaced early), then one every 60 minutes until every package is delivered. Builders do
   not wait for you, so a longer gap does not slow the build; only a broken session costs time, and those show up in the
   first check. Also check whenever the owner asks.
3. Every check:
   - Inbox: list `scope "assets"`, every page. Download each new asset (Artifact read with path = asset id, one per call)
     into a NEW folder, then `python3 -I kafu_queue/collect_zips.py <in> <scratchpad>/ready` (it names each good ZIP
     `MCARDS_<PKG>_r1.zip`) and `KAFU_MOUNTAIN=... python3 kafu_queue/preflight.py zips <scratchpad>/ready <PREFIX>`.
     For every package that is OK there: `python3 kafu_queue/watch.py deliver <PKG> "<N> lessons, <PR link>"`, commit
     `ledger.json`, push (builders read it to skip finished packages).
   - Sessions: `get_session` for each. Treat as broken: final message "الصوت معطل" or "export rejected", status failed, or
     no new event for 60 minutes while not limited. Replace a broken slot at once: `python3 kafu_queue/assign.py left`, then
     `create_session` with `assign.py prompt NN --packages <its left packages> --as <NN>b` (then <NN>c for a second replacement). Never give one package to two
     live sessions.
   - Usage limit (sessions stop with a limit message): note the reset time and schedule `send_later` for reset + 2 minutes
     ("Head: wake builders"). Then `send_message` each unfinished slot: "SLOT NN: continue (usage limit is over)". If
     send_message is refused, replace the slot as above instead (do not retry variations).
4. Tell the owner, short, with numbers: packages delivered N/M, lessons N/M, slots working/broken, next check time.

## Stage 4: delivery to the bot

1. `KAFU_MOUNTAIN=... python3 -I kafu_queue/merge_zips.py $KAFU_MOUNTAIN <scratchpad>/ready <scratchpad>/merged <PREFIX>`
   (parts of at most 15 MB, every member copied byte for byte, each part validated).
2. `python3 kafu_queue/preflight.py coverage <scratchpad>/merged <PREFIX>`: every question exactly once; it prints each part's
   byte size and sha256.
3. Send the parts (SendUserFile) with the exact byte size in each caption. Owner: wait until the download is complete, compare
   the size, then forward to @KafuMcqsbot 5 files at a time, about 2 minutes apart.
4. `BadZipFile` from the bot = the file was cut on the way. Check the local part (`unzip -t`), send it again with its byte size;
   if it fails twice, merge again with CAP_MB 9 (smaller parts) for those questions.
5. A package stuck at "running" in `/motioncards-status`: open the "Publish Kafu MotionCards Queue" run and press
   "Re-run failed jobs". If the bot answers "already received", the owner sends `/motioncards-retry <PACKAGE-ID>_r1`.

## What went wrong in the chapter 36 run (135 questions) and what prevents it now

| # | Problem | Prevention (where) |
|---|---|---|
| 1 | Usage limit hit twice; nobody woke the sessions | few sessions (the owner's number, not 30); start on a fresh window; Head `send_later` at reset + `send_message` "continue"; builders keep a `send_later` (Stage 3.3, BUILDER keep-alive) |
| 2 | Export without `question_integrity` stopped 10 sessions | `preflight.py export` gate in Stage 0 and again in every builder (BUILDER SETUP 3) |
| 3 | `add_repo` push refused, 9 of 30 sessions never worked | builders run in this repository (no add_repo, no second repo); permissions probe in Stage 2 |
| 4 | Builders started before the images existed | `preflight.py images` gate; no builder before it is OK |
| 5 | Sessions stopped by themselves and packages were forgotten | fixed list in the prompt; "stop only when all delivered"; `assign.py left` + replacement |
| 6 | Breeze failures (download, SHA, AMX not ready, silent stop) | voice smoke test before any work (BUILDER SETUP 4); broken container replaced at once |
| 7 | Dispatcher script died 3 times | no dispatcher: images are complete, the split is fixed (`assign.py split`) |
| 8 | Head reminders came late | Head check 30 min after launch, then hourly; builders do not depend on the Head to continue |
| 9 | 12 images missing at the end | `watch.py missing` while drawing; `preflight.py images` gate |
| 10 | Same package built twice | one package, one live session; builders skip packages the ledger marks delivered; per-slot branch names |
| 11 | 68 packages of 2 questions (setup cost 68 times) | packages of 6 (`batch_size`), one branch and one PR per session |
| 12 | Merged M4 arrived cut (`BadZipFile`) | parts of at most 15 MB, byte size and sha256 in the caption, owner compares before forwarding |
| 13 | 30 MB asked, system ceiling is 19 MB | `merge_part_mb` 15 in config; `merge_zips.py` refuses a part over the cap |
| 14 | A message to a session refused; `pkill -f` killed my own shell | replace instead of retrying; no `pkill -f`/`pgrep -f` loops anywhere |
| 15 | Inbox listing is paged (50 per page) | always read every page (`next`) |
| 16 | Old inbox belonged to another account | inbox roundtrip test in Stage 2 |
| 17 | Counting mistakes (100 instead of 135) | numbers come from `preflight.py export`, `watch.py missing`, `assign.py left`, `preflight.py coverage` only |
| 18 | ChatGPT redrew old topics, stopped after drawing, could not read some pages | fresh chat per set; the full prompts are inside the painter card (no GitHub reading); "generate, check, save, next"; skip-if-saved makes re-pasting safe |
| 19 | Banner answer different from the key | the writer script copies short answers exactly and refuses other banners; builders check every image's "Answer -->" against the key |
