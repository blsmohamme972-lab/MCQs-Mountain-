# Candidate ideas — pass 001

Only gate-passing, buildable proposals. IDs are stable identifiers, not rank. Sorted by Impact × Confidence × Effort (5 = easiest); ties retain ID order. All are proposed, not implementation authorizations. Each data-format addition still needs owner approval before an app PR. Evidence paths refer to the assessed main commit.

### DNA-001 Truthful report capture
- Status: 🔒 locked (owner only)
- Area: Security & privacy
- Problem (with evidence): `app/index.html:1112,1138` says Send report but queues locally.
- Idea (concrete, buildable on the current stack): Rename the action Save report on this device and say it is not sent; show export/copy option without extra account data.
- Why students will come back for it: A learner can trust correction status and return to fix a flagged item.
- Acceptance test (how we prove it works): Offline tap shows local-only status; relaunch retains report; no network claim.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 5/5 · Effort 5/5 (5 = easiest) → Total = 125
- Devil's advocate: This might reduce reporting. Answer: misleading medical reporting is worse; measure completion after honest copy.
- Revision: v1 (pass-001)

### DNA-002 Same-phone account isolation and reinstall proof
- Status: 🔒 locked (owner only)
- Area: Security & privacy
- Problem (with evidence): `sync-bridge.js:8-18` scopes state, but `sync-bridge.test.cjs:44-49` only tests A→B; `05_new_device.py:1-82` simulates reinstall.
- Idea (concrete, buildable on the current stack): Test two actual Telegram accounts sharing one phone: A answers, stars, schedules, resumes, earns badges; B is clean; return A intact. Reinstall Telegram and restore same A from CloudStorage, checking compact state and documenting device-only event history. Fix only verified leaks with additive formats and owner approval.
- Why students will come back for it: Students can safely share a phone or switch accounts without losing trust.
- Acceptance test (how we prove it works): Signed-off Android and iOS A→B→A + uninstall/reinstall checklist, screenshots with anonymized values; packs may be shared, personal states not.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 5/5 · Effort 4/5 (5 = easiest) → Total = 100
- Devil's advocate: Telegram may isolate WebViews itself. Answer: then prove it on the target hosts; unit mocks do not establish that.
- Revision: v1 (pass-001)

### DNA-003 Visible sync-before-exit state
- Status: 🔒 locked (owner only)
- Area: Speed & offline
- Problem (with evidence): `sync-bridge.js:62-76` coalesces up to 30s and boot pull races after 2s; `docs/PERSONAL_SYNC.md` notes compact backup.
- Idea (concrete, buildable on the current stack): Put a nonblocking Last synced/pending indicator near Me and an explicit Sync now after a session, using existing status; never imply full event-history backup.
- Why students will come back for it: Reliable continuation across devices encourages short sessions.
- Acceptance test (how we prove it works): Throttle network in host; study, exit under 30s, return and observe pending or confirmed sync; no false success text.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 4/5 · Effort 5/5 (5 = easiest) → Total = 100
- Devil's advocate: A persistent status adds clutter. Answer: keep compact and only escalate pending/errors.
- Revision: v1 (pass-001)

### DNA-004 Question image accessibility gate
- Status: proposed
- Area: Accessibility
- Problem (with evidence): `app/index.html:947-955` outputs generic Question image alt for every medical diagram.
- Idea (concrete, buildable on the current stack): Add optional rights-cleared figure description metadata in package validation and render it as alt; make image-dependent questions nonpublishable without human-reviewed description.
- Why students will come back for it: Students using assistive tech can answer and revisit visual questions.
- Acceptance test (how we prove it works): A labeled ECG fixture announces diagnostic features with screen reader; absent required alt fails prepublish validation, existing packs keep working.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 4/5 · Effort 4/5 (5 = easiest) → Total = 80
- Devil's advocate: Descriptions can reveal answers. Answer: medical educator reviews clue leakage and offers an accessible equivalent.
- Revision: v1 (pass-001)

