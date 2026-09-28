# Kafu content team guide

This is the safe path for preparing a real book ZIP. Helpers prepare packages; only the owner publishes them through the private Kafu bot.

## What you need

- The source PDF.
- A parser in `tools/parsers/` that matches that book layout.
- A small metadata JSON file.
- Python with PyMuPDF and Pillow.
- The repository tools. Do not edit `validate.py`, `audit.py`, or the parser merely to force a bad package through.

## 1. Choose or add a parser

Read `tools/parsers/README.md`. Use an existing parser only when its documented layout assumptions exactly match the PDF.

If the layout is new, add a new parser module. It must:
- copy source wording instead of rewriting it;
- preserve printed question number and PDF page;
- never guess an answer;
- put every unextractable numbered item into `skipped`;
- return deterministic results when run twice on the same PDF.

Commit the parser and a focused test before using it for production.

## 2. Make metadata.json

Example:

```json
{
  "book_id": "CARDIO-REVIEW-1E",
  "title": "Cardiology Review",
  "authors": ["Author Name"],
  "edition": "1st",
  "year": 2024,
  "publisher": "Publisher",
  "field": "medicine",
  "specialty": "Cardiology",
  "collection_type": "textbook",
  "language": "en",
  "version": 1,
  "license_note": "Prepared from owner-provided source PDF."
}
```

Use a new `book_id` for a substantially renumbered new edition.

## 3. Build, audit and validate

From the repository root:

```bash
python -m pip install 'Pillow>=11,<13' 'PyMuPDF>=1.24,<2'
python tools/package_batch.py SOURCE.pdf \
  --parser YOUR_PARSER_NAME \
  --metadata metadata.json \
  --out-dir dist/packages
```

The command:
1. runs the known parser;
2. creates `book.json`, `questions.jsonl`, `cover.webp`, and `report.md`;
3. runs the source consistency audit against the PDF;
4. creates `audit.json`;
5. builds the ZIP;
6. runs both package validators.

Do not send the ZIP to the owner unless the command ends with both validator results passing.

If the package is over Telegram's 19 MB safe limit, stop and split the layout deterministically by chapter/part. Do not manually delete images or questions just to shrink it.

## 4. Review before handoff

Check:
- question count plus skipped count equals the source count when known;
- warnings in `audit.json` are understood;
- 15 spot checks match the PDF exactly;
- answers come from the book, not a helper's medical knowledge;
- figures belong to the correct question;
- the filename follows `BOOK-ID_vN.zip`.

## 5. Handoff to the owner

Give the owner:
- the validated ZIP;
- the parser file used;
- the metadata JSON;
- the parser name and exact batch command;
- a short note listing skipped/flagged items.

Do not upload directly to production unless you are the owner.

## Audit warnings

Warnings are not silently approved. The owner reviews `/flags`.

For a book with many already-reviewed pending warnings:
1. send `/flags approve-all BOOK-ID`;
2. Kafu shows the number that would be approved and the exact confirmation command;
3. only after checking the count, send `/flags approve-all BOOK-ID CONFIRM`.

The confirmation approves the currently pending warnings for that book and queues one moderation publish. It does not bypass structural validation or source mismatches.
