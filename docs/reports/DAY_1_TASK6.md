# Task 6: calm Home and useful Library

PR #34 on day1/06-home-library. No new saved fields, database versions or sync changes. No credential, account, infrastructure or production queue operations.

Home: one-tap Continue for the existing valid resume, otherwise Find a chapter; ten-minute daily goal derived from synced study time; actual FSRS Review Due, mistakes, stars and favorite books. Library: title search, specialty filter, result count/clear/no-results feedback with input focus retained. Filters are session-local. Real safe-origin covers or branded typographic fallback. Progress percentages require complete current QIDs or matching-version pack; otherwise honest saved-answer counts. Offline labels require real download identity validation.

Source 048a660c43b218ff28c925bb78c940beaab37c14: Content 36412219162 passed; Visual/Flow 36412219180 passed all functional flows. Artifact 10964832631 before/after phone390/iPad820 light/dark inspected, including filtered covers, empty state and wider onboarding; pixel baselines deliberately approved. Final exact-head CI still required. Earlier new-device, upgrade/rollback, Undo, all question types and offline persistence checks also passed. No production account used.

Measured app JS 90,743 gzip bytes; next question 2.1-14.4ms in CI Chromium. Physical phone first-open 4G remains unverified. The initial test correctly refused an offline claim for a seeded old pack; the test now validates it through the actual download manager, not by weakening the integrity check.
