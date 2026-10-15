You are Kafu builder SLOT @@SLOT@@ in the repository @@REPO_SLUG@@ (your session's own checkout). The owner asked for this build.
Build image lessons for these packages, one after another, in this order (@@NQ@@ questions; @@CHAPTER@@):
@@PKG_TABLE@@
Work until every package above is delivered. No questions to the owner, no progress messages. One short Arabic line at the very end.

OWNER'S RULES (always; they override motioncards/LESSON_PROMPT.md where it says otherwise)
- Never change an answer key. Facts only from the stem, the key and the explanation.
- NOTHING IS WRITTEN TO GITHUB: no git commit, no git push, no branch, no pull request (this overrides LESSON_PROMPT step 8).
  Your output is the ZIP in the owner's inbox. Never put keys or secrets in chat.
- Voice engine: breeze (the owner chose it; do not ask). Never run two Breeze jobs at once.
- A tool call refused by permissions: do not retry variations. Stop and give the exact refused command in one Arabic line.
- Do not call add_repo, do not message other sessions.

OWNER'S VOICE STANDARD (overrides the length in LESSON_PROMPT step 5: no 6-8 lines, no 70-90 words)
- At most 60 seconds per question. Order: "question" = the stem (if long, only the important points and the lead-in);
  "answer" = the correct answer as one smart, complete statement that contains the key's words (the most important part);
  2-4 short lines that explain why, each pointing at its scene; one last line that starts with "Remember"; at most one
  vocal event; "dir" = a short delivery instruction (tone, emotion, pace), never a voice description.
- ChatGPT already wrote most of these (in the bundle); you review them and write only the missing ones.

SAVE USAGE (the owner pays for every turn; speed stays the same)
- While the voice build runs there is nothing to do: sleep. Before ending the turn schedule ONE `send_later` sized to the work:
  delay_minutes = number of voice lines in the package + 3 (about 50 s per line), message "SLOT @@SLOT@@: continue". On waking,
  one `tail -n 5 <log>`; not finished: one more `send_later` of 10 minutes. Never poll in a loop inside a turn.
- Read the question facts from `work/kq-data/queue/<PKG>.json` (small). Never print an export file.
- Look at images through small copies (see c): a 1024 px copy is enough to read the labels and costs less than half.
- Keep tool output short (`-q`, `| tail -n 5`). No summaries in chat; the final line is the only message.

KEEP-ALIVE (most lost work in the last run came from sessions that ended their turn and never woke up)
- A completion notice for a background job never arrives. Never end a turn while work remains without a pending `send_later`.
  Never `pgrep -f`, `pkill -f` or `while` loops that wait on a process.
- You stop only when every package is delivered, or the voice is broken (SETUP 4). Never stop because a check was quiet.
- Woken after a pause (usage limit, restart): continue with the first package of the list that has no ZIP in `dist/` yet.
  If `work/kq-data` is gone (new container), do SETUP 1-3 again. Finished voice lines are cached and are not spoken again.

SETUP (once)
1. `printf 'work/\ndist/\n' >> .git/info/exclude` (build folders never show up as changes).
2. Start the voice setup in the background, nothing else chained to it, logging to a file:
   motioncards/LESSON_PROMPT.md step 1, as `( <step 1 commands> ) > work/setup.log 2>&1`. A failed download: run it again (it resumes).
3. While the setup runs:
   a. Tools (read only): `git fetch -q origin +refs/heads/@@QUEUE_BRANCH@@:refs/remotes/origin/@@QUEUE_BRANCH@@ && git worktree add -q --detach /home/user/kq origin/@@QUEUE_BRANCH@@`
      (explicit refspec: a single-branch clone does not create origin/<branch> otherwise).
   b. Data: Artifact action "read" with url @@INBOX@@ and path @@BUNDLE@@ (the run's bundle; the result says where it saved
      the file). Then `python3 /home/user/kq/kafu_queue/bundle.py unpack <that file> work/kq-data` must print `BUNDLE OK`.
      Reading the inbox here also lets you upload to it later.
   c. `mkdir -p work/input && cp @@EXPORT_CP@@ work/input/`
      `@@EXPORT_CHECK@@` must print `PREFLIGHT export OK` for every export. If not: final message "SLOT @@SLOT@@: export
      rejected" + the FAIL line, and stop.
   d. Read CLAUDE.md, motioncards/LESSON_PROMPT.md and motioncards/lib/lesson.py (once).
4. Voice smoke test, once `work/setup.log` shows the setup finished (sleep with `send_later` 10 until then):
   `~/.venvs/kafu-voice/bin/python voiceover/voiceover.py sample --engines breeze --seconds 4 --out work/voice-smoke`
   It must print a `Breeze_4s.mp3` line. If it fails: run the setup again once, then the test again. Fails twice (AMX is
   not ready, SHA mismatch, download error...): final message "SLOT @@SLOT@@: الصوت معطل" + the last error line, and stop.
   The Head starts a fresh session for your packages.

FOR EACH PACKAGE, in the order of the list
a. Skip it if `dist/MCARDS_<PKG>_r1.zip` exists and was uploaded already.
b. Follow motioncards/LESSON_PROMPT.md steps 3-7 with: PACKAGE ID <PKG>, workspace `work/<PKG>`, export
   `work/input/<the export named in that package's row above>`, ZIP `dist/MCARDS_<PKG>_r1.zip`, only that package's QIDs,
   ALREADY LIVE @@ALREADY_LIVE@@, voice engine breeze. Step 8 is replaced by f below.
c. Images (after scaffold, which may empty the folder): `python3 /home/user/kq/kafu_queue/watch.py get work/<PKG>/lessons <its QIDs>`.
   Small copies to look at: `mkdir -p work/look && for f in work/<PKG>/lessons/Q*.png; do ~/.venvs/kafu-voice/bin/python -c "import sys;from PIL import Image;i=Image.open(sys.argv[1]);i.thumbnail((1024,1024));i.save(sys.argv[2])" $f work/look/$(basename $f); done`
   (if that python lacks PIL, use `python3`). Look at each copy once: its "Answer -->" must match the key. A wrong or broken
   image: leave that QID out (scaffold without it) and name it in the final message; do not fail the package.
   Shot and spot coordinates are in the ORIGINAL image's pixels (1536x1024): scale what you see in the copy by 1.5.
   Then the lessons from ChatGPT's voice scripts (run from the repository root):
   `python3 /home/user/kq/kafu_queue/lesson_from_voice.py work/<PKG>/lessons <its QIDs>`
   It writes <QID>.lesson.json for every QID that has a voice script and lists the ones without. Review each written lesson
   (do not rewrite good ones): every line agrees with the stem, key and explanation (fix only a wrong line), the answer
   statement is the key, and each shot/spot sits on its scene in the copy you looked at (move it if not). Write the listed
   ones yourself in the OWNER'S VOICE STANDARD.
d. If a stem contradicts its key (asks for the incorrect statement but only one option is true, etc.), keep the key and write
   the intro question the way it must read to be correct; name the QID in the final message.
e. Step 6 in the background with a log: `( <step 6 commands> ) > work/<PKG>.build.log 2>&1`, then sleep (SAVE USAGE).
f. When `validate` passes, at once:
   1. `ls -l dist/MCARDS_<PKG>_r1.zip`: at most @@MAX_MB@@ MB (a 6-question package is about 3 MB).
   2. `base64 -w0 dist/MCARDS_<PKG>_r1.zip > dist/MCARDS_<PKG>_r1.zip.b64.txt` and Artifact action "publish" with url
      @@INBOX@@, asset true, file_path that .b64.txt (only that file in the call).
      Only if the upload fails or the ZIP is over @@MAX_MB@@ MB: SendUserFile the ZIP (status "proactive", caption "<PKG>: N lessons")
      and keep the error for the final message. Otherwise do not send it: the Head collects it from the inbox.
g. Next package (a).

FINAL MESSAGE (one Arabic line): SLOT @@SLOT@@, packages N/@@NPKG@@ done, lessons count, QIDs left out or corrected, word timing ok or fallback, any upload error.
