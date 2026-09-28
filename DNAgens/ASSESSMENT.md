# Current app assessment — pass 002

**Snapshot:** current main `123cb8986ac6f04991194b6c735821738fd0e94d`, 2026-09-28 UTC. **Overall remains 5.6/10** (unweighted mean 89/16). Runtime app/source is unchanged from the pass-001 app snapshot `22afa6a416c6d8eca91fbf7a8ab5b69eb1b00921`; merged PRs #36–#37 only created/updated `DNAgens/`. New evidence this pass is the exact-head #34 Visual/Flow artifact and CI logs plus a local replay from that source artifact. No learner outcome, clinical-accuracy cohort, physical Telegram reinstall, screen-reader or cold-4G measurement was produced, so no area score moves.

**Pass-002 evidence boundary:** Reviewed Visual/Flow run 36413005462 artifact 10966180395 (phone 390×844 and iPad 820×1180, light/dark; `visual_pass: true`) and Content run 36413005498 (44 Python tests green). The artifact's extracted source omits gitignored vendored dependencies and `.git`; a local pure-module replay passed 23/23 tests, while the full local suite cannot be claimed from that extraction because vendor-dependent tests/build and the repository security scan need those omitted inputs. Standing account check: production source namespaces personal state by Telegram user ID; the unit test proves A→fresh-B isolation only, and `05_new_device.py` proves a synthetic same-A CloudStorage restore plus a separate clean account/offline reload. There is still no physical same-phone A→B→A return test and no actual Telegram uninstall/reinstall restore, so DNA-002 is not done.

## Sixteen areas

### 1. Learning effectiveness — 6/10

- FSRS is real, but ordinary questions map wrong→Again/correct→Good without confidence or difficulty input (`app/modules/review-bridge.js:12-16`); this cannot distinguish a lucky guess from durable recall.
- A due card demands a second rating after grading (`app/modules/review-bridge.js:39-60`); added friction may depress completion, and no student completion-rate measurement exists (`docs/REVIEW_DUE.md`).
- Explanation is optional and may be empty in the content contract (`tools/MASTER_PROMPT.md:108-123`); the study view then shows only result/source (`app/index.html:941-952`).
- Mock exams are random downloaded questions at one minute each, rather than a mapped syllabus or exam blueprint (`app/index.html:1008-1020`).

**World-best bar:** Anki's scheduled retrieval, AMBOSS's linked explanations, UWorld's rationale for every option and exam analytics. Kafu has scheduling, not that complete instructional loop.

### 2. Daily habit and motivation — 5/10

- The fixed ten-minute goal (`app/design/discovery.js:45-49`; `docs/reports/DAY_1_TASK6.md`) ignores an imminent exam or a two-minute commute.
- A streak is derived from days with activity, but it conveys continuity rather than topic mastery (`app/design/delight.js:19-34`).
- Four badges measure chapter/question milestones (`app/design/delight.js:7,34`); none rewards repairing a misconception over time.
- No field evidence establishes day-7 or day-30 return; `PROGRESS.md` describes implementation and phone checks, not retention cohorts.

**World-best bar:** Duolingo makes a tiny daily step legible; Brilliant connects return visits to adaptive progress. Neither licenses guilt or artificial urgency.

### 3. Onboarding — 6/10

- Three screens explain offline and specialty but never take a learner through one real answer and explanation (`app/design/onboarding.js:18-40`).
- A fresh catalog with no books leads to a reconnect message (`app/design/discovery.js:19-21`), which is poor first-run value for a launch cohort.
- Tour choice is local to the Telegram ID, but the physical A→B→A and reinstall path is unverified (`app/design/onboarding.js:5-15`; `tools/ui/flows/05_new_device.py:16-82`).

**World-best bar:** Quizlet/Brilliant put a real learning interaction in the first session and lead directly to the next action.

### 4. Ease of use — 6/10

- Library searches title and filters specialty, not chapter/topic or source page (`app/design/discovery.js:19-35`).
- Due review has to scan catalog chapters to locate missing questions, then download them serially when online (`app/modules/review-bridge.js:22-32`); a learner can face a long wait with no per-card progress.
- Exam setup offers only 10, 20 or all downloaded questions (`app/index.html:1008-1020`), with no weak-topic or blueprint selection.
- Reporting says “Send report” although it only queues on device (`app/index.html:1106-1138`).

**World-best bar:** AMBOSS jumps from a question into relevant learning material; UWorld supports targeted practice and review filters.

### 5. Visual theme and brand — 6/10