### DNA-011 Offline readiness drill
- Status: proposed
- Area: Speed & offline
- Problem (with evidence): `docs/OFFLINE_SHELL.md` states Telegram iOS cold launch may fail; `download-core.js:43-68` needs images.
- Idea (concrete, buildable on the current stack): On save completion show a short testable offline readiness card: chapter/text/images ready, shell status, what may fail in this Telegram host.
- Why students will come back for it: Students trust the commute workflow and come back despite connectivity.
- Acceptance test (how we prove it works): On Android/iOS, toggle airplane mode and reopen; messaging predicts result; missing image never marked ready.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 5/5 · Effort 4/5 (5 = easiest) → Total = 80
- Devil's advocate: A warning may scare users. Answer: specific capability status avoids the larger surprise of a failed launch.
- Revision: v1 (pass-001)

### DNA-012 Due queue availability breakdown
- Status: proposed
- Area: Ease of use
- Problem (with evidence): `review-bridge.js:18-32` shows available count but fetches missing chapters serially.
- Idea (concrete, buildable on the current stack): Show due total, downloaded count and explicit Save needed chapters action with progress before starting.
- Why students will come back for it: A clear five-minute review target lowers friction.
- Acceptance test (how we prove it works): Mixed cached/missing fixture shows accurate counts, offline action and no silent omission.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 5/5 · Effort 4/5 (5 = easiest) → Total = 80
- Devil's advocate: More UI on Home is clutter. Answer: detail belongs in due sheet, not dashboard.
- Revision: v1 (pass-001)

### DNA-014 Low-end phone performance budget
- Status: proposed
- Area: Speed & offline
- Problem (with evidence): `docs/reports/DAY_1_TASK6.md` measures next-question CI timing but no physical cold 4G; build HTML is 317,054 bytes.
- Idea (concrete, buildable on the current stack): Instrument repeatable first-open and next-question timings on one low-end Android in Telegram, with a 3s cold target and regression log in reports.
- Why students will come back for it: Fast opening makes a small daily task practical.
- Acceptance test (how we prove it works): Ten cold 4G and warm offline runs, median/p95 recorded; fail future major regressions before adding effects.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 5/5 · Effort 4/5 (5 = easiest) → Total = 80
- Devil's advocate: Device/network variance confounds results. Answer: pin device, host version and protocol; compare matched runs.
- Revision: v1 (pass-001)

### DNA-015 Dark and enlarged text audit
- Status: proposed
- Area: Accessibility
- Problem (with evidence): `docs/DESIGN.md:31-37` sets WCAG/200% and phone/iPad references; local Chromium screenshot run failed.
- Idea (concrete, buildable on the current stack): Review 390×844 and 820×1180 in light/dark and 200% text on device; record contrast, clipping, focus and safe-area defects as evidence.
- Why students will come back for it: Usability on real phones prevents early abandonment.
- Acceptance test (how we prove it works): Annotated screenshots and keyboard/assistive-tech notes; no horizontal scroll or obstructed answer actions.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 5/5 · Effort 4/5 (5 = easiest) → Total = 80
- Devil's advocate: Visual tests already exist. Answer: automated fixtures are not the Telegram host or enlarged real-device text.
- Revision: v1 (pass-001)

### DNA-016 Scoped recovery wording
- Status: proposed
- Area: Security & privacy
- Problem (with evidence): `docs/PRIVACY.md:5,9` says full event history is device-local and reset is not provider erasure.
- Idea (concrete, buildable on the current stack): Put precise compact-backup and reset scope in Me near sync controls; preserve unbound browser state safeguards.
- Why students will come back for it: Trust sustains a healthy habit after device changes.
- Acceptance test (how we prove it works): Fresh device retains counts/stars/review/resume; full answer log absent is stated; reset text matches provider limits.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 5/5 · Effort 4/5 (5 = easiest) → Total = 80
- Devil's advocate: Too much copy harms clarity. Answer: one sentence with expandable details.
- Revision: v1 (pass-001)

