#!/usr/bin/env python3
"""Kafu MotionCards voice-over: free, offline, small, synced narration for MotionCards.

Agent quick start (Golden rule 8):  voiceover/bootstrap.sh  then  voiceover.py make --workspace work/<batch>

Pipeline (one command per step):
  make    everything below in one go (setup if needed, draft, synth, check, review)
  setup   download the pinned Kokoro-82M model + voices (Apache-2.0) and check SHA-256
  draft   write work/<batch>/voice/<QID>.voice.json, lines pre-filled from the scene's numbered captions
  synth   speak each beat, fit it inside its beat window, place it on the card timeline,
          loudness-normalise, encode Opus 16 kbps mono -> work/<batch>/voice/<QID>.opus + .track.json
  check   listen back with a speech recogniser: every word understood, every beat starts on time
  review  render the card and mux it with its voice into work/<batch>/voice/review/<QID>.mp4

Run with the voice-over venv:  voiceover/.venv/bin/python voiceover/voiceover.py all --workspace work/<batch>
See voiceover/README.md (the Golden 8 Rules) and voiceover/DESIGN.md.
"""
from __future__ import annotations
import argparse, hashlib, json, re, subprocess, sys, urllib.request
from difflib import SequenceMatcher
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CACHE = Path.home() / ".cache" / "kafu-voiceover"
SR = 24000                      # Kokoro output rate; Opus encodes it natively (super-wideband)
BITRATE = "16k"                 # Golden rule 1: chosen by listening test + ASR check (see DESIGN.md)
MAX_SPEED = 1.2                 # never speed a voice up more than this to fit a beat
LEAD_MS, FIRST_LEAD_MS, TAIL_MS, END_HOLD_MS = 120, 250, 120, 350
MAX_VOICE_BYTES = 48 * 1024     # per card, after encoding (a 30 s card at 16 kbps is ~60 KB: raise only with a reason)
MODEL = {
    "kokoro-v1.0.onnx": ("https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
                         "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5"),
    "voices-v1.0.bin": ("https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
                        "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d"),
}
ENGINE = "kokoro-82M v1.0 (Apache-2.0) via kokoro-onnx 0.6.1"
DEFAULT_VOICE, DEFAULT_LANG, DEFAULT_SPEED = "af_heart", "en-us", 1.05
CAPTION = re.compile(r"^\s*(\d+)\s*·\s*(.+)$", re.S)


# ---------------------------------------------------------------- helpers (pure, unit-tested)
def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""): h.update(c)
    return h.hexdigest()


def load_lexicon(path: Path = HERE / "lexicon.json") -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def beats_from_scene(scene: dict) -> list[dict]:
    """The numbered captions ("1 · …") with their show windows are the card's beats."""
    out = []
    for l in scene.get("layers", []):
        if l.get("type") not in ("text", "label") or not isinstance(l.get("show"), list): continue
        m = CAPTION.match(str(l.get("text", "")))
        if m: out.append({"n": int(m.group(1)), "start_ms": int(l["show"][0]), "end_ms": int(l["show"][1]), "caption": m.group(2).strip()})
    out.sort(key=lambda b: b["start_ms"])
    return out


def draft_doc(scene: dict, voice=DEFAULT_VOICE, lang=DEFAULT_LANG) -> dict:
    beats = beats_from_scene(scene)
    if not beats: raise ValueError(f"{scene.get('qid')}: no numbered captions ('1 · …' with show:[a,b]) to time the voice to")
    return {"qid": scene["qid"], "duration_ms": int(scene["duration_ms"]), "voice": voice, "lang": lang, "speed": DEFAULT_SPEED,
            "beats": [{"start_ms": b["start_ms"], "end_ms": b["end_ms"], "caption": b["caption"],
                       "say": b["caption"]} for b in beats]}   # pre-filled from the caption: synth tells you if it is too long


