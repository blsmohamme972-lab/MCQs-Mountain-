# Extraction stage — RUSH-REVIEW-SURGERY-6E-2018

- Source: Rush University Medical Center Review of Surgery || Sixth Edition (2018)
- Extracted questions: 1572
- Skipped source items: 7
- Total numbered source items: 1579
- Flattened section/chapter/subchapter units: 63
- Main, merge, and deploy: untouched

The 7 skipped items are source matching/matrix questions that cannot be represented faithfully by the current Kafu SBA/MTF/multi/EMQ schema without changing the source question: Surgical Infection Q6, Q8, Q30, Q33; Hernia Q1, Q13; Colon and Rectum Q35.

Deterministic source-layout exceptions handled during extraction:
- Pancreas Q37: answer choices are a printed table and were transcribed from the PDF table exactly.
- Evidence-Based Surgery and Applications of Biostatistics Q2: answer choices are a printed table and were transcribed from the PDF table exactly.
- Pancreas Q50: the printed question label lacks the PDF label control glyph; its page/number is explicitly recognized.
- Trauma Q10–Q12: the book provides one grouped answer line (ANSWERS: C, E, B); these are emitted as three SBA questions in source order.

No medical wording or answer key was corrected.
