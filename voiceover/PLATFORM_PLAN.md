# Platform changes needed before students hear the voice

Everything in `voiceover/` runs without touching the platform. Playing the voice in the app needs the changes below. Per `motioncards/AGENTS.md`, these are infrastructure changes: each one goes in its own PR for the owner to review. Nothing is deployed without the owner's approval.

Suggested order: **PR 1 → PR 2 → PR 3**, with PR 4 when the card count nears 20,000.

## PR 1: free-plan safety for card delivery (needed with or without voice; Golden rules 4–6)

- `motioncards-worker/dist/_headers`: move the CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CORS (indexes and assets) and cache headers here, by path pattern.
- `motioncards-worker/wrangler.jsonc`: remove `run_worker_first: true`. Card and index requests are then served as static assets: free, unlimited, and not counted toward the 100,000/day Worker requests shared by the whole account.
- Keep the Worker script only if something truly dynamic remains; otherwise make it assets-only.
- Tests: the existing Wrangler static-asset acceptance must still prove the exact headers, the `.html` route without redirect, the CSP sandbox and Kafu-only CORS.

## PR 2: voice in the package, compiler and validator (Golden rules 2, 3)

- **Workspace:** `work/<batch>/voice/<QID>.opus` and `<QID>.track.json`, both produced by `voiceover.py synth`.
- **`motioncards/lib/package.py`:**
  - Package `voice/<QID>.opus` in the ZIP.
  - Add `voice` to each animation row of the manifest: `{path, mime:"audio/ogg; codecs=opus", bytes, sha256, track_ms, cues:[{t_ms,end_ms,text}], voice, engine}`.
  - `package` refuses a new card without voice (Golden rule: voice is required). `--no-voice` exists only for re-packaging old cards.
- **Validator:** the path is allowed only as `voice/Q#########.opus`. The file must start with `OggS` and contain `OpusHead`, be at most 64 KB, and match its SHA-256. `track_ms` must be at most the card's `duration_ms` and the cues must lie inside it. One voice per animation; no other audio paths.
- **Compiler** (deterministic, so the validator's byte-exact rebuild still works): embed `<script type="application/octet-stream" id="kafu-voice">BASE64</script>` in the entry. The child runtime, after `ready`, posts `{type:"voice", mime, sha256, data:ArrayBuffer}` on the existing MessageChannel, transferring the buffer. The card's CSP stays `media-src 'none'`: the card never plays sound itself.
- **Publisher index:** add `voice: {sha256, bytes, mime}` to each QID's record, so the host can verify what the card sends.
- **Docs:** add the voice step to `MASTER_PROMPT.md` and `AUTHORING_V2.md`, and add `voiceover/` to the bundle file list.
- **Tests:**
  - package/validate with voice: tampered bytes, wrong magic, oversize, extra audio path and missing voice must all fail
  - compiler determinism with voice
  - the existing authoring tests must still pass

## PR 3: host player (Golden rule 7)

- Add `voiceover/host/voice-sync.js` to `app/modules/` (it is already written and browser-tested).
- `motioncards-core.js`: accept `"voice"` in `validMessage`.
- `motioncards-player.js`:
  - **On `voice` message:** check the bytes against the index SHA-256 (`crypto.subtle`), then `KafuMotionCards.voice.create(bytes)`.
  - **`play()`** (already inside the click handler, so the user gesture holds): call `voice.play(active.time)`.
  - **`frame(now)`:** use `t = voice.clock(now - anchor)` and re-anchor to it (the audio-led clock).
  - **`pause()`, `seek()`, `restart()`, `closePlayer()`:** call `voice.pause`, `voice.seek`, `voice.seek(0)` and `voice.destroy` respectively.
  - **Mute button:** add a 🔊/🔇 button next to Play/Restart, with an `aria-label` and the choice remembered (`kafu.motioncards.voice.muted`).
- **Old iPhones (Safari before 18.4, no Ogg Opus):**
  - If `voice.supported()` is false, lazy-load a small WASM Opus decoder hosted on the app's own origin (candidate: `ogg-opus-decoder` from *wasm-audio-decoders*; **verify its licence and size at integration**).
  - Decode to PCM and play through WebAudio, clocked by `AudioContext.currentTime`.
  - The decoder is downloaded only by those phones, so it costs nothing for everyone else.
- **Tests:**
  - extend `tools/motioncards/browser_smoke.py` with a voiced card: play, seek, pause; picture and voice stay within 60 ms
  - mute persists across cards
  - no sound before the user taps Play

## PR 4: shards for 300+ books (Golden rule 6)

- The free plan allows 20,000 files per Worker version, about 75 books at one file per card.
- Publish to `kafu-motioncards-1 … N` by book (a deterministic book → shard map stored in state).
- The index records the shard base URL for each card; the app already loads cards from the index URL.
- Each shard is an assets-only Worker after PR 1, so every shard stays free and unlimited.