def window_ms(doc: dict, i: int) -> int:
    """Time a beat's clip may last: from its start (+lead) to the next beat (−tail); the last beat may run to the end hold."""
    b = doc["beats"][i]; lead = FIRST_LEAD_MS if i == 0 else LEAD_MS
    end = doc["duration_ms"] - END_HOLD_MS if i == len(doc["beats"]) - 1 else b["end_ms"] - TAIL_MS
    return end - b["start_ms"] - lead


def max_words(doc: dict, i: int, wps: float = 2.6) -> int:
    """Rough word budget for a beat at normal speed (Kokoro af_heart ≈ 2.5–2.7 words/s)."""
    return max(1, int(window_ms(doc, i) / 1000 * wps))


def spoken_text(text: str, lex: dict) -> str:
    """Apply 'say' rewrites (abbreviations, subscripts) before phonemising."""
    for k, v in lex.get("say", {}).items(): text = re.sub(rf"(?<![\w]){re.escape(k)}(?![\w])", v, text)
    return text


def ipa_split(text: str, ipa: dict) -> list[tuple[str, bool]]:
    """Split text into (chunk, is_ipa) so dictionary words get their exact IPA and the rest is phonemised normally."""
    if not ipa: return [(text, False)]
    pat = re.compile(r"(?<![\w-])(" + "|".join(sorted(map(re.escape, ipa), key=len, reverse=True)) + r")(?![\w-])", re.I)
    out, pos = [], 0
    for m in pat.finditer(text):
        if m.start() > pos: out.append((text[pos:m.start()], False))
        out.append((ipa[next(k for k in ipa if k.lower() == m.group(1).lower())], True)); pos = m.end()
    if pos < len(text): out.append((text[pos:], False))
    return out


def norm_words(text: str) -> list[str]:
    return [w for w in re.sub(r"[^a-z0-9 ]", " ", text.lower().replace("-", "")).split() if w]


def word_score(expected: str, heard: str) -> float:
    """Best character-level match of the expected words against any run of heard words.
    Joined words, so ASR spacing ('pro thrombin') is not an error; best window, so an ASR repeat is not either."""
    a, hw = "".join(norm_words(expected)), norm_words(heard)
    if not a: return 1.0
    n = len(norm_words(expected)); best = 0.0
    for size in range(max(1, n - 2), n + 3):
        for i in range(0, max(1, len(hw) - size + 1)):
            best = max(best, SequenceMatcher(None, a, "".join(hw[i:i + size])).ratio())
    return best


# ---------------------------------------------------------------- model
def model_paths() -> tuple[Path, Path]:
    return CACHE / "kokoro-v1.0.onnx", CACHE / "voices-v1.0.bin"


def cmd_setup(a):
    CACHE.mkdir(parents=True, exist_ok=True)
    for name, (url, digest) in MODEL.items():
        p = CACHE / name
        if not p.exists() or sha256(p) != digest:
            print("downloading", name); urllib.request.urlretrieve(url, p)
        got = sha256(p)
        if got != digest: p.unlink(); sys.exit(f"{name}: SHA-256 mismatch ({got}); refusing to use it")
        print("ok", name, digest[:12])


_K = None
def kokoro():
    global _K
    if _K is None:
        from kokoro_onnx import Kokoro
        m, v = model_paths()
        if not m.exists(): sys.exit("model missing: run `voiceover.py setup` first")
        _K = Kokoro(str(m), str(v))
    return _K


def phonemes(text: str, lang: str, lex: dict) -> str:
    k = kokoro(); ipa = lex.get("ipa", {}).get(lang, {})
    parts = []
    for chunk, is_ipa in ipa_split(spoken_text(text, lex), ipa):
        if is_ipa: parts.append(chunk)
        elif chunk.strip(): parts.append(k.tokenizer.phonemize(chunk, lang=lang))
    return " ".join(p.strip() for p in parts if p.strip())