### DNA-005 Real-book launch quality gate
- Status: proposed
- Area: Content pipeline
- Problem (with evidence): `PROGRESS.md` has no first real licensed book; `tools/MASTER_PROMPT.md:13-17` preserves questionable answers as flags.
- Idea (concrete, buildable on the current stack): Require owner rights evidence, 15 random PDF-to-question checks, medical signoff of all flagged answers and one physical offline phone trial before first real release.
- Why students will come back for it: Useful, trusted Iraqi exam material is the actual retention engine.
- Acceptance test (how we prove it works): Owner-approved rights record; validator/audit pass; flagged count resolved; sampled source pages and answer keys signed off without reproducing book text in repo.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 5/5 · Effort 3/5 (5 = easiest) → Total = 75
- Devil's advocate: It delays launch. Answer: wrong or infringing medical questions cost more than a slower first release.
- Revision: v1 (pass-001)

### DNA-007 Accessible sheet focus cycle
- Status: proposed
- Area: Accessibility
- Problem (with evidence): `app/index.html:1106-1139` creates a dialog but has no evident focus trap/return; `docs/DESIGN.md:31` requires it.
- Idea (concrete, buildable on the current stack): Add reusable Escape, initial focus, trap and return behavior for sheets, no state-format change.
- Why students will come back for it: Keyboard and assistive-tech learners can complete/report a question.
- Acceptance test (how we prove it works): Tab/Shift+Tab stay in sheet, Escape closes, focus returns to Report; VoiceOver/TalkBack smoke in Telegram.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 5/5 · Effort 3/5 (5 = easiest) → Total = 75
- Devil's advocate: Host Back handling might conflict. Answer: test Back and Escape separately and preserve existing navigation.
- Revision: v1 (pass-001)

### DNA-028 Source audit parser warning repair
- Status: proposed
- Area: Content pipeline
- Problem (with evidence): `tools/MASTER_PROMPT.md:84` has literal `\n` between audit and report entries.
- Idea (concrete, buildable on the current stack): Correct packaging instruction in a future app/docs PR and add a parser fixture proving both required files; board records the bug only.
- Why students will come back for it: Reliable content supply prevents empty library and broken study sessions.
- Acceptance test (how we prove it works): Parser-produced ZIP contains audit.json and report.md and passes require-audit validator.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 3/5 · Confidence 5/5 · Effort 5/5 (5 = easiest) → Total = 75
- Devil's advocate: Validator already catches it. Answer: upstream instruction should not invite repeated correction cycles.
- Revision: v1 (pass-001)

### DNA-017 Gentle adaptive daily target
- Status: proposed
- Area: Daily habit
- Problem (with evidence): Fixed 10-minute target (`app/design/discovery.js:45-49`) has no user adjustment.
- Idea (concrete, buildable on the current stack): Allow local 2/5/10-minute display target using a new additive preference only after owner migration approval; never punish a missed day.
- Why students will come back for it: A feasible routine fits ward shifts and commutes.
- Acceptance test (how we prove it works): Set 2 minutes, close/reopen, goal reflects study time; no loss message or cross-account leak.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 4/5 · Effort 4/5 (5 = easiest) → Total = 64
- Devil's advocate: Choice overload. Answer: default 10, one edit control, no nag.
- Revision: v1 (pass-001)

### DNA-018 Study next-step by misconception
- Status: proposed
- Area: Daily habit
- Problem (with evidence): `app/design/study.js:17-27` completion offers mistakes but no specific due topic.
- Idea (concrete, buildable on the current stack): After a session, show one optional next weak/due topic available offline, derived locally; leave Browse chapters available.
- Why students will come back for it: The next visit has a meaningful ready task.
- Acceptance test (how we prove it works): Controlled fixture recommends an available weak topic; offline missing items are not called ready.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 4/5 · Effort 4/5 (5 = easiest) → Total = 64
- Devil's advocate: Suggestion may be pedagogically wrong. Answer: label it as a suggestion and expose basis.
- Revision: v1 (pass-001)

### DNA-019 Topic and chapter discovery
- Status: proposed
- Area: Ease of use
- Problem (with evidence): Library filter only handles title and specialty (`app/design/discovery.js:19-35`).
- Idea (concrete, buildable on the current stack): Index catalog chapter titles and topic tags locally; search results show book/chapter and offline status without fetching all packs.
- Why students will come back for it: Students find a target from lectures quickly.
- Acceptance test (how we prove it works): Search fixture matches chapter/topic, respects casing, clears filters and opens correct source.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 4/5 · Effort 4/5 (5 = easiest) → Total = 64
- Devil's advocate: Catalog size may slow search. Answer: index once and measure on low-end phone.
- Revision: v1 (pass-001)

