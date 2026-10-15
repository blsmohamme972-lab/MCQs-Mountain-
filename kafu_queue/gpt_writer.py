#!/usr/bin/env python3
"""ChatGPT step 1: the prompts the owner pastes into ChatGPT so that it WRITES the image prompts.

  python3 kafu_queue/gpt_writer.py --prefix GT-CH5 --out writer_GT-CH5.html [--per-chat 16] [--set 8] [--qids Q..,Q..]

Reads queue/<PREFIX>-*.json (make_queue.py split) and writes one HTML page for the owner: one card per ChatGPT chat,
each with a "Copy" button. A card holds the writing rules, the questions (stem, options, key, explanation) and a
Python script. ChatGPT fills in only the DATA part of the script (cast and story for each set of 8 questions, a title,
scenes and a banner per question) and runs it. The script checks the work (every QID once, every banner present, short
answers copied exactly) and writes painter_<first>-<last>.html: one card per set of 8 images, each card a complete
message for a NEW ChatGPT chat that draws the 8 images and saves them to Google Drive as <QID>.png.

The same page code (PAGE_CODE) builds both HTML files, so the owner sees the same Copy page twice.
"""
import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
QUEUE = Path(os.environ.get("KAFU_QUEUE_DIR", HERE / "queue"))
CONFIG = json.loads((HERE / "config.json").read_text())
EXACT_MAX = 60      # an answer up to this many characters must appear on the banner exactly as written

# Builds a Copy page. Used here and pasted verbatim into the script ChatGPT runs. Plain Python, no imports beyond json/html.
PAGE_CODE = r'''
import html as _html, json as _json

def copy_page(title, intro, cards):
    """cards: list of (heading, text). Returns one self-contained HTML page with a Copy button per card."""
    css = ("body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:16px;background:#f4f6fa;color:#111}"
           "h1{font-size:20px;margin:0 0 6px}p.i{margin:0 0 14px;color:#444;font-size:14px}"
           ".c{background:#fff;border:1px solid #d6dbe4;border-radius:10px;padding:12px;margin:0 0 14px}"
           ".h{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}"
           ".h b{font-size:16px}button{font-size:16px;padding:10px 18px;border:0;border-radius:8px;background:#1f5eff;color:#fff}"
           "button.ok{background:#14883e}textarea{width:100%;box-sizing:border-box;height:120px;margin-top:8px;font:12px monospace}"
           "@media (prefers-color-scheme:dark){body{background:#111418;color:#eee}.c{background:#1b2027;border-color:#2c333d}"
           "p.i{color:#aaa}textarea{background:#0d1014;color:#ddd}}")
    js = ("var T=" + _json.dumps([t for _, t in cards]).replace("</", "<\\/") + ";"
          "function cp(i,b){var t=T[i];function done(){b.textContent='Copied \\u2713';b.className='ok';}"
          "function fb(){var a=document.getElementById('t'+i);a.focus();a.select();try{document.execCommand('copy');done();}"
          "catch(e){b.textContent='Select the text below and copy';}}"
          "if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).then(done,fb);}else{fb();}}")
    out = ["<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>",
           "<title>" + _html.escape(title) + "</title><style>" + css + "</style></head><body>",
           "<h1>" + _html.escape(title) + "</h1><p class='i'>" + _html.escape(intro) + "</p>"]
    for i, (head, text) in enumerate(cards):
        out.append("<div class='c'><div class='h'><b>" + _html.escape(head) + " (" + str(len(text)) + " chars)</b>"
                   "<button onclick='cp(" + str(i) + ",this)'>Copy</button></div>"
                   "<textarea id='t" + str(i) + "' readonly>" + _html.escape(text) + "</textarea></div>")
    out.append("<script>" + js + "</script></body></html>")
    return "".join(out)
'''

STYLE = ("Picmonic-style visual mnemonic, fun and medically accurate, for medical students: cute cartoon characters with big "
         "friendly eyes, bright flat colors, thick dark outlines, clean pale background, each fact drawn as a memorable visual pun. "
         "All text sits in rounded white label boxes with dark navy bold letters, crisp and spelled exactly as given.")
AVOID = ("Avoid: garbled or misspelled text, extra text that is not in quotes here, duplicated characters, distorted faces, "
         "realistic gore, photographs, watermarks, cluttered dark background.")
