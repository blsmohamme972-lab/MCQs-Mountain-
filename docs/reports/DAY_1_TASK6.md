# Task 6: calm Home and useful Library

Branch day1/06-home-library. Builds on merged #33. No new saved fields, storage versions or sync changes. No account/credential/infrastructure/production queue operations.

Home has one-tap Continue when the existing resume is valid, or a clear Find a chapter action. The default 10-minute goal is derived from existing daily study time, and Review Due uses the actual FSRS queue. Existing mistakes, stars, favorite books, educational notices and offline status remain accessible.

Library supports title search and specialty filtering without navigation on each keystroke, so focus/keyboard stay stable. Results, clear action and helpful empty states explain what to do. Search/filter preferences are session-local. A selected onboarding specialty initializes discovery without hiding the all-specialties choice. Real same-origin/content-origin covers are shown; otherwise a typographic branded cover is used. Progress percentages require complete current QIDs or a verified matching downloaded pack; otherwise the UI says saved answers rather than inventing completion. Offline labels use actual download availability.

Pure tests cover search/filter normalization, no mutation, removed books, exact progress, goal and resume. New Playwright journeys cover phone/iPad light/dark search/clear/empty results, one-tap resume, read-only saved state and offline discovery. All earlier new-device, upgrade/rollback, Undo, grading and offline flows remain required. Screenshots and exact-head CI are pending; this is not a production/performance claim.