### DNA-020 No-shame streak wording
- Status: proposed
- Area: Daily habit
- Problem (with evidence): `app/design/delight.js:19-34` displays continuous-day streak; `docs/DESIGN.md:9` forbids lost-streak warnings.
- Idea (concrete, buildable on the current stack): A/B test a neutral active-days summary and optional streak display, never a missed-day push or guilt copy.
- Why students will come back for it: Students may return for learning without avoiding the app after a gap.
- Acceptance test (how we prove it works): After 7-day gap, UI offers due review with no loss warning; opt-out survives account changes without shared state.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 4/5 · Effort 4/5 (5 = easiest) → Total = 64
- Devil's advocate: Streak can motivate. Answer: keep optional and measure retention and self-reported pressure.
- Revision: v1 (pass-001)

### DNA-006 Review reason after a lucky correct answer
- Status: proposed
- Area: Learning effectiveness
- Problem (with evidence): `review-bridge.js:12-16` sends every ordinary correct response to Good.
- Idea (concrete, buildable on the current stack): Offer a quick optional Uncertain rating after feedback; map it to conservative FSRS scheduling only with owner-approved additive state handling.
- Why students will come back for it: Students return to material they guessed rather than falsely mark it mastered.
- Acceptance test (how we prove it works): For fixed cards, uncertain-correct review is no later than confident-correct; older schedules remain valid; completion rate monitored.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 4/5 · Effort 3/5 (5 = easiest) → Total = 60
- Devil's advocate: Extra tap harms flow. Answer: default unchanged, offer contextual one-tap choice and test usage.
- Revision: v1 (pass-001)

### DNA-008 Weak-topic review from existing tags
- Status: proposed
- Area: Learning effectiveness
- Problem (with evidence): `app/index.html:1008-1020` mocks are random; `questions.jsonl` supports topic (`tools/MASTER_PROMPT.md:111-123`).
- Idea (concrete, buildable on the current stack): Compute local per-topic attempted/error summaries and offer Review weakest downloaded topic; no server analytics or new personal storage.
- Why students will come back for it: A specific repair task makes each return useful.
- Acceptance test (how we prove it works): Seed two topics with controlled errors; recommendation selects weaker one and honestly notes missing offline items.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 4/5 · Effort 3/5 (5 = easiest) → Total = 60
- Devil's advocate: Sparse data makes rankings noisy. Answer: require minimum attempts and label exploratory until then.
- Revision: v1 (pass-001)

### DNA-009 Medical errata follow-through
- Status: proposed
- Area: Content pipeline
- Problem (with evidence): Report queue is local (`docs/PRIVACY.md:6`) while bot `/flags` handles separate owner flags (`worker/bot.mjs:98-108`).
- Idea (concrete, buildable on the current stack): After honest local capture, design a minimal opt-in report handoff to owner moderation with question ID/reason only, rate limits, no student identity; require owner approval before transmission.
- Why students will come back for it: A corrected explanation repairs trust and motivates revisits.
- Acceptance test (how we prove it works): One report reaches moderation once; offline queue retries with consent; spam bound; no personal progress transmitted.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 4/5 · Effort 3/5 (5 = easiest) → Total = 60
- Devil's advocate: Abuse and moderation load may exceed free tier. Answer: cap submissions and keep owner review; stop if quota rises.
- Revision: v1 (pass-001)

### DNA-023 Exam calibration label
- Status: proposed
- Area: Medical education
- Problem (with evidence): `app/index.html:1001-1004` displays a percent score from self-selected downloaded items.
- Idea (concrete, buildable on the current stack): Label the mock as practice score and disclose sample size/coverage; prohibit pass prediction until calibrated cohort and blueprint data exist.
- Why students will come back for it: Honest scores support focused repeat practice.
- Acceptance test (how we prove it works): 10-question fixture never shows readiness or percentile; review path remains accessible.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 5/5 · Effort 3/5 (5 = easiest) → Total = 60
- Devil's advocate: Less exciting result. Answer: false readiness is dangerous for exams.
- Revision: v1 (pass-001)

