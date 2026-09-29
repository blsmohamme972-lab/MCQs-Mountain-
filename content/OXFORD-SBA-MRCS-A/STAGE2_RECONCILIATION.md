# Oxford stage 2 - questions, reconciliation and initial audit

All source chapters independently reconciled from both question and answer sections: Chapter 1 50/50, Chapter 2 50/50, Chapter 3 50/50, Chapter 4 50/50, Chapter 5 50/50, Chapter 6 50/50, Chapter 7 50/50. Total 350 source questions, 350 extracted and 350 printed keys. Numbering restarts 1-50 in each chapter; local IDs run 1-350. No gaps, duplicated numbers, exact duplicated stem/option records, or skipped questions.

PDF question/answer ranges respectively: 20-35/36-49; 50-66/67-79; 80-96/97-111; 112-128/129-143; 144-159/160-175; 176-193/194-209; 210-228/229-245. Repeated curriculum headings are stored as topics; the seven actual chapter names are retained.

Two initial question-level disagreements (local IDs 47 and 144) were running-header leakage. Visual checks of PDF 34-35 and 94-95 resolved these without changing printed text. Current two-engine question/key comparison: 350 equal, zero unresolved disagreements. All 350 question stems/options were visually inspected on all 120 question pages because numeric, symbol, typography and source-warning risks were pervasive. Including cover/front matter and PDF36, 127 unique PDF pages have been manually inspected at this checkpoint. Diagnostic renders are not counted.

Important independent visual finding: Chapter 7 question 28 (local 328, PDF219) has SIX options A-F. Both initial parsers had merged F into E. The task-local parsers were fixed to preserve six distinct options, including source option F 'Ulna nerve', with the printed answer C unchanged. This was an additional visual boundary resolution, not a disagreement between the two initial parsers. Final distribution is 349 five-option questions and one six-option question. Chapter 6 question 32 (local282, PDF186) prints labels A,B,C,D,D; all five texts and printed key C are preserved, with the duplicate label stored in source_option_labels and flagged. All questions have no_shuffle=true to preserve source order.

No source spelling or medical corrections. Source anomalies are retained in the local issues ledger (24 entries at this stage), including original units, carpel spelling, cmH2 followed by zero, and duplicated label. Final flags will incorporate that ledger.

Existing, unchanged audit command actually run:
`python /mnt/data/oxford_work/readonly_tools/audit.py /mnt/data/oxford_source/OXFORD.pdf work/questions-initial.jsonl --output evidence/audit-stage2.json`
Result: PASS; 332 match, 18 warning, zero mismatch. All warning question pages were visually reviewed. Most warnings arise from the PDF text layer inserting spaces inside ligatures or from positioned numeric typography. Do not corrupt printed wording to suppress those warnings. Warning IDs: 8,13,21,88,110,112,126,144,152,166,167,192,200,202,221,279,328,343.

Full explanation comparison is not yet final: first pass had 58 differing explanation records; two header cases are resolved and 56 remain for the figures/explanation stages (48 bullet-glyph encoding cases and 8 figure/table reading-order cases). No final validator PASS or uploadable ZIP is claimed here.

## Reproducibility and evidence locations

Committed task-local parse_oxford.py and compare_engines.py reproduce the question parsing and comparison from verified source/extraction evidence. Full data and image review evidence remain in the task workspace and will be delivered separately from the clean bot ZIP. They are not claimed as committed content by this checkpoint.

- parse_oxford.py SHA256 b39e8f4d2901496f0d896ece2d9ee1a41fa4a5299e3e068a303e6dc6da346c72
- compare_engines.py SHA256 593a972cda50057a33d0051a3465eb2634ca1786db1bc18a3812c5ccb6f0f5f1
- work/questions-initial.jsonl: 379636 bytes, SHA256 c26e5e22f43facdc4bbc6e41d966677f54b9b9bf6daea4a57896abef7381a711
- evidence/manual-review.json SHA256 8ef47969649d821618b0b448b73942e06fdcb8aad632c964dba8481b1be6ca75
- evidence/source-issues.json SHA256 5f82c5571ee85a4940369acc458dd94636f5651d1c8cbb9beaff3dec15a24f5e
- evidence/chapter-reconciliation.json SHA256 1530593295a9b748fc6b4166887d4e70528b2ace3b9759322c5f9c7e96278927

Only content/OXFORD-SBA-MRCS-A is updated. No main write, merge, deployment, publication or shared-tool modification.
