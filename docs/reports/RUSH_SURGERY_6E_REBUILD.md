# Rush Review of Surgery sixth edition

The owner-provided PDF has 595 pages, selectable text, two columns, inline ANSWER(S)/COMMENTS and numbering restarted in chapter subsections. The parser inventories 1,579 source blocks across 35 chapters; seven matching blocks become 35 individual items. It emits 1,607 questions: 1,572 SBA, 33 EMQ, two multi-select. No skipped questions or parser flags. All keys come from source answers.

`tools/parsers/rush_surgery_6e.py` exports `parse_pdf(Path)`. Source-confirmed word joins preserve signs, units and real hyphens. Matching instructions are in lead_in. Very short source items also keep copied instructions in their stem because the unchanged gate requires at least ten characters. Figure citations match numbered source captions; table/figure crops have verified boundaries.

`package_batch.py` now accepts optional parser image payloads and writes optional provenance maps outside the upload ZIP. The original validators/audit remain unchanged. The Rush wrapper adds warning locations and exact, converged archive metrics, and fixes ZIP timestamps so two builds can be compared byte for byte.

Rebuild from repository root:

```bash
python -m pip install 'PyMuPDF>=1.24,<2' 'Pillow>=11,<13'
PYTHONPATH=. python tools/package_batch.py SOURCE.pdf --parser rush_surgery_6e --metadata tools/metadata/rush_surgery_6e.json --out-dir dist
# For the delivered report and identical deterministic ZIP:
PYTHONPATH=. python -m tools.package_rush_surgery_6e SOURCE.pdf --metadata tools/metadata/rush_surgery_6e.json --out-dir dist
PYTHONPATH=. python tools/tests/test_rush_surgery_6e.py dist/RUSH-SURGERY-6E_v1.zip
```

See `RUSH_SURGERY_6E.md` for the final warning and size report. The PDF and book payload are delivered separately, never committed to normal Git. This change prepares content; it does not publish the book.
