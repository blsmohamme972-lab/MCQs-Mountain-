# Kafu reel: one command, a finished Instagram reel

This tool turns one published lesson into a 9:16 reel (1080x1920, 30 fps, about 60-70 s) that shows the **real Kafu app**
inside a realistic phone. You do not design anything: every position comes from the live app, every length from the lesson,
and a quality gate decides whether the file may be sent. **Follow these steps exactly. Do not improvise.**

## What the reel shows (the owner's structure, 2026-10-17)

Built for retention: something new every 1-3 s in the opening, an open question until the answer, a reason to stay after it.

| time (Q25 example) | beat |
|---|---|
| 0.0-1.3 s | Iraqi flag waving full screen, "البورد العراقي / IRAQI BOARD" (impact) |
| 1.3-3.3 s | The Board books slam in over the flag, one every 0.25 s: "RUSH MCQs", "BAILEY MCQs", "ILLUSTRATED MCQs"… Headline "All your Board books / كل كتب البورد… بمكان واحد" |
| 3.3-4.2 s | The books fall into the phone as it flies up; the flag shrinks away |
| 4.2-7.7 s | The real MCQ scrolls up to its "Watch the lesson" video card: "Every MCQ / with a video explanation / كل سؤال… مع شرح بالفيديو" |
| 7.7-12.2 s | Whip to the home screen, a tap on **Leaders**; the real board scrolls up and down; Arabic names are highlighted ("Weekly leagues / دوري أسبوعي") |
| 12.2-13.5 s | Back to the MCQ, "Tap to watch", a tap on ▶ |
| 13.5 s-end-4 s | The real lesson plays in the app's player (picture and voice), zoomed in, frame-exact. Headlines follow the lesson's own clock: "Answer before the video" → (answer) "Did you get it right? / اكتب جوابك بالتعليقات" → (story) "Now the trick to never forget it" → (remember) "Remember this" |
| last 4 s | End card: Kafu, تطبيق عراقي + flag, "Every MCQ / Video explanation / كل سؤال… مع شرح بالفيديو", the two phones, "مجاني · الرابط بالبايو / Free · Link in bio", "دزّها لصاحبك اللي يدرس للبورد". Everything stays above y=1560, clear of Instagram's caption and buttons |

Book covers come from the app's own catalogue (`covers` in `config.default.json`: book id + the word shown).

## 1. Requirements (once per machine)

- `~/.venvs/kafu-voice` with `playwright`, `numpy`, `pillow` (`~/.venvs/kafu-voice/bin/python -m pip install pillow` if missing).
- Chromium (default path `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; pass `--chromium` otherwise) and `ffmpeg`.
- Network access to the live app `https://kafu.blsmohamme97.workers.dev/` (the capture opens it).

## 2. Make the reel

You need the lesson package ZIP (`MCARDS_<PACKAGE>_r1.zip`, the file sent to the bot) and the question id inside it.

```
~/.venvs/kafu-voice/bin/python tools/kafu_reel/reel.py make \
    --zip <path>/MCARDS_BAILEY-CH2H_r1.zip --qid Q000000257 --out work/reels/Q000000257
```

It takes about 8-12 minutes: capture the app (1 min), plan, mix the sound, render every frame on all CPU cores, run the quality gate.
The question must be **published** in the app (its "Watch the lesson" card must exist), or the capture stops and says so.

## 3. Read the result

The command prints a report and writes, in `--out`:

- `reel_<QID>.mp4`: the reel.
- `qa_report.json`: `"pass": true` or the list of failures.
- `qa_sheet.jpg`: 16 labelled frames (the same moments `stills` renders).

**If `pass` is false: do not send.** Each failure says what is wrong; fix the cause and run `make` again.
If `pass` is true, open `qa_sheet.jpg` and check, frame by frame:

1. flag: the Iraqi flag and "البورد العراقي" are sharp;
2. books: covers centred, the headline above them readable, the word under them ("RUSH MCQs");
3. fall, every, card: the books drop into the phone; the real question screen; headlines readable, nothing cut;
4. home, podium, list: the tap on Leaders; yellow boxes sit exactly on Arabic names;
5. tap: the "Watch the lesson" card with the finger on ▶;
6. try, got, story, last: the lesson moving, the time counter rising, the headline matching the lesson moment;
7. end: logo, flag, text, two phones, the two Arabic pills (the gate already checked that every line fits and stays
   above Instagram's caption).

Then send the MP4 to the owner (SendUserFile). Never commit the outputs (lean storage).

## 4. Rules

- **Never invent a number.** `--students-now` shows a "N students studying now" beat, and the app's own counter. Use it
  only with a real number the owner gave you (admin usage page). Without it the counter is hidden. The app computes its
  counter and the board's rivals on the device, so an advert must not present them as live facts.
- Texts live in `config.default.json`. To change wording, pass `--config my.json` with only the keys you change
  (`{"text": {"watch_en": "..."}}`). Keep the English short (a headline must fit one or two lines) and check the sheet.
- Do not edit times or positions for one lesson. If something looks wrong, fix `timeline.py` or the template for every
  lesson, re-run, and look at the sheet.
- Do not add other organisations' logos (for example the Iraqi Board council's emblem): use the flag and the words.

## 5. Other commands (for fixing the template)

- `capture`: only capture the app into `--out/cap/`.
- `stills`: plan and render the sheet's labelled moments as still frames (`still_*.jpg`) from an existing capture, in seconds.
- `build`: plan, sound, render and gate from an existing capture (no new capture).

## How it works (for maintainers)

- `capture.py` opens the app in a 390x844 iPhone at 3x, accepts the one-time notice, and saves every screen as
  layers: the whole scrollable page with fixed/sticky bars hidden (`*_content.png`), and the bars alone at scroll 0 and
  scrolled (`*_fixed0.png`, `*_fixedN.png`). Fixed pseudo-elements (the board's bottom fade) are handled too.
  `geometry.json` holds every rectangle: tabs, options, the lesson card and ▶, the player stage, time text and slider,
  Arabic names and rows on the board. The capture stops with a clear message if anything is missing.
- `timeline.py` turns the geometry into keyframes: phone pose (`focus(rect)` puts a rect at a frame position),
  screen segments with transitions (push, fade, whip), scroll curves, finger path and taps, highlights, texts.
- `template/reel.html` draws one frame from `t` alone (no state). The phone, status bar, island and glare are CSS;
  the app screens are the captured layers; the lesson is the real compiled MotionCards entry in an iframe, seeked to the
  exact millisecond through the same host protocol the app uses (`render.py`).
- `render.py` keeps the lesson iframe in the page's process (`--disable-features=IsolateSandboxedIframes`; the sandbox is
  unchanged). Out of process it starts at 0x0 and sometimes measured its text before it had a layout (the card then
  reports an error). The page also waits for the card before its first frame, and every render chunk draws its first
  frame once before recording, so a frame after a jump in time is never stale.
- `audio.py` puts the lesson voice (from the ZIP, at `rate`, default 1.1) at the moment ▶ is tapped, adds a 120 bpm bed
  (drums only in the intro and the end card, a soft pad under the voice, ducked), UI sounds on every cue, and normalises
  to -14 LUFS in two passes.
- `qa.py` is the gate.