- The palette and type hierarchy are specified (`app/design/tokens.css:2-29`), but brand expression is mostly generic cards, teal and typographic covers (`app/design/discovery.js:10-16`).
- Exact-head artifact 10966180395 provides reviewed phone 390×844 and iPad 820×1180 light/dark screenshots for Home, Library, Study, completion and Me with `visual_pass: true`; this proves default-size CI rendering, not physical Telegram safe areas or enlarged text.
- “Kafu” appears as a correct-answer phrase and home text (`app/design/delight.js:28-34`), but its Iraqi cultural meaning is only explained in the design document (`docs/DESIGN.md:9`).

**World-best bar:** Duolingo has recognizable interaction and voice; Kafu needs its own calm, original, adult medical-study identity, not imitation.

### 6. Characters and mascot — 2/10

- No character system or mascot asset appears in `app/design/` or the module manifest (`app/modules/manifest.json`); this area is effectively absent.
- The design rule explicitly rejects childish mascots (`docs/DESIGN.md:9`); adding a character without owner direction would violate the intended tone.
- Existing four badges are typographic/icon affordances rather than narrative characters (`app/design/delight.js:7,34`).

**World-best bar:** Duolingo's mascot is consistent and recognizable. Kafu may consciously choose an original non-character identity; this score measures the requested character area, not a demand to add one.

### 7. Visual quality: icons, illustration, motion, dark mode — 5/10

- SVG icons and an 80ms question transition exist (`app/design/study.css:27`; `app/design/tokens.css:20`), but no bespoke educational illustration set is evident in `app/design/`.
- Telegram color scheme drives dark mode (`app/design/foundation.js:5-14`), while the design spec calls for a saved Light/Dark/Auto preference (`docs/DESIGN.md:29`); no such visible preference was established in this review.
- Generic `alt="Question image"` and `alt="Explanation image"` discard the medical figure's meaning (`app/index.html:947-955`).
- Local screenshot automation failed to install Chromium; appearance at 390×844 and 820×1180 remains unverified here (`docs/DESIGN.md:37`).

**World-best bar:** Brilliant's custom interactive visual guidance and polished states. Medical figures require meaningful text and source integrity, not decorative filler.

### 8. Accessibility — 5/10

- Tokens, 44px target and reduced-motion rule are present (`app/design/tokens.css:20-21,50-52`); none proves VoiceOver/TalkBack operation on Telegram.
- Figure alt text is generic (`app/index.html:947-955`), a major loss for image-dependent medical questions.
- Sheet accessibility now has implementation and browser proof: initial focus, inert outside content, Tab/Shift+Tab cycle, Escape and opener-focus return (`app/design/usability.js:78-111`; `tools/ui/flows/02_usability.py:13-19`). Physical VoiceOver/TalkBack behavior in Telegram is still unverified.
- Accessibility PR #35 is still open, so its changes are not current-main evidence. The intended WCAG 2.2 AA/200% text target (`docs/DESIGN.md:31-33`) still lacks merged physical-host signoff.

**World-best bar:** An accessible full question path, named diagrams, keyboard and assistive-technology evidence in both themes.

### 9. Speed and offline — 7/10

- Build produced 317,054-byte HTML locally; `docs/reports/DAY_1_TASK6.md` records ~90,743 gzip JS and 2.1–14.4ms next-question interactions in CI, not first-open 4G.
- A saved chapter needs text and every expected image before “Available offline” (`app/modules/download-core.js:43-68`); this is correct but can turn one missing image into an incomplete pack.
- Service-worker shell support is conditional; Telegram iOS cold offline launch is explicitly not guaranteed (`docs/OFFLINE_SHELL.md`; `app/modules/shell-bridge.js:6-19`).
- Bulk saving iterates chapters and reports failures (`app/modules/download-core.js:81-87`), but actual large rights-cleared books and device eviction are untested.

**World-best bar:** Anki and PassMedicine document offline access and cross-device continuation. Kafu's text-first chapter delivery is promising, but physical low-end phone and airplane-mode evidence must bound the promise.

### 10. Code quality and architecture — 6/10

- Two Workers, static content and local personal state keep routine study off D1 (`HANDOFF.md`; `docs/PERSONAL_SYNC.md`), a sound cost boundary.
- `app/index.html` is 1,225 source lines with global mutable state and view/action coupling (`app/index.html:427-469,1118-1145`); an interaction often requires monkey-patching another global function.
- The enhancement installer pattern wraps `render`, `DB.open`, `recordAnswer` and `nextQuestion` in multiple modules (`app/design/foundation.js:29-35`; `app/design/study.js:5-16`; `app/modules/review-bridge.js:8-16`; `app/modules/sync-bridge.js:10-17`); ordering is a hidden dependency.
- Silent catches in sync and UI bridges protect sessions but erase diagnostic causes (`app/modules/sync-bridge.js:53,58,75`; `app/modules/download-bridge.js:49`).

**World-best bar:** Explicit feature boundaries, typed interfaces and observable failure paths without adding costly infrastructure.

