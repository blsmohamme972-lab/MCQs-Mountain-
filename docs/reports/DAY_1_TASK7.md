# Task 7: accessible study and navigation

Branch day1/07-accessibility, based on merged Home/Library #34. No new saved fields, font preference values, database versions, sync formats or infrastructure changes.

Adds skip-to-content, contextual heading/answer-group/true-false labels, reliable new-question focus and named download-removal actions. Existing sheet trap/Escape/opener-focus is retained. Stronger meaningful control boundaries and theme-correct progress fill complement existing textual grading. Legacy fixed-size diagnostic/privacy text now follows the global text setting. Responsive score rings, headers, badges, diagnostic grids and bottom clearance support enlarged text and narrow screens. Forced-colors rules provide visible boundaries.

The existing saved font values remain exactly 0.9, 1, 1.12 and 1.25. The 200% test uses browser text-only scaling without inventing a new sync preference. All old/new/old and new-device badge tests remain required. Browser checks cover computed text/token contrast, 44px controls, labels, skip link, keyboard sheets, text-size propagation, 200% reflow and 320px width. Gradients are listed for visual review; automation is not a complete screen-reader/WCAG certification. Actual TalkBack/VoiceOver review remains on the phone checklist.

CI and reviewed before/after phone390/iPad820 light/dark evidence are pending. Do not merge without exact-head Content and Visual/Flow passes. No production queue, account settings or credentials touched.
