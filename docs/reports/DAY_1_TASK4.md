# Day 1 task 4 - study polish

Branch: day1/04-study-polish. Follows approved and merged onboarding PR #31.

The new completion screen reports this session only. A resumed chapter with unvisited questions is a Session complete, not an invented perfect chapter. Review mistakes opens just the wrong answers from that session. Existing grading, permanent question IDs, favorites, downloaded packs, personal sync and FSRS are unchanged. Summary lives in memory; no migration is needed.

Question transitions use an 80ms token and are disabled with reduce motion. Reading width stays constrained on iPad. Correct/wrong choices include words as well as colour. Explanation status is announced politely. Base browser tests remain in force; new flow tests cover mixed scores, mistakes and resumed/skipped questions, plus offline persistence in every device/theme.

Before/after screenshots and exact-head CI evidence will be reviewed and recorded in the PR before merge. No secrets or production queue operations.