### 11. Ease of future changes — 4/10

- A new wrapper can change an earlier wrapper's behavior depending on manifest order (`app/modules/manifest.json`; `app/design/study.js:35-55`).
- Progress format is deliberately immutable/additive; sync has a compact, key-limited protocol (`app/modules/sync-core.js:172-240`), so even small new personal fields need migration review.
- The plan and operational docs drift: `BUILD_PROMPT.md` is absent; `PROGRESS.md` calls merged Home/Library in progress; older `HANDOFF.md`/`docs/ADMIN.md` retain earlier PR/backup states.
- Packaging prompt contains a literal `\n` between required file names (`tools/MASTER_PROMPT.md:84`), a confusing source contract for helpers.

**World-best bar:** A versioned, testable domain core and a single current source of operational truth; no new architecture is proposed in this review.

### 12. Tests and CI — 7/10

- Exact-head Content run 36413005498 is green with 44 Python tests, and Visual/Flow run 36413005462 is green with reviewed screenshot/flow evidence. This pass also replayed 23/23 pure JS sync/discovery/delight tests locally from the artifact source; a full local replay is not claimed because the artifact intentionally omits gitignored vendor files and `.git` metadata required by some tests/build.
- Account isolation unit test checks A→fresh B only (`tools/tests/js/sync-bridge.test.cjs:44-49`); it does not return to A with two accounts in one persistent phone database.
- New-device badge test uses two synthetic browser contexts and a CloudStorage callback adapter (`tools/ui/flows/05_new_device.py:1-82`); it is not a Telegram reinstall.
- Docs-only PRs skip both path-filtered workflows (`.github/workflows/ci-tools.yml:3-25`; `.github/workflows/ui.yml:2-10`); a green historical run is not this PR's validation.

**World-best bar:** Behavior tests for storage migration, real host-device flows and content correctness, alongside fast deterministic contracts.

### 13. Security and privacy — 5/10

- Client-side Telegram user ID is a namespace hint, explicitly not server authorization (`app/modules/sync-access.js:1-6`); no cross-account physical-device adversarial test exists.
- Compact CloudStorage is provider-backed, but complete answer-event history is device-only (`docs/PRIVACY.md:5`; `tools/tests/js/sync-bridge.test.cjs:30-42`); “restore progress” has this limit.
- Current main still keeps reports local and labels the action “Send report” (`app/index.html:1106-1138`; `app/modules/privacy.js:15`). The owner-approved minimal D1 send/deletion contract is recorded in `DNAgens/CHANGELOG.md`, but the implementation PR remains open and therefore is not current-product evidence.
- Reset says all synced devices and keeps stars (`app/modules/sync-bridge.js:81-83`); historical cloud checkpoints/provider erasure are explicitly outside that promise (`docs/PRIVACY.md:9`).

**World-best bar:** A truthful, minimal-data privacy contract with tested recovery, account isolation and timely medical errata handling.

### 14. Free-tier headroom and cost risk — 7/10

- Static pack downloads and local grading avoid per-answer Worker/D1 cost (`app/modules/download-core.js:43-87`; `docs/BACKUPS.md:21`).
- The private repo's Actions quota is finite: prior `PROGRESS.md` snapshot cites 148 minutes and repeated CI; path filters and cancel-in-progress now help (`.github/workflows/ci-tools.yml:3-27`).
- D1 Free now hard-fails queries when daily row limits are exceeded (Cloudflare changelog, 2026-09-01); backup/publish/admin workload needs measured row usage, not a free-tier assumption.
- CloudStorage has a 1,024-key/4,096-character platform cap; the app budgets 716 keys (`tools/ui/flows/05_new_device.py:20-25`; `docs/PERSONAL_SYNC.md`), but many-book worst-case progress is unmeasured.

**World-best bar:** Published usage ceilings, alarms and graceful local study when admin services hit quota, all within $0.

### 15. Content pipeline — 6/10

- Parser, batch packager, audit, validator, moderation and rollback path exist (`tools/MASTER_PROMPT.md`; `tools/package_batch.py`; `docs/CONTENT_TEAM.md`), but no representative real licensed book was published in this snapshot (`PROGRESS.md`).
- The audit is source-consistency support, not medical peer review; questionable book answers are retained with a flag (`tools/MASTER_PROMPT.md:13-17`).
- Images depend on crops/alt text and rights review; generic app alt labels cannot express ECG or radiograph findings (`app/index.html:947-955`).
- `tools/MASTER_PROMPT.md:84` malformed line risks a missing `report.md` in a helper's output despite the validator.

**World-best bar:** AMBOSS/UWorld medical editorial review, complete rationales, transparent provenance and rapid correction tracking. Kafu should make its different rights-cleared book fidelity explicit.

