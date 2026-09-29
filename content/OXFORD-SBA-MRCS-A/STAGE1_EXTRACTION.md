# Oxford stage 1 - extraction recovered

Source OXFORD.pdf independently verified: 2736487 bytes, 256 pages, SHA-256 00da079467ce8d8aecdb5dc65cab6b0d0b884bff17c9b6a00b03c69604de0ad6. Original unchanged.

Initial remote HEAD 467f44da6f6f58bc2ddde28563af3238cc5c05a5; main 898cc20d9635f82342a9ce6ea03dc14f970c911b. Work branch content/OXFORD-SBA-MRCS-A only. No merge, deployment or publication. Container cannot resolve GitHub; authorized connector used for branch-specific checkpoints rather than claiming a local clone exists.

## Serialization test and full extraction

Task-local extract_oxford.py replaces bytes/bytearray leaves with byte length and SHA-256. It never removes the enclosing image/block and never embeds base64 or stringified bytes. Representative PDF pages 1,4,7,20,36,256 all passed JSON serialization; page text before/after identical; structured text, span/font information and coordinates preserved; zero binary payload leaves after sanitization. Synthetic bytearray test passed. All 256 structured pages saved successfully.

## Page-health audit

For every PDF page 1 through 256: PyMuPDF page open PASS; text extraction PASS; diagnostic rendering PASS; Poppler normal/raw/layout extraction PASS; Poppler rendering PASS. No suspiciously empty/truncated pages under the explicit length/replacement-glyph heuristic. This is not a claim that all questions have been manually verified. Manual question-level review is the next stage.

Initial whitespace/ligature-normalized page comparison: PyMuPDF vs Poppler raw 211/256 equal, 45 different; versus normal 33/256 equal, 223 different. Reading order, numeric/symbol placement and question-level differences remain to be investigated. Exit status alone is not accepted as source verification.

## Warning investigation

Offsets 2060938 and 2061133 belong to object 3525, referenced by the PDF trailer as /Info. The raw metadata dictionary has unescaped spaces in keys. These offsets are NOT pages.

All 395 bad-flate offsets were mapped through PDF objects to reader-annotation appearance streams (449 annotations total), on 120 question-section pages. They are not the printed book content streams. Annotation-free rendering of all printed pages also succeeded. Reader-note contents are never used as book answer keys. No repair of the original or a copy was needed. Printed answer sections will determine answers.

## Evidence storage

The original checkpoint ZIP was recovered from the Library and its SHA-256 matched 143ca58f468b1f3519fa20758d9e72353dd5e728886b0c921341488bebc9aea4. All three old evidence hashes matched. Large extraction evidence is in the current task workspace, NOT silently represented as committed by this checkpoint:

- evidence/pymupdf-pages.json: 14912385 bytes; SHA-256 2c3d496c284c0d87b0f398a79ef8d18dcafb26c790fc544713058e728e58fb1a
- evidence/poppler-pages.json: 2941149 bytes; SHA-256 455712242f7a0ada261aad4b900f25f49d02dc8c0cb9557222410bf7f8d0d3fe
- evidence/page-health.json: 1092255 bytes; SHA-256 14b3b010116e95b7f83591744fbb2f35d51e4563daa5e4cb4f80af2880ff83bf
- evidence/parser-warning-investigation.json: 133512 bytes; SHA-256 f621c3dfc0a885d2c195fdbbf0163e688b74c6deb95fab83569987d55ae669f7
- evidence/sanitizer-tests.json: 3127 bytes; SHA-256 db9d679ab3037da7ad607cb84916464c39690a7f65345c64da3ee38e3b1021c7

Regenerate extraction evidence with `python extract_oxford.py /path/to/OXFORD.pdf`. Original fingerprint is enforced.

Existing audit.py and validate.py were read from the pinned repository commit and copied byte-for-byte into a read-only local tools directory. Verified Git blob SHAs: audit.py f1aa2d28ce70904a7718599d33f93ab8853dc7fa; validate.py 0902c0c8efcba7e01084c23c1c5db7948d22b4a4. Neither was edited.

No completed MCQ pack or validator PASS is claimed at this stage.
