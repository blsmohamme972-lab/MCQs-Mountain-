"""Parser for a strict machine-readable numbered SBA layout.

Expected layout, with one or more questions per page:

1. Question stem text
A. First option
B. Second option
C. Third option
Answer: B
Explanation: Optional explanation text

Assumptions:
- questions are SBA only;
- option lines start with A-Z followed by "." or ")";
- the answer is inline in the same question block;
- chapter headings may be written as "Chapter: TITLE";
- blocks that lack a usable answer are returned in skipped, never guessed.
"""
from __future__ import annotations

import re
from pathlib import Path

try:
    import fitz
except Exception:
    fitz = None

QUESTION = re.compile(r"^\s*(\d+)\s*[.)]\s+(.+?)\s*$")
OPTION = re.compile(r"^\s*([A-Z])\s*[.)]\s+(.+?)\s*$")
ANSWER = re.compile(r"^\s*Answer\s*:\s*([A-Z])\b", re.I)
EXPLANATION = re.compile(r"^\s*Explanation\s*:\s*(.*)$", re.I)
CHAPTER = re.compile(r"^\s*Chapter\s*:\s*(.+?)\s*$", re.I)

def _clean(text: str) -> str:
    return (
        str(text or "")
        .replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff")
        .replace("ﬃ", "ffi").replace("ﬄ", "ffl")
        .strip()
    )

def _page_lines(page) -> list[str]:
    return [_clean(x) for x in page.get_text("text").splitlines() if _clean(x)]

def parse_pdf(pdf_path: Path) -> dict:
    if fitz is None:
        raise RuntimeError("PyMuPDF is required: pip install pymupdf")
    doc = fitz.open(pdf_path)
    questions, skipped, chapters = [], [], [{"id": 1, "title": "Questions"}]
    chapter_id = 1
    current_chapter = chapters[0]["title"]
    local_id = 0

    for page_index in range(len(doc)):
        lines = _page_lines(doc[page_index])
        i = 0
        while i < len(lines):
            ch = CHAPTER.match(lines[i])
            if ch:
                title = _clean(ch.group(1))
                if title and title != current_chapter:
                    chapter_id += 1
                    current_chapter = title
                    chapters.append({"id": chapter_id, "title": title})
                i += 1
                continue

            start = QUESTION.match(lines[i])
            if not start:
                i += 1
                continue

            source_number, first_stem = start.group(1), _clean(start.group(2))
            block = [first_stem]
            i += 1
            while i < len(lines) and not QUESTION.match(lines[i]) and not CHAPTER.match(lines[i]):
                block.append(lines[i])
                i += 1

            options, stem_lines, explanation_lines = [], [], []
            answer = None
            in_explanation = False
            for line in block:
                ans = ANSWER.match(line)
                if ans:
                    answer = ans.group(1).upper()
                    in_explanation = False
                    continue
                exp = EXPLANATION.match(line)
                if exp:
                    in_explanation = True
                    if exp.group(1).strip():
                        explanation_lines.append(_clean(exp.group(1)))
                    continue
                opt = OPTION.match(line)
                if opt and not in_explanation:
                    options.append((opt.group(1).upper(), _clean(opt.group(2))))
                    continue
                if in_explanation:
                    explanation_lines.append(line)
                elif not options:
                    stem_lines.append(line)

            local_id += 1
            labels = [x[0] for x in options]
            if not answer or answer not in labels or len(options) < 3:
                skipped.append({
                    "local_id": local_id,
                    "reason": f"Question {source_number}: parser could not prove a valid inline answer/options",
                })
                continue

            questions.append({
                "local_id": local_id,
                "chapter_id": chapter_id,
                "topic": "",
                "type": "sba",
                "source_number": source_number,
                "lead_in": "",
                "stem": " ".join(stem_lines).strip(),
                "options": [x[1] for x in options],
                "answer": answer,
                "answer_source": "inline_marked",
                "explanation": " ".join(explanation_lines).strip(),
                "images": [],
                "explanation_images": [],
                "group_id": "",
                "no_shuffle": False,
                "source_page": page_index + 1,
                "flag": "",
            })

    if not questions and not skipped:
        raise ValueError("Parser found no numbered questions")
    return {
        "questions": questions,
        "chapters": chapters,
        "skipped": skipped,
        "notes": [f"Parser simple_numbered_mcq extracted {len(questions)} questions and skipped {len(skipped)}."],
    }
