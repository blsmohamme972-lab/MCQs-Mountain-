# Kafu reel: one command, a finished Instagram reel

This tool turns one published lesson into a 9:16 reel (1080x1920, 30 fps, about 60-70 s) that shows the **real Kafu app**
inside a realistic phone. You do not design anything: every position comes from the live app, every length from the lesson,
and a quality gate decides whether the file may be sent. **Follow these steps exactly. Do not improvise.**

## What the reel shows (the owner's structure, 2026-10-17)

| time | beat |
|---|---|
| 0.0-1.7 s | Iraqi flag waving full screen, "البورد العراقي / IRAQI BOARD" |
| 1.6-5.2 s | The phone flies in with the real MCQ; it scrolls up to the "Watch the lesson" video card. Big text: "Every MCQ / with a video explanation / كل سؤال… مع شرح بالفيديو" |
| 5.2-10 s | Whip to the home screen, a tap on **Leaders**; the real board scrolls up and down; Arabic names are highlighted |
| 10-11 s | Back to the MCQ, a tap on ▶ |
| 11 s-end-4 s | The real lesson plays in the app's player (picture and voice), zoomed in, frame-exact |
| last 4 s | End card: Kafu, تطبيق عراقي + flag, "Every MCQ / Video explanation", Free · Link in bio |

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

It takes about 6-8 minutes: capture the app (1 min), plan, mix the sound, render every frame, run the quality gate.
The question must be **published** in the app (its "Watch the lesson" card must exist), or the capture stops and says so.

## 3. Read the result

The command prints a report and writes, in `--out`:

- `reel_<QID>.mp4`: the reel.
- `qa_report.json`: `"pass": true` or the list of failures.
- `qa_sheet.jpg`: 14 labelled frames.

**If `pass` is false: do not send.** Each failure says what is wrong; fix the cause and run `make` again.
If `pass` is true, open `qa_sheet.jpg` and check, frame by frame:

1. flag: the Iraqi flag and "البورد العراقي" are sharp;
2. phone, every, video: the real question screen, the headline readable, nothing cut at the sides;
3. home, podium, list: the Leaders tab, yellow boxes sit exactly on Arabic names;
4. back, tap: the "Watch the lesson" card with the finger on ▶;
5. lesson (3 frames): the lesson picture moving, the time counter rising, the voice's captions;
6. end: logo, flag, text, two phones, the pills.

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
- `stills`: plan and render 12 still frames (`still_*.jpg`) from an existing capture, in seconds.
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
- `audio.py` puts the lesson voice (from the ZIP, at `rate`, default 1.1) at the moment ▶ is tapped, adds a 120 bpm bed
  (drums only in the intro and the end card, a soft pad under the voice, ducked), UI sounds on every cue, and normalises
  to -14 LUFS in two passes.
- `qa.py` is the gate.