FRESH = ('IMPORTANT - FRESH START: ignore any images, files or results from previous chats or from your memory. Do not reuse, '
         'link to or re-upload any old image. The ONLY truth is what is in the Google Drive folder "Books" right now (not the '
         'trash). Every image in this task must be newly generated in this chat.')

# Shared by both scripts ChatGPT may run: constants, the Copy page, and make_page (checks DATA, writes painter_*.html).
CORE = r'''DRIVE = "@@DRIVE@@"
STYLE = @@STYLE@@
AVOID = @@AVOID@@
FRESH = @@FRESH@@
@@PAGE_CODE@@

def make_page(DATA, EXPECT, SETS, OUTNAME):
    import re
    err = []
    if len(DATA["sets"]) != len(SETS):
        err.append(f"DATA['sets'] needs {len(SETS)} entries, has {len(DATA['sets'])}")
    for k, s in enumerate(DATA["sets"]):
        for f in ("cast", "story"):
            if not str(s.get(f, "")).strip():
                err.append(f"set {k + 1}: empty {f}")
        if len(str(s.get("cast", "")).split()) > 70:
            err.append(f"set {k + 1}: cast longer than 70 words")
    items = DATA["items"]
    for q in items:
        if q not in EXPECT:
            err.append(f"{q}: not one of the questions of this batch")
    for q, e in EXPECT.items():
        it = items.get(q)
        if not it:
            err.append(f"{q} (question {e['n']}): missing")
            continue
        title, scenes, banner = (str(it.get(f, "")).strip() for f in ("title", "scenes", "banner"))
        if not title or len(title.split()) > 6:
            err.append(f"{q}: title must be 1-6 words")
        lines = [x for x in scenes.splitlines() if x.strip()]
        if not 3 <= len(lines) <= 5:
            err.append(f"{q}: scenes must be 3-5 lines, has {len(lines)}")
        labels = re.findall(r'"([^"]+)"', scenes)
        if not 3 <= len(labels) <= 12:
            err.append(f"{q}: 3-12 quoted labels needed, has {len(labels)}")
        for lab in labels:
            if len(lab.split()) > 5:
                err.append(f"{q}: label too long (max 5 words): {lab}")
        if "Answer" in scenes or "banner" in scenes.lower():
            err.append(f"{q}: put the answer only in 'banner', not in scenes")
        if not banner:
            err.append(f"{q}: empty banner")
        elif e["exact"] is not None and banner != e["exact"]:
            err.append(f"{q}: banner must be exactly: {e['exact']}")
        elif e["exact"] is None and len(banner.split()) > 10:
            err.append(f"{q}: banner longer than 10 words")
        if '"' in banner or '"' in title:
            err.append(f"{q}: no double quotes inside title or banner")
    if err:
        print("ERROR - fix DATA and run again:")
        print("\n".join(err))
    else:
        cards = []
        for k, qids in enumerate(SETS):
            s = DATA["sets"][k]
            nums = ", ".join(EXPECT[q]["n"] for q in qids)
            msg = [FRESH, "",
                   f'Task: generate {len(qids)} teaching illustrations and save each one to my Google Drive folder "Books" ({DRIVE}).',
                   "Work one image at a time, in this order:",
                   "1. If <QID>.png is already in \"Books\" now, skip that image.",
                   "2. Otherwise generate it from its prompt exactly as written (landscape 3:2, 1536x1024).",
                   "3. Check it: every quoted label present and spelled exactly; the bottom banner reads exactly as written. If not, regenerate once.",
                   "4. Save it to \"Books\" in the same message, named exactly <QID>.png (capital Q, nine digits, .png, no other words). Then go on.",
                   "Do not stop after generating: generate, check, save, next. No drafts or duplicates in the folder; to replace an image, overwrite the same name.",
                   "If you stop before the end and I write \"continue\", continue from the first image that is not yet in \"Books\".",
                   f"When finished, reply with one line: saved N/{len(qids)} and the QIDs you could not save. If you cannot save to Drive, say so plainly; never claim an image was saved when it was not.",
                   "", "Recurring characters of this set (draw them the same way in every image): " + s["cast"].strip(),
                   "Story of this set: " + s["story"].strip(), ""]
            for i, q in enumerate(qids, 1):
                it = items[q]
                p = (f"Create a landscape 3:2 image (1536x1024). {STYLE}\n"
                     f"Recurring characters: {s['cast'].strip()}\n"
                     f"This is scene {i} of {len(qids)} of the story: {s['story'].strip()}\n"
                     f"Title banner at the top: \"{it['title'].strip()}\".\n"
                     f"{it['scenes'].strip()}\n"
                     f"Bottom banner: \"Answer --> {it['banner'].strip()}\".\n{AVOID}")
                msg += [f"===== IMAGE {i} of {len(qids)}: save as {q}.png (question {EXPECT[q]['n']}) =====", p, ""]
            cards.append((f"Set {k + 1}: questions {nums}", "\n".join(msg)))
        page = copy_page(OUTNAME[:-5], "Paste each card into a NEW ChatGPT chat (one card per chat). It draws the images and saves them to Google Drive.", cards)
        open("/mnt/data/" + OUTNAME, "w", encoding="utf-8").write(page)
        print(f"OK - {len(EXPECT)} prompts in {len(SETS)} sets. File: /mnt/data/{OUTNAME}")
'''

