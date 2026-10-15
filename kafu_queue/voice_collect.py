#!/usr/bin/env python3
"""Collect the voice scripts ChatGPT wrote (Head Department). Each painter card makes ChatGPT save one text file,
VOICE_<first QID>-<last QID>.txt, next to the images in the Drive folder.

  voice_collect.py drive PREFIX          read every VOICE_*.txt in the Drive folder
  voice_collect.py file PREFIX PATH...   read voice scripts from local files instead: the .txt itself, or the painter_*.html
                                         page the owner sends (its cards carry the same text; the backup when Drive fails)

Every file must pass: its "check" code (proves not one character changed on the way), and for every question the same rules
the ChatGPT script used (gpt_writer.py check_voice) against the key in the queue. Good questions are written to
<data folder>/voice/<QID>.json (nothing goes to GitHub; bundle.py carries them to the builders). A bad file or question is reported and skipped: its builder
writes that lesson itself, so nothing waits. Prints how many questions of PREFIX have a voice script.
"""
import hashlib
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gpt_writer  # noqa: E402
import watch  # noqa: E402

from kafu_data import VOICE as OUT  # noqa: E402
RULES = {}
exec(gpt_writer.core(), RULES)          # the exact rules ChatGPT's script used (check_voice, norm, voice_seconds)


def texts_from(raw, name):
    """All voice JSON texts in a file: a plain .txt, or the BEGIN/END blocks of a painter page."""
    if name.endswith(".html") or "----- BEGIN VOICE_" in raw:
        page = html.unescape(raw)
        return re.findall(r"----- BEGIN (VOICE_[\w-]+\.txt) -----\n(.*?)\n----- END \1 -----", page, re.S)
    return [(name, raw)]


def parse(text):
    a, b = text.find("{"), text.rfind("}")
    if a < 0 or b < a:
        raise ValueError("no JSON in the file (was it saved as a Google Doc?)")
    data = json.loads(text[a:b + 1])
    if data.get("format") != "kafu-voice-v1":
        raise ValueError("not a Kafu voice file")
    check = data.pop("check", None)
    canon = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    if hashlib.sha256(canon.encode()).hexdigest()[:16] != check:
        raise ValueError("check code does not match: the text was changed on the way")
    return data


def collect(prefix, sources):
    from kafu_data import require_data_folder
    require_data_folder()
    items = {it["qid"]: it for k, q in watch.packages().items() if k.startswith(prefix + "-") for it in q["items"]}
    if not items:
        sys.exit(f"no packages {prefix}-*")
    OUT.mkdir(exist_ok=True)
    good, bad = 0, 0
    for name, text in sources:
        try:
            data = parse(text)
        except Exception as e:  # noqa: BLE001
            print(f"FAIL {name}: {e}")
            bad += 1
            continue
        for q, row in data["items"].items():
            if q not in items:
                print(f"SKIP {name}: {q} is not a question of {prefix}")
                continue
            L = row["lesson"]
            lines = L["lines"]
            v = {"question": L["question"]["text"], "answer": L["answer"]["text"], "takeaway": L["takeaway"],
                 "lines": [{k: x[k] for k in x if k in ("text", "say", "scene", "dir")} for x in lines[:-1]],
                 "remember": {k: lines[-1][k] for k in lines[-1] if k in ("text", "say", "scene", "dir")}}
            for k in ("question", "answer"):
                if L[k].get("say"):
                    v[k + "_say"] = L[k]["say"]
            errs = RULES["check_voice"](q, v, items[q]["answer_text"].strip(), len(row["scenes"]))
            if errs:
                print(f"FAIL {name}: " + "; ".join(errs))
                bad += 1
                continue
            (OUT / f"{q}.json").write_text(json.dumps(row, indent=1, ensure_ascii=False) + "\n")
            good += 1
    have = sorted(q for q in items if (OUT / f"{q}.json").exists())
    print(f"voice scripts: {good} written now, {bad} rejected; {prefix} has {len(have)}/{len(items)} questions with a voice script")
    missing = [f"Q{items[q].get('number')}" for q in items if q not in have]
    if missing:
        print("without a voice script (the builder writes these itself): " + " ".join(missing[:40]) + (" ..." if len(missing) > 40 else ""))


def main(a):
    if len(a) < 2:
        sys.exit(__doc__)
    if a[0] == "drive":
        every = []
        watch.list_drive(watch.CONFIG["drive_folder_id"], every=every)
        srcs = []
        for name, fid in every:
            if name.upper().startswith("VOICE_Q"):
                if not name.lower().endswith(".txt"):
                    print(f"FAIL {name}: not a .txt file (saved as a Google Doc?): ask the owner to re-paste that card, or send the painter page")
                    continue
                srcs += texts_from(watch.download(fid).decode("utf-8", "replace"), name)
        print(f"Drive: {len(srcs)} voice file(s)")
        collect(a[1], srcs)
    elif a[0] == "file":
        srcs = []
        for p in a[2:]:
            srcs += texts_from(Path(p).read_text(encoding="utf-8", errors="replace"), Path(p).name)
        collect(a[1], srcs)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
