# Kafu MotionCards Voice-over

Every MotionCard gets a short spoken explanation, made entirely by Claude Code. Each chapter of 8 cards arrives as one ZIP for the owner to upload to the Telegram bot.

> **Status (8 Oct 2026):** the voice pipeline is built and proven on chapter 10 (8 cards). Every word passes the listen-back check, and every beat starts within 0–40 ms of its animation. Students cannot hear it yet: the app and the card format need the owner-approved changes in [PLATFORM_PLAN.md](PLATFORM_PLAN.md).

## The Golden 8 Rules

| # | Rule | How this folder meets it |
|---|---|---|
| 1 | **Best voice quality at the lowest file size, and free** | Kokoro-82M voice model (Apache-2.0, free, runs offline), voice `af_heart` (the model's top-rated voice). Opus 16 kbps mono: about **12.6 KB per 8 s card**. A speech recogniser understood every word, even at 12 kbps. |
| 2 | **Voice is added as a ZIP through the Telegram bot** (e.g. every 8 MotionCards with their voice-over) | The voice travels inside the normal `MCARDS_<PKG>_r<N>.zip`: `voice/<QID>.opus` next to each card, checksummed in the manifest. Same bot, same validation, same replace confirmation. |
| 3 | **Claude Code does all the work; the owner only uploads the ZIP** | One command per step: `draft → synth → check → review`. The pipeline writes, speaks, checks the voice by listening back, and makes a review video. No accounts, keys or manual audio editing. |
| 4 | **Cloudflare stays free; the whole project stays free** | No paid service anywhere: local model, local encoder, no API. The voice is embedded in the card file, so it adds **zero requests and zero files** on Cloudflare. |
| 5 | **Thousands of students can use it daily on the free plan** | Zero extra requests per card view. About 13 KB more per card download, compressed. Playback happens on the student's phone. See the free-plan maths in [DESIGN.md](DESIGN.md#free-plan-maths). |
| 6 | **More than 300 books, free** | About 79,000 cards × 12.6 KB ≈ **1 GB of voice** in total, with no storage charge for Worker assets. Two existing limits (unrelated to voice) must be fixed first for 300 books; see [DESIGN.md](DESIGN.md#300-books-two-existing-limits-to-fix-first). |
| 7 | **The voice is synced with the animation as closely as possible** | (a) Each line is written for its beat and must fit inside it (`synth` refuses lines that don't). (b) Each line starts exactly when its caption and animation start. The check measures it from the waveform: **0–40 ms** on chapter 10. (c) In the app, the voice is the master clock, so picture and sound cannot drift (browser test: under 60 ms through play, seek and pause). |
| 8 | **A Claude Code agent can generate the voice easily: least effort, highest quality** | **One-time setup:** `voiceover/bootstrap.sh`. **Then one command:** `voiceover.py make --workspace work/<batch>`. `make` installs what's missing (model pinned by SHA-256) and pre-fills every spoken line from the card's captions. It then speaks, fits, encodes, checks by listening back, and makes review videos. It stops with **one list of everything to fix**, and each fix says how many words to cut. Quality is built in: the top-rated voice, loudness-normalised, a pronunciation dictionary, and a pass/fail listen-back check. |

Voice is a required part of every new card, not an add-on. Students can mute it, and the mute choice is remembered.

## How the owner uses it

1. Ask Claude Code: *"Make chapter N with voice-over"* (or *"add voice to package X"*).
2. Claude Code builds the cards and their voice, then runs every check.
3. You get **one ZIP** and, optionally, review videos (MP4s that play in Telegram) to watch on your phone.
4. Upload the ZIP to the bot. Nothing else.

## How Claude Code makes it (Golden rule 8)

```bash
voiceover/bootstrap.sh                                                   # once per machine: venv, pinned tools, checksummed model
~/.venvs/kafu-voice/bin/python voiceover/voiceover.py make --workspace work/<batch>
```

`make` does everything, then either says **DONE** or prints one list of lines to shorten. Edit those `say` lines in `work/<batch>/voice/<QID>.voice.json` and run `make` again. Existing scripts are kept.

**Least effort:** write each card's numbered captions short and speakable (no arrows or symbols, within the word budget) when the card is made. `make` then needs **no edits at all**, because it reads the captions aloud.

The single steps (`setup`, `draft`, `synth`, `check`, `review`) still exist for fine control.

## What is in this folder

| File | What it is |
|---|---|
| `voiceover.py` | The pipeline: `make` (all in one), or setup, draft, synth, check, review |
| `bootstrap.sh` | One-time setup for a fresh Claude Code machine |
| `lexicon.json` | Pronunciation fixes: abbreviations to spoken words, and exact IPA for medical words the voice got wrong (found by the check) |
| `NARRATION_GUIDE.md` | How to write the spoken lines: word budgets, style, what never to say |
| `DESIGN.md` | Every decision with its evidence: voice, codec, bitrate, sync, delivery, free-plan maths, scaling to 300 books |
| `AUDIT.md` | Checklist for re-checking this work against the Golden 8 Rules, with how to measure each one |
| `PLATFORM_PLAN.md` | The exact app, compiler, validator and Worker changes still needed, for the owner to approve |
| `host/voice-sync.js` | Drop-in sync controller for the app's player (audio-led clock), tested in Chromium |
| `samples/ch10/` | The real chapter 10 voice: 8 Opus tracks (101 KB total), scripts, timing and check report |
| `tests/` | Unit tests, plus a real-browser sync test |
| `requirements.txt` | Pinned versions |

## Chapter 10 pilot results

| QID | Spoken lines (3 beats) | Size | Words understood | Beat starts vs animation |
|---|---|---|---|---|
| Q000009378 | Plasma osmolality falls. / Water floods brain cells. / Brain cells swell: confusion. | 12.1 KB | 100% | +0 / +10 / +10 ms |
| Q000009379 | No insulin: glucose can't enter. / Cells burn fat instead. / Ketones build up: acidosis. | 13.0 KB | 100% | +10 / +10 / +0 ms |
| Q000009380 | Injured lungs can't take up oxygen. / Tissues turn anaerobic. / Lactic acid lowers the pH. | 13.0 KB | 100% | +0 / +10 / +10 ms |
| Q000009381 | Trauma triggers a cortisol surge. / Muscle yields amino acids. / The liver makes new glucose. | 12.0 KB | 100% | +10 / +10 / +10 ms |
| Q000009382 | The liver makes clotting factors. / Sick liver: less prothrombin. / Clotting slows, the INR rises. | 13.4 KB | 100% | +10 / +10 / +10 ms |
| Q000009383 | Energy in equals energy used. / Now eat less than you use. / Fat is burned: weight falls. | 12.0 KB | 94–100% | +10 / +10 / +40 ms |
| Q000009384 | A fractured femur: major stress. / Her metabolic rate rises. / So give more energy in her PN. | 12.8 KB | 100% | +0 / +20 / +10 ms |
| Q000009385 | Swallowed blood becomes ammonia. / The failing liver can't clear it. / Ammonia reaches the brain: drowsiness. | 13.5 KB | 100% | +10 / +10 / +10 ms |

**Total: 101 KB of voice for 8 cards.** The cards themselves are 30–250 KB each, so voice adds about 10%.
