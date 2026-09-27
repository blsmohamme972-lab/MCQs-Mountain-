# M2 — Step 1 Report: Connect Kafu to Published Content

Status: **DONE — CI green, waiting for owner merge**

## 1. What was built

- Set the Mini App content origin to:
  - `https://kafu-content-1.blsmohamme97.workers.dev`
- Kept the built-in sample books only as the last-resort offline fallback when neither the live catalog nor a cached published catalog is available.
- Aligned `publish.py` output with what `app/index.html` consumes:
  - catalog fields and specialties
  - book metadata
  - chapter question counts
  - chapter URLs
  - image ZIP URLs
  - stable question IDs
  - source pages
  - question and explanation image names
- Added scalable deep-link routing:
  - `startapp=Q#########`
  - static route shards such as `/routes/Q000000.json`
  - one route request finds the exact book/chapter instead of scanning/downloading every book
- Added chapter image ZIP support:
  - image ZIP downloaded only when the chapter is downloaded
  - `fflate@0.8.3` unzips the archive
  - WebP blobs are stored in IndexedDB
  - object URLs are rebuilt from IndexedDB after app restart
  - question images and explanation images work without network after download
  - deleting a chapter also deletes its stored image blobs
- Upgraded IndexedDB from v1 to v2 with an `images` object store while preserving existing `packs` and `meta` stores.
- Published book covers are now used when `cover_url` exists.
- Added short-cache headers for deep-link route shards.
- Added app↔publisher contract tests, including image ZIP output and deep-link route output.
- Added Mini App JavaScript syntax checking to CI.

## 2. How to test on the phone after merging

1. Open the GitHub app.
2. Open repository **MCQs-Mountain-**.
3. Open **Pull requests**.
4. Open PR **#1 — M2 Step 1: connect Kafu to published content**.
5. Confirm the checks show green.
6. Tap **Merge pull request** → **Confirm merge**.
7. Wait for both GitHub Actions to become green:
   - **Deploy Kafu**
   - **Deploy Kafu Content**
8. Open Telegram → **@KafuMcqsbot** → **Open Kafu**.
9. Until Step 2 publishes the fixture book, the live published catalog is intentionally empty. This is expected.
10. Step 2 will publish the fixture and then we will test:
    - chapter download
    - airplane-mode studying
    - question images
    - explanation images
    - deep-link opening

## 3. What is deployed and where

Current production endpoints remain:
- App: `https://kafu.blsmohamme97.workers.dev`
- Content: `https://kafu-content-1.blsmohamme97.workers.dev`

This Step 1 branch is **not merged yet**, so its app/content changes are not production traffic yet. The merge to `main` triggers deployment through GitHub Actions.

## 4. Free-tier impact

Step 1 adds no D1 writes and no per-question backend requests.

Normal behavior:
- catalog: static Cloudflare asset
- chapter JSON: static Cloudflare asset
- image ZIP: static Cloudflare asset
- deep-link route shard: static Cloudflare asset
- downloaded study: 0 network requests per question

Route sharding uses one small static JSON file per 1,000 permanent question IDs, keeping lookup scalable without a dynamic API.

## 5. Human steps needed now

No new secret, token, Cloudflare setting, or BotFather setting is needed for Step 1.

Only merge the pull request after reviewing the green check:

1. GitHub app → **MCQs-Mountain-**
2. **Pull requests**
3. PR **#1**
4. Verify checks are green
5. **Merge pull request**
6. **Confirm merge**

Then wait for the automatic deploy Actions to finish.

## 6. Known issues / decisions

- The live published catalog is empty until Step 2 publishes the fixture; therefore the Library will be empty while online after Step 1 is deployed. This is intentional because built-in samples are now fallback-only.
- `fflate` is loaded only when an image ZIP actually needs to be unpacked. Once images are stored in IndexedDB, reopening/studying the downloaded chapter offline does not depend on fflate or the network.
- Full fixture proof, version-2 ID preservation, broken-package repair reporting, duplicate detection, rollback and remove are intentionally deferred to **Step 2**, per the requested order.
- Bot upload automation is intentionally deferred to **Step 3**.

## 7. GitHub proof

- Branch: `m2-connect-published-content`
- Pull request: https://github.com/blsmohamme972-lab/MCQs-Mountain-/pull/1
- Green PR CI: https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36342582360
- Green branch CI: https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36342575220
