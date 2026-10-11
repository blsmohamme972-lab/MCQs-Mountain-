# Image lessons: the prompt to start a session

Paste this into a new Claude Code session, fill in the ✏️ lines, attach the images and paste the chapter export under it.
The owner checks the voice and the picture in the app; the agent does not run speech or frame checks and makes no MP4.

```
You are making Kafu IMAGE LESSONS (not MotionCards) for the repo blsmohamme972-lab/MCQs-Mountain-.
An image lesson = one landscape illustration + voice, played below its MCQ in the app. I (the owner) upload the ZIP
to my Telegram bot and check the voice and the picture myself. Work fast: no speech-recognition check, no frame
renders, no MP4 previews. Do not change app code.
Do it in ONE pass: write all lesson files at once, build once, package once. Do not stop to ask or report progress
unless something is broken; send one short message at the end with the ZIP.

✏️ CHAPTER: MRCS-PARTA-550-2E chapter <N>, all questions in the export below (skip: <QIDs or none>)
✏️ PACKAGE ID: MRCS-CH<N>   (ZIP name MCARDS_MRCS-CH<N>_r1.zip; short ids only)
✏️ ALREADY LIVE: <yes | no>  (yes = these questions already have an animation in the app)
VOICE ENGINE: breeze (my answer to the CLAUDE.md engine question; do not ask again)
STYLE: one narrator, Breeze lecturer-woman (default). Leave out "who", "voices" and "names".
IMAGES: attached, one per question in source order. Save each as work/MRCS-CH<N>-LESSONS/lessons/<QID>.png.

READ FIRST: CLAUDE.md, motioncards/lib/lesson.py.

1. Setup (fresh machine, run in the background while you read):
   export MOTIONCARDS_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome ; pip install playwright ;
   voiceover/bootstrap.sh ; ~/.venvs/kafu-voice/bin/python voiceover/voiceover.py setup --engine breeze
2. Save the export below as work/input/MRCS-PARTA-550-2E-ch<N>.export.json (content hashes must match).
3. Look at each image once: it must open fully, and its "Answer -->" text must match that question's key.
   Tell me only if one is broken or belongs to another question; otherwise carry on without asking.
4. Scaffold: python3 tools/motioncards.py scaffold work/input/<export> --out work/MRCS-CH<N>-LESSONS
   --package-id MRCS-CH<N> --revision 1 --qids <QIDs> --duration-ms 30000
   If ALREADY LIVE is yes, add --replace <QID> for every QID (the bot refuses to overwrite without it).
5. Write lessons/<QID>.lesson.json per question:
   {"qid","image":"<QID>.png","takeaway"(<=240 chars),"engine":"breeze","tempo":1.0,
    "shots":[{"x","y","z","spot":[x,y,r]}],"lines":[{"text","shot"}]}
   - shots in the image's own pixels; shot 0 = whole image (z 1); 1.7-2.3 to zoom on a labelled part.
     Keep each spotlight in the upper three-quarters of its shot (the caption covers the bottom).
   - 6-8 lines, 70-90 words (31-35 s); every line points at what it talks about.
   - Facts only from the stem, answer and explanation; never change the key or invent numbers.
   - Known Breeze respellings are in voiceover/lexicon.json (say_breeze); add one only if a word is plainly wrong.
6. Build, lint, package and validate in ONE background command (about 50 s per voice line; never two Breeze jobs
   at once; wait for the completion notice, do not poll):
   W=work/MRCS-CH<N>-LESSONS; E=work/input/MRCS-PARTA-550-2E-ch<N>.export.json; Z=dist/MCARDS_MRCS-CH<N>_r1.zip
   ~/.venvs/kafu-voice/bin/python tools/motioncards.py lesson --workspace $W && python3 tools/motioncards.py lint --workspace $W
   && python3 tools/motioncards.py package $E --workspace $W --out $Z && python3 tools/motioncards.py validate $Z
   (lint and validate must PASS; ZIP <= 19 MB)
7. If something fails, fix only that and re-run step 6 (finished voice lines are cached and not re-spoken).
8. Commit the workspace and the ZIP, push, open a PR, send me the ZIP. Keep messages short.

If the bot answers "animation_replace_requires_explicit_intent", the questions are already live: set
"replace": true in each scenes/<QID>.scene.json, raise package_revision in selection.json, package again as _r2.

<paste the chapter export JSON here>
```
