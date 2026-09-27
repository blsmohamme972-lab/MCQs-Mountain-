# M2 — Step 2 Report: Fixture Proof

Status: **AUTOMATED PROOF PASSED — phone/Telegram offline check pending before merge**

## Library safety first

Kafu must never show a blank Library.

The Step 2 branch now enforces this rule:

1. If the published catalog is reachable and contains one or more books, show the published catalog.
2. If the live catalog is empty, do **not** show an empty Library; show the built-in sample catalog.
3. If the live catalog fails, use a cached published catalog only if it contains books.
4. If there is no usable published catalog, show the built-in samples.

This behavior is locked by CI.

## Synthetic fixtures

The repository generates fixtures at runtime; ZIP binaries are not committed to Git.

Generated packages:

- `KAFU-FIXTURE-ALLTYPES_v1.zip`
  - SBA
  - MTF
  - multi-select
  - EMQ
  - question image
  - explanation image
  - cover
- `KAFU-FIXTURE-ALLTYPES_v2.zip`
  - same logical questions
  - one edited stem to prove stable permanent IDs
- `KAFU-FIXTURE-MULTIPART_v1_part1of2.zip`
- `KAFU-FIXTURE-MULTIPART_v1_part2of2.zip`
- `KAFU-FIXTURE-BROKEN_v1.zip`
  - deliberately invalid
  - must fail validation

All fixture text is synthetic Kafu test content.

## Automated proof results

GitHub Actions workflow: **Publish Kafu Book**

Successful proof run:
https://github.com/blsmohamme972-lab/MCQs-Mountain-/actions/runs/36343339056

### Package validation

- all-types v1: PASS
- all-types v2: PASS
- multipart part 1: PASS
- multipart part 2: PASS
- combined multipart release: PASS

### Images / offline package contract

PASS:
- publisher generated chapter JSON
- publisher generated chapter image ZIP
- question image was renamed to the permanent question ID
- explanation image was renamed to the permanent question ID
- app contract supports fflate extraction
- image blobs persist in IndexedDB
- app reconstructs image object URLs from IndexedDB after restart
- deleting a chapter also deletes its image blobs

### Broken package

PASS:
- broken package failed validation
- workflow created `repair_report.md`
- report was uploaded as GitHub Actions artifact:
  `broken-fixture-repair-report`
- artifact ID: `10940205469`

### Duplicate package

PASS:
- the same exact ZIP SHA-256 was recorded
- second check returned duplicate
- no second publish is required

### v2 stable IDs and student progress

PASS:
- v1 allocated permanent IDs
- v2 changed one stem
- publisher reported 3 kept + 1 edited + 0 new + 0 retired
- all four permanent IDs remained identical
- simulated answer/favorite/resume state remained attached to the same question IDs

### Multipart publishing

PASS:
- two ZIP parts validated individually
- release validator accepted the complete two-part release
- publisher combined it into one 4-question book

### Live Cloudflare proof

PASS:
- fixture v1 deployed and live catalog reported version 1
- fixture v2 + multipart deployed and live catalog reported version 2 + multipart book
- rollback redeployed the v1 snapshot and live catalog returned version 1
- takedown removed `KAFU-FIXTURE-ALLTYPES` from `books` and added it to `removed_books`
- final production content was restored to:
  - `KAFU-FIXTURE-ALLTYPES` v2
  - `KAFU-FIXTURE-MULTIPART` v1

Cloudflare propagation is explicitly polled instead of assuming the first request sees the new static version.

## Takedown behavior on student devices

The app already checks `catalog.removed_books` and missing catalog books at boot. Any downloaded chapter belonging to a removed book is deleted from IndexedDB the next time the student comes online and loads the new catalog.

Important limitation: an already-offline device cannot learn about a takedown until it next reconnects. This is expected and documented.

## Manual phone proof still required

Automation cannot operate the owner's Telegram client, so one real-device check remains before Step 2 is marked fully DONE.

On the phone:

1. Open Telegram.
2. Open **@KafuMcqsbot**.
3. Tap **Open Kafu**.
4. Open **Library → Cardiology**.
5. Open **Kafu Fixture: All Question Types**.
6. Download **Fixture Chapter**.
7. Open the chapter and confirm:
   - SBA renders
   - MTF renders
   - multi-select renders
   - EMQ renders
   - question image appears on question 1
   - explanation image appears after checking question 4
8. Answer at least one question.
9. Close Kafu completely.
10. Turn on Airplane Mode.
11. Reopen Kafu from Telegram.
12. Open the already-downloaded fixture chapter.
13. Confirm all four questions and both images still work.
14. Confirm the answer/progress you made before Airplane Mode is still present.

After this passes, Step 2 can be marked DONE and merged.

## Human setup

No new secret, Cloudflare token, BotFather action, or Telegram token is required for Step 2.

## Git status

- milestone branch: `m2-fixture-tests`
- CI: green
- fixture publishing proof: green
- production content worker currently contains the final synthetic fixtures for phone testing
- do not publish a real book yet