### DNA-025 Accessibility regression fixture
- Status: proposed
- Area: Tests & CI
- Problem (with evidence): `PROGRESS.md` lists task 7; `docs/DESIGN.md:31-33` defines behavior but no signoff.
- Idea (concrete, buildable on the current stack): Add CI keyboard/focus and image-alt assertions against representative question types, alongside manual host checklist.
- Why students will come back for it: Accessible flow remains usable as features grow.
- Acceptance test (how we prove it works): A deliberately broken focus return or unlabeled image fails fixture; normal question types pass.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 5/5 · Effort 3/5 (5 = easiest) → Total = 60
- Devil's advocate: Automated a11y is incomplete. Answer: retain phone screen-reader signoff too.
- Revision: v1 (pass-001)

### DNA-021 Original identity decision prototype
- Status: proposed
- Area: Visual theme
- Problem (with evidence): `docs/DESIGN.md:9` rejects childish mascots; `app/design/tokens.css:2-29` has palette but no distinct original illustration.
- Idea (concrete, buildable on the current stack): Prototype two original directions in a review artifact: typographic Kafu mark versus a restrained non-character study motif; owner selects before production art.
- Why students will come back for it: Recognition can reduce friction when reopening Telegram.
- Acceptance test (how we prove it works): Blind comprehension/recognition check with 5–8 students, original asset provenance, light/dark small-size check.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 3/5 · Effort 4/5 (5 = easiest) → Total = 48
- Devil's advocate: Brand work may be premature. Answer: cap it to a cheap decision and defer art until real content.
- Revision: v1 (pass-001)

### DNA-022 Summary of missed concepts
- Status: proposed
- Area: Learning effectiveness
- Problem (with evidence): `app/design/study.js:17-27` scores session and lists mistakes but not conceptual takeaways.
- Idea (concrete, buildable on the current stack): Use existing topic labels to show counts of missed concepts; do not synthesize medical advice or store new history.
- Why students will come back for it: A concrete repair list creates a reason to return.
- Acceptance test (how we prove it works): Mixed-topic session summary matches mistakes exactly and does not invent explanation.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 4/5 · Effort 3/5 (5 = easiest) → Total = 48
- Devil's advocate: Topic tags may be absent. Answer: hide this when coverage is low and surface content gap.
- Revision: v1 (pass-001)

### DNA-024 Published source and rights card
- Status: proposed
- Area: Medical education
- Problem (with evidence): `app/index.html:945-951` shows book/page but not review date or edition context on every result; `book.json` has edition/year (`tools/MASTER_PROMPT.md:94-109`).
- Idea (concrete, buildable on the current stack): Expose edition/year/source page and last checked date where approved metadata exists; avoid identifying private source files.
- Why students will come back for it: Trustworthy provenance makes explanations worth revisiting.
- Acceptance test (how we prove it works): Fixture renders edition/page; missing fields are omitted rather than guessed; rights-cleared metadata only.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 4/5 · Effort 3/5 (5 = easiest) → Total = 48
- Devil's advocate: Metadata can crowd feedback. Answer: tuck it into a source disclosure.
- Revision: v1 (pass-001)

### DNA-026 Storage-capacity stress model
- Status: proposed
- Area: Free-tier headroom
- Problem (with evidence): `sync-core.js:172-240` chunks CloudStorage; synthetic UI adapter caps at 716 keys (`05_new_device.py:20-25`).
- Idea (concrete, buildable on the current stack): Model 20, 100 and 500 books with realistic review/favorite state, measuring bytes/keys and fallback status without real student data.
- Why students will come back for it: Students keep local study even when backup reaches cap.
- Acceptance test (how we prove it works): Synthetic upper-bound test reports cap margin; overflow gives capacity status and never discards local answers.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 4/5 · Effort 3/5 (5 = easiest) → Total = 48
- Devil's advocate: 500 books may never exist. Answer: establish safe headroom before real multi-book launch.
- Revision: v1 (pass-001)

