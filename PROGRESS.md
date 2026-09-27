# Kafu — PROGRESS

Last updated: 2026-09-27

## Current milestone

**M2 — Step 1: Connect the app to published content**

Status: **DONE on branch; CI green; waiting for owner merge**

Branch:
`m2-connect-published-content`

Pull request:
https://github.com/blsmohamme972-lab/MCQs-Mountain-/pull/1

## Done

- Kafu app is live on Cloudflare Workers.
- Kafu content Worker is live.
- Final two-Worker architecture is saved in `MCQ_PLATFORM_FINAL_PLAN.yaml`.
- `validate.py`, `audit.py`, `validate_release.py`, and `publish.py` exist.
- Publishing tools CI is green.
- App now reads published catalog from `kafu-content-1`.
- Samples are fallback-only.
- Publisher output and app input contracts are tested together.
- Published chapter image ZIPs are unzipped with fflate and stored in IndexedDB.
- Question and explanation images render from local IndexedDB while offline.
- Published covers are understood by the app.
- Deep links resolve permanent question IDs through static route shards.
- Step 1 PR CI is green.

## Next

After the owner merges PR #1, start **M2 — Step 2: fixture proof** on a new milestone branch.

Step 2 must create and publish:
1. a fixture with SBA + MTF + multi + EMQ + images,
2. a multipart fixture,
3. a deliberately broken package.

Then prove:
- fixture appears in Kafu,
- full offline study with images,
- v2 keeps permanent IDs/student progress,
- broken ZIP produces clear repair_report.md,
- duplicate ZIP is detected,
- rollback works,
- /remove/takedown works and local copies are deleted.

Do **not** build the bot upload layer until Step 2 is complete and reported.

## Open questions

None for Step 1.

## Architecture decisions changed

- Deep-link lookup uses static route shards (`/routes/Qxxxxxx.json`) rather than embedding every question ID into one global catalog. This keeps deep links static, cheap, and scalable.
- Chapter metadata still includes `qids` for compatibility/testing, but production deep-link resolution uses route shards.
