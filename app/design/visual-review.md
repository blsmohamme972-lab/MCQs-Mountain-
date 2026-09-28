# Reviewed UI evidence

Task 5 #33 merged after exact-head Content 36410090318 and Visual/Flow 36410090320 passed; reviewed artifact 10963463906.

Task 6 #34: source 048a660c43b218ff28c925bb78c940beaab37c14, Visual/Flow run 36412219180, artifact 10964832631. All functional tests passed; expected visual changes remained. Phone390 and iPad820 light/dark before/after contact sheets reviewed for Home, Library, Study correct/wrong, Completion and Me. Filtered search/no-results and wider onboarding were inspected separately. Single filtered covers now retain their normal width. The candidate raw-pixel hashes in that artifact are deliberately approved here. CI never regenerates its own expected baseline. Final exact-head Content and Visual/Flow checks remain required before merge.

Offline labels use real source-identity validation; stale packs are not labelled complete. Progress fallback also requires the matching book version. These checks do not migrate or delete any saved record.
