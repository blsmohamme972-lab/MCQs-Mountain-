# APPLETON-LANGE-ANATOMY-6E v1 conversion report

Source: Appleton & Lange Review of Anatomy, Sixth Edition; Royce Lee Montgomery and Kurt Ogden Gilliland; McGraw-Hill, 2003. PDF: 157 pages. SHA-256: `77cbba818e814703159b28e80fcd0d24f72076bcca7e659450a70a87613e6e9e`.

Delivery: one ZIP, `APPLETON-LANGE-ANATOMY-6E_v1.zip`. MCQs only. Each question carries `Appleton & Lange Review of Anatomy || Sixth Edition`. Specialty General Surgery; branch Surgery, as requested. The actual book is Anatomy; its title has not been changed to Surgery.

## Chapter counts

Counts were taken separately from the numbered questions and answer sections in this PDF.

| Chapter | Book MCQs | Packaged | Excluded art-label items |
|---|---:|---:|---:|
| 1. The Back | 40 | 39 | 6 |
| 2. The Upper Limb | 83 | 83 | 15 |
| 3. The Thorax | 75 | 75 | 20 |
| 4. The Abdomen | 100 | 100 | 30 |
| 5. The Pelvis and Perineum | 100 | 100 | 25 |
| 6. The Lower Limb | 100 | 100 | 15 |
| 7. The Head and Neck | 146 | 146 | 40 |
| Total | 644 | 643 | 151 |

The supplied body contains 795 numbered items across seven chapters: 644 MCQs and 151 art-identification items. The cover advertises 1,200 examination questions and an additional 200-question practice test; that count/test is not present in this supplied PDF. This possible cover/body discrepancy is flagged. No missing questions or chapters were invented.

## Source issues and flagged questions

- C1Q23 (local ID 23; question PDF p10, explanation p15): the printed answer explanation has no parenthesized answer letter. Excluded because a single keyed option cannot be copied. Original text retained below.
- C1Q40 (local ID 40; PDF pp13 and 16): printed key A corresponds to “ventral axial skeletal musculature”; the explanation says “dorsal axial musculature”. The key and text were copied unchanged, with a review flag.
- C2Q79 (local ID 119; explanation PDF p35): mixed-fraction typesetting is printed as one and one-half, but extracted as `11⁄2`. Original extracted characters retained and flagged; no mathematical interpretation substituted.
- C4Q43 (local ID 241; PDF p58): only A–D are printed. All four alternatives retained, with key D.
- C3Q74 (local ID 197; explanation PDF p52): the source sentence has no terminal period. The complete wording is retained without adding punctuation.
- 395 explanations contain only one complete source sentence. They are retained unchanged and flagged rather than expanded to the requested 2–4 sentences. Source question numbers follow, grouped by chapter:

- Chapter 1 (29): 1–3, 5–7, 9–13, 15–16, 18, 20–21, 25–32, 34–36, 39–40.
- Chapter 2 (32): 1, 4–5, 7–8, 11–12, 15, 18–20, 22, 24, 26, 29–31, 33, 37, 39–43, 46, 48, 55, 58, 65, 68–69, 72.
- Chapter 3 (60): 1–3, 6, 8, 12, 15–18, 21, 24–31, 33–53, 55–70, 72–75.
- Chapter 4 (64): 1–2, 5, 7–9, 11–14, 17–18, 20, 23–30, 32, 34–35, 37–48, 50–55, 57–63, 65–70, 72–73, 78–81, 87, 96, 100.
- Chapter 5 (48): 2, 5–7, 12, 16, 21, 28, 33–35, 37, 39–40, 44, 50, 52–54, 56–57, 61–71, 73–74, 76, 78, 82–83, 85–86, 89–90, 92–95, 97, 99.
- Chapter 6 (39): 2–4, 6–8, 10–11, 30, 35, 38, 43, 45, 47–48, 50, 52, 55–63, 66, 70, 73, 78, 80, 82, 84, 90, 94–95, 98–100.
- Chapter 7 (123): 1–10, 12–17, 19–27, 29–34, 36–42, 44–52, 54, 57–78, 82–83, 86–90, 92–95, 98, 100–103, 105–107, 109–120, 122–127, 129, 132–146.

## Text proof and source verification

Whitespace proof: **4500 fields checked; 0 failures**. Every packaged stem, option and selected explanation has identical characters after whitespace removal. Real paragraph breaks are retained. Printed line-end word hyphens are retained while removing the line break. No rewording, spelling correction, answer inference or deletion of non-whitespace characters was performed after extraction.

The original extraction uses PyMuPDF with `TEXT_PRESERVE_LIGATURES` disabled: printed fi/fl ligature glyphs are decoded into their constituent letters during extraction. The original text for proof is this canonical extraction, not the separate default-glyph diagnostic extraction. This is necessary because the unmodified Kafu validator rejects Unicode presentation ligatures. Subscript/superscript styling is flattened by text extraction; the mixed-fraction ambiguity is explicitly flagged above.

All selected source lines were independently found, character for character after whitespace removal, on their declared PDF pages. Every packaged answer letter was separately found beside the matching question number in the printed answer section. Excerpts use up to three contiguous complete source sentences; where only one exists, it is flagged as listed above.

Numbers, units and symbols were compared against OCR from 119 rendered question/answer pages. The two residual lines (C2Q79's mixed fraction and C3Q61's reference `p 111`) were inspected directly on page crops. The missing letter, contradictory key and four-option item were also checked visually. Running headers/page numbers were separated by layout; none were found mixed inside packaged fields.

The unmodified repository audit initially returned 601 matches, 41 warnings and 1 mismatch. Its single-page heuristic cannot reliably handle printed hyphenation and questions spanning pages; C3Q37 spans PDF pp41–42. Every original heuristic result is retained inside `audit.json`, alongside the stronger exact multi-page source and printed-key checks. These checks pass for all 643 packaged items; final audit mismatches: 0. Repository validator/audit code was not modified.

## Exclusions and figures

All 151 art-label items were excluded because they have no printed multiple-choice alternatives: C1Q41–46; C2Q84–98; C3Q76–95; C4Q101–130; C5Q101–125; C6Q101–115; C7Q147–186. Their 28 illustrations belong to those excluded groups. No included MCQ requires a figure crop, so no question figures were added. The introductory demonstration question is not part of the chapter question bank and was excluded.

One MCQ was skipped (C1Q23). No proof-check failures, unreadable packaged items or inferred keys. The cover is included. The source PDF and conversion scripts are not bundled. No bot upload was performed; the user uploads the ZIP. Only this report is archived in GitHub; no repository code or question pack is changed.

## Skipped original: C1Q23

```text
Which of the following is contained in the extra-
dural (epidural) space?
(A) fat (loose connective tissue)
(B) external vertebral venous plexus
(C) CSF
(D) denticulate ligaments
(E) radicular, medullary, and spinal arteries

Printed explanation (no answer letter):
Fat (loose connective tissue) is contained in the
extradural (epidural) space (Moore, p 480).
```

## Validation

Unmodified repository `validate.py --require-audit`: **0 errors**. Validation warnings, if any, are recorded below.

Validator warnings: 404.
- Q61 option E: duplicate option text
- Q77 option E: duplicate option text
- Q119: AI flag: Mixed-fraction typography appears as 11⁄2 in the original extracted explanation (printed as one and one-half). Extracted
- Q230 option D: duplicate option text
- Q290: same stem as Q254 (different options)
- Q294: same stem as Q237 (different options)
- Q295: same stem as Q236 (different options)
- Q384: same stem as Q342 (different options)
- Q440: same stem as Q308 (different options)
