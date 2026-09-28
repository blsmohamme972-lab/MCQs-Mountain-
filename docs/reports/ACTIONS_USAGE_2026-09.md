# Actions usage and backup activation — September 2026

Recorded 2026-09-28 (UTC). Repository: private `blsmohamme972-lab/MCQs-Mountain-`.

## Backup activation

- PR #20 was updated from main with its `PROGRESS.md` conflict resolved, while retaining the backup workflow, script, tests and guide.
- Pull request CI run #94 (`36388853880`) and merge-commit CI run #95 (`36389032019`) passed.
- PR #20 merged as commit `18d7ca4776efee587ed7d32fbb9b0e27f6e6d887`.
- First manual `Weekly Kafu D1 Backup` run #1 (`36389139180`) passed on main.
- Private `d1-backups` release has a complete, uploaded pair: `kafu-d1-20260928T065829Z-36389139180.sql.gz` (1,113 bytes) and `kafu-d1-20260928T065829Z-36389139180.json` (429 bytes). The workflow verifies restore and uploaded checksums. No SQL content or secrets are included here.

## Actions minutes

GitHub's repository **Actions Usage Metrics** showed **148 total minutes** for the current month, 2026-09-01 through its 2026-09-28 06:39 UTC data cutoff. It showed 145 job runs. The breakdown was:

| Workflow | Minutes | Runs |
| --- | ---: | ---: |
| Kafu Content Contract CI | 93 | 93 |
| Deploy Kafu | 28 | 28 |
| Drain Kafu Publish Queue | 17 | 17 |
| Publish Kafu Book | 11 | 8 |
| Deploy Kafu Content | 3 | 3 |
| Setup Kafu Bot | 1 | 1 |

The row totals can differ from the displayed overall total because GitHub's metrics aggregate and round individual workflow figures. The dashboard lags recent runs, including the first backup. This is repository usage, not the account's billing balance.

## CI minute reduction

`ci-tools.yml` now triggers only for pull requests and pushes to `main`. It removes the legacy `m3-bot-upload-queue` push trigger. Existing positive path filters omit documentation-only changes, including `docs/**` and root Markdown files. Workflow changes and code/tool changes still run the tests. A concurrency group keyed by pull request number or branch ref cancels older in-progress runs of this workflow for the same PR or main. No tests were removed and `tools/validate.py` was untouched.

Source: GitHub repository Actions Usage Metrics (current month), PR #20, workflow runs and private release metadata.