def trim_lead(s, rel_db=-35.0, keep_ms=8):
    """Cut the model's leading silence so the first word starts exactly where the clip is placed (Golden rule 7)."""
    import numpy as np
    n = SR // 200; frames = len(s) // n
    if frames == 0: return s
    rms = np.sqrt(np.mean(s[:frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    first = int(np.argmax(rms > rms.max() * 10 ** (rel_db / 20)))
    return s[max(0, first * n - SR * keep_ms // 1000):]


def speak(text: str, voice: str, lang: str, speed: float, lex: dict):
    import numpy as np
    s, sr = kokoro().create(phonemes(text, lang, lex), voice=voice, speed=speed, lang=lang, is_phonemes=True)
    assert sr == SR
    return trim_lead(np.asarray(s, dtype=np.float32))


# ---------------------------------------------------------------- synth
def ws_voice(ws: Path) -> Path:
    d = ws / "voice"; d.mkdir(parents=True, exist_ok=True); return d


def scenes(ws: Path, qids=None):
    for p in sorted((ws / "scenes").glob("Q*.scene.json")):
        s = json.loads(p.read_text(encoding="utf-8"))
        if not qids or s["qid"] in qids: yield s


def cmd_draft(a):
    ws = Path(a.workspace); d = ws_voice(ws)
    for s in scenes(ws, a.qids):
        p = d / f"{s['qid']}.voice.json"
        if p.exists() and not a.force: print("keep", p.name); continue
        doc = draft_doc(s, a.voice, a.lang)
        p.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print("draft", p.name, "budgets (words):", [max_words(doc, i) for i in range(len(doc["beats"]))])


def encode_opus(pcm, out: Path):
    """Loudness-normalise to −16 LUFS and encode Opus 16 kbps mono, bit-exact (same input → same bytes)."""
    import numpy as np
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR), "-ac", "1",
                        "-c:a", "libopus", "-b:a", BITRATE, "-vbr", "on", "-application", "voip", "-frame_duration", "60",
                        "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", str(out)],
                       input=np.asarray(pcm, np.float32).tobytes(), capture_output=True)
    if r.returncode: sys.exit("ffmpeg failed: " + r.stderr.decode()[-400:])


def synth_one(doc: dict, d: Path, lex: dict) -> dict:
    import numpy as np
    qid = doc["qid"]; clips, cues, problems = [], [], []
    for i, b in enumerate(doc["beats"]):
        say = b.get("say", "").strip()
        if not say or say.startswith("EDIT:"): problems.append(f"{qid} beat {i+1}: write the spoken line ('say') first"); continue
        speed, win = float(b.get("speed", doc.get("speed", DEFAULT_SPEED))), window_ms(doc, i)
        clip = speak(say, doc["voice"], doc["lang"], speed, lex)
        ms = len(clip) * 1000 / SR
        if ms > win:                                   # Golden rule 7: the line must finish inside its beat
            speed = min(MAX_SPEED, speed * ms / win * 1.02)
            clip = speak(say, doc["voice"], doc["lang"], speed, lex); ms = len(clip) * 1000 / SR
            if ms > win:
                problems.append(f"{qid} beat {i+1}: '{say}' needs {ms:.0f} ms, the beat allows {win} ms even at {MAX_SPEED}x: "
                                f"cut it to about {max_words(doc, i)} words"); continue
        at = b["start_ms"] + (FIRST_LEAD_MS if i == 0 else LEAD_MS)
        clips.append((at, clip)); cues.append({"t_ms": at, "end_ms": round(at + ms), "text": say, "speed": round(speed, 3)})
    if problems: raise ValueError("\n".join(problems))      # every problem of the card at once: one editing pass fixes all
    total = max(at * SR // 1000 + len(c) for at, c in clips) + SR // 10
    track = np.zeros(total, np.float32)
    for at, c in clips: s0 = at * SR // 1000; track[s0:s0 + len(c)] += c
    out = d / f"{qid}.opus"; encode_opus(track, out)
    size = out.stat().st_size
    if size > MAX_VOICE_BYTES: raise ValueError(f"{qid}: voice is {size} bytes, over the {MAX_VOICE_BYTES} byte budget")
    info = {"qid": qid, "file": out.name, "mime": "audio/ogg; codecs=opus", "bytes": size, "sha256": sha256(out),
            "track_ms": round(total * 1000 / SR), "card_ms": doc["duration_ms"], "voice": doc["voice"], "lang": doc["lang"],
            "engine": ENGINE, "bitrate": BITRATE, "cues": cues}
    (d / f"{qid}.track.json").write_text(json.dumps(info, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return info


def cmd_synth(a):
    ws = Path(a.workspace); d = ws_voice(ws); lex = load_lexicon(); rows, bad = [], []
    for p in sorted(d.glob("Q*.voice.json")):
        doc = json.loads(p.read_text(encoding="utf-8"))
        if a.qids and doc["qid"] not in a.qids: continue
        try: info = synth_one(doc, d, lex); rows.append(info)
        except ValueError as e: bad.append(str(e)); continue
        print(f"{info['qid']}  {info['bytes']/1024:5.1f} KB  {info['track_ms']/1000:4.1f} s  speeds {[c['speed'] for c in info['cues']]}")
    if rows: print(f"total {sum(r['bytes'] for r in rows)/1024:.1f} KB for {len(rows)} cards")
    if bad: sys.exit("\n".join(["FIX:"] + bad))


# ---------------------------------------------------------------- check (ASR round trip)
def pcm16k(path: Path):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def speech_onsets(pcm, cues, sr=16000, frame_ms=10, rel_db=-30.0) -> list[int | None]:
    """Exact sync measure from the waveform: first 10 ms frame above (peak − 30 dB) near each cue."""
    import numpy as np
    n = sr * frame_ms // 1000; frames = len(pcm) // n
    if frames == 0: return [None] * len(cues)
    rms = np.sqrt(np.mean(pcm[:frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    thr = rms.max() * 10 ** (rel_db / 20); out = []; prev_end = 0
    for c in cues:
        # search from 400 ms early, but never inside the previous beat's own line
        lo, hi = max(0, (c["t_ms"] - 400) // frame_ms, prev_end // frame_ms + 1), min(frames, (c["t_ms"] + 400) // frame_ms)
        prev_end = c.get("end_ms", c["t_ms"])
        hit = next((i for i in range(lo, hi) if rms[i] > thr), None)
        out.append(None if hit is None else hit * frame_ms - c["t_ms"])
    return out


def assign_words(words, cues) -> list[list]:
    """Give every recognised word to the beat whose spoken span is nearest to the word's midpoint."""
    groups = [[] for _ in cues]
    for w in words:
        mid = (w.start + w.end) * 500
        i = min(range(len(cues)), key=lambda k: 0 if cues[k]["t_ms"] <= mid <= cues[k]["end_ms"] else min(abs(mid - cues[k]["t_ms"]), abs(mid - cues[k]["end_ms"])))
        groups[i].append(w)
    return groups


def cmd_check(a):
    from faster_whisper import WhisperModel
    ws = Path(a.workspace); d = ws_voice(ws); asr = WhisperModel(a.asr, device="cpu", compute_type="int8")
    fails, report = [], []
    for p in sorted(d.glob("Q*.track.json")):
        info = json.loads(p.read_text(encoding="utf-8"))
        if a.qids and info["qid"] not in a.qids: continue
        if sha256(d / info["file"]) != info["sha256"]: fails.append(f"{info['qid']}: audio changed after synth; re-run synth"); continue
        pcm = pcm16k(d / info["file"])
        segs, _ = asr.transcribe(pcm, beam_size=5, word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
        words = [w for s in segs for w in (s.words or [])]
        onsets = speech_onsets(pcm, info["cues"])
        row = {"qid": info["qid"], "beats": []}
        for c, got, onset in zip(info["cues"], assign_words(words, info["cues"]), onsets):
            heard = " ".join(w.word.strip() for w in got)
            score = word_score(c["text"], heard)
            row["beats"].append({"say": c["text"], "heard": heard, "score": round(score, 3), "onset_error_ms": onset})
            if score < a.min_score: fails.append(f"{info['qid']}: said '{c['text']}' but it sounds like '{heard}' ({score:.2f}); fix lexicon.json")
            if onset is None or abs(onset) > 80: fails.append(f"{info['qid']}: beat '{c['text'][:30]}…' starts {onset} ms off its animation beat")
        report.append(row)
        print(info["qid"], " | ".join(f"{b['score']:.2f} {b['onset_error_ms']:+d}ms" if b['onset_error_ms'] is not None else f"{b['score']:.2f} ?" for b in row["beats"]))
    (d / "check-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if fails: sys.exit("\n".join(["CHECK FAILED:"] + fails))
    print("CHECK PASS: every word understood, every beat starts within 80 ms of its animation beat")


# ---------------------------------------------------------------- review video (owner listens on the phone)
def cmd_review(a):
    sys.path.insert(0, str(ROOT))
    from motioncards.lib.render import render_scenes
    ws = Path(a.workspace); d = ws_voice(ws); out = d / "review"; out.mkdir(exist_ok=True)
    for s in scenes(ws, a.qids):
        tr = d / f"{s['qid']}.track.json"
        if not tr.exists(): continue
        fdir = out / f"frames-{s['qid']}"; step = 1000 // a.fps
        times = list(range(0, int(s["duration_ms"]) + 1, step))
        render_scenes([s], fdir, times=times, sizes=["phone"], sheet=False)
        lst = fdir / "list.txt"
        lst.write_text("".join(f"file '{fdir}/{s['qid']}_phone_{t:05d}ms.png'\nduration {step/1000}\n" for t in times), encoding="utf-8")
        mp4 = out / f"{s['qid']}.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-i", str(d / f"{s['qid']}.opus"),
                        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-r", str(a.fps), "-c:v", "libx264", "-crf", "28",
                        "-preset", "veryfast", "-af", "apad", "-c:a", "aac", "-b:a", "48k", "-shortest", str(mp4)], check=True)
        subprocess.run(["rm", "-rf", str(fdir)])
        print("review", mp4, f"{mp4.stat().st_size/1024:.0f} KB")


def cmd_all(a):
    for f in (cmd_synth, cmd_check, cmd_review): f(a)


def cmd_make(a):
    """Golden rule 8: one command for the agent. Installs the model if missing, drafts every card's lines
    from its captions (existing scripts are kept), then synth -> check -> review. Stops with a clear FIX list."""
    m, v = model_paths()
    if not (m.exists() and v.exists()): cmd_setup(a)
    cmd_draft(a); cmd_synth(a); cmd_check(a)
    if not a.no_review: cmd_review(a)
    d = ws_voice(Path(a.workspace))
    print(f"DONE: voice for {len(list(d.glob('Q*.track.json')))} cards in {d} — now run: python tools/motioncards.py package … (it embeds the voice)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup").set_defaults(f=cmd_setup)
    for name, f in (("make", cmd_make), ("draft", cmd_draft), ("synth", cmd_synth), ("check", cmd_check), ("review", cmd_review), ("all", cmd_all)):
        p = sub.add_parser(name); p.set_defaults(f=f)
        p.add_argument("--workspace", required=True); p.add_argument("--qids", nargs="*")
        p.add_argument("--voice", default=DEFAULT_VOICE); p.add_argument("--lang", default=DEFAULT_LANG)
        p.add_argument("--force", action="store_true"); p.add_argument("--asr", default="base.en")
        p.add_argument("--min-score", type=float, default=0.85); p.add_argument("--fps", type=int, default=15)
        p.add_argument("--no-review", action="store_true", help="make: skip the review videos")
    a = ap.parse_args(); a.f(a)


if __name__ == "__main__":
    main()
