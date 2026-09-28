# Day 1 task 4 - study polish

Branch: day1/04-study-polish, PR #32. Follows approved and merged onboarding PR #31.

The new completion screen reports this session only. A resumed chapter with unvisited questions is a Session complete, not an invented perfect chapter. Review mistakes opens just the wrong answers from that session. Existing grading, permanent question IDs, favorites, downloaded packs, personal sync and FSRS are unchanged. Summary lives in memory; no migration is needed.

Question transitions use an 80ms token and are disabled with reduce motion. Reading width stays constrained on iPad. Correct/wrong choices include words as well as colour. Explanation status is announced politely.

Evidence run 36404432889 / artifact 10961338888: all browser journeys, actual old/new/old database compatibility, undo and onboarding tests passed. New tests cover a 75% mixed chapter, session-only mistakes, and skipped/resumed questions never earning perfect, across phone390/iPad820 and light/dark. Screenshots for Home, Library, correct/wrong study, completion, Me and additional states inspected in all four combinations. Changed raw-pixel hashes deliberately approved in this commit. CI will compare, not regenerate, expectations.

App JS: 82,787 gzip bytes. Next-question DOM/rAF: 2.2-7.6 ms on Chromium CI, not a physical 4G phone measurement. A fresh exact-head Content and Visual/Flow run must pass before merge. No secrets, production queue or infrastructure changes.
