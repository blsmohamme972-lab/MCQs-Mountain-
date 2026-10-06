# Kafu MotionCards handoff

> **SEPARATION WARNING:** Kafu MotionCards is a new independent system. Do not modify, import, copy, rebrand, or depend on `Animations and illustrations/`, Medical Motion, DNAgens, or their runtime code.

STATUS: INCOMPLETE - SAFE TO CONTINUE

## Repository state
- Branch: `feature/kafu-motioncards`
- Baseline/main inspected: `00f09cf42bbc021053ef95355bdad6b12f75e7b0`
- Objective: build an independent AI-authored, question-linked animation pipeline from exported Kafu MCQ JSON through validation/package/upload/publish/player integration.
- Merge/deploy/service creation/migrations: **NOT AUTHORIZED YET for this project**. Keep PR open for owner review.

## Ownership map

### New MotionCards-owned paths
- `motioncards/**`
- planned `app/modules/motioncards-*.js`, `app/modules/motioncards-*.css`
- planned `motioncards-worker/**` or equivalent dedicated static-content config
- planned `tools/motioncards/**`
- planned MotionCards-specific tests/workflows/migrations using the `motioncards_` prefix

### Shared integration files (minimal changes only)
- `app/modules/manifest.json`
- `app/design/study.js` only if a small explicit post-render hook is required
- `worker/bot.mjs`, `worker/queue-state.mjs`
- additive migration files
- `.github/workflows/ci-tools.yml`, `.github/workflows/ui.yml`
- dedicated MotionCards publish workflow and app config/binding only after owner approval for infrastructure/deploy

### Protected legacy / unrelated files
- `Animations and illustrations/**` — Medical Motion legacy library; do not touch or import.
- DNAgens and unrelated projects.
- Existing book publisher/content state and `kafu-content-state` release assets.
- Protected `KAFU-UPLOAD-TEST` book.
- Existing export, download, sync, leaderboard, grading and authorization behavior except narrowly tested compatibility fixes.

## Inspection findings
- Latest main equals baseline `00f09cf42bbc021053ef95355bdad6b12f75e7b0`.
- No existing MotionCards branch/handoff found; only legacy `codex/medical-motion-v2`.
- Final study decoration is installed by `app/design/study.js` after the base `VIEWS.study` renderer.
- Base `render()` replaces `#app.innerHTML`; MotionCards playback must live in a stable host outside `#app` so background renders do not restart it.
- Current app Worker keeps `CONTENT_SERVICE -> kafu-content-1`; this must remain intact.
- Book Telegram intake currently routes every document through `queueDocument()` and the book filename grammar; MotionCards needs a small explicit filename router before that parser and isolated queue tables/contracts.

## Milestone 1 work
- Branch + durable handoff created.
- Next: implement authoritative schema/limits, export adapter with chapter-scope mismatch regression, hash/answer extraction, scaffold/validate/package CLI and isolated fixtures.

## Exact next action
Create `motioncards/schema/`, `motioncards/lib/`, and `tools/motioncards/` with the export compatibility adapter and package contract, then add tests proving the 30-record chapter export mislabeled as whole-book is adapted without inventing the missing 179 records.

## Test status
- Not run yet on this branch.

## Production status
- No production mutation performed.