# Per-chat script (questions inside the prompt): ChatGPT edits DATA only.
SCRIPT = r'''# ===== Kafu painter page builder. Edit ONLY the DATA block. Run it. Fix DATA until it prints OK. =====
DATA = {
  "sets": [
    # one entry per set, in order. Example:
    # {"cast": """Captain Valve, a round red heart with a sailor cap ...""", "story": """The crew sails ..."""},
  ],
  "items": {
    # one entry per QID. Example:
    # "Q000000001": {"title": """Oesophageal Hiatus""",
    #                "scenes": """LEFT: ... Label: "T10".
    # CENTER: ... Label: "Oesophagus".
    # RIGHT: ... labels "Anterior gastric nerve" and "Posterior gastric nerve".""",
    #                "banner": """T10"""},
  },
}
# ===== do not change anything below this line =====
EXPECT = @@EXPECT@@
SETS = @@SETS@@
OUTNAME = "@@OUTNAME@@"
@@CORE@@
make_page(DATA, EXPECT, SETS, OUTNAME)
'''

# Master script (the owner attaches the app export to the chat): reads the export itself, batch by batch.
MASTER_SCRIPT = r'''# ===== Kafu master script: run this whole block once, exactly as it is =====
@@CORE@@
import glob as _glob, math as _math
BATCH_SIZE = @@BATCH@@
SET_SIZE = @@SET@@
EXACT_MAX = @@EXACT_MAX@@


def _num(q):
    s = str(q.get("source_number"))
    return (0, int(s), "") if s.isdigit() else (1, 0, s)


def _answer_text(q):
    opts, a = q.get("options", []), str(q.get("answer", "")).strip().upper()
    for i, o in enumerate(opts):
        lab = (o.get("label") or o.get("key") or o.get("letter") or "ABCDEFGH"[i]) if isinstance(o, dict) else "ABCDEFGH"[i]
        if str(lab).strip().upper() == a:
            return ((o.get("text") or o.get("value") or "") if isinstance(o, dict) else str(o)).strip()
    return ""


def _load():
    found = []
    for f in sorted(_glob.glob("/mnt/data/**/*.json", recursive=True)):
        try:
            d = _json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        if isinstance(d, dict) and d.get("export_type") == "kafu_mcq_text_export":
            found.append(d)
    if not found:
        raise SystemExit("NO EXPORT FOUND: ask the owner to upload the app export JSON file again.")
    qs = {}
    for d in found:
        for q in d.get("questions", []):
            qs.setdefault(q["id"], q)
    return sorted(qs.values(), key=_num)


def show(n):
    """Prints batch n (1, 2, 3...) of the export: the questions to write prompts for."""
    global EXPECT, SETS, OUTNAME
    qs = _load()
    total = _math.ceil(len(qs) / BATCH_SIZE)
    chunk = qs[(n - 1) * BATCH_SIZE: n * BATCH_SIZE]
    if n < 1 or not chunk:
        print(f"NO BATCH {n}: the export has {len(qs)} questions = {total} batches.")
        EXPECT, SETS, OUTNAME = {}, [], ""
        return
    EXPECT, rows = {}, []
    for q in chunk:
        ans = _answer_text(q)
        if not ans:
            raise SystemExit(f"{q['id']}: the key {q.get('answer')!r} matches no option. Tell the owner; do not guess.")
        exact = ans if len(ans) <= EXACT_MAX and '"' not in ans else None
        EXPECT[q["id"]] = {"n": str(q.get("source_number")), "exact": exact}
        opts = [(f"{o.get('label') or 'ABCDEFGH'[i]}. {(o.get('text') or o.get('value') or '').strip()}" if isinstance(o, dict)
                 else f"{'ABCDEFGH'[i]}. {str(o).strip()}") for i, o in enumerate(q.get("options", []))]
        row = {"qid": q["id"], "question_number": q.get("source_number"), "stem": q.get("stem", ""), "options": opts,
               "key": q.get("answer"), "key_text": ans, "explanation": q.get("explanation", ""),
               "has_book_images": bool(q.get("images"))}
        if exact is not None:
            row["banner"] = exact
        rows.append(row)
    SETS = [[q["id"] for q in chunk[i:i + SET_SIZE]] for i in range(0, len(chunk), SET_SIZE)]
    first, last = chunk[0].get("source_number"), chunk[-1].get("source_number")
    OUTNAME = f"painter_batch{n:02d}_Q{first}-{last}.html"
    print(f"BATCH {n} of {total}: questions {first}-{last}, {len(chunk)} questions, {len(SETS)} set(s): {SETS}")
    print(_json.dumps(rows, ensure_ascii=False, indent=1))


def make(DATA):
    """Checks DATA for the batch shown last and writes its painter file."""
    if not SETS:
        raise SystemExit("Run show(n) first.")
    make_page(DATA, EXPECT, SETS, OUTNAME)


SETS = []
print("Master script loaded. Next: show(<batch number>).")
'''

