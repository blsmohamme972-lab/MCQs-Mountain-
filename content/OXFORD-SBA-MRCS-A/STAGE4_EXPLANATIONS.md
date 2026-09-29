# Oxford stage 4 - source explanations and completed risk review

All 350 printed answer explanations and keys independently agree between positioned Poppler and PyMuPDF. Initial explanation disagreements: 58 (2 header cases, 48 bullet glyphs, 8 visual/reading-order cases), all resolved against source images. No unresolved true extraction mismatch.

All 350 short explanations were selected from complete source sentence/list units and reviewed against their printed answer. No medical explanation generated. 262 contiguous selections; 88 selections of whole source units in source order, without within-sentence splicing. Exact text offsets, source pages and hashes are preserved in explanation-proof.json in the separate evidence archive.

Word counts: min 19, max 150, average 64.11428571428571. 254 are within approximate 50-70 words; 96 outside to retain intact source units. 39 retain source list structure. The requested 2-4 complete prose sentences is NOT claimed for every list-based explanation. Explicit list/format exceptions include local IDs 124,229,238,341. Local324 has the entire 19-word source explanation plus Table7.1. Local330 retains the source classification, 150 words. Source context/rationale limitations are documented rather than filled from general medical knowledge.

Source spelling changes: ZERO. Typesetting changes comprise visual/coordinate-verified ligature whitespace, numeric positioning, source bullet interpretation, paragraph whitespace and separately logged discretionary line-end hyphen joins. Genuine/ambiguous compounds retain their hyphens.

Manual source-image review: 228 unique PDF pages, all 350 question stems and options, all seven final visual crops. All pages associated with the 58 initial explanation disagreement records are included in the manual ledger. Diagnostic rendering of 256 pages is separate and not counted as manual review.

Source-issue ledger: 57 entries affecting 55 questions; original text and printed keys retained. Important internal source tensions include local28 (least likely/vomiting), local100 (rare exposure vs rare disease), local165 (keyed teres major vs explanation teres minor), local292 (keyed60% vs source DukesB80%), local328 (six options and possible multiple-answer wording), and local330 (N1=1-3, N2>4). None is medically corrected.

## Committed regeneration inputs

prepare_explanations.py, select_explanations.py, assemble_explanations.py and all350 reviewed selections in explanation-selection-indices.json are task-local. Selection index list positions map to local IDs1-350; values index source sentence/list units. Rebuild with PyMuPDF1.26.7, NLTK3.9.2 and Poppler after the extraction/parsing stages:

```
pdftotext -bbox-layout /path/to/OXFORD.pdf evidence/poppler-bbox.html
python prepare_explanations.py
python select_explanations.py
python assemble_explanations.py
```

All committed extraction entrypoints enforce the original PDF fingerprint. Missing transient evidence can be regenerated from the original, never replaced by another PDF.

Evidence fingerprints (large evidence itself is delivered separately, not falsely represented as committed here):
- explanation-proof.json: 590b1010d7d3ccde93b8eeb60a74518b1852952add7b6668a5bcc284bc916e23
- explanation-stats.json: 99a4a70911e876e87619ebab7e1bfd0410c1d339c3052862d242924c011dbb61
- source-issues.json: f302d7e1b2ddc0609c7ca61f32d911b0a7d08adff704e967e46fb5516bb3ef13
- manual-review.json: ef0dd97383f8485bb5a95050926e391644c69fc543fe4001771a5fd72aa2fc14
- explanation-selection-indices.json: 93369489d2c3abb8478bc29a0640dfce80b5140c55382e455ec648e164e4e05c

Only content/OXFORD-SBA-MRCS-A updated. No application/shared-validator changes, merge, deployment or publication. Final package and actual validator result are recorded in stage5.