### DNA-027 Free-tier operations dashboard
- Status: proposed
- Area: Free-tier headroom
- Problem (with evidence): `docs/BACKUPS.md:21` distinguishes D1 metadata; Actions private minutes finite; Cloudflare now hard-enforces D1 daily rows.
- Idea (concrete, buildable on the current stack): Owner-only monthly checklist records Actions minutes, D1 rows/storage, Worker requests and release size, with thresholds and pause actions; use existing dashboards.
- Why students will come back for it: A predictable $0 service avoids interruption to daily study.
- Acceptance test (how we prove it works): One sampled month with screenshot-free numeric totals; alert thresholds below current free caps; no secrets/data exported.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 4/5 · Effort 3/5 (5 = easiest) → Total = 48
- Devil's advocate: Manual tracking costs time. Answer: monthly is sufficient for 20–50 students.
- Revision: v1 (pass-001)

### DNA-029 Meaningful motion budget
- Status: proposed
- Area: Visual quality
- Problem (with evidence): `app/design/tokens.css:20,50-52` and `app/design/study.js:39-42` define transitions, but no perceived-motion phone evidence.
- Idea (concrete, buildable on the current stack): Limit animation to entry and earned milestones; collect reduced-motion and low-end frame evidence before adding character motion.
- Why students will come back for it: A calm tactile rhythm supports return without distraction.
- Acceptance test (how we prove it works): Reduced-motion has zero nonessential transition; ten next-question runs remain under agreed latency budget.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 3/5 · Confidence 4/5 · Effort 4/5 (5 = easiest) → Total = 48
- Devil's advocate: No demand for more motion. Answer: this is a guardrail, not an animation backlog.
- Revision: v1 (pass-001)

### DNA-010 Exam blueprint for Iraqi finals
- Status: proposed
- Area: Medical education
- Problem (with evidence): Current mock is 10/20/all random downloaded (`app/index.html:1008-1020`); no syllabus mapping verified in `PROGRESS.md`.
- Idea (concrete, buildable on the current stack): Owner and educator define a versioned topic blueprint; assemble local mocks only from available licensed questions, showing coverage and gaps.
- Why students will come back for it: A visible exam path beats generic practice.
- Acceptance test (how we prove it works): Fixture with known topic weights yields reproducible mix and honest shortfall; clinician signs mapping; no readiness claim on sparse data.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 4/5 · Effort 2/5 (5 = easiest) → Total = 40
- Devil's advocate: Blueprint can age. Answer: version/date it and do not overclaim representativeness.
- Revision: v1 (pass-001)

### DNA-013 Medical explanation completeness score
- Status: proposed
- Area: Learning effectiveness
- Problem (with evidence): Content contract permits `explanation: ""` (`tools/MASTER_PROMPT.md:108-123`).
- Idea (concrete, buildable on the current stack): Publish a per-book explanation-coverage metric in owner audit; prioritize authored rationales for high-error questions, never AI-generated medical claims.
- Why students will come back for it: Students return because wrong answers teach, rather than just grade.
- Acceptance test (how we prove it works): Audit counts nonempty explanations by type/topic; launch review includes gaps and owner accepts threshold.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 5/5 · Confidence 4/5 · Effort 2/5 (5 = easiest) → Total = 40
- Devil's advocate: Some books lack explanations. Answer: label absence honestly; do not fabricate textbook text.
- Revision: v1 (pass-001)

### DNA-030 Knowledge-gap reading link
- Status: proposed
- Area: Learning effectiveness
- Problem (with evidence): `app/index.html:941-952` shows source/explanation without a linked concept index.
- Idea (concrete, buildable on the current stack): For licensed books with chapter anchors, offer a local jump to that book's explanation/context after a wrong answer; no external paid library dependency.
- Why students will come back for it: A wrong answer turns into a small teach-and-retry loop.
- Acceptance test (how we prove it works): Anchor fixture navigates offline to licensed material; missing anchor hides link; back returns to same question.
- Gates: $0 ✅ · Constitution ✅ · Progress-safe ✅
- Scores: Impact 4/5 · Confidence 3/5 · Effort 3/5 (5 = easiest) → Total = 36
- Devil's advocate: Rights may not include full text. Answer: ship only where licensed, otherwise remain with question explanation.
- Revision: v1 (pass-001)