WRITER = '''You write image prompts for a medical-education app (Kafu). Do NOT draw any image in this chat.
Your only output is ONE downloadable HTML file, made by running the Python script at the end in your Python tool.

THE QUESTIONS ({N} multiple-choice questions, JSON below). The key is final: never change it, never contradict it.

STEP 1 - story and characters. The questions are already split into {N_SETS} set(s) of up to {SET} (listed under SETS in the
script). For each set invent:
- "cast": 2-4 recurring cartoon characters with a fixed look (body or species, colours, clothes, one prop each), at most 60
  words in total. They are the actors of every scene in the set, so the images feel like one story.
- "story": one sentence, the adventure that links the scenes of the set (e.g. a hospital-ship voyage, a detective case).

STEP 2 - one picture plan per question:
- "title": 2-5 words, the topic of the question.
- "scenes": 3-5 lines, one scene per line, left to right (start the lines with LEFT:, CENTER:, RIGHT: or similar). In each
  scene a cast member acts out one fact as a memorable visual pun, and the scene ends with its label(s) in double quotes.
- "banner": the answer for the bottom banner (the script adds "Answer --> "). If the question lists an exact "banner", copy it
  character for character. Otherwise write the key's option text shortened faithfully to at most 8 words.

RULES (learned from earlier runs; they decide whether the images come out right):
- Facts only from the stem, the key and the explanation. Never invent numbers. If the explanation is wrong, contradictory or
  does not explain the key, show the short standard correct reason that supports the key.
- 3 to 12 quoted labels per question, 1 to 4 words each. A long list in one label comes out garbled: give each item its own
  short label, or show it with colour and no text. No double quotes except around labels.
- One story that flows left to right. Every arrow or path must reach where the scene says.
- Keep each character small enough (about a third of the width or less) to leave room for the other scenes.
- Never use the same object for two meanings within one image.
- The answer appears only on the banner, never inside the scenes.
- "has_book_images": true means the book shows a picture: describe only what the stem and explanation say.
- Nothing gory, no real photos, no brand names.

STEP 3 - copy the script below exactly into your Python tool. Fill in only the DATA block (use triple quotes \"\"\" for
every text). Run it. If it prints ERROR, fix DATA and run it again until it prints OK. Then reply with only the download
link of the file {OUTNAME}. Never change the lines below "do not change anything below this line".

QUESTIONS:
{QUESTIONS}

SCRIPT:
```python
{SCRIPT}
```'''


def core():
    c = CORE
    for k, v in {"@@DRIVE@@": CONFIG["drive_folder_url"], "@@STYLE@@": json.dumps(STYLE), "@@AVOID@@": json.dumps(AVOID),
                 "@@FRESH@@": json.dumps(FRESH), "@@PAGE_CODE@@": PAGE_CODE.strip()}.items():
        c = c.replace(k, v)
    return c