### 16. Differentiators — 6/10

- Telegram-native, free and offline-first plus an Iraqi student context is a strong *combination*, but `PROGRESS.md` records no first real Iraqi Board/MRCS book or student cohort outcome.
- A generic timed mock drawn from downloaded questions (`app/index.html:1008-1020`) does not yet express Iraqi Board/finals blueprint specificity.
- Plain English UI honors owner policy (`docs/DESIGN.md:9`); Iraqi context needs exam taxonomy and content rather than translating the UI.
- PassMedicine itself offers offline questions and device sync, and Anki offers offline spaced repetition; these capabilities alone are not unique.

**World-best bar:** Demonstrate one rights-cleared, locally relevant exam path whose value is clear within Telegram in under a minute, without payment or a separate app account.

## Seven seats: explicit dissent

| Seat | Hard call | Evidence |
|---|---|---|
| Staff software engineer | Stop treating wrapper order as an informal API; a review feature can silently change sync or navigation. | `app/modules/manifest.json`; `app/design/study.js:5-16`; `app/modules/sync-bridge.js:10-17` |
| Principal product designer | A palette is not a finished identity; no reviewed physical dark-mode or 200% text screenshot in this pass. Choose a restrained brand direction before adding art. | `app/design/tokens.css:2-52`; `docs/DESIGN.md:31-37` |
| Learning scientist | “Correct” is not “mastered”; lucky guesses go to Good, and the app has no measured retention outcome. | `app/modules/review-bridge.js:12-16`; `PROGRESS.md` |
| Iraqi medical educator | Generic downloaded-question mocks cannot claim Iraqi Board readiness. Rights and answer provenance outrank badge work. | `app/index.html:1008-1020`; `tools/MASTER_PROMPT.md:13-17`; `PROGRESS.md` |
| Retention lead | Four badges and a ten-minute bar are not a reason to return if a student's weak topic is unclear. Avoid streak-pressure mechanics. | `app/design/delight.js:7,34`; `app/design/discovery.js:45-49` |
| Cost guardian | “Free” depends on quota headroom and storage footprint. Daily D1 hard limits and private Actions minutes require observation. | `.github/workflows/ci-tools.yml:3-27`; `docs/BACKUPS.md:21`; Cloudflare/GitHub limits below |
| Devil's advocate | Do not make any of the ideas below a launch blocker until one real book, phone A→B→A, and 20–50 students expose the actual bottleneck. | `PROGRESS.md`; `tools/tests/js/sync-bridge.test.cjs:44-49`; `docs/reports/DAY_1_TASK6.md` |

## Benchmark ledger (official product claims, checked 2026-09-28)

| Product | What it presently does better or more completely | Kafu's honest angle |
|---|---|---|
| [Anki](https://apps.ankiweb.net/) | Mature spaced repetition, editing and sync ecosystem. | Exam-oriented, rights-cleared MCQ books inside Telegram; no card-making burden. |
| [AMBOSS](https://www.amboss.com/) | Curated medical library linked to question explanations. | A narrower free, locally relevant bank, if rights and medical review are secured. |
| [UWorld](https://www.uworld.com/) | Detailed option rationales and performance analytics. | Free access and small offline chapters, without claiming equal editorial depth. |
| [Pastest](https://www.pastest.com/mrcs-part-a/) | MRCS-specific breadth, revision resources and exam framing. | Local Iraqi cohort context and Telegram access after a real book is proven. |
| [PassMedicine](https://www.passmedicine.com/) | Large exam banks, notes, peer comparison, offline app and sync. | No payment gate, Telegram-native discovery and Iraqi Board alignment. |
| [Duolingo](https://blog.duolingo.com/streaks-and-motivation/) | A legible tiny daily return step and recognizable voice. | Gentle mastery-linked returns without guilt, ads or forced streaks. |
| [Quizlet](https://quizlet.com/features/learn) | Mixed-mode learning and self-testing on user-created sets. | Verified medical book source and four MCQ formats in one study path. |
| [Brilliant](https://brilliant.org/) | Interactive stepwise tutoring and bespoke visual teaching. | Practical medical exam retrieval on the student's existing Telegram client. |

No benchmarked product's cited offering establishes **this entire combination**: permanently free question access, Telegram-native launch, offline-first downloaded chapters and rights-cleared Iraqi exam context. That is a positioning hypothesis, not proof that no competitor can offer it. PassMedicine offline/sync and Anki offline are explicit counterexamples to simpler uniqueness claims.

**Free-tier sources:** [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 enforcement change](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/), [Telegram CloudStorage API](https://core.telegram.org/bots/webapps), [GitHub included usage](https://docs.github.com/en/billing/reference/product-usage-included). Limits change; recheck before scale decisions.
