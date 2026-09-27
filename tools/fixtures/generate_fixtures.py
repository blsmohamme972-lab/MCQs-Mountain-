#!/usr/bin/env python3
"""Generate deterministic, synthetic Kafu fixture packages.

Fixtures are original synthetic content created for testing only; they contain no
copyrighted book text and are never committed as ZIP binaries.

Usage:
    python tools/fixtures/generate_fixtures.py --out /tmp/kafu-fixtures
"""

from __future__ import annotations
import argparse, hashlib, json, zipfile
from pathlib import Path

WEBP = (
    b"RIFF" + (30).to_bytes(4, "little") + b"WEBP" +
    b"VP8X" + b"\x0a\x00\x00\x00" + b"\x00\x00\x00\x00" +
    (599).to_bytes(3, "little") + (399).to_bytes(3, "little")
)

def q(local_id, qtype, stem, options, answer, *, image=False, explanation_image=False, group_id=None):
    return {
        "local_id": local_id,
        "chapter_id": 1,
        "topic": "Fixture testing",
        "type": qtype,
        "source_number": str(local_id),
        "lead_in": "Fixture lead-in" if qtype == "emq" else "",
        "stem": stem,
        "options": options,
        "answer": answer,
        "answer_source": "book_key",
        "explanation": f"Synthetic explanation for fixture question {local_id}.",
        "images": [f"L{local_id:04d}_1.webp"] if image else [],
        "explanation_images": [f"L{local_id:04d}_e1.webp"] if explanation_image else [],
        "group_id": group_id,
        "no_shuffle": qtype == "emq",
        "source_page": local_id,
        "flag": "",
    }

def audit(raw, questions):
    return {
        "schema": 1,
        "questions_sha256": hashlib.sha256(raw).hexdigest(),
        "pdf_sha256": "f" * 64,
        "scanned": False,
        "mismatch_count": 0,
        "results": [
            {"local_id": x["local_id"], "source_page": x["source_page"], "level": "match",
             "score": 1.0, "detail": "Synthetic fixture source match"}
            for x in questions
        ],
    }

def write_pkg(path, *, book_id, title, version, questions, expected_count, part_index=1, part_total=1, id_range=None, cover=True, broken=False):
    id_range = id_range or [questions[0]["local_id"], questions[-1]["local_id"]]
    if broken:
        broken_questions = [dict(questions[0])]
        broken_questions[0]["answer"] = "Z"
        raw = (json.dumps(broken_questions[0], ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    else:
        raw = "".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) + "\n" for x in questions).encode()
    book = {
        "schema": 1,
        "book_id": book_id,
        "title": title,
        "subtitle": "Synthetic Kafu fixture",
        "authors": ["Kafu Test Suite"],
        "edition": "1st",
        "year": 2026,
        "publisher": "Kafu",
        "field": "medicine",
        "specialty": "Cardiology",
        "branch": "",
        "collection_type": "textbook",
        "language": "en",
        "version": version,
        "expected_count": expected_count,
        "part": {"index": part_index, "total": part_total},
        "id_range": id_range,
        "chapters": [{"id": 1, "title": "Fixture Chapter"}],
        "skipped": [],
        "license_note": "Synthetic fixture created by Kafu; safe for automated testing.",
    }
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("book.json", json.dumps(book, ensure_ascii=False))
        z.writestr("questions.jsonl", raw)
        if not broken:
            z.writestr("audit.json", json.dumps(audit(raw, questions)))
            z.writestr("report.md", "# Kafu synthetic fixture\nNo external source text.\n")
        # Broken fixture intentionally omits report.md + audit.json and has answer Z.
        if cover and not broken:
            z.writestr("cover.webp", WEBP)
        for item in questions:
            for name in item["images"] + item["explanation_images"]:
                z.writestr("images/" + name, WEBP)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    a=ap.parse_args()
    out=Path(a.out); out.mkdir(parents=True, exist_ok=True)

    v1=[
        q(1, "sba", "Which synthetic option is designated correct in this fixture?",
          ["Synthetic alpha", "Synthetic beta", "Synthetic gamma"], "A", image=True),
        q(2, "mtf", "Mark each synthetic statement as true or false for this fixture.",
          ["Synthetic statement one", "Synthetic statement two", "Synthetic statement three"], ["T","F","T"]),
        q(3, "multi", "Select the two synthetic options designated correct in this fixture.",
          ["Synthetic red", "Synthetic blue", "Synthetic green", "Synthetic amber"], ["A","C"]),
        q(4, "emq", "Choose the best synthetic match for this extended matching item.",
          ["Synthetic A", "Synthetic B", "Synthetic C", "Synthetic D", "Synthetic E"], "D",
          explanation_image=True, group_id="EMQ-FIX-1"),
    ]
    write_pkg(out/"KAFU-FIXTURE-ALLTYPES_v1.zip", book_id="KAFU-FIXTURE-ALLTYPES",
              title="Kafu Fixture: All Question Types", version=1, questions=v1, expected_count=4)

    v2=[dict(x) for x in v1]
    v2[0]=dict(v2[0]); v2[0]["stem"]="Which synthetic option is designated correct in this revised v2 fixture?"
    write_pkg(out/"KAFU-FIXTURE-ALLTYPES_v2.zip", book_id="KAFU-FIXTURE-ALLTYPES",
              title="Kafu Fixture: All Question Types", version=2, questions=v2, expected_count=4)

    multi=[
        q(1,"sba","Multipart fixture question one has which designated answer?",
          ["Choice one","Choice two","Choice three"],"B"),
        q(2,"sba","Multipart fixture question two has which designated answer?",
          ["Choice one","Choice two","Choice three"],"C"),
        q(3,"sba","Multipart fixture question three has which designated answer?",
          ["Choice one","Choice two","Choice three"],"A"),
        q(4,"sba","Multipart fixture question four has which designated answer?",
          ["Choice one","Choice two","Choice three"],"B"),
    ]
    write_pkg(out/"KAFU-FIXTURE-MULTIPART_v1_part1of2.zip", book_id="KAFU-FIXTURE-MULTIPART",
              title="Kafu Fixture: Multipart", version=1, questions=multi[:2], expected_count=4,
              part_index=1, part_total=2, id_range=[1,2], cover=True)
    write_pkg(out/"KAFU-FIXTURE-MULTIPART_v1_part2of2.zip", book_id="KAFU-FIXTURE-MULTIPART",
              title="Kafu Fixture: Multipart", version=1, questions=multi[2:], expected_count=4,
              part_index=2, part_total=2, id_range=[3,4], cover=False)

    write_pkg(out/"KAFU-FIXTURE-BROKEN_v1.zip", book_id="KAFU-FIXTURE-BROKEN",
              title="Kafu Fixture: Broken", version=1, questions=[v1[0]], expected_count=1,
              broken=True, cover=False)
    print(out)

if __name__ == "__main__":
    main()
