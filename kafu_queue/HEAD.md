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

## How the run flows now (fast, cheap, checked)

ChatGPT draws while the builders already run: every builder starts its voice engine at once and builds each of its packages
the moment that package's images and voice scripts are in the Drive folder (autobuild.py polls Drive by itself, no tokens).
Builders are mechanical (one script, a few short turns), so they run on a cheaper model. You review every image through
small review sheets while ChatGPT draws, so wrong images are redrawn early. Nothing reaches the bot before the final
coverage check.

## Stage 0: the exports (nothing else starts before this is OK)

1. The owner sends the same export(s) he gives ChatGPT: one JSON, many JSONs, or ZIPs of them.
2. `KAFU_MOUNTAIN=/home/user/mm python3 /home/user/kq/kafu_queue/preflight.py export <file>` for every JSON must end
   `PREFLIGHT export OK`. Tell the owner the counts it prints (never count by hand). A FAIL: ask for the full app export.
3. Split: `make_queue.py split-all <BOOK> <files or zips>` (each chapter gets the prefix <BOOK>-CH<chapter>, 6 questions per
   package; e.g. BOOK = GT for Get Through), then `make_queue.py check` must be all OK. Below, PREFIX is <BOOK> for the whole
   run (or <BOOK>-CH<N> for one chapter). If `check` lists BOOK IMAGES for a question: look at that question's images in the
   export, then `make_queue.py inspected <QID>...` (the project refuses to build a question whose book images nobody saw).

## Stage 1: start ChatGPT and the builders together

1. `gpt_writer.py --master --out <scratchpad>/master_prompt.html` and send it (SendUserFile). The owner attaches the exports to
   a new ChatGPT chat and pastes it. ChatGPT first reports files, chapters, questions and batches (compare with Stage 0), then
   works 8 questions per batch (or several: "next 3", "batches 5-8"; the owner may run two writer chats on different batches):
   each batch is one painter page with one card = one message that makes 8 images and saves one voice text file,
   `VOICE_<first QID>-<last QID>.txt`, in the Drive folder (9 things).
2. Readiness, once per Head session (a few minutes, while ChatGPT works):
   - Inbox: Artifact read `zip_inbox_url`; upload a small test asset and download it back by id (sha256 must match). Gone or
     not the owner's: create a new one (assets capability), test it, save `{"zip_inbox_url": "<url>"}` in
     `<data>/config.local.json`.
   - Permissions probe: one short session (create_session, source_url this repository, revision main): "Permission probe only:
     read the Artifact <inbox url> with path <the test asset id>, call send_later with delay_minutes 1 and message 'probe',
     then answer in one line which of the two worked." Both must work; a refusal: tell the owner the exact command and setting.
   - Usage: start the builders at the start of a fresh 5-hour window when possible; a weekly-limit warning: tell the owner first.
3. Sessions: the OWNER decides how many (ask if not said). Facts in one line: one builder makes about MINQ minutes of CPU per
   question (measured), so N builders finish Q questions in about Q x MINQ / N minutes after the images exist; builders are
   cheap now (one script, few turns), so more builders mostly buy speed. Then `assign.py split <PREFIX> <N>`.
4. Bundle: `bundle.py pack <scratchpad>/bundle.json` (exports, packages, the owner's settings; voice scripts that already
   exist), upload it to the inbox as an asset (Artifact publish, asset true, alone in the call) and note its asset id and time.
