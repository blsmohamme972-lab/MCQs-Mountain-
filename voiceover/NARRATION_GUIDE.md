# Writing the spoken lines

`voiceover.py make` (or `draft`) creates `voice/<QID>.voice.json` with one entry per beat (the card's numbered captions). Each `say` line is **pre-filled with the caption**. Edit only the lines `make` lists as too long, or ones that read badly aloud.

**Least effort (Golden rule 8):** write the captions themselves short and speakable when authoring the card: within the word budget (about 6 / 5 / 6 words on an 8 s card), no arrows or symbols. The voice then needs no edits.

## Rules

1. **One short spoken line per beat.** Stay within the word budget `draft` prints. On an 8 s card that is about 6 / 5 / 6 words. The voice talks at about 2.6 words per second.
2. **Say what the animation shows at that moment**, in the same order. The line starts with its caption and its animation step (Golden rule 7).
3. **Spoken English, not caption text:**
   - no arrows, symbols or abbreviations the ear can't parse
   - write "ammonia", not "NH₃"; `lexicon.json` expands the common ones (INR, PO₂, →)
4. **Never contradict the source answer or explanation.** Never say option letters ("C is correct") and never add facts the card doesn't show. The host shows the correct answer after the card.
5. **Plain and calm.** Short sentences, present tense, no filler ("so basically…"). A colon gives a natural pause: "Ketones build up: acidosis."
6. **The last beat carries the takeaway.** It may run up to the final hold (350 ms before the end).
7. If `synth` says a line doesn't fit, **cut words**. Don't lengthen the card, unless the owner set a longer duration.

## Fields

```json
{"qid": "Q000009379", "duration_ms": 8000, "voice": "af_heart", "lang": "en-us", "speed": 1.05,
 "beats": [{"start_ms": 0, "end_ms": 2700, "caption": "No insulin: glucose cannot enter the cells", "say": "No insulin: glucose can't enter."}, …]}
```

- `voice`: `af_heart` (default, best rated) or `bf_emma` with `"lang": "en-gb"` for a British voice. Use one voice per book.
- `speed`: 1.05 by default. `synth` raises it up to 1.2 when a line runs long. A beat can set its own `speed`.

## After `synth`

`check` must say **CHECK PASS**:
- If a word "sounds like" something else, add the word to `lexicon.json`:
  - `say` for abbreviations
  - `ipa` for words the voice mispronounces (copy the pattern of the existing entries)
- Then run `synth` and `check` again.
- Watch at least one `review` MP4 per batch with sound.
