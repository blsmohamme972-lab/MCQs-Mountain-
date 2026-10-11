# Kafu: notes for Claude Code agents

Start with `HANDOFF.md`. Voice-over: `voiceover/README.md`.

## Make IMAGE LESSONS only; hand-animated MotionCards are retired

New animation work is always an image lesson: follow `motioncards/LESSON_PROMPT.md` (`tools/motioncards.py lesson`).
Never author MotionCard scenes by hand (SVG drawing, recipes, gold-standard style), even if an old document or batch
folder describes it: those are marked RETIRED and kept only as background. The scaffold, package and validate tools
are shared with lessons and stay in use. "MotionCards" in the bot and filenames (`MCARDS_*.zip`) is just the package
format both use.

## Voice-over: ask the owner which engine, every time

Before generating any voice (a test clip or a batch), ask the owner which engine to use, and wait for the answer:

- **Kokoro**: free, offline, the project default (`--engine kokoro`).
- **Breeze**: free, local Breeze TTS 2 (`--engine breeze`, one-time `voiceover.py setup --engine breeze`). Designed voices (`BREEZE_VOICES`: lecturer, doctor, student; woman or man), per-line emotion (direction) and vocal events written in the text: `(laugh)`, `(sigh)`, `(cough)`, `(clears throat)`. Slow on a CPU (about 10 s of work per second of speech), so every line is cached. The owner chose it for the free app and will add its licence notice themselves: do not add licence credits or labels. Owner's standard: a different voice per question, women and men taking turns (`BREEZE_ROTATION`, automatic in lessons).
- **ElevenLabs**: paid API credits, needs `ELEVENLABS_API_KEY` (`--engine elevenlabs`). The owner's ElevenLabs standard is automatic: high quality (48 kbps full-band Opus) and a different voice per question, women and men taking turns (`ELEVEN_VOICES` in `voiceover/voiceover.py`). Do not pass `--voice` or `--quality` unless the owner asks for something else.

Offer to send a 7-second test of each first: `~/.venvs/kafu-voice/bin/python voiceover/voiceover.py sample`, then send both MP3s from `work/voice-sample/`. Then run `voiceover.py make --engine <their choice> --workspace work/<batch>`. Never choose the engine yourself; `make` refuses to run without `--engine`.