5. For each slot: `create_session` with source_url `https://github.com/blsmohamme972-lab/MCQs-Mountain-`, source_revision
   `main`, title `Kafu · <PREFIX> · slot NN`, tags `["kafu-lessons"]`, `model` set explicitly (a child session otherwise
   inherits the Head's model, which costs more), prompt = the exact output of `assign.py prompt NN --bundle <asset id>`.
   Start them about one minute apart. Keep the session ids and their models in `<data>/sessions.json`.
   Choosing the builder model is your decision, by cost (owner's rule: the Head runs on Opus, builders on the cheapest model
   that does the job). Builder work is mechanical (start a script, upload files), so:
   - Start slot 01 alone on "claude-haiku-5-5" (the cheapest). When its status shows the script RUNNING and its first upload
     arrived in the inbox, start every other slot on Haiku too.
   - A Haiku builder that fails a mechanical step (bundle, start command, upload, marking) or writes a WRITE_LESSONS lesson
     that fails its checks: replace that slot with "claude-sonnet-5-5" (`assign.py prompt NN --bundle <id> --packages
     <its left packages> --as NNb`). Never use Opus for builders.

## Stage 2: while ChatGPT draws and the builders build (checks every 30-60 minutes, and whenever the owner asks)

1. Images: `watch.py missing` (numbers still without an image). Tell the owner briefly; a missing image: re-paste that card in
   a new chat (it skips what is saved) or write "continue".
2. Review every finished card once: `preflight.py sheet <PREFIX> <scratchpad>/sheets --qids <the card's QIDs>` and look at the
   sheet (Read the PNG): each row shows the KEY and the image's own title and answer banner. A banner that does not state the
   key, a wrong topic or garbled text: tell the owner the exact question number and QID to redraw (same file name, the card
   skips the others). If that package was already built, add it to `<data>/rebuild.txt` (one package per line).
3. Voice scripts: `voice_collect.py drive <PREFIX>` (counts N/M with a checked script; builders read them from Drive by
   themselves). A rejected or missing file: ask the owner for that painter page and run `voice_collect.py file <PREFIX> <page>`;
   still missing after that: the builder writes those lessons itself (its status says WRITE_LESSONS).
4. Inbox: list `scope "assets"`, every page; take only assets newer than this run's bundle. Download each new text/plain asset
   (Artifact read, path = asset id) into a NEW folder, then `python3 -I collect_zips.py <in> <scratchpad>/ready` (names each
   good ZIP `MCARDS_<PKG>_r1.zip`; a second build of a package is kept aside, the first stays) and
   `KAFU_MOUNTAIN=/home/user/mm preflight.py zips <scratchpad>/ready <PREFIX>`; `watch.py deliver <PKG> "<N> lessons"` for each OK.
5. Builders: `get_session` for each. Broken = final line "الصوت معطل" or "export rejected", status failed, or no event for 90
   minutes while its packages still wait. Replace at once: `assign.py left`, then a new session with
   `assign.py prompt NN --bundle <id> --packages <its left packages> --as <NN>b`. Never one package in two live sessions.
   Usage limit: the builds go on in the background; after the reset `send_message` each unfinished slot "SLOT NN: check".
6. Tell the owner, short, with numbers: images N/M, voice scripts N/M, packages delivered N/M, builders working/broken.

## Stage 3: rebuilds, then delivery to the bot

1. Rebuilds (`<data>/rebuild.txt`, after the owner redrew the images): `bundle.py pack` again, upload it, one session with
   `assign.py prompt FX --bundle <new id> --packages <the list> --as FX`; collect as above (the newer ZIP replaces the old one:
   delete the old `MCARDS_<PKG>_r1.zip` from `ready/` first).
2. `KAFU_MOUNTAIN=/home/user/mm python3 -I merge_zips.py /home/user/mm <scratchpad>/ready <scratchpad>/merged <PREFIX>` (parts of at
   most 15 MB, members copied byte for byte, each part validated). Mixed provenance refused: merge per chapter with START.
3. `KAFU_MOUNTAIN=/home/user/mm preflight.py coverage <scratchpad>/merged <PREFIX>`: every question exactly once; prints each
   part's byte size and sha256. Nothing goes to the owner before this is OK.
4. Send the parts (SendUserFile) with the exact byte size in each caption. Owner: wait for the full download, compare the
   size, forward to @KafuMcqsbot 5 files at a time, about 2 minutes apart.
5. `BadZipFile` from the bot = the file was cut on the way: check it (`unzip -t`), send it again; twice: merge again with
   CAP_MB 9. Stuck at "running" in `/motioncards-status`: "Publish Kafu MotionCards Queue" run → "Re-run failed jobs".
   "already received": the owner sends `/motioncards-retry <PACKAGE-ID>_r1`.
6. Everything published: tell the owner the run is finished; the Drive folder may be emptied now (keep the painter pages:
   they are the only copy of the voice texts).

## If your data folder is lost (new container)

`bundle.py use <scratchpad>/kafu-data`; list the inbox assets and read the newest `application/json` asset (the latest bundle)
with Artifact read; `bundle.py unpack <file> <scratchpad>/kafu-data`; then collect every text/plain asset newer than that
bundle again (Stage 2.4): the ledger is rebuilt from what is in the inbox. Session ids: `list_sessions` with tag `kafu-lessons`.

## What went wrong before and what prevents it now

| # | Problem | Prevention |
|---|---|---|
| 1 | Usage limit hit twice; nobody woke the sessions | few sessions (the owner's number); fresh window; Head `send_later` at reset + "continue"; builders keep a `send_later` |
| 2 | Export without `question_integrity` stopped 10 sessions | `preflight.py export` in Stage 0 and again in every builder |
| 3 | `add_repo` push refused, 9 of 30 sessions never worked | builders run in their own repository and write nothing to GitHub; permissions probe in Stage 1 |
| 4 | Builders started before the images existed and waited by hand | builders start early on purpose; autobuild.py waits per package by itself (no tokens) |
| 5 | Sessions stopped by themselves, packages forgotten | fixed list in the prompt; "stop only when all delivered"; `assign.py left` + replacement |
| 6 | Breeze failures (download, SHA, AMX not ready, silent stop) | voice_setup.py: size-checked resuming download (the SHA failures came from silently cut downloads), then a test clip; broken container replaced at once |
| 7 | Dispatcher script died 3 times | no dispatcher: images complete first, fixed split |
| 8 | Head reminders came late | check at +30 min then hourly; builders never depend on the Head |
| 9 | 12 images missing at the end | `watch.py missing` while drawing; per-package start, so one missing image blocks only its package |
| 10 | Same package built twice | one package, one live session; replacements get only the left packages |
| 11 | 68 packages of 2 questions | packages of 6 |
| 12 | Merged part arrived cut (`BadZipFile`) | parts of at most 15 MB, byte size and sha256 in the caption |
| 13 | 30 MB asked, system ceiling 19 MB | `merge_part_mb` 15; `merge_zips.py` refuses a bigger part |
| 14 | A message to a session refused; `pkill -f` killed my own shell | replace instead of retrying; no `pkill -f`/`pgrep -f` loops |
| 15 | Inbox listing is paged (50 per page) | always read every page |
| 16 | Old inbox belonged to another account | inbox roundtrip test in Stage 1 |
| 17 | Counting mistakes | numbers only from the tools (`preflight`, `watch.py missing`, `assign.py left`, `coverage`) |
| 18 | ChatGPT redrew old topics, stopped after drawing | fresh chat per card; full prompts inside the card; "generate, check, save, next"; skip-if-saved |
| 19 | Banner answer different from the key | the writer script copies short answers exactly and refuses wrong options; the Head reviews every banner on a review sheet |
| 20 | GitHub grew complicated (many PRs and merges) | nothing is written to GitHub; data in the Head's data folder, bundle through the inbox |
| 21 | Builders spent most tokens writing, waiting and waking | ChatGPT writes; autobuild.py does every step in one background job; builders only upload (cheap model) |
| 22 | Invented numbers or a wrong option in a lesson | the writer script refuses any number not in the source and any wrong option in the banner or answer statement |
