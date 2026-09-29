# ABSITE-DE-VIRGILIO v2 — final report

## Source
- **Source label on every published question:** `Review of Surgery for ABSITE and Boards || Second Edition`
- PDF copyright page: Elsevier, 2018.
- Branch mapping remains **Surgery** / **General Surgery**.

## Counts and validation
- Source total: **956 questions**.
- Published in `questions.jsonl`: **955**.
- Preserved skipped validator-blocked H. pylori question: **1 (L0203, source Q23, PDF p107)**.
- v1 baseline audit mismatches: **0**.
- v2 audit: **858 match, 97 warning, 0 mismatch, 0 unverifiable**.
- `validate.py --require-audit`: **RESULT: PASS**, **0 errors**, 46 warnings.

## Risk-based visual verification
- Risk union visually checked: **320 questions**.
- Unique rendered source question pages visually inspected: **172 pages** across **43 contact sheets**.
- Risk union includes all **97 audit-warning questions**, all published flagged questions, the preserved flagged H. pylori item, and every detected question containing doses/units/lab-value/symbol risk patterns.
- Audit-warning composition retained from v1 review evidence: **92 cross-page, 4 superscript/subscript, 1 raster image-table**.
- Full-book dual-engine source check retained as baseline: **956 question records + 956 answer/explanation records, 0 mismatches**.
- **Transcription fixes found by the risk visual pass: 0.**

## Spelling review
A conservative automated spelling pass used the available CMU general-English lexicon plus a book-domain medical terminology whitelist. External medical-dictionary installation was unavailable in the execution environment, so medical/domain candidates were deliberately left unchanged unless unambiguously ordinary English.

- Candidate spellings reviewed by the automated pass: **242**.
- Ordinary non-medical spelling fixes applied: **1**.
- **L0272 / source Q20 / PDF p146 / option D:** `preperation` → `preparation`.
- No medical spelling candidate was silently corrected.

## Short explanations
- Short excerpts generated for all **955 published questions**.
- Each excerpt uses complete sentences copied from the book explanation, in original order.
- Word lengths after refinement: **min 45, max 80, average 60.32 words**.
- Excerpts flagged as unclear on their own after context checks: **0**.
- Manual refinement was needed for 10 excerpts to remove context-dependent openings / improve self-containedness while retaining exact source sentences: L0069, L0317, L0382, L0396, L0427, L0479, L0631, L0636, L0836, L0871.
- The skipped H. pylori question remains preserved unchanged, including its original full explanation.

## Source-sensitive flags retained
- **L0001 / PDF p14** — PDF p16: printed key B is retained; explanation says 1 month but cites option (C), whereas 1 month is option B.
- **L0538 / PDF p274** — PDF p274: options occur in an image table. Rows visually transcribed and original table retained; text-only audit cannot verify the table.
- **L0687 / PDF p349** — PDF p352: the printed reference URL stops at ImplantsandProsth. Kept exactly; the missing continuation is not reconstructed.
- **L0954 / PDF p488** — PDF p489: option E contains the literal source marker [?]. Retained exactly; book key C is unchanged.
- **L0203 / PDF p107 (skipped)** — Validator compatibility blocker: LABEL_PREFIX_RE rejects the genuine option H. pylori serology. No text or answer was changed. Full question retained in this skipped record.

## Package integrity
- H. pylori skipped-question object is byte-for-semantic-content identical to v1.
- Stems/options/answers are unchanged from v1 except for the single approved ordinary spelling correction at L0272.
- Figures, provenance, chapter structure, and Surgery mapping are unchanged.
- Every published question has the required source label.
