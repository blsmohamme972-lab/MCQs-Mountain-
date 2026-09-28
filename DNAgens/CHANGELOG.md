# DNAgens pass log

## Owner decisions — 2026-09-28 (Baghdad)

- **Report sending approved for a future implementation PR:** send only question ID, book ID and version, reason, and an optional note of at most 300 characters. Store reports in D1. Telegram user ID is for rate limiting only; do not retain it in the report record. Queue offline on the device with the truthful status “Saved — will send when online”; delete local queued data once the server acknowledges it and delete server data once resolved. Owner reads reports with a bot command. Update `docs/PRIVACY.md` in the behavior PR, with tests and production smoke.
- **Image descriptions:** describe only what is visible. Never include the diagnosis, correct option, or another answer-revealing clue. Human medical review is required before publication.
- **Personal-data formats:** approval is case by case. Changes must be additive, compatible with old versions, and prove upgrade and rollback in the implementation PR. This decision does not approve a specific migration.
- **Brand:** the next DNAgens critique pass proposes three written original brand directions. The owner chooses one before implementation.
- **Exam blueprint:** the owner reviews MRCS personally. Iraqi Board mapping follows later; no readiness claim is authorized now.
- **Locked priorities:** DNA-001 truthful report wording, DNA-002 same-phone A→B→A plus reinstall proof, DNA-003 visible sync status. Only the owner changes their scope or locked status. Implementation remains subject to each PR's tests and the constitution.

This entry records decisions, not completed app work. No privacy page, app behavior, progress format or production state changes in this PR.

## 2026-09-28 UTC — pass 001, founding review

- Reviewed main `22afa6a416c6d8eca91fbf7a8ab5b69eb1b00921`: `HANDOFF.md`, `PROGRESS.md`, `MCQ_PLATFORM_FINAL_PLAN.yaml`, all `docs/` and `docs/reports/`, app, Workers, content tools, tests and GitHub workflows. `BUILD_PROMPT.md` does not exist; reviewed `tools/MASTER_PROMPT.md` as the present parser/packaging instruction. Existing documents disagree about recent PR/backup state; source/tests and dated reports were distinguished from aspirations.
- Local checks: `python tools/vendor_frontend.py` fetched hash-pinned ignored assets; `python -m unittest discover -s tools/tests -p 'test_*.py'` passed **44/44** in 7.727s; `node --test tools/tests/js/*.test.cjs worker/bot.test.mjs` passed **82/82** in 1.24s; `python tools/build_frontend.py --out /tmp/kafu-local-app` passed and produced **317,054-byte** HTML. Local `http.server` served HTML and service worker with HTTP 200. One deliberately wrong vendor filename in the smoke probe returned 404; actual built vendor assets were present. Playwright Python package installed, but Chromium browser download failed with gateway error, so local visual/Telegram flows were **not run**. No new phone screenshots, account-switch proof or first-open 4G latency were collected.
- Created constitution/rubric, 16-area assessment (**5.6/10**), 30 sorted gate-passing ideas and rejected list. No app, tests, workflow, content release or student data changed.
- Top five by score: DNA-001 truthful report capture (125); DNA-002 same-phone A→B→A and reinstall proof (100); DNA-003 visible sync state (100); DNA-004 meaningful medical image alt (80); DNA-011 offline readiness drill (80). Ties retain stable ID order.
- Decisions needing owner: approve any additive personal-data schema or sync change; provide rights and medical review authority for the first real book; choose whether any original non-character/character brand work is wanted under adult-tone policy; approve a minimal report transmission/privacy policy before implementation; approve a dated Iraqi exam blueprint and its clinical reviewer. The board can test and propose, not decide these.
- PR scope check required immediately before opening: `git diff --name-only origin/main`; every output path must begin `DNAgens/`. Docs-only workflows are path-filtered; no new green CI result should be claimed if no checks start.