# The fixed prompt for the owner who attaches the app export to the ChatGPT chat himself.
MASTER = """You write image prompts for a medical-education app (Kafu). Do NOT draw any image in this chat.
I attached my app export (a JSON file, export_type kafu_mcq_text_export). Its keys are final: never change or contradict one.
You work in batches of @@BATCH@@ questions (@@NSETS@@ sets of @@SET@@ images). For each batch you give me one downloadable HTML
file, made by the master script below.

HOW TO WORK
1. Copy the master script below exactly into your Python tool and run it once (do not change any line of it).
2. Run show(1). It prints batch 1: its questions (stem, options, key, explanation, sometimes an exact "banner") and its sets.
3. Write the DATA for that batch (STEP 1 and STEP 2 below), then run make(DATA). If it prints ERROR, fix DATA and run
   make(DATA) again until it prints OK. Reply with only the download link of the file it names, plus one line:
   "batch n of N: questions a-b".
4. Then stop and wait. When I write "next", do the next batch the same way (show(2), then make(DATA), ...).
   When I write "batch 5", do batch 5. When show() says there is no such batch, tell me all batches are done.
5. If Python was reset (NameError, or the file is gone), run the master script again; if it prints NO EXPORT FOUND,
   ask me to upload the export again.

DATA format (Python; use triple quotes \"\"\" for every text):
DATA = {"sets": [{"cast": \"\"\"...\"\"\", "story": \"\"\"...\"\"\"}, ...one per set, in order],
        "items": {"<QID>": {"title": \"\"\"...\"\"\", "scenes": \"\"\"LEFT: ... "Label".
CENTER: ... "Label".
RIGHT: ... "Label".\"\"\", "banner": \"\"\"...\"\"\"}, ...one per QID of the batch}}

@@RULES@@

MASTER SCRIPT:
```python
@@MASTER_SCRIPT@@
```"""


