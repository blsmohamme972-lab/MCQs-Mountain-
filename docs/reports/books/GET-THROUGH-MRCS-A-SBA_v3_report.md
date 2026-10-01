# Get Through MRCS Part A: SBAs — v3

**1000 SBA questions; 36 chapters; skipped 0; unresolved flags 0; validator errors 0; warnings 0.**

## Chapter counts

| Chapter | Book | Extracted |
|---|---:|---:|
| Applied surgical anatomy — Thorax | 28 | 28 |
| Applied surgical anatomy — Abdomen, Pelvis And Perineum | 91 | 91 |
| Applied surgical anatomy — Upper Limb, Breast | 35 | 35 |
| Applied surgical anatomy — Lower Limb | 35 | 35 |
| Applied surgical anatomy — Head, Neck And Spine | 86 | 86 |
| Applied surgical anatomy — Central, Peripheral And Autonomic Nervous Systems | 54 | 54 |
| Physiology — Respiratory System | 22 | 22 |
| Physiology — Cardiovascular System | 55 | 55 |
| Physiology — Gastrointestinal System | 30 | 30 |
| Physiology — Renal System | 24 | 24 |
| Physiology — Endocrine System (Including Glucose Homeostasis) | 33 | 33 |
| Physiology — Nervous System | 26 | 26 |
| Physiology — Thyroid And Parathyroid | 22 | 22 |
| Pathology — Inflammation | 12 | 12 |
| Pathology — Cellular Injury Other Than By Infection | 5 | 5 |
| Pathology — Wounds And Wound Healing | 8 | 8 |
| Pathology — Vascular Disorders | 10 | 10 |
| Pathology — Disorders Of Growth, Differentiation And Morphogenesis | 19 | 19 |
| Pathology — Neoplasia | 37 | 37 |
| Pathology — Surgical Immunology | 16 | 16 |
| Pathology — Surgical Haematology | 27 | 27 |
| Pathology — Surgical Microbiology | 16 | 16 |
| Pathology — Surgical Biochemistry | 5 | 5 |
| System-specific pathology — Nervous System | 14 | 14 |
| System-specific pathology — Musculoskeletal System | 26 | 26 |
| System-specific pathology — Respiratory System | 7 | 7 |
| System-specific pathology — Breast Disorders | 11 | 11 |
| System-specific pathology — Cardiovascular System | 5 | 5 |
| System-specific pathology — Endocrine System | 26 | 26 |
| System-specific pathology — Genitourinary System | 15 | 15 |
| System-specific pathology — Gastrointestinal System | 35 | 35 |
| System-specific pathology — Dermatological Diseases | 12 | 12 |
| System-specific pathology — Lymphoreticular System | 12 | 12 |
| System-specific pathology — Ear, Nose And Throat | 5 | 5 |
| System-specific pathology — Miscellaneous | 1 | 1 |
| Practice paper | 135 | 135 |
| **Total** | **1000** | **1000** |

## Resolved issues

| Questions | Cause | Resolution |
|---|---|---|
| Q283→193, Q580→557, Q888→27, Q994→991 | Four exact repeats printed in the book | All retained with two-way source declarations; equal stem/options/type/key and different printed source pages verified. |
| Q240→217, Q310→302, Q715→714, Q877→470, Q972→524 | Same printed stems, distinct source options | All retained, unchanged stems/options/keys, with verified two-way source-variant declarations. |
| Q507 | Checker ignored numeric signs | Checker now distinguishes –70, –10, +10, +40 and +70 mV. Explanation selection now includes three copied sentences explicitly explaining +40 mV. |
| Q558, Q626, Q734, Q819 | Correct suspended hyphens were misclassified | Original hyphens retained. Checker accepts “high- or low-velocity” and similar constructions; genuine broken words still warn. |
| Q884 (printed 19, PDF question page 350; answer pages 375–376) | A and D both printed Osteochondroma | Authorized editorial replacement: D becomes Osteoid osteoma. Stem, correct B/Osteosarcoma and copied explanation remain unchanged. Original options preserved in question metadata. |
| Q715 | Selected explanation began with context-dependent pronouns | Authorized three-sentence authored explanation of Erb’s palsy/shoulder dystocia; original excerpt preserved in metadata. Answer D unchanged. |
| Q972 | Genuine source list lines collapsed | Restored separate lines for spleen/lymph nodes, testes, uterus, adult brain and anterior pituitary; no characters changed. |
| Q371, Q372, Q384, Q416, Q427, Q583, Q584, Q684, Q704, Q892, Q981 | Unnumbered raster explanation tables | 11 tables transcribed and visually checked (309 cells); supplied as Markdown text, without uncited image attachments. Three formerly empty explanations now have their full source tables. |

