# Kafu: notes for Claude Code agents

Start with `HANDOFF.md`. MotionCards: `motioncards/MASTER_PROMPT.md`. Voice-over: `voiceover/README.md`.

## Voice-over: ask the owner which engine, every time

Before generating any voice (a test clip or a batch), ask the owner which engine to use, and wait for the answer:

- **Kokoro**: free, offline, the project default (`--engine kokoro`).
- **ElevenLabs**: paid API credits, needs `ELEVENLABS_API_KEY` (`--engine elevenlabs`).

Offer to send a 7-second test of each first: `~/.venvs/kafu-voice/bin/python voiceover/voiceover.py sample`, then send both MP3s from `work/voice-sample/`. Then run `voiceover.py make --engine <their choice> --workspace work/<batch>`. Never choose the engine yourself; `make` refuses to run without `--engine`.
