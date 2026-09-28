# NIGHT 1 report — 2026-09-28

## Done / merged

- PR #12 — security audit, safe HTTP diagnostics, secret-source scan, and `docs/ROTATE_SECRETS.md`.
- PR #13 — M3 automated queue/admin acceptance and failed-upload recovery fixes.
- PR #14 — compact Telegram CloudStorage personal sync with two-device merge rules.
- PR #15 — pinned `ts-fsrs 5.4.2` Review Due sessions, offline-capable.
- PR #16 — invisible chapter downloads, next-chapter prefetch, whole-book offline save.
- PR #17 — Me build/source info, offline banner, iPad fullscreen diagnostic.
- PR #18 — offline app shell/service-worker policy with safe iOS/Telegram fallback.
- PR #19 — privacy/About and once-only educational-use disclaimer.
- PR #21 — reusable `tools/parsers/`, `tools/package_batch.py`, parser delivery in MASTER_PROMPT, content-team guide, and confirmed bulk audit-warning approval.
- PR #22 — refreshed HANDOFF/PROGRESS plus `docs/ADMIN.md` with the full owner publish/recovery guide.

Every merged code task had green CI before merge. The latest runtime change, PR #21, deployed green in Deploy Kafu run 36387183574, including the exact-build, Mini App, and protected `KAFU-UPLOAD-TEST` read-only guard. PR #22 changed docs/tests only; its post-merge CI is green.

## Left open / skipped

- **PR #20 — Weekly Kafu D1 Backup:** still open in GitHub. Its CI is green, but it was intentionally not self-merged because it adds a scheduled production D1 export. No production D1 backup run has happened from this PR yet.
- **Credential rotation:** not performed because it requires owner actions in GitHub, Cloudflare and BotFather. Earlier exposed setup credentials should still be rotated.
- **New-feature phone results:** the initial message contained placeholders, then the owner selected **“All passed”** on 2026-09-28. This is an overall owner report without individual check details or new screenshots. No specific phone failure was reported to fix first.
- Prior phone proof did pass the protected upload book path: `/queue` published, `/books` listed it, the book opened in the Mini App, question types/feedback worked, and images rendered.

## Phone test list

Do these in order on your phone:

1. Open Kafu → confirm Home loads and `KAFU-UPLOAD-TEST` is still present.
2. Open its chapter → answer SBA, true/false, multi-select and EMQ; confirm feedback/explanations/images.
3. Home → check **Review Due** count. Finish one due card with Again/Hard/Good/Easy, close/reopen, and confirm the state remains.
4. Open a chapter on Wi-Fi → immediately start studying while images finish in background. Go back and confirm the next chapter, if present, was prefetched.
5. Use **Save whole book for offline** → confirm size/progress and **Available offline ✓**. Turn on Airplane Mode and reopen the saved chapter.
6. Star a question, answer some questions, create a mistake/review state, then reopen Kafu on your second Telegram device. Confirm compact personal progress merges instead of replacing newer activity.
7. Go offline → confirm the banner says **Offline — your downloaded chapters still work** and saved content still opens.
8. Me → confirm app version/commit and catalog source are shown.
9. Me → Privacy/About → confirm the educational-use notice is present; first-use acknowledgement should not repeatedly block the same local account/device.
10. Bot → `/flags approve-all BOOK-ID` should only preview a count. Do **not** send CONFIRM on a real book until you intentionally want all pending warnings approved.

### iPad fullscreen test

1. Telegram on iPad → open Kafu.
2. Me → **Try full screen**.
3. Record Telegram version, platform, `isFullscreen`, and the displayed request result/error.
4. Rotate portrait/landscape and confirm the app remains usable.
5. Leave/reopen Kafu and confirm normal launch still works even if fullscreen is unsupported.

## Human steps

### Rotate exposed credentials

Follow `docs/ROTATE_SECRETS.md`. Short order:

1. Wait for publishing to finish; temporarily disable **Drain Kafu Publish Queue**.
2. Replace the **Cloudflare API token** in GitHub.
3. Replace **DISPATCH_TOKEN** with a repo-scoped Actions token.
4. Generate and save a new **QUEUE_API_TOKEN**.
5. Generate and save a new **WEBHOOK_SECRET**.
6. Revoke/regenerate the Telegram **BOT_TOKEN** last and save it in GitHub.
7. GitHub Actions → **Deploy Kafu → Run workflow → main**; wait for green.
8. GitHub Actions → **Setup Kafu Bot → Run workflow → main**; wait for green.
9. Telegram → send `/status` and `/books`; open the Mini App.
10. Re-enable **Drain Kafu Publish Queue**, start one new run, verify green, then revoke superseded Cloudflare/GitHub tokens.

Never paste any replacement token into chat.

### Decide on PR #20 backup

1. Open PR #20 and review it.
2. If you want weekly backups, merge it.
3. GitHub → Actions → **Weekly Kafu D1 Backup → Run workflow → main → Run workflow** during an off-peak period.
4. Wait for green.
5. Repository → Releases → **Private Kafu D1 backups** → confirm one timestamped `.sql.gz` and matching JSON manifest.
6. If the workflow reports a Cloudflare permission error, stop; do not broaden or change permissions casually.

## Free-tier estimate

This is an estimate from architecture/workflow activity, not provider billing telemetry.

- Cloudflare Workers dynamic traffic tonight was admin/test scale, plausibly well under 1% of the 100,000 requests/day free guardrail in the project plan.
- D1 queue/moderation test traffic was tiny relative to 5,000,000 rows read/day and 100,000 rows written/day; no normal student answer path writes D1.
- Static content remains far below the 20,000-files-per-Worker-version guardrail for the current tiny test catalog.
- GitHub Actions used many short CI/deploy runs during development; exact remaining included minutes are account-specific and were not available here. Normal operation is much lighter: publishing only when you upload books, plus the proposed weekly backup if PR #20 is activated.

## Before the first real book / 20–50 student pilot

1. Rotate the previously exposed credentials.
2. Decide whether to activate PR #20 and verify the first backup if enabled.
3. Add/commit a parser for the real book layout and run `tools/package_batch.py` until audit + both validators pass.
4. Manually spot-check at least 15 questions against the PDF, including answers and figures.
5. Publish the real ZIP through the owner bot; verify `/queue`, `/books`, Mini App study, images and offline save.
6. Review all held/audit warnings; bulk-approve only after checking the preview count.
7. Run the phone/iPad tests above, including two-device sync and Airplane Mode.
8. Invite 20–50 students only after those checks pass; watch reports, queue failures and free-tier usage before wider rollout.
