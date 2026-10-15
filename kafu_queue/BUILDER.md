You are Kafu builder SLOT @@SLOT@@ in the repository @@REPO_SLUG@@ (your session's own checkout). The owner asked for this build.
Build image lessons for these packages, one after another, in this order (@@NQ@@ questions; @@CHAPTER@@):
@@PKG_TABLE@@
Work until every package above is delivered. No questions to the owner, no progress messages. One short Arabic line at the very end.

OWNER'S RULES (always)
- Never change an answer key. Facts only from the stem, the key and the explanation.
- Commit only `work/<PKG>/lessons/<QID>.lesson.json` and `work/<PKG>/selection.json`, added by exact path. Never images,
  voice, scenes, the export copy or the ZIP. Never put keys or secrets in chat or in the repo.
- Voice engine: breeze (the owner chose it; do not ask). Never run two Breeze jobs at once.
- A tool call refused by permissions: do not retry variations. Stop and give the exact refused command in one Arabic line.
- Do not call add_repo (this repository is your own session's), do not message other sessions, never push to `@@QUEUE_BRANCH@@`.

SAVE USAGE (the owner pays for every turn; speed stays the same)
- While the voice build runs there is nothing to do: sleep. Before ending the turn schedule ONE `send_later` sized to the work:
  delay_minutes = number of voice lines in the package + 3 (about 50 s per line), message "SLOT @@SLOT@@: continue". On waking,
  one `tail -n 5 <log>`; not finished: one more `send_later` of 10 minutes. Never poll in a loop inside a turn.
- Read the question facts from `/home/user/kq/kafu_queue/queue/<PKG>.json` (small). Never print the export file.
- Look at images through small copies (see c): a 1024 px copy is enough to read the labels and costs less than half.
- Keep tool output short (`-q`, `| tail -n 5`). No summaries in chat; the final line is the only message.

KEEP-ALIVE (most lost work in the last run came from sessions that ended their turn and never woke up)
- A completion notice for a background job never arrives. Never end a turn while work remains without a pending `send_later`.
  Never `pgrep -f`, `pkill -f` or `while` loops that wait on a process.
- You stop only when every package is delivered, or the voice is broken (SETUP 4). Never stop because a check was quiet.
- Woken after a pause (usage limit, restart): `git status`, then continue with the first package of the list that has no
  ZIP in `dist/` yet. Finished voice lines are cached and are not spoken again.

SETUP (once)
1. `printf 'work/\ndist/\n' >> .git/info/exclude` (the stop hook then never sees the build folders).
2. Start the voice setup in the background, nothing else chained to it, logging to a file:
   motioncards/LESSON_PROMPT.md step 1, as `( <step 1 commands> ) > work/setup.log 2>&1`. A failed download: run it again (it resumes).
3. While the setup runs (always fetch with these explicit refspecs: a single-branch clone does not create origin/<branch> otherwise):
   `git fetch -q origin +refs/heads/@@QUEUE_BRANCH@@:refs/remotes/origin/@@QUEUE_BRANCH@@ +refs/heads/main:refs/remotes/origin/main && git worktree add -q --detach /home/user/kq origin/@@QUEUE_BRANCH@@`
   `git checkout -q -B @@BRANCH@@ origin/main` (your one branch for all your packages)
   `mkdir -p work/input && cp /home/user/kq/kafu_queue/@@EXPORT@@ work/input/`
   `KAFU_MOUNTAIN=$PWD python3 /home/user/kq/kafu_queue/preflight.py export work/input/@@EXPORT_NAME@@ | tail -n 2` must end with
   `PREFLIGHT export OK`. If not: final message "SLOT @@SLOT@@: export rejected" + the FAIL line, and stop.
   Read CLAUDE.md, motioncards/LESSON_PROMPT.md and motioncards/lib/lesson.py (once).
   Read the inbox once: Artifact action "read" with url @@INBOX@@ (needed once per session before uploading to it).
4. Voice smoke test, once `work/setup.log` shows the setup finished (sleep with `send_later` 10 until then):
   `~/.venvs/kafu-voice/bin/python voiceover/voiceover.py sample --engines breeze --seconds 4 --out work/voice-smoke`
   It must print a `Breeze_4s.mp3` line. If it fails: run the setup again once, then the test again. Fails twice (AMX is
   not ready, SHA mismatch, download error...): final message "SLOT @@SLOT@@: الصوت معطل" + the last error line, and stop.
   The Head starts a fresh session for your packages.

FOR EACH PACKAGE, in the order of the list
a. Skip it if done: `git fetch -q origin +refs/heads/@@QUEUE_BRANCH@@:refs/remotes/origin/@@QUEUE_BRANCH@@ && git -C /home/user/kq checkout -q --detach origin/@@QUEUE_BRANCH@@ &&
   python3 /home/user/kq/kafu_queue/watch.py state <PKG>` prints `delivered`.
b. Follow motioncards/LESSON_PROMPT.md steps 3-8 on branch @@BRANCH@@ with: PACKAGE ID <PKG>, workspace `work/<PKG>`, export
   `work/input/@@EXPORT_NAME@@`, ZIP `dist/MCARDS_<PKG>_r1.zip`, only that package's QIDs, ALREADY LIVE @@ALREADY_LIVE@@,
   voice engine breeze.
c. Images (after scaffold, which may empty the folder): `python3 /home/user/kq/kafu_queue/watch.py get work/<PKG>/lessons <its QIDs>`.
   Small copies to look at: `mkdir -p work/look && for f in work/<PKG>/lessons/Q*.png; do ~/.venvs/kafu-voice/bin/python -c "import sys;from PIL import Image;i=Image.open(sys.argv[1]);i.thumbnail((1024,1024));i.save(sys.argv[2])" $f work/look/$(basename $f); done`
   (if that python lacks PIL, use `python3`). Look at each copy once: its "Answer -->" must match the key. A wrong or broken
   image: leave that QID out (scaffold without it) and name it in the final message; do not fail the package.
   Shot and spot coordinates are in the ORIGINAL image's pixels (1536x1024): scale what you see in the copy by 1.5.
d. If a stem contradicts its key (asks for the incorrect statement but only one option is true, etc.), keep the key, write the
   intro question the way it must read to be correct, and list the QID in the PR.
e. As soon as the lesson JSONs and selection.json are written: commit them (exact paths) and push, BEFORE the voice build.
   Step 6 in the background with a log: `( <step 6 commands> ) > work/<PKG>.build.log 2>&1`, then sleep (SAVE USAGE).
f. When `validate` passes, at once:
   1. `ls -l dist/MCARDS_<PKG>_r1.zip`: at most @@MAX_MB@@ MB (a 6-question package is about 3 MB).
   2. `base64 -w0 dist/MCARDS_<PKG>_r1.zip > dist/MCARDS_<PKG>_r1.zip.b64.txt` and Artifact action "publish" with url
      @@INBOX@@, asset true, file_path that .b64.txt (only that file in the call).
      Only if the upload fails or the ZIP is over @@MAX_MB@@ MB: SendUserFile the ZIP (status "proactive", caption "<PKG>: N lessons")
      and keep the error for the final message. Otherwise do not send it: the Head collects it from the inbox.
   3. `git push -q`. After your FIRST package only, open one PR: head @@BRANCH@@, base main, title "Lessons @@PREFIX@@ slot @@SLOT@@".
      Later packages just push to the same branch (the PR updates itself). Note corrected or left-out QIDs in the final message.
g. Next package (a).

FINAL MESSAGE (one Arabic line): SLOT @@SLOT@@, packages N/@@NPKG@@ done, lessons count, PR link, QIDs left out, word timing ok or fallback, any upload error.
