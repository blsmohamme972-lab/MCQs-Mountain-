# DNAgens — Kafu review board

Permanent, evidence-led critique, assessment and idea bank. Review agents edit **only `DNAgens/`**. This board does not implement app changes, approve content rights, or speak for the owner. Each pass reads the current handoff, plan, docs, source, tests, workflows and prior passes; runs feasible local checks; distinguishes code, simulation and phone evidence; and submits a branch and pull request. The assessment describes the reviewed commit, not a timeless truth.

## Constitution — only the owner may change this section

- $0/month for the owner and free for students. No question is ever locked behind payment.
- No ads during study, no data selling, no pharma-sponsored questions, no pay-to-win leaderboards.
- Never break saved student progress. Data-format changes are additive-only and need owner approval.
- Only rights-cleared content and original art; no copied characters, logos or assets.
- Healthy habit loops only: no guilt-trip streaks, spam notifications or fake urgency.
- English-only app. Branches and pull requests only; CI green; never print secrets.

## Scoring rubric

Score each area from **1 to 10** against a working product, not an attractive roadmap. 1–2 = absent or actively harmful; 3–4 = prototype with serious holes; 5–6 = functional but materially behind the benchmark; 7–8 = strong, evidenced on representative content/devices; 9–10 = exceptional, demonstrated with actual learners and production-scale reliability. Untested promises cannot score 7+. Overall score is the unweighted mean of the 16 named areas, rounded to one decimal; it is a diagnostic, not a launch certificate. Supply 3–5 hard criticisms per area, a path/line or measured evidence for each, and the relevant world-best bar. Do not call a missing test a proven defect.

## Pass rules for future agents

1. Stop if the constitution is changed without explicit owner direction. Read `HANDOFF.md` if present, `PROGRESS.md`, `MCQ_PLATFORM_FINAL_PLAN.yaml`, `BUILD_PROMPT.md` if present, `docs/`, `docs/reports/`, source, tests and workflows before rating; identify absent/stale sources.
2. Seven seats independently challenge the work: staff engineer, principal product designer, learning scientist, Iraqi medical educator, retention lead, cost guardian and devil's advocate. Be specific and severe. Cite evidence in every criticism. Benchmarks must state the exact superior behavior and its source, while preserving Kafu's combination of free access, offline-first delivery, Telegram context and Iraqi exam relevance as a hypothesis to prove.
3. Run build, tests and an app flow where the environment permits. Log commands, counts, failures and limitations. Simulation is not a physical Telegram reinstall or student outcome study. Never paste secrets, tokens, private student data or proprietary book text.
4. `IDEAS.md`: only ideas passing all three gates; exact template; 25–40 strong proposals when evidence supports them; sort descending by Impact × Confidence × Effort, where Effort 5 is easiest. Acceptance tests must be falsifiable and preserve progress. The strongest objection and rebuttal are mandatory. Record nonpassing proposals in `REJECTED.md` to avoid recycling them.
5. Status is proposed until owner acceptance. `🔒 locked` is owner-only. `done` requires code and behavioral proof. Each pass increments the pass number and revision, updates the current assessment and changelog, and lists owner decisions separately. Do not implement ideas in this board pass.
6. Branch and PR; never commit to main. Before PR, run `git diff --name-only origin/main` and reject any path outside `DNAgens/`. A docs-only PR may be excluded by path-filtered CI; report that honestly rather than claiming green checks that did not run.

## Pass 001 evidence boundary

Reviewed main at `22afa6a416c6d8eca91fbf7a8ab5b69eb1b00921` on 2026-09-28 UTC. `BUILD_PROMPT.md` is absent; `tools/MASTER_PROMPT.md` is the packaging instruction present. The local browser automation could not run because Chromium download failed; source/tests and existing CI/phone reports are cited with their own dates. `DNAgens/CHANGELOG.md` records the exact local checks.
