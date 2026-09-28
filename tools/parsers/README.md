# Kafu PDF parser library

Each parser in this directory is deterministic code for one known PDF layout family. Keep the parser with the project so the same book can be rebuilt without an AI chat.

## Contract

A parser module must export:

```python
def parse_pdf(pdf_path: Path) -> dict:
    ...
```

and return:

```python
{
  "questions": [ ... schema-1 question objects ... ],
  "chapters": [{"id": 1, "title": "Chapter title"}],
  "skipped": [{"local_id": 17, "reason": "answer missing"}],
  "notes": ["optional report note"]
}
```

Rules:
- Never invent or medically correct source content.
- Preserve PDF wording, `source_number`, `source_page`, and answer source.
- Assign stable sequential `local_id` values in book order.
- Put unextractable numbered items in `skipped`; never silently drop them.
- Parser-specific assumptions belong in that parser's module docstring and tests.
- If the book layout changes, add a new parser instead of making an old parser guess.

## Included parser

`simple_numbered_mcq.py` handles machine-readable pages where each question begins with a numbered line, options are one-per-line as `A. ...`, and the answer appears inline as `Answer: C`. It intentionally refuses ambiguous blocks.

For a real book, copy the closest parser, rename it for that layout, add focused tests, then run `tools/package_batch.py`.
