# PDF repair and two-engine extraction

Ghostscript `pdfwrite` rewrote all 961 pages. Poppler `pdftotext -layout` then completed with zero stream errors. The original file yielded stream errors on 62 PDF pages:

6–7, 16–19, 48–50, 52, 58–64, 78–81, 83–84, 106–112, 126–128, 144–149, 172–175, 177–179, 208–211, 234–237, 708–711, 724–727.

Both original text engines extracted all 40 answer/explanation sections. Token multiset overlap between original PyMuPDF and Poppler is below 85% on PDF pages 4, 6, 7, 13, 283 and 311; only 283 and 311 are in the book body and warrant targeted review. The Ghostscript rewrite can change PyMuPDF glyph extraction (for example “The” appears as “Te” on pages 924 and 936), while Poppler retains “The” in spot checks. Exact question text must therefore be checked against the original PDF, with the repaired copy used to recover streams where needed. Neither token overlap nor zero stream errors proves every question is correct.

The 40-chapter question count and individual answers remain unaudited. The book pack is not ready for bot upload.
