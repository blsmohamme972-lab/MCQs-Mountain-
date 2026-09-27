#!/usr/bin/env python3
"""Generate deterministic, synthetic Kafu fixture packages.

Fixtures are original synthetic content created for testing only; they contain no
copyrighted book text and are never committed as ZIP binaries.

Usage:
    python tools/fixtures/generate_fixtures.py --out /tmp/kafu-fixtures
"""

from __future__ import annotations
import argparse, base64, hashlib, json, zipfile
from pathlib import Path

# Decodable synthetic images. The previous RIFF-only headers passed packaging checks
# but rendered as broken images in Telegram.
WEBP_QUESTION = base64.b64decode("UklGRuYCAABXRUJQVlA4INoCAABwGwCdASpAAXgAPm02lkekIyIhKtGIAIANiWdu4XPwyLcvyAwpnTTd55wADrp/qH4X2Kf9ZiwDicNQb/WvyK9sL+g8n3y56I//E4F39bgHogFlUZGoj1XkMg/9SkaiPVeQyD/1HErbzL9mX681+vNfrzX681+vNfHnPVkG1/JL9dNtuO5jY+1MjlNjl7Y+czb26nv+PsenD0p/IUzMzMywDE1Pln8hTMzMzMsAxND5cKDbQbX8kmXUaKW0muNwBaeq8hkH/qUjUR6ryGQf+oc4EH9NAo5sz4TM+EzPhMz4TM+D9gAA/tNxQ/cYuVMqtDEATrP3SfqfONaf/wH8S/sAjVoVY1015MHYXv/uvv/jWHxi45oIEnHcWdem/2chQuJSgCTjuLOvTfErEzP+NJ1+DD4Bxr3wWH802FKROJjya8GF4GhAMJJmSJBxKHeLmhW+/Z60+/x7VE8xNAZYSiNX9ENv7m+fGFJSn4Y4um9z4gXyPDLT8iohQgAACe38FVOseD/vFKr/nm7zqthjBqoi5P/oLNd+1wnDsOUmmv5W1qJylgBzp2+onGfBbIp6Yesv2Jwvyj0fx5H/0yeS+s1/pNmFtYUGcqnI4fJCyYuqFGOttfP8NP9I+ku+6pwl9EUr7uAsms//cZW58Wt3OH6CarjULTnNKxkEjsB4PZv2CLCv6JnfNfzC2ly4ZayvJ/6/rH/hEoiU+UbiVbPHfEmnSRlLVk2UEroHtaSsOASg45cHKzO5JkS4+T3XXmNBGoVieWX+oP/aGzZXJTe9X9tMkYoXGEIojLeuPi2sT5O2BwtvmhI9/7gfib1Hc3wyqoB4RhOsgIzcAE/+awDy3gAFdMOiAAo79xcC7UD9zcu2fbf7O/wTn/QIhnmLaS/LaI9AXGGbRHBffI3IWKzBPzfFS06JadEtOiWnRLTm7Jvdb3xhl7JJSNmL63jCsa2TtF9TgHAAAAAAAAAA")
WEBP_EXPLANATION = base64.b64decode("UklGRvgCAABXRUJQVlA4IOwCAACQGgCdASpAAXgAPm00lkekIyIhKzF4AIANiWdu4XKQ4DpKnnPJacBvPWAAdZ/8PrmP69XA11n8A4xnVAP6J/UvuA+Kb+88rnzd6KwDXAFmXQ3gqF4JnSCDwsGgRnSCDwsCkRJyp7xEW2m6MEwdo428x5W55l7X+VDGAbcnJ34jOj5I+iym2z+6q0ckgWLxNLdnTDANxJYN1lsobcnJ79HiHLkDUkHYqaoYwDbbeaEXv0e/yoYwDbbdHj5Cq4iyIoz2WDQIzpBB4WDQIzo/Ul5AuKfZVe/yoYwDbk77AAD+ecVH4KF5ZKIKybz3cn5f//wH8S/sBrSHu907ksaBHIUYZ9WjEKN1O8tdxAX9vaneWu4gL+XbLPR1/uV2uOPDfHesQuNyX2zYQo3IcMsIz3cESSeFZWDl6ABmVwC7URtCA58h+aFD5AAAA/zusoqzXaYMWB0kfq/3DkRPNAHiyz5+48XlQVj1qpUfcOpmOW9nNg6s3Q2IN36v7/8QbYjYx7oBhMWT7uvvAxQN9persrsAHM8Pkpe6BNUosCNwBe+o5hwc/V3g7PO/a9U4vFx7sKFZM2Yb630TawCSi+/0WsIWeBk7D+GEfS/jnKq/0mtVi4m+PMMX6ziD+DW4GvRCcxSAhnUOl3WOAi0jJl1eOi/WXCcq6jiPNSdws0ffzbpnaHVn1nn9makFDXjpQK+16hFlDANBbH7cknDjB3v9GOdgtDdOHkYbCXXkznkMy25yGp7cl7Tlnvk9jiZBfP1TsY/gADY1gf7vs6EVuilbnW2UxqmW4aJHP0Q94thgjTPycFt62CtX8tTL6BQqEOSbMppAGISCOqeo8pFIV9JQBGO+Mln5yplUAA4iLAwAHj5SU/wuvei8cXfHh4j+P/eXZEmxnkjh+IvK9WpcnsQ7suq0Fg+BrLPpmjY6nvCWdjf703LDaGp84KsC9R6WNyrc/WdetgsYiBKXGn5anq3utz3JtsKlO2EkvZa5jqAA")
WEBP_COVER = base64.b64decode("UklGRoACAABXRUJQVlA4IHQCAABwGACdASpAAXgAPm02lkekIyIhKpE4AIANiWdu4XPB/kaw782pqgFPV+AOtaundkBqM/7X6DP9V5Vvm/0QN8A/WYBkIN/AjdCZYZ0XUEjANKiYB/RdQSMA0m6rbzGg8PwOpGwkthJbCS2ElsHnOyiszMzMzMzMzLJXScnTUOVtB90TiF/uB3d3d3d3doRXNQg6qqqqqqqqkYjXp3d3d3d3d3djEomC/6t+i6gkYBpUTAP6LqCRgGlQ8rOp+sYu3ve973y8LyGdhT+lLAAA/uvxN/pJsOAise+XqKnor/FDzW9g1y0ocr/Q1tCRZPicImjUXE7Pf76n4CveqsBXvVWAr3qrAV71VgK96qwFe9VYCveqsAwc+Rn9q1XZcS6sOeMq/1Hp3hvx2bD0YWkrwDkQJ0Xovl86s50Vb9J/8Ikq1Jp/JWMpazeKglywBlB7fsZ+O1KWHQ4qSe53aEgAAIHjuYEePv9rYyqe91wc5g0j1hZ83rCtBQm6O13HRNW1unQ6RfGJwgvxwMOMw06W+frn0ApJwAI3hbRciJ0xriSRWgUOzpo1FP7uAGcdLa17B11adY+kebAOUIJ/wpZurQLazw1eRbK291fsvpD42ei72zGjSe9/hLPgw6W6/LU/LTW/PeIEjXCV8l/zwb21L/+NoM6uj6XWX1UH9BkmkgOmT1VwBXuZsgLgABXJMnTusAAQVvogAAz261sBqe4CsdkZmf+7X08guLm0WzhQhZyL+qZEFON7p9fpnkueriDc0BZOsiYVXobcKz/kl/MqqEvQSzlc6zG+drksUKcvopY6XjiUrQ12tyAx6qcVnqEd1tAAAAAA")

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
            z.writestr("cover.webp", WEBP_COVER)
        for item in questions:
            for name in item["images"] + item["explanation_images"]:
                z.writestr("images/" + name, WEBP_EXPLANATION if "_e1.webp" in name else WEBP_QUESTION)

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