def master_text():
    rules = WRITER[WRITER.index("STEP 1 - story"):WRITER.index("STEP 3 - copy")].strip()
    rules = rules.replace("The questions are already split into {N_SETS} set(s) of up to {SET} (listed under SETS in the\nscript).",
                          "show() lists the sets of the batch.")
    ms = MASTER_SCRIPT.replace("@@CORE@@", core())
    batch, set_size = CONFIG["gpt_writer_questions"], CONFIG["gpt_set_size"]
    for k, v in {"@@BATCH@@": str(batch), "@@SET@@": str(set_size), "@@EXACT_MAX@@": str(EXACT_MAX)}.items():
        ms = ms.replace(k, v)
    text = MASTER
    for k, v in {"@@BATCH@@": str(batch), "@@NSETS@@": str(-(-batch // set_size)), "@@SET@@": str(set_size),
                 "@@RULES@@": rules, "@@MASTER_SCRIPT@@": ms.strip()}.items():
        text = text.replace(k, v)
    assert "@@" not in text and "{N_SETS}" not in text
    return text, ms


def packages(prefix):
    out = [json.loads(p.read_text()) for p in QUEUE.glob(f"{prefix}-*.json")]
    return sorted(out, key=lambda q: [num_key(it.get("number")) for it in q["items"]])


def num_key(n):
    """Question numbers sort as numbers (9 before 10 before 101), anything else after them."""
    s = str(n)
    return (0, int(s), "") if s.isdigit() else (1, 0, s)


def letter_options(opts):
    res = []
    for i, o in enumerate(opts):
        if isinstance(o, dict):
            lab = (o.get("label") or o.get("key") or o.get("letter") or "ABCDEFGH"[i])
            res.append(f"{lab}. {(o.get('text') or o.get('value') or '').strip()}")
        else:
            res.append(f"{'ABCDEFGH'[i]}. {str(o).strip()}")
    return res


def build(prefix, per_chat, set_size, only=None):
    items = [it for q in packages(prefix) for it in q["items"]]
    if only:
        items = [it for it in items if it["qid"] in only]
    if not items:
        sys.exit(f"no questions for prefix {prefix} in {QUEUE}")
    seen = set()
    for it in items:
        if it["qid"] in seen:
            sys.exit(f"duplicate QID {it['qid']}")
        seen.add(it["qid"])
        if not it.get("answer_text", "").strip():
            sys.exit(f"{it['qid']}: no answer text (make_queue.py check)")
    cards = []
    for c in range(0, len(items), per_chat):
        chunk = items[c:c + per_chat]
        sets = [[it["qid"] for it in chunk[i:i + set_size]] for i in range(0, len(chunk), set_size)]
        first, last = chunk[0].get("number"), chunk[-1].get("number")
        outname = f"painter_{prefix}_Q{first}-{last}.html"
        expect = {}
        qs = []
        for it in chunk:
            ans = it["answer_text"].strip()
            exact = ans if len(ans) <= EXACT_MAX and '"' not in ans else None
            expect[it["qid"]] = {"n": str(it.get("number")), "exact": exact}
            row = {"qid": it["qid"], "question_number": it.get("number"), "stem": it.get("stem", ""),
                   "options": letter_options(it.get("options", [])), "key": it.get("answer"), "key_text": ans,
                   "explanation": it.get("explanation", ""), "has_book_images": bool(it.get("has_book_images"))}
            if exact is not None:
                row["banner"] = exact
            qs.append(row)
        script = SCRIPT.replace("@@CORE@@", core())
        for k, v in {"@@EXPECT@@": repr(expect), "@@SETS@@": repr(sets), "@@OUTNAME@@": outname}.items():
            script = script.replace(k, v)
        text = WRITER
        for k, v in {"{N}": str(len(chunk)), "{N_SETS}": str(len(sets)), "{SET}": str(set_size), "{OUTNAME}": outname,
                     "{QUESTIONS}": json.dumps(qs, ensure_ascii=False, indent=1), "{SCRIPT}": script.strip()}.items():
            text = text.replace(k, v)
        cards.append((f"Chat {len(cards) + 1}: questions {first}-{last} ({len(chunk)} questions, {len(sets)} sets of images)", text,
                      script, outname))
    return cards


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prefix", help="per-chat mode: packages PREFIX-* from the queue (questions inside the prompts)")
    ap.add_argument("--master", action="store_true", help="the one fixed prompt; the owner attaches the export in ChatGPT")
    ap.add_argument("--out", required=True)
    ap.add_argument("--per-chat", type=int, default=CONFIG["gpt_writer_questions"])
    ap.add_argument("--set", type=int, default=CONFIG["gpt_set_size"])
    ap.add_argument("--qids", help="only these QIDs, comma separated (e.g. to redo a few)")
    ap.add_argument("--dump-scripts", help="folder: also save each chat's script (for testing)")
    a = ap.parse_args()
    ns = {}
    exec(PAGE_CODE, ns)
    if a.master:
        text, ms = master_text()
        Path(a.out).write_text(ns["copy_page"](
            "Kafu: ChatGPT master prompt",
            "Open a NEW ChatGPT chat, attach the app export (JSON), press Copy, paste, send. ChatGPT gives one painter_batchNN "
            "file per batch; write next for the next batch. Open each painter file in Chrome: each card goes into a NEW chat.",
            [("Master prompt (attach the export JSON to the same message)", text)]), encoding="utf-8")
        if a.dump_scripts:
            Path(a.dump_scripts).mkdir(parents=True, exist_ok=True)
            (Path(a.dump_scripts) / "master.py").write_text(ms)
        print(f"{a.out}: master prompt, {len(text)} chars")
        return
    if not a.prefix:
        sys.exit("--prefix or --master")
    cards = build(a.prefix, a.per_chat, a.set, set(a.qids.split(",")) if a.qids else None)
    page = ns["copy_page"](f"Kafu {a.prefix}: ChatGPT writer prompts",
                           "Step 1. Paste each card into a NEW ChatGPT chat. ChatGPT gives you a painter_...html file: open it in "
                           "Chrome and paste each of its cards into a NEW chat (step 2), which draws and saves the images.",
                           [(h, t) for h, t, _, _ in cards])
    Path(a.out).write_text(page, encoding="utf-8")
    if a.dump_scripts:
        d = Path(a.dump_scripts)
        d.mkdir(parents=True, exist_ok=True)
        for i, (_, _, s, o) in enumerate(cards, 1):
            (d / f"chat{i:02d}.py").write_text(s)
    n = sum(t.count('"qid":') for _, t, _, _ in cards)
    print(f"{a.out}: {len(cards)} writer chats, {n} questions, longest card {max(len(t) for _, t, _, _ in cards)} chars")


if __name__ == "__main__":
    main()
