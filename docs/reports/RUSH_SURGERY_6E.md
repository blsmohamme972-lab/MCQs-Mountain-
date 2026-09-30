# Rush Review of Surgery, sixth edition: preparation report

Source: owner-supplied 595-page PDF; printed answers retained without medical correction.
Source SHA-256: 68d4051d135a221e798c5ae3548e9c58267acde68814d72efc2e96b9b5e95bbd
Parser: tools/parsers/rush_surgery_6e.py. Gates: original audit.py, validate.py and validate_release.py, unchanged.

Coverage: 1,579 numbered source blocks, 35 chapters; seven matching blocks expanded into 35 individual items. Total: 1607.
Types: {'sba': 1572, 'emq': 33, 'multi': 2}. Skipped: 0. Flagged: 0. Missing assigned explanation: local_id 442 (chapter 9, source 13, PDF p.162); no explanation invented.
Matching instructions are in lead_in. Source items shorter than the unchanged 10-character stem minimum also retain their copied instruction in stem; no scenario is invented.
Explanations retain four copied sentences and any additional sentence needed for a cited figure/table.
48 figures and 20 table-page crops; 84 image attachments. All distinct crops visually checked; labels, table tails and column boundaries corrected before final build.
Complex source tables remain source crops; two option matrices (local_id 1182 and 1562) use Markdown tables.

## Source review

Fifteen reproducible spot checks (seed 600), plus all remaining audit warnings:
- local_id 125: chapter 4, source 3, PDF pages [60], answer A.
- local_id 145: chapter 4, source 23, PDF pages [65], answer A.
- local_id 211: chapter 5, source 27, PDF pages [83], answer C.
- local_id 308: chapter 6, source 32, PDF pages [113], answer B.
- local_id 542: chapter 11, source 6, PDF pages [203], answer B.
- local_id 705: chapter 15, source 40, PDF pages [262, 263], answer E.
- local_id 800: chapter 18, source 14, PDF pages [293], answer E.
- local_id 826: chapter 19, source 13, PDF pages [301], answer A.
- local_id 877: chapter 21, source 11, PDF pages [320], answer D.
- local_id 901: chapter 21, source 35, PDF pages [327], answer B.
- local_id 909: chapter 22, source 2, PDF pages [329], answer D.
- local_id 1140: chapter 25, source 66, PDF pages [417, 418], answer A.
- local_id 1236: chapter 28, source 19, PDF pages [452], answer A.
- local_id 1296: chapter 28, source 13, PDF pages [470], answer D.
- local_id 1419: chapter 31, source 4, PDF pages [522], answer A.

Every answer checked against extracted inline source keys, including shared trauma answers C/E/B and matching item letters.
Full-phrase comparisons additionally identify source column interleaving around figures/tables; these are documented in phrase-differences.json in the rebuild evidence.

## Audit warnings

- local_id 229, source 37, PDF [86]: warning; source-confirmed line-end word hyphenation is joined. Original wording and key retained. Partial source match; manual review recommended.
- local_id 985, source 19, PDF [359]: warning; source-confirmed line-end word hyphenation is joined. Original wording and key retained. Partial source match; manual review recommended.
- local_id 1095, source 21, PDF [404]: warning; source-confirmed line-end word hyphenation is joined. Original wording and key retained. Partial source match; manual review recommended.
- local_id 1112, source 38, PDF [409]: warning; source-confirmed line-end word hyphenation is joined. Original wording and key retained. Partial source match; manual review recommended.
- local_id 1174, source 29, PDF [429]: warning; source-confirmed line-end word hyphenation is joined. Original wording and key retained. Partial source match; manual review recommended.
- local_id 1290, source 7, PDF [468]: warning; source-confirmed line-end word hyphenation is joined. Original wording and key retained. Partial source match; manual review recommended.

## Validator warning locations

- local_id 29, chapter 2, source 4, PDF [29]: - Q29: stem has a line-break hyphen like 'hypo- thermia'
- local_id 154, chapter 4, source 7, PDF [68]: - Q154: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 155, chapter 4, source 8, PDF [68]: - Q155: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 177, chapter 5, source 1, PDF [74]: - Q177: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 181, chapter 5, source 5, PDF [75]: - Q181 option E: duplicate option text
- local_id 510, chapter 10, source 28, PDF [191]: - Q510: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 597, chapter 12, source 14, PDF [223]: - Q597: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 598, chapter 12, source 15, PDF [223, 224]: - Q598: stem has a line-break hyphen like 'hypo- thermia'
- local_id 598, chapter 12, source 15, PDF [223, 224]: - Q598: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 754, chapter 16, source 20, PDF [279]: - Q754: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 798, chapter 18, source 12, PDF [292]: - Q798: stem has a line-break hyphen like 'hypo- thermia'
- local_id 862, chapter 20, source 28, PDF [315]: - Q862 option C: option has a line-break hyphen like 'hypo- thermia'
- local_id 898, chapter 21, source 32, PDF [326]: - Q898: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 982, chapter 23, source 16, PDF [357]: - Q982: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 1010, chapter 23, source 40, PDF [369, 370]: - Q1010: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 1029, chapter 23, source 7, PDF [379]: - Q1029: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 1033, chapter 23, source 11, PDF [381]: - Q1033: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 1104, chapter 25, source 30, PDF [407]: - Q1104: explanation has unbalanced parentheses
- local_id 1184, chapter 26, source 39, PDF [432]: - Q1184: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 1236, chapter 28, source 19, PDF [452]: - Q1236: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 1301, chapter 28, source 18, PDF [471]: - Q1301: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 1318, chapter 28, source 6, PDF [478]: - Q1318: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 1318, chapter 28, source 6, PDF [478]: - Q1318: same stem as Q309 (different options)
- local_id 1437, chapter 31, source 22, PDF [527]: - Q1437: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 1590, chapter 35, source 7, PDF [588]: - Q1590: explanation has a line-break hyphen like 'hypo- thermia'
- local_id 1591, chapter 35, source 8, PDF [588]: - Q1591 option D: option has a line-break hyphen like 'hypo- thermia'

