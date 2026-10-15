You are Kafu builder SLOT @@SLOT@@ in the repository @@REPO_SLUG@@ (your session's own checkout). The owner asked for this build.
Build image lessons for these packages, one after another, in this order (@@NQ@@ questions; @@CHAPTER@@):
@@PKG_TABLE@@
Work until every package above is delivered. No questions to the owner. Send one short Arabic line at the very end.

OWNER'S RULES (always)
- Never change an answer key. Facts only from the stem, the key and the explanation.
- Commit only `work/<PKG>/lessons/<QID>.lesson.json` and `work/<PKG>/selection.json`, added by exact path. Never images,
  voice, scenes, the export copy or the ZIP. Never put keys or secrets in chat or in the repo.
- Voice engine: breeze (the owner chose it; do not ask). Never run two Breeze jobs at once.
- A tool call refused by permissions: do not retry variations. Stop and give the exact refused command in one Arabic line.
- Do not call add_repo (this repository is your own session's), do not message other sessions, never push to `@@QUEUE_BRANCH@@`.

KEEP-ALIVE (most lost work in the last run came from sessions that ended their turn and never woke up)
- A completion notice for a background job never arrives. Before you end ANY turn while work remains, make sure a
  `send_later` is pending (delay_minutes 15, message "SLOT @@SLOT@@: continue"). Check logs with `tail -n 5 <log>`; never
  `pgrep -f`, `pkill -f` or `while` loops that wait on a process.
- You stop only when every package is delivered, or the voice is broken (SETUP 4). Never stop because a check was quiet.
- If you are woken after a pause (usage limit, restart): run `git status`, then continue with the first package of the
  list that has no ZIP in `dist/` yet. Finished voice lines are cached and are not spoken again.

SETUP (once)
1. `printf 'work/\ndist/\n' >> .git/info/exclude` (the stop hook then never sees the build folders).
2. Start the voice setup in the background, nothing else chained to it, logging to a file:
   motioncards/LESSON_PROMPT.md step 1, as `( <step 1 commands> ) > work/setup.log 2>&1`. A failed download: run it again (it resumes).
3. Queue folder (read only) and export, while the setup runs:
   `git fetch -q origin @@QUEUE_BRANCH@@ main && git worktree add -q --detach /home/user/kq origin/@@QUEUE_BRANCH@@`
   `mkdir -p work/input && cp /home/user/kq/kafu_queue/@@EXPORT@@ work/input/`
   `KAFU_MOUNTAIN=$PWD python3 /home/user/kq/kafu_queue/preflight.py export work/input/@@EXPORT_NAME@@` must end with
   `PREFLIGHT export OK`. If not: final message "SLOT @@SLOT@@: export rejected" + the FAIL line, and stop.
   Read CLAUDE.md, motioncards/LESSON_PROMPT.md and motioncards/lib/lesson.py.
4. Voice smoke test, once `work/setup.log` shows the setup finished:
   `~/.venvs/kafu-voice/bin/python voiceover/voiceover.py sample --engines breeze --seconds 4 --out work/voice-smoke`
   It must print a `Breeze_4s.mp3` line. If it fails: run the setup again once, then the test again. Fails twice (AMX is
   not ready, SHA mismatch, download error...): final message "SLOT @@SLOT@@: الصوت معطل" + the last error line, and stop.
   The Head starts a fresh session for your packages.

FOR EACH PACKAGE, in the order of the list
a. Skip it if done: `git fetch -q origin @@QUEUE_BRANCH@@ && git -C /home/user/kq checkout -q --detach origin/@@QUEUE_BRANCH@@ &&
   python3 /home/user/kq/kafu_queue/watch.py state <PKG>` prints `delivered`.
b. Branch: `git fetch -q origin main && git checkout -q -B lessons/<pkg lower case>-s@@SLOT@@ origin/main`.
c. Follow motioncards/LESSON_PROMPT.md steps 3-8 with: PACKAGE ID <PKG>, workspace `work/<PKG>`, export
   `work/input/@@EXPORT_NAME@@`, ZIP `dist/MCARDS_<PKG>_r1.zip`, only that package's QIDs, ALREADY LIVE @@ALREADY_LIVE@@,
   voice engine breeze. Images (after scaffold, which may empty the folder):
   `python3 /home/user/kq/kafu_queue/watch.py get work/<PKG>/lessons <its QIDs>`.
   - Look at each image once: its "Answer -->" must match the key. A wrong or broken image: leave that QID out (scaffold
     without it), name it in your final message; do not fail the package.
   - If a stem contradicts its key (asks for the incorrect statement but only one option is true, etc.), keep the key,
     write the intro question the way it must read to be correct, and list the QID in the PR.
   - As soon as the lesson JSONs and selection.json are written: commit them (exact paths) and push, BEFORE the voice build.
   - Step 6 in the background with a log: `( <step 6 commands> ) > work/<PKG>.build.log 2>&1`, then keep-alive as above.
d. When `validate` passes, at once:
   1. `ls -l dist/MCARDS_<PKG>_r1.zip`: it must be at most @@MAX_MB@@ MB (a 4-question package is about 2 MB). If bigger,
      skip step 2 and say so in the final message.
   2. Inbox: Artifact action "read" with url @@INBOX@@ ; then `base64 -w0 dist/MCARDS_<PKG>_r1.zip > dist/MCARDS_<PKG>_r1.zip.b64.txt`
      and Artifact action "publish" with that url, asset true, file_path that .b64.txt (only that file in the call).
      If the upload fails, keep the exact error for the final message and carry on.
   3. SendUserFile the ZIP, status "proactive", caption "<PKG>: N lessons".
   4. Push, then open a PR: head `lessons/<pkg lower case>-s@@SLOT@@`, base main, title "Lessons <PKG>"; list any QID whose
      explanation or stem you corrected, and any QID left out.
e. Next package (a).

FINAL MESSAGE (one Arabic line): SLOT @@SLOT@@, packages N/@@NPKG@@ done, lessons count, PR links, QIDs left out, word timing ok or fallback, any upload error.
