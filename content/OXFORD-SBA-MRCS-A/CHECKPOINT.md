# OXFORD-SBA-MRCS-A - extraction stopped

Status: STOPPED_TOOL_FAILURE. This is a checkpoint, not a completed book pack.

## Scope

- Book: SBA MCQs for the MRCS Part A (Oxford University Press, 2013).
- Edition number: not stated on the inspected title/copyright pages; not inferred.
- Book ID: OXFORD-SBA-MRCS-A; version: 1.
- Intended specialty/branch: General Surgery / Surgery.
- Work branch: content/OXFORD-SBA-MRCS-A.
- No publishing, merging, deploying, or changes to main, application code, tools, audit.py, or validate.py.

## Source fingerprint

- Original filename: OXFORD.pdf
- PDF pages: 256
- Size: 2736487 bytes
- SHA-256: 00da079467ce8d8aecdb5dc65cab6b0d0b884bff17c9b6a00b03c69604de0ad6
- Original PDF left unchanged.

## Exact stop

Stage 1: extraction, at json.dumps(pages, ensure_ascii=False), before writing evidence/pymupdf-pages.json.

The task-local extraction wrapper raised:

```text
TypeError: Object of type bytes is not JSON serializable
```

The structured page payload included embedded-image bytes returned by PyMuPDF page.get_text("dict"). The structured PyMuPDF extraction was therefore not saved. This is an extraction-wrapper serialization error, not a Kafu validator bug. No retry or repair was attempted after failure.

The command also emitted PDF parser diagnostics, including:

```text
MuPDF error: syntax error: invalid key in dict
Syntax Error (2060938): Dictionary key must be a name object
Syntax Error (2061133): Dictionary key must be a name object
Syntax Error (2227251): Bad block header in flate stream
```

These are representative messages, not a complete stderr log. The numbers are byte offsets, not PDF page numbers. Affected pages have not been mapped. Both Poppler commands produced text and returned successfully, but the parser errors mean completeness and reliability have not been established.

## Saved processing evidence

The following files are preserved in the conversation checkpoint archive, not committed as accepted book content:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| evidence/poppler-layout.txt | 685465 | 3ca105f66fa8aff2a47330ce1e3b88de9aeac3067e2e516ae72ccfbc3378df7d |
| evidence/poppler-raw.txt | 612354 | 40dd818db17f0cac6a5e63cc660cc6673776984ae72f59bbe08b8a0504c70da9 |
| evidence/source.json | 2471 | 2174a4fa656f1c653c773057ccb7b6bb6a2e557f8183b816399bfffa1549016f |

Checkpoint archive: OXFORD-SBA-MRCS-A_CHECKPOINT_NOT_UPLOADABLE.zip.
Archive size at checkpoint creation: 447864 bytes.
Archive SHA-256: 143ca58f468b1f3519fa20758d9e72353dd5e728886b0c921341488bebc9aea4.
It also contains CHECKPOINT.md and STOP_REPORT.json.

## Completion accounting

- Source title, copyright and contents inspected.
- Repository schema, validator, audit source and synthetic fixture package structure inspected read-only.
- Isolated remote branch created.
- Source fingerprint and two Poppler text outputs saved.
- Verified MCQ records built: 0.
- Questions visually checked: 0.
- Spelling fixes: 0.
- Per-chapter reconciliation, dual-engine comparison, answer matching, flags, figures, short explanations and their length measurements: not completed.
- No questions deliberately skipped; no skip decision made.
- audit.py: not run.
- validate.py --require-audit: not run. No PASS claim.
- Final bot-uploadable OXFORD-SBA-MRCS-A_v1.zip: not created.

## Resume point

Diagnose the PDF parsing errors and correct serialization in the task-local extraction wrapper, then restart extraction. Preserve the original source and leave repository tools and validator unchanged. Continue with chapter-by-chapter parsing, exact answer matching, independent engine comparison, risk-only visual review, figures, verbatim short explanations, audit and final validation only after extraction succeeds.