## Validator warnings

The validator output retains legacy HELD wording; docs/CONTENT_TEAM.md states remaining audit warnings are informational and require no owner approval.
Suspended hyphens (for example split- and full-thickness) are printed source wording. They are retained.
local_id 181: HBcAb+ and HBcAb- are distinct printed options; punctuation-stripped duplicate detection treats them as equal.
local_id 1104: unmatched parenthesis is present in the source explanation; retained.
local_id 1318 and 309: same short printed stem with different options and chapters; retained.

```text
================================================================
Package : RUSH-SURGERY-6E_v1.zip
Book    : RUSH-SURGERY-6E — Rush University Medical Center Review of Surgery (part 1/1)
Counts  : 1607 questions {'sba': 1572, 'emq': 33, 'multi': 2}, 0 skipped, 84 images, 1 without explanation
Audit   : {'match': 1601, 'warning': 6, 'mismatch': 0, 'unverifiable': 0}

WARNINGS (27):
  - Q29: stem has a line-break hyphen like 'hypo- thermia'
  - Q154: explanation has a line-break hyphen like 'hypo- thermia'
  - Q155: explanation has a line-break hyphen like 'hypo- thermia'
  - Q177: explanation has a line-break hyphen like 'hypo- thermia'
  - Q181 option E: duplicate option text
  - Q510: explanation has a line-break hyphen like 'hypo- thermia'
  - Q597: explanation has a line-break hyphen like 'hypo- thermia'
  - Q598: stem has a line-break hyphen like 'hypo- thermia'
  - Q598: explanation has a line-break hyphen like 'hypo- thermia'
  - Q754: explanation has a line-break hyphen like 'hypo- thermia'
  - Q798: stem has a line-break hyphen like 'hypo- thermia'
  - Q862 option C: option has a line-break hyphen like 'hypo- thermia'
  - Q898: explanation has a line-break hyphen like 'hypo- thermia'
  - Q982: explanation has a line-break hyphen like 'hypo- thermia'
  - Q1010: explanation has a line-break hyphen like 'hypo- thermia'
  - Q1029: explanation has a line-break hyphen like 'hypo- thermia'
  - Q1033: explanation has a line-break hyphen like 'hypo- thermia'
  - Q1104: explanation has unbalanced parentheses
  - Q1184: explanation has a line-break hyphen like 'hypo- thermia'
  - Q1236: explanation has a line-break hyphen like 'hypo- thermia'
  - Q1301: explanation has a line-break hyphen like 'hypo- thermia'
  - Q1318: explanation has a line-break hyphen like 'hypo- thermia'
  - Q1318: same stem as Q309 (different options)
  - Q1437: explanation has a line-break hyphen like 'hypo- thermia'
  - Q1590: explanation has a line-break hyphen like 'hypo- thermia'
  - Q1591 option D: option has a line-break hyphen like 'hypo- thermia'
  - audit: 6 audit warnings + 0 unverifiable → these questions will be HELD for review

RESULT: PASS (27 warnings)
```

## Final archive limits

Limit references: ZIP tools/validate.py:46,434-436; worker/queue-state.mjs:2,21; tools/drain_queue.py:32,89; migrations/0001_publish_queue.sql:24. Expanded contents tools/validate.py:47,371,376-377. Entries:48,340-343. Member ratio:49,372-374. Images:50,52-53,487-494. Cover:51,465-473.
Images per item: images <=6 and explanation_images <=6, tools/validate.py:311-317. Parts <=100 and filename <=255 characters: worker/queue-state.mjs:6,10; migrations/0001_publish_queue.sql:5. No independent question-count or JSON byte ceiling: tools/validate.py:390-404,448-449,497-530; tools/validate_release.py:21-45; tools/publish.py:51-112.
Downstream HTTP response default cap 64 MiB: tools/http_client.py:14,77-95,116-125. Permanent ID allocation <=999999999: tools/publish.py:175-180. Upload splitting cannot bypass either downstream limit.
ZIP bytes: 000002905406; limit 19922944.
Expanded bytes: 000005102172; limit 209715200.
Entries: 000000000089; limit 5000.
Maximum entry compression ratio: 00042.777312; limit 100.
Maximum image bytes: 84518; limit 1500000.
Maximum image width: 1200; target 1200, hard limit 1600.
Cover bytes: 24110; limit 400000.

One complete package fits the bot limits. No chapter splitting needed.

## Rebuild

```bash
PYTHONPATH=. python tools/package_batch.py SOURCE.pdf --parser rush_surgery_6e --metadata rush-metadata.json --out-dir dist
# For the identical enriched report and deterministic final ZIP:
PYTHONPATH=. python -m tools.package_rush_surgery_6e SOURCE.pdf --metadata rush-metadata.json --out-dir dist
```
Dependencies: PyMuPDF and Pillow. Source PDF is not included in the rebuild bundle.
