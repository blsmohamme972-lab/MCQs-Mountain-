"""Speak narration lines with the repo's Breeze engine (cached per line).
~/.venvs/kafu-voice/bin/python narrate.py <out_dir> <lines.json>
lines.json: {"voice": "<description>", "lines": [{"id": "l1", "text": "...", "direction": "..."}]}"""
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, "/home/user/MCQs-Mountain-/voiceover")
import voiceover as vo  # noqa: E402

out, spec = Path(sys.argv[1]), json.load(open(sys.argv[2]))
out.mkdir(parents=True, exist_ok=True)
lex = vo.load_lexicon()
for ln in spec["lines"]:
    wav = vo.breeze_wav(vo.breeze_text(ln["text"], lex), spec["voice"], ln.get("direction"))
    shutil.copy(wav, out / f'{ln["id"]}.wav')
    print("ok", ln["id"], wav)