## Editorial provenance and medical verification

Only two final items intentionally differ from source text: Q884 option D and Q715 explanation. These are disclosed editorial changes authorized by the user, not whitespace-only copies. All answer keys and question stems remain sourced from the book.

- Q884: [AAOS: Osteoid osteoma](https://orthoinfo.aaos.org/en/diseases--conditions/osteoid-osteoma/) describes a benign, small nidus-forming tumour. Choosing it as the distinct wrong distractor is an editorial inference; the book never prints this replacement. The book’s key and explanation of osteosarcoma/Codman’s triangle are retained.
- Q715: [AAOS: Erb’s palsy](https://orthoinfo.aaos.org/en/diseases--conditions/erbs-palsy-brachial-plexus-birth-palsy/) and [AAOS: brachial plexus injuries](https://orthoinfo.aaos.org/en/diseases--conditions/brachial-plexus-injuries/) support upper-plexus involvement and birth injury when the shoulders become caught. The new explanation focuses on the keyed concept without the earlier excerpt’s unrelated pronouns.

## Proof checks and source audit

- Original extracted-text whitespace checks: 7000, failures 0. This covers original stem, five options and full source explanation per question, before explicitly authorized editorial changes.
- Final stem/option comparisons: 6000; 5999 identical after whitespace removal; one deliberate exception (Q884 D). Final copied-prose excerpt checks outside the 11 transcribed tables: 989; 988 source-substring matches; one deliberate authored exception (Q715). Unexpected proof failures: 0.
- Table-cell whitespace checks: 309, failures 0. Original cells and cleaned cells are preserved in the separate proof file. Markdown separator rows/pipes are formatting.
- No evidenced line-end hyphen removals were required. Real hyphens retained. No running header or page number remains flagged.
- Original extracted stems/options/full explanations are preserved in the reproducible parser result; original replaced fields are also preserved directly in question metadata.
- Unchanged audit.py: 1000 match, 0 warning, 0 mismatch, 0 unverifiable. Its match threshold is at least 80% of options: Q884 passes on its four original options; this does not prove the new D came from the source. The audit does not clinically validate explanations or answer keys.
- All 1000 answer keys were matched by section and printed question number. All are single letters from their five options. No answers were invented.
- source_label on every question: Get Through MRCS Part A: SBAs || Edition not stated. No edition number appears on the cover/title/copyright pages; no edition was guessed.
- Specialty General Surgery; branch Surgery. Figures attached: 0 (no matching numbered question/caption citations). Cover included.
- Source table quirks preserved and disclosed: inferior ECG row literally “II, II, aVF”; teratogen table repeats Irradiation/Microcephaly; hepatitis E taxonomy literally “RNA Calcivirus”. These remain book statements, not undisclosed transcription edits.

## Importer and release checks

- Authorized validator policy change: [GitHub PR #55](https://github.com/blsmohamme972-lab/MCQs-Mountain-/pull/55). Ordinary undeclared duplicates still fail. Invalid provenance still fails. Numeric signs and suspended hyphens now retain their meaning. Source audit and release validators are unchanged.
- Local focused validator tests: 10 passed, including existing option-label regressions and invalid provenance cases. GitHub Content Contract CI passed on code head 1cd34f36710bedab0bf2288bb16d6143c29f11bf ([run 36841923761](https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36841923761)). Validator blob: e923ae5a91a333290c6f4e07ddb550c1f9dab2df.
- validate.py --require-audit: PASS, errors 0, warnings 0. validate_release.py: PASS, 1000 IDs, one part, skipped 0.
- Resolved source issues remain documented above; flags were cleared after correction or verified provenance. Skipped items: none.

## Archive measurement

- ZIP bytes:     293118
- Uncompressed bytes:    1577054
- Entries:          5
- Maximum member compression ratio:    46.321750:1
- One ZIP, below 19 MB.

These are structural/source checks; they are not an independent clinical review of every statement in the 2016 book.
