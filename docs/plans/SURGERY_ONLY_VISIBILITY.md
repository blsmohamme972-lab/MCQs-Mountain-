# Surgery-only public discovery

Owner request (2026-09-29): show Surgery only to students now, retain other branches for future explicit activation, test and deploy without colliding with other agents.

## Isolation

Base: 898cc20d9635f82342a9ce6ea03dc14f970c911b. Branch: feature/surgery-only-visibility.

Preflight: open PRs #35, #38, #43 and #49 inspected. feature/leaderboard-live is identical to main; admin dashboard #49 currently claims its own plan/new modules. This task does not edit their branches, Worker code, leaderboard, admin dashboard, publishing pipeline, validators, migrations, student storage/sync, app/index.html, existing art/crops, design tokens or approved visual baselines.

Implementation uses new isolated specialty-policy and view-integration modules. Only append-only module registration and narrowly documented browser-fixture configuration may touch shared integration files. Recheck latest main and active PRs before merge; preserve concurrent additions.

## Product and data contract

- Default public discovery is Surgery only: branch cards, Library search/filter, onboarding choices and Home recommendations.
- Keep all 15 original branch-art definitions, image paths and crop values intact.
- One explicit allowlist controls future activation; an enabled specialty without existing artwork uses the existing accessible text-card fallback.
- Match exact normalized specialty names and documented aliases; surgical specialty aliases must not accidentally appear under Cardiology.
- Visibility is a non-destructive UI projection, not content deletion or authorization. The full catalog, downloaded packs, question IDs, answers, favorites, resume and sync stay intact. In particular, never feed a filtered catalog into boot's downloaded-pack pruning.
- Do not add polling, network requests, dependencies or persistent settings.

## Evidence and gates

Keep every existing assertion and approved screenshot hash. Existing multi-specialty fixture journeys explicitly exercise the all-enabled configuration for future compatibility; add separate real default-configuration browser tests proving Surgery-only discovery, hidden-title search, alias handling, future activation, unknown-specialty fallback, offline relaunch and preservation of stored hidden-book progress. Include phone/iPad light/dark screenshots and geometry checks.

Run Content Contract and Visual/Flow CI on the exact head. Inspect evidence before merging. Deploy through the existing staged Worker-version smoke/promotion workflow, then verify production build and public visibility. Record exact results and any limitations in the PR; do not claim unfinished work is online.
