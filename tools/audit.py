#!/usr/bin/env python3
"""Create audit.json by comparing package questions with their declared PDF pages.

This is a conservative source-consistency audit, not a medical-correctness review.

Usage:
    python audit.py SOURCE.pdf PACKAGE.zip
    python audit.py SOURCE.pdf questions.jsonl --output audit.json

Dependencies:
    PyMuPDF (import name: fitz)

Exit code 0 = audit created with no mismatches, 1 = mismatch/error.
"""

from __future__ import annotations
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

try:
    import fitz
except Exception:
    fitz = None


# Normalize only equivalent numeric/charge typography, not arbitrary Unicode
# compatibility characters or chemical values.
_SCRIPT_SYMBOLS = str.maketrans(
    "₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹₊₋⁺⁻",
    "01234567890123456789+-+-",
)


def norm(text: str) -> str:
    text = str(text or "").translate(_SCRIPT_SYMBOLS).lower()
    text = text.replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff").replace("ﬃ", "ffi").replace("ﬄ", "ffl")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w%+±≥≤µμ°./ -]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_questions(source: Path):
    if source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as zf:
            raw = zf.read("questions.jsonl")
    else:
        raw = source.read_bytes()
    rows = []
    for n, line in enumerate(raw.decode("utf-8").splitlines(), 1):
        if line.strip():
            try:
                rows.append(json.loads(line))
            except Exception as exc:
                raise ValueError(f"questions.jsonl line {n}: {exc}") from exc
    return raw, rows


def contains_fragment(page_norm: str, value: str) -> bool:
    value_norm = norm(value)
    if not value_norm:
        return True
    if len(value_norm) <= 20:
        return value_norm in page_norm
    # Exact normalized containment first; then robust phrase windows.
    if value_norm in page_norm:
        return True
    words = value_norm.split()
    for width in (14, 10, 7):
        if len(words) < width:
            continue
        for i in range(0, len(words) - width + 1, max(1, width // 2)):
            if " ".join(words[i:i+width]) in page_norm:
                return True
    return False


def declared_pages(q: dict, page_count: int) -> list[int]:
    """Validate every declared page; only absent source_pages uses legacy fallback."""
    page_no = q.get("source_page")
    if type(page_no) is not int or not 1 <= page_no <= page_count:
        raise ValueError("source_page is outside the PDF page range")
    pages = q.get("source_pages", [page_no])
    if not isinstance(pages, list) or not pages:
        raise ValueError("source_pages must be a nonempty list of PDF page numbers")
    if any(type(p) is not int or not 1 <= p <= page_count for p in pages):
        raise ValueError("source_pages contains a page outside the PDF page range")
    if page_no not in pages:
        raise ValueError("source_pages must include source_page")
    # PDF reading order, with duplicate declarations read only once. Never fill
    # gaps or search undeclared pages.
    return sorted(set(pages))


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("Usage: python audit.py SOURCE.pdf PACKAGE.zip [--output audit.json]")
        return 1
    if fitz is None:
        print("ERROR: PyMuPDF is required (pip install pymupdf)")
        return 1

    pdf_path = Path(argv[1])
    q_path = Path(argv[2])
    out = Path("audit.json")
    if "--output" in argv:
        i = argv.index("--output")
        if i + 1 >= len(argv):
            print("ERROR: --output requires a path")
            return 1
        out = Path(argv[i + 1])

    try:
        q_raw, questions = load_questions(q_path)
        pdf_raw = pdf_path.read_bytes()
        doc = fitz.open(pdf_path)
    except Exception as exc:
        print("ERROR:", exc)
        return 1

    results = []
    mismatch_count = 0

    for q in questions:
        lid = q.get("local_id")
        page_no = q.get("source_page")
        try:
            pages = declared_pages(q, len(doc))
        except ValueError as exc:
            results.append({
                "local_id": lid,
                "source_page": page_no,
                "source_pages": q.get("source_pages", [page_no]),
                "level": "mismatch",
                "score": 0.0,
                "stem_check": False,
                "options_check": False,
                "answer_evidence_check": None,
                "detail": str(exc),
            })
            mismatch_count += 1
            continue

        page_texts = [norm(doc[p - 1].get_text("text")) for p in pages]
        if not all(page_texts):
            results.append({
                "local_id": lid,
                "source_page": page_no,
                "source_pages": pages,
                "level": "unverifiable",
                "score": 0.0,
                "stem_check": None,
                "options_check": None,
                "answer_evidence_check": None,
                "detail": "A declared PDF page has no extractable text; visual/OCR review required",
            })
            continue

        page_norm = " ".join(page_texts)
        stem_ok = contains_fragment(page_norm, q.get("stem", ""))
        options = q.get("options") or []
        option_hits = [contains_fragment(page_norm, x) for x in options]
        option_ratio = (sum(option_hits) / len(option_hits)) if option_hits else 0.0
        options_ok = option_ratio >= 0.8

        score = (1.0 if stem_ok else 0.0) * 0.65 + option_ratio * 0.35
        if stem_ok and options_ok:
            level = "match"
            detail = "Stem and at least 80% of options found on declared PDF pages."
        elif stem_ok or option_ratio >= 0.5:
            level = "warning"
            detail = "Partial source match; manual review recommended."
        else:
            level = "mismatch"
            detail = "Stem/options do not sufficiently match declared PDF pages."
            mismatch_count += 1

        results.append({
            "local_id": lid,
            "source_page": page_no,
            "source_pages": pages,
            "level": level,
            "score": round(score, 3),
            "stem_check": stem_ok,
            "options_check": options_ok,
            "answer_evidence_check": None,
            "detail": detail,
        })

    payload = {
        "schema": 1,
        "audit_tool": "kafu-audit",
        "audit_tool_version": 2,
        "questions_sha256": sha256_bytes(q_raw),
        "pdf_sha256": sha256_bytes(pdf_raw),
        "scanned": all(r["level"] == "unverifiable" for r in results) if results else False,
        "mismatch_count": mismatch_count,
        "results": results,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    counts = {}
    for r in results:
        counts[r["level"]] = counts.get(r["level"], 0) + 1
    print("Audit:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    print(f"Wrote: {out}")
    if mismatch_count:
        print(f"RESULT: FAIL ({mismatch_count} mismatches)")
        return 1
    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
