# MCQ BOOK PACKAGER — MASTER PROMPT (schema 1)

I attached: (1) a medical MCQ book (PDF), (2) `validate.py`, and (3) `audit.py`.
Your job: turn this book into ONE publish-ready ZIP package (or several parts), working entirely with code in your sandbox. Do the whole job yourself. Only stop to ask me if the book cannot be processed at all.

Optional settings (blank = you decide):
- SPECIALTY:
- FIELD: medicine
- COLLECTION_TYPE: textbook   (use past_exam for previous-years questions)
- BOOK_ID:

---

## 0. Golden rules (never break these)

1. **Copy, never write.** Every question, option and explanation must come from the PDF text through code (PyMuPDF / pdfplumber / pypdf — whichever is installed). Never retype from memory, summarise, paraphrase, translate or "improve" wording.
2. **Never correct the medicine.** If a book answer looks wrong, keep the book's answer and write your concern in `flag`.
3. **Never guess an answer.** Answers come only from the book's answer key or an answer marked in the text. If you cannot find a question's answer, leave that question out and list it in `skipped` with the reason.
4. **Never drop a question silently.** Every number in the book appears in `questions.jsonl` or in `skipped`.
5. **Do not edit `validate.py` or `audit.py`.** After extraction, run `python audit.py SOURCE.pdf PACKAGE.zip --output audit.json`, place `audit.json` in the ZIP, then run `python validate.py --require-audit <zip>`. The package is finished only when the validator prints `RESULT: PASS`.

## 1. Map the book first

Before extracting, open the PDF with code and write a short book map in your reply:
- text PDF or scanned (no text layer)?
- where questions are, and where answers/explanations are (after each question, end of chapter, or end of book)
- numbering scheme (continuous 1…N, or restarting each chapter)
- question formats present: SBA (single best answer), MTF (multiple true/false), multi-select ("choose two"), EMQ (extended matching)
- chapters, total question count stated by the book (if any), pages with figures

## 2. Extract with a parser, not by hand

Write a parser for THIS book's layout and run it over the whole PDF. Clean the text:
- remove running headers, footers, page numbers, publisher lines
- replace ligatures (ﬁ ﬂ ﬀ ﬃ ﬄ) with normal letters
- join words broken across lines ("hypo- thermia" → "hypothermia"), but keep real hyphens ("beta-blocker")
- keep symbols and units exactly; use Unicode (PaO₂, Na⁺, µg, ≥, ±), never LaTeX
- keep tables as simple Markdown tables; keep line breaks inside stems where the book has them
- strip option labels from option text ("A. Ketamine" → "Ketamine")

**Scanned PDF:** read pages visually in batches of about 20 pages, transcribe exactly, and append each batch to the JSONL file with code before moving on. If the book is too long for one session, finish a clean part, deliver it, and tell me the page where the next part starts.

## 3. Numbering and answers

- `local_id`: 1, 2, 3 … in book order across the whole book (never restart, never reuse).
- `source_number`: the number exactly as printed ("12", "3.12", "Q12").
- Match answers to questions by chapter + printed number, then check: every answer letter exists among that question's options; the number of answers equals the number of questions in each chapter.
- `answer_source`: `"book_key"` (answer key / explanation section) or `"inline_marked"` (answer shown next to the question).

## 4. Question formats

| type | options | answer |
|---|---|---|
| `sba` | 3–8 | one letter: `"C"` |
| `mtf` | 2–10 statements | list of T/F, one per statement: `["T","F","T","T","F"]` |
| `multi` | 3–12 | list of 2+ letters: `["A","D"]` |
| `emq` | 5–26 (the theme's shared list) | one letter; split each item of the theme into its own question with the same `group_id` (e.g. `"EMQ-7"`), the theme's instruction in `lead_in`, the item scenario in `stem` |

If any option depends on position ("All of the above", "None of the above", "Both A and C", "Only B") set `"no_shuffle": true`.

## 5. Images

- Extract figures that belong to questions (ECGs, X-rays, CT, photos, diagrams, graphs). Skip logos, icons, decorative chapter art.
- Crop to the figure only. Convert to WebP: max width 1200 px, quality 80, under 1.5 MB.
- Name by `local_id`: question images `L0041_1.webp`, `L0041_2.webp`; explanation images `L0041_e1.webp`. Put them in `images/`.
- Cover: the book's front cover (or page 1) as `cover.webp`, about 600 px wide, under 400 KB.

## 6. Files inside the ZIP (top level, nothing else)

```
book.json
questions.jsonl
cover.webp          (part 1 only)
images/             (only if the book has figures)
audit.json          (source-consistency audit; required)\nreport.md           (your short summary)
```

**book.json**
```json
{
  "schema": 1,
  "book_id": "ANES-REVIEW-1000-1E",
  "title": "Anesthesia Review: 1000 Questions and Answers",
  "subtitle": "",
  "authors": ["First Author", "Second Author"],
  "edition": "1st",
  "year": 2014,
  "publisher": "",
  "field": "medicine",
  "specialty": "Anesthesiology",
  "branch": "",
  "collection_type": "textbook",
  "language": "en",
  "version": 1,
  "expected_count": 1000,
  "part": {"index": 1, "total": 1},
  "id_range": [1, 1000],
  "chapters": [{"id": 1, "title": "Pharmacology"}, {"id": 2, "title": "Physiology"}],
  "skipped": [{"local_id": 417, "reason": "answer missing from the key"}],
  "license_note": ""
}
```
- `book_id`: UPPERCASE letters, digits and hyphens (short title + edition). Keep it identical in every part.
- `specialty`: exactly one name from `ALLOWED_SPECIALTIES` in `validate.py`.
- `expected_count`: total questions the book contains (or `null` if unknown).
- `id_range`: first and last `local_id` in THIS part. Every id in the range is in `questions.jsonl` or `skipped`.

**questions.jsonl** — one JSON object per line, in book order:
```json
{"local_id": 41, "chapter_id": 3, "topic": "Diuretics", "type": "sba", "source_number": "41", "lead_in": "", "stem": "…", "options": ["…", "…", "…", "…", "…"], "answer": "C", "answer_source": "book_key", "explanation": "…", "images": ["L0041_1.webp"], "explanation_images": [], "group_id": "", "no_shuffle": false, "source_page": 112, "flag": ""}
```
- `explanation`: `""` if the book has none. `topic`: `""` if unclear.
- `source_page`: the PDF page where the question starts.
- `flag`: `""`, or a short reason if anything is uncertain (unclear scan, doubtful answer, figure not found).

## 7. Size and parts

If the ZIP would exceed 19 MB, split by chapters into parts: `BOOK_ID_v1_part1of3.zip`, … Each part has its own `book.json` (same `book_id`, its own `part` and `id_range`) and only its own questions and images. `cover.webp` goes in part 1.

## 8. Self-check before delivering

1. Run `python validate.py <each zip>`. Fix every ERROR and re-run until `RESULT: PASS`. Review WARNINGS and fix the real ones.
2. Spot-check 15 random questions: print the source page text next to your extracted JSON and confirm stem, options and answer match exactly. Fix any mismatch and re-run step 1.
3. Confirm the counts: questions + skipped = `expected_count` (when known).

## 9. Deliver

Give me only:
- the ZIP file(s): `BOOK_ID_v1.zip` (or the parts)
- a 5-line summary: title, questions per type, skipped (with reasons), flagged count, images count, and the final `RESULT: PASS` line.