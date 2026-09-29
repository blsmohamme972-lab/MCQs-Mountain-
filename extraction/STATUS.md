# Extraction checkpoint — Surgery Review Illustrated, Second Edition

Book ID: SURGERY-REVIEW-ILLUSTRATED-2E. Intended metadata: General Surgery / Surgery.

Both Poppler (`pdftotext -layout`) and PyMuPDF extracted page text from the 961-page PDF. The comparison and preliminary 40-chapter inventory are in `manifest.json`. Raw full-book text was kept outside the committed package. Poppler emitted 444 compressed-stream syntax-error lines; the first errors arose while reading chapter 1. The candidate question numbers are discovery data, not verified PDF-versus-extracted counts.

**Stopped after extraction:** question parsing, answer matching, visual review, figures, explanations, audit, packaging, and `validate.py --require-audit` are not complete. No bot-ready ZIP has been created or published. Do not upload this checkpoint to the bot.
