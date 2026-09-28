# Kafu design system

Day 1 design brief, 2026-09-28. This document is the UI source of truth. Architecture and content rules remain in HANDOFF.md and MCQ_PLATFORM_FINAL_PLAN.yaml.

## People and promise

Kafu serves busy medical students and doctors, often tired and studying for hours on a phone. The study experience must be calm, confident and clean. Make the next action obvious. Keep medical question text central; never decorate it so heavily that it becomes harder to read. A successful session should feel encouraging, not like a game demanding attention.

Kafu means “well done” in Iraqi Arabic. The interface remains English-only. A short, varied “Kafu! 👏” belongs after a correct answer, a meaningful streak milestone or a completed chapter. Never tease a wrong answer. Never celebrate before an answer is actually scored. No noisy confetti, surprise sounds, shame, lost-streak warnings or childish mascots.

## Brand and visual language

- Petrol teal #0F4C54 / #16606A is the primary brand. Crimson #A8323E is a restrained accent and error colour, never the only way to identify an error.
- Poppins is the interface family; Lora is the question/reading family. Serve licensed, pinned font assets from our own app origin at runtime, with system/Georgia fallbacks and font-display: swap. Do not depend on Google Fonts during a study session.
- Use spacious surfaces, quiet borders, a short type scale, consistent rounded corners and at most one soft elevation level for floating controls. Avoid a card around every sentence.
- Use real book covers when present; otherwise use a consistent typographic cover. Book title, question count, offline availability and progress remain legible outside the cover image.
- Icons supplement labels. Primary navigation always has English labels. Decorative SVGs are aria-hidden.

## Tokens and components

One tokens file owns colour, spacing, radius, shadow, type scale and motion. Use semantic roles (background, surface, text, muted, primary, success, danger, border, focus) rather than component-specific hex values. The app config identifies the brand and feature switches; it references token names rather than maintaining a second palette. Legacy CSS variables may alias semantic tokens during the transition.

The small shared component set includes primary/secondary/quiet/destructive buttons; cards; full-width list rows; chips; accessible bottom sheets; status/undo toasts; actionable empty states; progress bars/rings; and skeleton loaders. Components must document loading, disabled, focus, error and selected states. The hidden /styleguide route demonstrates every component and both themes without writing study data.

Minimum interactive target is 44 by 44 CSS pixels. Provide space between destructive and primary actions. Loading indicators must explain what is happening and must not trap navigation. Empty states contain a helpful next step, not just “nothing here.”

## Themes and accessibility

Follow the saved theme preference when it is not Auto; otherwise follow Telegram's light/dark colour scheme and themeChanged event, with system preference as the browser fallback. Preserve brand identity while respecting the host theme. Do not blindly adopt a host colour that would make text unreadable.

Target WCAG 2.2 AA: normal text at least 4.5:1, large text at least 3:1, meaningful controls/focus boundaries at least 3:1. Contrast tests complement, not replace, keyboard and screen-reader checks. Correct/wrong feedback uses words and icons as well as colour. Focus must remain visible, follow screen navigation and return to the originating control when a sheet closes. Sheets support Escape, a labelled close action and a focus trap.

The text-size setting applies to interface labels, question text, answer options, explanations and sheets. At 200% text size the UI must remain usable without horizontally scrolling the page. Respect prefers-reduced-motion. No essential information may require animation, haptics, hover or colour perception. Telegram haptics are optional and safely no-op outside Telegram.

## Layout and one-hand use

Phone reference viewport: 390 by 844 CSS pixels. iPad reference: 820 by 1180 CSS pixels. Include light and dark evidence for each. Phone study actions stay near the bottom above safe-area insets; do not overlap options or explanations. Home always offers one-tap Continue when a resumable chapter exists. Without a resume target, provide one clear “Find a chapter” action.

On iPad, give Home/Library useful columns while keeping question text in a comfortable roughly 65-character reading column. Do not stretch a question across the full tablet width. Keep the primary action within the same reading column.

## Journey details

1. Home: Continue, today's goal, Review Due and current streak, with a light hierarchy. No medical advice, adverts or attention-grabbing feed.
2. Onboarding: three short, skippable screens — what Kafu is, what offline studying does and does not include, then specialty. Shown once per local profile. Choosing a specialty changes discovery, not access to other books. Do not create hidden writes to existing sync formats.
3. Library: search book titles and filter specialties; show active filters, result count, clear action and an actionable no-results state. Search never modifies catalog or downloads.
4. Study: preserve all four question types and grading semantics. Short question transitions, stable layout, progress, clear answer feedback and readable source/explanation text. No animation on every tap.
5. Completion: session score, encouraging copy, Review mistakes, and an obvious way Home. Never claim a perfect chapter when any answer was wrong or skipped.
6. Me: saved preferences, offline storage information, sync status and a small achievements shelf. Destructive actions describe scope and offer confirmation/undo where safe. Do not promise restoration of data already removed from an external provider.

## Saved-data and offline contract

Do not change IndexedDB database names, versions, object stores, question IDs, saved answer/favorite/download shapes, sync snapshot format or tombstones in a UI task. Do not delete or overwrite unknown keys. All new derived UI should prefer the current public in-memory state and existing read APIs.

Onboarding completion, specialty selection or achievements that require a new persistent format must have an explicit, additive, tested migration and stay in an open PR for owner review. Do not sneak a schema change into a cosmetic feature. Independent safe UI tasks continue on main when a data-change PR is held.

Offline-first means previously downloaded chapters and images remain usable after relaunch, without any network request being required to grade an answer. Preserve the existing atomic service-worker shell and downloaded-content logic. Dynamic sync/status messages distinguish locally saved from synced. Do not claim a newly viewed chapter's images are saved before the download bridge confirms it.

## Performance budget

- Sum of app JavaScript (inline, modules and shipped vendor scripts) at most 150 KB gzipped; report the counting method and avoid double-counting bundled copies.
- First open target at most 3 seconds under a documented 4G simulation; include cold-cache and warm/offline observations. A desktop simulation is not a physical 4G phone measurement.
- Next question target at most 100 ms for locally available content; measure click-to-next-question DOM update separately from optional decoration.
- No framework rewrite, new paid service, analytics dependency or background polling. Pin and integrity-check dependencies. Cache self-hosted fonts with the existing shell policy.

## Safety gates and evidence

Each numbered task has its own branch and PR. Introduce the baseline visual/flow harness with the design-system task so later UI work can be gated from the start; complete its journey matrix in task 8. CI test plumbing is separate from production deployment infrastructure. Do not change Worker bindings, D1, secrets, account permissions, BotFather or production publishing triggers.

Before self-merge: all required content/unit tests plus applicable new flow/visual checks are green for the exact PR head; inspect before/after screenshots; test saved-state compatibility; inspect the diff for prohibited changes. Leave infrastructure/data-format PRs open regardless of passing tests.

Visual evidence covers Home, Library, Study correct/wrong, Chapter complete and Me at phone/iPad in light/dark, using fixed test data, time and animation settings. Baselines are approved deliberately; CI must not silently regenerate expected images and call that a regression pass. No screenshots contain credentials or real students' data.

Keep PROGRESS.md current after each task, HANDOFF.md current for future agents and docs/CHANGE_RECIPES.md specific about files and proving tests. Record actual evidence, unverified claims and blocked actions in docs/reports/DAY_1_DESIGN.md.

## References

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Telegram themes/events: https://core.telegram.org/bots/webapps
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
