# Learning science and game design: does a game wrapper help?

> Research saved from the session of 2026-10-18 (Claude Code). Each report was written by one agent and then
> fact-checked claim by claim by a second, independent agent; the corrections are at the end and **override the
> report text**. Paths under `/tmp/...` were scratch files of that session and no longer exist.

## TL;DR (short Arabic summary for the owner)

الفكرة ممكنة تقنياً، مجانية، وتگدر تكون سريعة جداً، بس بشرط واحد: اللعبة ما توقف الطالب بين كل سؤال وسؤال. الأبحاث تگول إن "غلاف لعبة" حول الأسئلة ما يزيد التعلم بحد ذاته. الفائدة المتوقعة هي إن الطالب يرجع ويكمل أكثر، وحتى هاي الفائدة صغيرة وتضعف بعد حوالي 4 أسابيع. المحترف راح يسوي ثلاث أشياء:
1. السؤال نفسه هو "المرحلة"، والشخصية تصعد خطوة بعد الجواب مو قبله. لازم تنحذف فكرة "تمشي وتاخذ كوين وبعدين يطلع السؤال".
2. المشاهد الطويلة (درج، مصعد، مخيم) بس بنهاية كل مجموعة 10 أو 20 سؤال، وكلها قابلة للتخطي.
3. يبدي بنموذج رمادي (مربعات، بدون شخصيات) ويجربه على 5 طلاب، ويقيس "أسئلة بالدقيقة" قبل ما يرسم أي شخصية.

---

## 0. Bottom line for this design

- **Feasible, free, fast: yes, with conditions.** A sprite-and-CSS-transform layer costs almost nothing at runtime. It fits Kafu's existing rules: motion tokens of 80/120/180/320 ms, transform/opacity only, durations set to zero under `prefers-reduced-motion`, and the 150 KB gzipped JS budget.
- Full engines don't fit inside that budget. Phaser 4.2.1 is about 352 KB gzipped and PixiJS 8.22 about 237 KB. KAPLAY (about 70 KB) or plain DOM/CSS does fit, and Lottie-light (about 46 KB) is an option.
- **Pedagogically, the proposed per-question loop is the weakest form of game-based learning in the literature.** The flow is tap, walk, coin, then MCQ, then Next, then walk. That is the "extrinsic" variant that Habgood & Ainsworth compared against an integrated one.
  - Their extrinsic Zombie Division put multiple-choice quizzes between levels.
  - It produced less learning under fixed time.
  - Children chose to play it 7 times less.
- **The coin-before-question order is backwards.** It rewards the tap (engagement-contingent reward), which is the reward type with the largest undermining effect in Deci, Koestner & Ryan's meta-analysis (d = −0.40 on free-choice motivation). Informational positive feedback after effort raised motivation (d = +0.33).
- **Recommendation:** answering moves the character. Progress comes after retrieval and stays visible in a thin "mountain strip" on the MCQ screen. Long story beats (stairs, elevator, camp) happen only at block or chapter boundaries, which are natural breaks.
- Keep the narrative thin and the visuals schematic. Clark et al. 2016:
  - thin narrative g = 0.47 vs medium narrative g = −0.03;
  - schematic visuals g = 0.48 vs realistic g = −0.01.
- Kafu already ships XP, levels, streak, badges, a weekly Top-30 leaderboard and Telegram haptics. A "game mode" therefore mostly adds fiction plus a world map. The meta-analytic evidence for fiction is about behaviour, not knowledge (Sailer & Homner: fiction g = .41 vs .10 on behaviour; .47 vs .51 on cognition).

## 1. Meta-analyses: what gamification does, and which elements carry it

**Sailer & Homner 2020** (Educational Psychology Review 32:77–112; 40 experiments)

| Outcome | g | 95% CI | k | N |
|---|---|---|---|---|
| Cognitive | .49 | [.30, .69] | 19 | 1,686 |
| Motivational | .36 | [.18, .54] | 16 | 2,246 |
| Behavioural | .25 | [.04, .46] | 9 | 951 |

Caveats that matter more than the headline:
- **Rigour shrinks the effect.**
  - Randomized experiments on cognitive outcomes gave only g = .29 [.07, .51] (k = 6), against .56 for quasi-experiments.
  - In the high-rigour subsplit, cognitive stayed significant (g = .42), but motivation (g = .22, p = .20) and behaviour (g = .27, p = .22) were not significant.
- **Game fiction (narrative) helps behaviour, not knowledge.**
  - Behavioural outcomes: with fiction g = .41 [.31, .51] (k = 3); without fiction g = .10, not significant (k = 7).
  - Cognitive outcomes: with fiction .47, without .51. No advantage.
  - Studies using fiction were less often randomized (r = −.41).
- **Social structure.**
  - Competition plus collaboration gave g = .70 on behaviour (k = 3).
  - Competition alone gave g = .12, not significant.

**Bai, Hew & Huang 2020** (Educational Research Review 33, 100322)
- g = 0.504 [0.284, 0.723]; 30 interventions, 3,202 participants.
- No significant difference by type or number of game elements.
- Students' complaints: gamification "does not bring additional utility", and it can cause anxiety or jealousy.

**Huang et al. 2020** (ETR&D 68(4)): g = .464 [.244, .684]; 30 studies, N = 3,083.

**Health professions, specifically**
- **Gentry et al. 2019** (JMIR; 27 RCTs and 3 cluster RCTs, 3,634 participants): at least as effective as controls. Evidence was low or very low quality for all outcomes.
- **van Gaalen et al. 2021** (Adv Health Sci Educ; 44 of 5,044 records):
  - Assessment was the most common attribute (n = 40), often paired with conflict/challenge (n = 27).
  - No negative outcomes were reported.
  - Most studies lacked well-defined control groups.
  - The authors warn that competition can shift attention from learning to winning.
- **Lee et al. 2026** (Med Educ Online; clinical reasoning, 10 of 26 studies pooled):
  - SMD 1.11, with I² = 85%, falling to 0.75 after trim-and-fill.
  - GRADE certainty: low.
  - The authors favour learner choice, adaptive challenge and informative feedback over competition-driven designs (not tested statistically).

**Game-based learning more broadly: Clark, Tanner-Smith & Killingsworth 2016** (Review of Educational Research)
- Games beat non-game conditions overall: g = 0.33.
- The moderators are the most useful part for Kafu:

| Moderator | Level | g |
|---|---|---|
| Sessions | Single | 0.08 (not significant) |
| | Multiple | 0.44 |
| Narrative | None | 0.44 |
| | Thin | 0.47 |
| | Medium | −0.03 |
| | Thick | 0.36 (not significant, k = 5) |
| Visuals | Schematic | 0.48 |
| | Cartoon | 0.32 |
| | Realistic | −0.01 |
| Game type | Simple points/badges | 0.53 |
| | More than points/badges | 0.25 (difference p = .07) |

**Implication:** expect small, fragile gains. The most dependable lever is the retrieval practice itself. Practice tests beat restudy and every other comparison (Adesope et al. 2017). The game layer should protect and amplify that, not dilute it.

## 2. Known risks

- **Overjustification / undermining** (Deci, Koestner & Ryan 1999; 128 experiments)
  - Expected rewards undermined free-choice intrinsic motivation:
    - engagement-contingent d = −0.40;
    - completion-contingent d = −0.36;
    - performance-contingent d = −0.28;
    - all tangible rewards d = −0.34 (92 studies).
  - Unexpected tangible rewards had no effect (d = 0.01).
  - Positive feedback increased motivation (free choice d = 0.33; interest d = 0.31).
  - Design rule: coins and stars should be informational ("you mastered renal physiology"), given after effort, and sometimes surprising. They should not be a payment for tapping.
- **Seductive details / coherence** (Sundararajan & Adesope 2020: 58 studies, 68 effects, g = −0.33)
  - Harm was larger when learners could not control the pace, and when details were frequent.
  - An unskippable walk between every question has exactly those properties.
- **"Chocolate-covered broccoli" / extrinsic integration**
  - Habgood & Ainsworth 2011:
    - 58 children: the intrinsic version produced more learning under fixed time.
    - 16 children with free choice played it 7 times longer.
    - The extrinsic version was multiple-choice quizzes at the end of levels, which is structurally what is proposed here.
  - Cutting & Iacovides 2022 (preregistered, n = 210): learning was higher with integration, while motivation and cognitive load did not differ. They conclude integration works through attention: players attend only to what the game task needs. A walk-and-coin layer directs attention to the walk.
- **Novelty decay**
  - Rodrigues et al. 2022 (756 STEM students, 14 weeks):
    - the effect started falling after 4 weeks;
    - the fall lasted 2–6 weeks;
    - it partly recovered between weeks 6 and 10 (a U-shape).
  - Hanus & Fox 2015 (from memory, not verified): badges, coins and a leaderboard over 14 weeks lowered motivation and satisfaction.
  - Hamari et al. 2014 flag novelty, context and user characteristics as caveats.
- **Time-on-game vs time-on-task (Prodigy)**
  - Prodigy's own correlational district study: about 0.73 ISASP scale-score points per additional hour of answering questions (1,390 students; grades 5–6 for the effect).
  - Fairplay (an advocacy group, so partisan) observed 16 membership ads and only 4 math problems in 19 minutes.
  - Fairplay also quotes the Prodigy-commissioned Johns Hopkins evaluation: students "wander about", and "more and more usage of Prodigy may not result in more and more achievement".
  - A 22-group FTC complaint was filed on 19 Feb 2021.
  - Lesson for Kafu: once the wrapper exists, everything pushes toward more wrapper. Questions per minute must be the hard guardrail.

## 3. Direct analogues

- **Duolingo path (2022)**
  - Replaced the skill tree with a linear path; launched to all learners on 1 Nov 2022.
  - Built in spaced repetition and interleaving; "Practice is also forward progress."
  - It was trialled on a subset of new users with "encouraging results", but no numbers were published.
  - Luis von Ahn's rationale: with free choice, "a significant fraction" of users were "just coming in to extend the streak with really easy lessons". Their rule for teams is that a change "cannot screw up the other metrics", i.e. guardrails.
  - Users strongly disliked losing choice.
- **Duolingo gamification, from the former CPO (Jorge Mazal)**
  - Leaderboards: +17% learning time, three times as many highly engaged learners, D1 and D7 retention improved significantly. DAU grew 4.5x over four years, combined with other work.
  - A Gardenscapes-style moves counter (a game mechanic bolted onto lessons) was "completely neutral" and "a boring, tacked-on nuisance".
  - A third-party extension exists solely to auto-click through Duolingo's after-answer and after-lesson interstitials. Duolingo itself now offers a setting to turn off motivational messages.
  - Signal: frequent per-answer interstitials irritate committed learners.
- **Saga maps (Candy Crush):** the map is meta-progression between levels, not between moves. I found no first-party King rationale; only the GDC talk listings (Palm 2013; Kang 2016) turned up.
- **Prodigy:** see section 2.
- **Anki add-ons used by medical students**
  - Picmonic says its Anki add-on works alongside Pokemanki, Kitten Rewards, Anki Fanfare and Anki Habitat.
  - Ankimon (by Unlucky-life) is listed under "Gamification" on the AnkiWeb forum.
  - All of these sit around reviews (pets grow as you review). None put an animation between cards.
  - No outcome studies were found.
- **Kahoot:** Wang & Tahir 2020 reviewed 93 studies. Mostly positive effects on performance, classroom dynamics and anxiety, though some studies found little or no effect. Students complained about stressful time pressure and not being able to change an answer.
- **Medical question banks:** AMBOSS pages show analytics, peer comparison and study plans, but I found no game wrapper. Picmonic and Sketchy put the story inside the mnemonic content (Picmonic RCT, Yang et al. 2014: significant retention gains, p < 0.001, but the authors had a financial interest).
- **Closest analogue: TESLA-G (NCT05520671)**
  - A gamified, Telegram-delivered MCQ platform for medical students.
  - Game elements: levels, countdown timer, lives, point multiplier, leaderboard, dashboard.
  - Design: 50 students, 1:1, 14 days. The control is the same platform with the gamification removed.
  - The primary outcome is feasibility only: enrol 50, retain at least 75%, 80% quiz completion. The knowledge comparison is explicitly underpowered.
  - No results posted; status unknown.
  - This is the right template for Kafu's pilot.

## 4. Game-design craft that matters here

- **Core loop:** retrieve, then get feedback, then visible progress. The question is the level. Avoid two scene changes per item (world to MCQ, then MCQ to world).
- **Game feel / juice**
  - Swink defines game feel as real-time control (a feedback cycle under 100 ms) emphasised by polish.
  - Jonasson & Purho describe juice as "maximum output for minimum input".
  - Kao 2020: medium and high juiciness beat both no juice and extreme juice on all measures. More juice is not always better.
  - For Kafu: a 120–320 ms step-up, a light haptic (`HapticFeedback.impactOccurred`, Bot API 6.1+) and a small particle burst. No long cutscenes per item.
- **Durations**
  - NN/g: 100–500 ms overall; 200–300 ms for big screen changes; about 500 ms feels like a drag; the more frequent the animation, the shorter it should be.
  - RAIL: respond to input within 100 ms; produce each frame in about 10 ms (16 ms budget).
  - NN/g: long waits belong at natural breaks.
  - Animate transform and opacity only. In web.dev's test, animating top/left dropped 50% of frames; transform dropped 1%.
- **Interruptibility:** every animation must be cancellable. Tapping Next during an animation finishes it instantly (Web Animations `finish()`). Input is never blocked.
- **Reward schedule:** steady informational feedback per item, plus occasional unexpected bonuses at block end. No loot boxes, no pay-to-win (Prodigy's FTC complaint).
- **Narrative:** thin and continuous. One climb per book; camps are chapters; the summit is the exam.
- **Wrong answers must not punish**
  - Kafu's own rule 5 already requires neutral feedback.
  - Metcalfe 2017 (from secondary summaries): errors followed by corrective feedback improve later memory; high-confidence errors are corrected best.
  - Mechanic: the climber plants a flag, and the path loops back to that flag later for spaced review. No falling and no lost lives.

## 5. The professional process

1. **Hypothesis and kill criteria, written before any art.** Example: game mode must not reduce questions per minute by more than 5% or reduce accuracy, and must raise 7-day voluntary return or planned-set completion.
2. **Baseline telemetry from the current app for 2+ weeks.** Track seconds per question, questions per session, where sessions end, and D1/D7 return.
3. **Paper/Figma prototype, then gray-box (rectangles) on a hidden route** (like `#gallery`, not in production navigation), using the real MCQ component. "Find the fun" before characters.
4. **Think-aloud with 5 students per round.** Nielsen: 5 users find about 85% of problems (L = 31%); quantitative studies need about 20.
5. **RITE:** fix problems between participants. In Medlock et al.'s Age of Empires II case, 10 participants drove the iterations, then 6 more needed no changes.
6. **Vertical slice:** one 20-question block with final art for one character, on the cheapest Android phone you can find.
   - Performance gate: p95 frame ≤ 16.7 ms, no long tasks over 50 ms during transitions, input to response ≤ 100 ms.
7. **Telemetry plus "why".** TRUE (Kim et al., CHI 2008) pairs logs with in-moment attitudinal data, to answer "the why behind the what".
   - Free storage options:
     - Workers Analytics Engine: free tier 100,000 data points per day.
     - Batched D1 writes: free tier 100,000 rows written per day, already shared with the leaderboard.
8. **Pilot (20–50 students), within-subject crossover.** Each student uses game mode on half the chapters and plain mode on the other half, counterbalanced.
   - **What 80% power can detect** (my normal-approximation calculation):
     - between groups, 25 per arm: d ≈ 0.79;
     - between groups, 50 per arm: d ≈ 0.56;
     - within-subject, n = 30: dz ≈ 0.51;
     - within-subject, n = 50: dz ≈ 0.40;
     - d = 0.5 needs about 64 per group.
   - Realistic gamification effects are 0.25–0.5, or .29 in randomized studies.
   - **The pilot can show:** usability, performance, gross throughput penalties, preference, feasibility.
   - **It cannot show:** a learning effect, D30 retention, or anything that outlasts the 4-week novelty window.
9. **Rollout behind a feature flag** (hash of the Telegram user ID), with a 10–20% holdout for at least 6–8 weeks to get past the novelty dip.
   - Measure D1/D7/D30, sessions per week, questions per week and per minute, accuracy, planned-set completion and review adherence.
   - Watch for novelty and primacy effects (Microsoft ExP).
   - Education-app D30 benchmarks conflict (about 2% vs about 8%), so compare against your own holdout, not industry numbers.

## 6. Concrete recommendations for this design

- **Per question** (never blocking, ≤ 320 ms):
  - After the student answers, the climber steps up one ledge in a 48–64 px strip above the stem, with a light haptic.
  - On a wrong answer, a flag is planted.
  - Next goes straight to the next stem with no world screen in between.
  - The existing comments, explanation and MotionCards video stay exactly as they are.
- **Per block of 10–20 MCQs** (20 matches the new USMLE block size; Step 1 has 14 blocks of 30 minutes with up to 20 questions each, about 90 s per question):
  - A 2–4 s story beat: stairs, elevator, campfire.
  - Skippable with one tap, and auto-skipped after the first viewing.
- **Per chapter or book:** the full map screen (Duolingo-style path; "MCQs Mountain" is the book), the summit, and flags waiting for review.
- **Time budget**
  - Two 1.5 s transitions per item cost about 5 minutes per 100 MCQs. That is about 3% at a 90 s pace and 10–15% at a 20–30 s review pace.
  - The strip design costs 0 s of blocking time.
  - Fast students: auto "speed mode" when their median answer time is low, plus an off switch for celebrations (Duolingo added one).
- **Reduced motion:** honour `prefers-reduced-motion` (WCAG 2.3.3, AAA). Kafu already zeroes durations. Replace the walk with an instant position change and a text label ("Ledge 23/40"). No information should depend on motion or haptics.
- **Story tied to the subject:** a thin story, schematic art, terrain by organ system, with camps named after chapters. Reuse the image-lesson characters as a "rope team" (competition plus collaboration, e.g. a class summit goal), but keep the game layer simple.
- **Iraq and low-end devices:** one WebP sprite atlas, cached by the offline shell. Stay within the 150 KB JS budget: no Phaser or Pixi in production, and no Rive (its WebAssembly runtime is about 2.1 MB). Use `disableVerticalSwipes` (Bot API 7.7+) only if swipe gestures conflict.

## What a top professional would do that you are not asking for

- Refuse to draw characters first: gray-box, test, then art.
- Measure the current app's baseline before building anything.
- Turn the question into the level and drop the coin-before-question order.
- Make questions per minute and accuracy hard guardrails.
- Plan for novelty decay: measure for 6–8 weeks or more with a holdout.
- Preregister kill criteria (free on OSF; from memory).
- Run accessibility and low-end performance gates.
- Rule out manipulative monetization and streak anxiety.

## Rawest material to start from

Instead of other apps' screenshots and blog summaries:
- Kafu's own per-question timestamps and session-end points.
- Screen recordings and think-alouds of 5 real Iraqi students doing their normal 20–40-question session, on their own phones and their own networks, inside Telegram.
- Frame-time traces from Telegram's Android WebView via remote debugging.
- The meta-analyses' moderator tables, not their abstracts. Clark 2016 Table 3 and Sailer Tables 2–4 are the useful parts.
- Interviews about the exam calendar: when students do 100+ MCQs and when they only have 10 minutes.

## Methods and tools (all free)

- **Prototyping:** Figma free tier or paper; plain HTML/CSS transforms or the Web Animations API, or KAPLAY 3001.0.19 (MIT, about 70 KB gzipped) for the gray-box.
- **Art:**
  - Kenney CC0 packs as placeholders.
  - LibreSprite (GPL fork, free) or Aseprite (minimum $19.99, or compile it yourself for personal use).
  - Lottie-light 5.13 (MIT, about 46 KB gzipped) if vector animation is needed.
- **Feel:** Telegram HapticFeedback.
- **Research:** think-aloud, RITE, Nielsen 5-user rounds, PXI (Player Experience Inventory, validated in 5 studies with 529 participants), IMI.
- **Data and experiments:** Workers Analytics Engine or batched D1; a feature flag by hashed user ID; a counterbalanced crossover; a delayed, held-out knowledge test.

## What, other than you or me, would show it is right

- Logged behaviour of real students compared against a control or holdout: questions per minute, completion, voluntary 7-day return, accuracy.
- A blinded, delayed (1–2 week) knowledge test on items held out from the practice bank.
- Five students who have never seen the idea, completing tasks without help in think-aloud sessions.
- Frame-time traces on a low-end Android phone that meet the gates above.
- Validated questionnaires (PXI/IMI) instead of "do you like it?".
- A preregistration that fixes the success criteria in advance.
- An external medical educator (an exam setter) and a game designer reviewing the gray-box.
- The TESLA-G protocol as an independent template: its feasibility thresholds of at least 75% retention and 80% completion.

---

## Fact-check result

57 of 60 claims confirmed by the independent checker. Corrections (these win over the text above):

- **C11 (corrected)**: Sundararajan & Adesope 2020 (Educ Psychol Rev 32:707-734): seductive details effect g=-0.33 over 58 studies/68 effects; larger when learners could not control pacing and when details were frequent.
  - Correct: Sundararajan & Adesope 2020 (Educ Psychol Rev 32(3):707-734) is right on g = -0.33, 58 studies and 68 effects. The original abstract lists learner pacing among the significant moderators, alongside image type, delivery format, language, subject, recall question type and manipulation check. It does not list frequency. Secondary summaries conflict: ACU says frequent details hurt more, while the QIC umbrella summary reports no difference by frequency, timing or placement. Treat 'larger when frequent' as unverified. Secondary sources also say static details were more harmful than dynamic ones, and most studies lasted only 6-12 minutes (WSU press release).
  - Source: https://link.springer.com/article/10.1007/s10648-020-09522-4
- **C17 (corrected)**: Hanus & Fox 2015 (Computers & Education): badges, coins and leaderboard over a 14-week course reduced motivation and satisfaction over time.
  - Correct: Hanus & Fox 2015, Computers & Education 80:152-161 (corrigendum 2018, vol. 127). Students were measured at four points during a 16-week semester, not 14 weeks. The gamified course used a leaderboard and badges (one secondary table also lists virtual coins). Compared with an identical non-gamified course, its students showed less intrinsic motivation, satisfaction and empowerment over time. They also had lower final exam scores, mediated by intrinsic motivation.
  - Source: https://osu.academia.edu/MichaelHanus
- **C20 (corrected)**: Fairplay (advocacy) observed 16 membership ads and 4 math problems in 19 minutes of Prodigy play, and quotes the Prodigy-commissioned Johns Hopkins evaluation: students tended to 'wander about' and 'More and more usage of Prodigy may not result in more and more achievement'.
  - Correct: Fairplay counted 16 membership ads and 4 math 'battles' in a 19-minute session, not 4 math problems; one battle can contain several questions. The Johns Hopkins quotes ('wander about'; 'More and more usage of Prodigy may not result in more and more achievement', p. 26) and 'funded by Prodigy' are accurate.
  - Source: https://fairplayforkids.org/?p=26304

### What the checker said was missing or misleading

1) The report says KAPLAY or plain DOM/CSS 'fits', but KAPLAY does not. The budget Kafu actually enforces is JS+CSS combined at 150 KB gzipped (153,600 B; tools/ui/check.py budget(), HANDOFF.md). The last recorded usage is 116,858 B (docs/design/design1-approved/README.md, PROGRESS.md item 8), leaving about 36 KB. KAPLAY (69.6 KB gz, re-measured) does not fit, and neither does a stripped-down Phaser custom build (about 110 KB gz, Phaser 3 community example, https://github.com/Ryu204/phaser-custom-build). Only plain DOM/CSS/Web Animations, or at most GSAP (28 KB), fits once the game is integrated. A separate prototype can use anything, but it should be built under the same budget so that its speed results carry over.

2) The report's per-answer step-up animation breaks Kafu's own design rules. Rule 6 says 'No animation on every study event', and the motion section says 'Avoid continuous motion in study views' (docs/DESIGN_STYLE.md lines 71 and 53). The report quotes these rules but never points out the conflict; the owner would have to change them explicitly. On the other side, the same file's 'two-second signature test' (line 111) already requires a 'game-style study app', which supports the owner's direction.

3) Some of the evidence is stretched:
   - Deci et al. measured tangible rewards for interesting lab tasks; applying that to virtual coins is an inference.
   - Habgood & Ainsworth compared integrated vs non-integrated game versions; their control had no maths at all, so they never tested 'game wrapper vs plain quiz app', which is Kafu's real choice. In their study, extrinsic players also made about half as many maths attempts (198 vs 382), so time-on-task explains part of the gap.
   - Clark's schematic-vs-realistic moderator became marginal (p=.09) after controls, and Sailer's randomized-vs-quasi cognitive difference was not significant (p=.28). These are correlational, between-study moderators, not tested design rules.
   - 'Delete the coin-before-question order' is a reasonable inference; no study tested that ordering.

4) The evidence on 'juice' is mixed. Kao and co-authors (CHI 2024) found that amplification-type juice reduced player motives, while success-dependent feedback enhanced them (https://www.universityxp.com/research/2026/7/19/how-does-juicy-game-feedback-motivate-testing-curiosity-competence-and-effectance). So a particle burst on every answer is not automatically good.

5) The seductive-details evidence is weaker than presented. The original abstract supports pacing but not frequency. Static details were reportedly more harmful than dynamic ones, and most studies used 6-12-minute sessions (https://news.wsu.edu/press-release/2020/03/19/seductive-details-inhibit-learning). The 'walk is a seductive detail' argument is therefore plausible but indirect.

6) Hanus & Fox, which the report cites from memory, found lower final exam scores (mediated by intrinsic motivation) over a 16-week semester. That is direct evidence that a badges-and-leaderboard layer can hurt achievement, not just motivation.

7) TESLA-G's last known status is 'not yet recruiting' (registry last updated April 2023), and no results have been found anywhere. The owner should not read it as evidence that gamified Telegram MCQs work; it is only a protocol template (BMJ Open 2023 protocol).

8) The report never mentions free Telegram options that fit the owner's 'separate prototype, no integration' condition:
   - Bot API 8.0 fullscreen plus lockOrientation (made 'to host more games') and 9.0 DeviceStorage, in a separate test Mini App (https://core.telegram.org/bots/webapps).
   - A separate bot using Telegram's HTML5 Gaming Platform, with built-in per-chat high scores (https://core.telegram.org/bots/games).
   Either lets real students try the prototype inside Telegram without touching Kafu.

9) Minor points:
   - The Anki 'Gamification' list does include per-answer feedback add-ons (Anki Killstreaks, Hitmarkers, Life Drain), so 'none act between cards' overstates it.
   - The duoleavemealone rating rests on 16 reviews.
   - The Prodigy figure is 4 math 'battles', not 4 problems.
   - RAIL is now superseded by Core Web Vitals and INP on web.dev, so the performance gate should also report INP.

> Note: the checker above quotes 116,858 B / about 36 KB of budget headroom. That figure is from DESIGN 1 and is out of date; the current CI-exact measurement is 153,244 of 153,600 B (356 B left). See `01-code-map.md`.

### Sources: every claim with its verdict

| ID | Verdict | Claim | Source |
|---|---|---|---|
| C1 | confirmed | Sailer & Homner 2020 (Educ Psychol Rev 32:77-112): gamification effects cognitive g=.49 [0.30,0.69] k=19 N=1686; motivational g=.36 [0.18,0.54] k=16 N=2246; behavioral g=.25 [0.04,0.46] k=9 N=951. | https://opus.bibliothek.uni-augsburg.de/opus4/files/109056/109056.pdf |
| C2 | confirmed | Sailer & Homner: game fiction moderated behavioral outcomes (with fiction g=.41 [0.31,0.51] k=3; without g=.10 n.s. k=7) but not cognitive outcomes (with .47, without .51); studies with fiction were less likely to be randomized (r=-.41). | https://opus.bibliothek.uni-augsburg.de/opus4/files/109056/109056.pdf |
| C3 | confirmed | Sailer & Homner: competitive-collaborative social interaction g=.70 on behavioral outcomes (k=3) vs competitive only g=.12 n.s. | https://opus.bibliothek.uni-augsburg.de/opus4/files/109056/109056.pdf |
| C4 | confirmed | Sailer & Homner: for cognitive outcomes, randomized experiments g=.29 [0.07,0.51] k=6 vs quasi-experimental g=.56; high-rigor subsplit: cognitive g=.42 significant, motivational g=.22 p=.20 and behavioral g=.27 p=.22 not significant. | https://opus.bibliothek.uni-augsburg.de/opus4/files/109056/109056.pdf |
| C5 | confirmed | Bai, Hew & Huang 2020 (Educational Research Review 33, 100322): g=0.504 [0.284,0.723], 30 interventions, 3,202 participants; no significant differences by game element type or number; students disliked that gamification 'does not bring additional utility' and that it could cause anxiety or jealousy. | https://www.gbl.uzh.ch/quartz/references/Bai-et-al.-(2020) |
| C6 | confirmed | Huang et al. 2020 (ETR&D 68(4):1875-1901): g=.464 [.244,.684], 30 studies, N=3,083. | https://pure.ecnu.edu.cn/en/publications/the-impact-of-gamification-in-educational-settings-on-student-lea |
| C7 | confirmed | Lee et al. 2026 (Med Educ Online 31(1):2614233): gamified learning for clinical reasoning, 10 of 26 studies pooled (931 learners), SMD 1.11 [0.69,1.52], I2=85.4%, trim-and-fill adjusted 0.75, GRADE certainty low; authors suggest learner choice, adaptive challenge and informative feedback over competition-driven designs (not tested). | https://pmc.ncbi.nlm.nih.gov/articles/PMC12805841/ |
| C8 | confirmed | van Gaalen et al. 2021 (Adv Health Sci Educ): 44 of 5,044 records included; assessment most common attribute (n=40), often with conflict/challenge (n=27); no negative outcomes reported; most studies lacked well-defined control groups; warns competition may shift attention from learning to winning. | https://pmc.ncbi.nlm.nih.gov/articles/PMC8041684/ |
| C9 | confirmed | Gentry et al. 2019 (JMIR): 27 RCTs + 3 cluster RCTs, 3,634 participants; serious gaming/gamification at least as effective as controls; evidence of low or very low quality for all outcomes. | https://pmc.ncbi.nlm.nih.gov/articles/PMC6458534/ |
| C10 | confirmed | Deci, Koestner & Ryan 1999 (128 studies): engagement-, completion- and performance-contingent rewards undermined free-choice intrinsic motivation (d=-0.40, -0.36, -0.28); positive feedback enhanced free-choice behavior (d=0.33) and self-reported interest (d=0.31); all tangible rewards d=-0.34 (92 studies); unexpected tangible rewards d=0.01 (n.s.). | https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf |
| C11 | corrected | Sundararajan & Adesope 2020 (Educ Psychol Rev 32:707-734): seductive details effect g=-0.33 over 58 studies/68 effects; larger when learners could not control pacing and when details were frequent. | https://inspire.acu.edu.au/articles/seductive-details |
| C12 | confirmed | Clark, Tanner-Smith & Killingsworth 2016 (RER 86(1)): games vs non-game g=0.33 [0.19,0.48] k=57; single session g=0.08 n.s. vs multiple 0.44; narrative none 0.44, thin 0.47, medium -0.03 n.s., thick 0.36 n.s. (k=5); visuals schematic 0.48, cartoon 0.32, realistic -0.01; simple points/badges 0.53 vs more than points/badges 0.25 (difference p=.07). | https://pmc.ncbi.nlm.nih.gov/articles/PMC4748544/ |
| C13 | confirmed | Habgood & Ainsworth 2011 (J Learning Sciences 20(2):169-206): 58 children learned more from the intrinsic version under fixed time; 16 children with free choice spent 7 times longer playing the intrinsic version. | https://shura.shu.ac.uk/3556/ |
| C14 | confirmed | In Habgood & Ainsworth's extrinsic Zombie Division, combat was non-mathematical and division problems were multiple-choice tests between/at the end of levels (structurally like a quiz-between-walks wrapper). | https://eprints.whiterose.ac.uk/189921/1/LearningByDoingCuttingAndIacovides090822.pdf |
| C15 | confirmed | Cutting & Iacovides 2022 (PACM HCI, CHI PLAY, article 240): preregistered study, n=210; learning higher in the intrinsically integrated version with no significant differences in motivation or cognitive load, suggesting an attentional mechanism. | https://eprints.whiterose.ac.uk/189921/1/LearningByDoingCuttingAndIacovides090822.pdf |
| C16 | confirmed | Rodrigues et al. 2022 (IJETHE): 756 STEM students over 14 weeks; gamification effect began decreasing after four weeks, the decrease lasted two to six weeks, then trended upward between six and 10 weeks (U-shape; novelty then familiarization). | https://www.universityxp.com/research/2022/10/3/gamification-suffers-from-the-novelty-effect-but-benefits-from-the-familiarization-effect-findings-from-a-longitudinal-study |
| C17 | corrected | Hanus & Fox 2015 (Computers & Education): badges, coins and leaderboard over a 14-week course reduced motivation and satisfaction over time. | memory |
| C18 | confirmed | Hamari, Koivisto & Sarsa 2014 (HICSS): gamification effects are mostly positive but depend on context, user characteristics and possible novelty effects. | https://gamification-research.org/2013/09/does-gamification-work-a-look-into-research/ |
| C19 | confirmed | Prodigy's own Council Bluffs study: about 0.73 ISASP scale-score points higher per additional hour spent answering questions (grades 5-6; 1,390 students in grades 5-7), from retrospective correlational analyses. | https://www.prodigygame.com/blog/council-bluffs |
| C20 | corrected | Fairplay (advocacy) observed 16 membership ads and 4 math problems in 19 minutes of Prodigy play, and quotes the Prodigy-commissioned Johns Hopkins evaluation: students tended to 'wander about' and 'More and more usage of Prodigy may not result in more and more achievement'. | https://fairplayforkids.org/?p=26304 |
| C21 | confirmed | A coalition of 22 groups led by CCFC filed an FTC complaint against Prodigy on Feb 19, 2021, alleging 'free' claims while pushing Premium memberships ($59.88-$107.40/year) to children. | https://fairplayforkids.org/feb-19-2021-advocates-to-ftc-prodigy-math-game-preys-on-kids-and-families/ |
| C22 | confirmed | Duolingo's new home screen (linear path replacing the tree) launched to all learners on November 1, 2022; lessons reordered with spaced repetition and mixing; 'Practice is also forward progress'; the post reports no metrics. | https://blog.duolingo.com/new-duolingo-home-screen-design/ |
| C23 | confirmed | Duolingo Q1 2022 shareholder letter: 'we are currently experimenting with the new path on a subset of our new users' and 'have seen encouraging results', with no figures. | https://www.sec.gov/Archives/edgar/data/1562088/000156208822000058/duolingo_q1-2022xshareho.htm |
| C24 | confirmed | Duolingo Q4 2022 earnings call: von Ahn said that with choice 'a significant fraction' of users were 'just coming in to extend the streak with really easy lessons'; teams are held to the rule that they 'cannot screw up the other metrics'. | https://www.fool.com/earnings/call-transcripts/2023/02/28/duolingo-duol-q4-2022-earnings-call-transcript/ |
| C25 | confirmed | Former Duolingo CPO Jorge Mazal: leaderboards raised overall learning time 17% and tripled highly engaged learners, with D1/D7 retention improving significantly; DAU grew 4.5x over four years (combined efforts); a Gardenscapes-style moves counter was 'completely neutral' and 'a boring, tacked-on nuisance'. | https://lennysnewsletter.com/p/how-duolingo-reignited-user-growth |
| C26 | confirmed | The 'duoleavemealone' Chrome extension auto-clicks through Duolingo interstitial screens after correct answers and completed lessons (993 users, 4.4/5); Duolingo now has its own option to turn off motivational messages. | https://chromewebstore.google.com/detail/duoleavemealone-for-duoli/clipadhhddnpnocanhnbonnhppdibnpf |
| C27 | confirmed | Picmonic states its Anki add-on works with popular add-ons including Pokemanki, Kitten Rewards, Anki Fanfare and Anki Habitat. | https://help.picmonic.com/en/articles/4651410-will-the-picmonic-anki-add-on-work-if-i-ve-got-other-add-ons-installed |
| C28 | confirmed | Ankimon (by Unlucky-life, AnkiWeb code 1908235722) is listed in the Gamification section of the AnkiWeb forum 'Awesome Add-ons' list. | https://forums.ankiweb.net/t/awesome-add-ons/54116.md |
| C29 | confirmed | Wang & Tahir 2020 (Computers & Education 149, 103818) reviewed 93 Kahoot! studies: positive effects on learning performance, classroom dynamics, attitudes and anxiety, some studies with little or no effect; student challenges included stressful time pressure and being unable to change answers. | https://research.gold.ac.uk/id/eprint/39435 |
| C30 | confirmed | TESLA-G (NCT05520671): gamified, Telegram-delivered MCQ platform for medical students with levels, countdown timer, lives, point multiplier, leaderboard and dashboard; 50 students randomized 1:1 for 14 days against the same platform with gamification removed; primary outcome feasibility (enroll 50, retain >=75%, 80% quiz completion); knowledge comparison stated as underpowered; status unknown, no results posted. | https://clinicaltrials.gov/study/NCT05520671 |
| C31 | confirmed | Yang et al. 2014 (Adv Med Educ Pract) Picmonic RCT reported significantly better retention vs text (P<0.001); several authors had a financial interest in Picmonic. | https://www.dovepress.com/the-picmonicreg-learning-system-enhancing-memory-retention-of-medical--peer-reviewed-article-AMEP |
| C32 | confirmed | Adesope, Trevisan & Sundararajan 2017 (RER): practice tests are more beneficial for learning than restudying and all other comparison conditions. | https://rex.libraries.wsu.edu/esploro/outputs/journalArticle/Rethinking-the-Use-of-Tests-A/99900601154801842 |
| C33 | confirmed | Metcalfe 2017 (Annu Rev Psychol 68:465-489): errors followed by corrective feedback enhance later memory for correct responses, especially high-confidence errors (hypercorrection). | https://wesleyan.edu/ofcd/resources/OFCD Resource Docs/Learning from Errors.pdf |
| C34 | confirmed | Kao et al. 2020 (Entertainment Computing vol. 34): four versions of an action RPG; Medium and High Juiciness outperformed No and Extreme Juiciness across all measures. | https://www.goodreads.com/author_blog_posts/19932694-the-effects-of-juiciness-in-an-action-rpg-new-study |
| C35 | confirmed | Jonasson & Purho's GDC Europe talk 'Juice it or lose it' defines juice as 'maximum output for minimum input', demonstrated on a Breakout clone with tweening, stretching and squeezing. | https://www.gamedeveloper.com/design/video-is-your-game-juicy-enough- |
| C36 | confirmed | Swink defines game feel as 'real-time control of virtual objects in a simulated space, with interactions emphasised by polish'; real-time means a feedback cycle under 100 ms. | https://arxiv.org/pdf/2011.09201 |
| C37 | confirmed | NN/g: UI animations 100-500 ms; ~100 ms for simple feedback; 200-300 ms for substantial screen changes; near 500 ms feels like a drag; the more frequent the animation, the shorter it should be. | https://www.nngroup.com/articles/animation-duration/ |
| C38 | confirmed | NN/g response time limits: 0.1 s feels instant, 1 s keeps flow of thought, 10 s is the limit of attention; long delays should occur at natural breaks. | https://www.nngroup.com/articles/response-times-3-important-limits/ |
| C39 | confirmed | RAIL: complete input-triggered transitions within 100 ms (handle input within 50 ms); produce each animation frame in 10 ms or less (16 ms budget at 60 fps). | https://web.dev/articles/rail |
| C40 | confirmed | web.dev: animate only transform and opacity; in their test animating top/left dropped 50% of frames vs 1% with transform. | https://web.dev/articles/animations-guide |
| C41 | confirmed | WCAG 2.2 SC 2.3.3 Animation from Interactions (Level AAA): interaction-triggered motion can be turned off unless essential; techniques C39/SCR40 use prefers-reduced-motion; non-essential motion can trigger vestibular disorders. | https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html |
| C42 | confirmed | Telegram Mini Apps: HapticFeedback (impactOccurred light/medium/heavy/rigid/soft; notificationOccurred; selectionChanged) is Bot API 6.1+; disableVerticalSwipes Bot API 7.7+; requestFullscreen Bot API 8.0+ (Nov 17, 2024); CloudStorage up to 1024 items per user, values up to 4096 characters. | https://core.telegram.org/bots/webapps |
| C43 | confirmed | Nielsen: 5 users find about 85% of usability problems (N(1-(1-L)^n), L=31%); run iterative small rounds; quantitative studies need about 20 users. | https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/ |
| C44 | confirmed | RITE (Medlock et al. 2002): fix problems between participants; in the Age of Empires II case, iteration with ten participants was followed by six participants needing no changes (verification step). | https://measuringu.com/rite-method/ |
| C45 | confirmed | Kim et al. CHI 2008 'Tracking Real-Time User Experience (TRUE)' (pp. 443-452) combines instrumentation with attitudinal and contextual data to answer 'the why behind the what'. | https://www.springerprofessional.de/doi/10.1145/1357054.1357126 |
| C46 | confirmed | A two-sample t-test with d=0.5, alpha=.05 and 80% power needs about 64 participants per group. | https://stats.libretexts.org/Bookshelves/Introductory_Statistics/Statistical_Thinking_for_the_21st_Century_(Poldrack)/19%3A_Statistical_Power_in_R/19.01%3A_Power_Analysis |
| C47 | confirmed | Minimum detectable effects at 80% power, alpha .05 (normal approximation computed in this session): between groups d=0.79 at 25/arm, 0.56 at 50/arm; within-subject dz=0.63 at n=20, 0.51 at n=30, 0.40 at n=50. | memory |
| C48 | confirmed | Cloudflare Workers Analytics Engine on the Workers Free plan: 100,000 data points written per day and 10,000 read queries per day (currently not billed). | https://developers.cloudflare.com/analytics/analytics-engine/pricing/ |
| C49 | confirmed | Cloudflare D1 Workers Free plan: 5 million rows read/day, 100,000 rows written/day, 5 GB total storage; limits reset at midnight UTC. | https://developers.cloudflare.com/d1/platform/pricing/ |
| C50 | confirmed | Measured from jsDelivr (gzip -9): phaser@4.2.1 phaser.min.js 1,375,976 B raw / 352,245 B gz (MIT); pixi.js@8.22.0 pixi.min.js 840,663 / 236,858 B gz (MIT); kaplay@3001.0.19 dist/kaplay.js 189,085 / 69,562 B gz (MIT); @rive-app/canvas@2.45.0 rive.js 126,442 B gz plus rive.wasm 2,096,365 B (MIT); lottie-web@5.13.0 lottie_light.min.js 46,441 B gz (MIT); gsap@3.15.0 28,285 B gz (GSAP Standard no-charge license). | https://cdn.jsdelivr.net/npm/phaser@4.2.1/dist/phaser.min.js |
| C51 | confirmed | Kenney platformer asset packs are CC0 (commercial use allowed, attribution not required). | https://kenney-assets.itch.io/pixel-platformer |
| C52 | confirmed | Aseprite's FAQ lists a $19.99 minimum for the binaries; the source is under a non-FOSS EULA but can be compiled for personal use; LibreSprite is a free GPLv2 fork. | https://aseprite.org/faq/ |
| C53 | confirmed | USMLE Step 1 on or after May 14, 2026: 14 blocks of 30 minutes with up to 20 questions each (max 280), i.e. about 90 seconds per question. | https://www.usmle.org/step-exams/step-1 |
| C54 | confirmed | Player Experience Inventory (PXI) was developed with 64 games user research experts and validated across five studies with 529 participants. | https://uwspace.uwaterloo.ca/items/91a094d7-abd3-4aad-8a40-87ca6aa59d67/full |
| C55 | confirmed | Microsoft research (Sadeghi et al., arXiv 2102.12893) defines novelty as a desire to use new technology that fades over time and primacy as growing engagement as users adopt a feature, and proposes estimating these long-term effects. | https://arxiv.org/pdf/2102.12893 |
| C56 | confirmed | Education-app retention benchmarks conflict: Business of Apps reports about 2% day-30 retention, while OneSignal 2024 data cited secondarily shows about 8% for Education. | https://www.businessofapps.com/?p=98187 |
| C57 | confirmed | Kafu design rules: motion tokens 80/120/180/320 ms; transform/opacity only; prefers-reduced-motion sets durations to zero; 'No animation on every study event'; wrong answers get neutral feedback with no teasing or punitive effects; Telegram haptics via game-feel.js; sound off by default. | /home/user/MCQs-Mountain-/docs/DESIGN_STYLE.md |
| C58 | confirmed | Kafu already shows an XP/level/streak HUD and badges (first chapter, seven-day streak, 100 questions, chapter mastered) in app/design/delight.js, and keeps app JavaScript at most 150 KB gzipped (docs/DESIGN.md performance budget). | /home/user/MCQs-Mountain-/app/design/delight.js |
| C59 | confirmed | Kafu's leaderboard already consumes D1 free-tier quota; the admin panel warns at 70% of the 5,000,000 rows read / 100,000 rows written daily free limits. | /home/user/MCQs-Mountain-/docs/LEADERBOARD_USAGE.md |
| C60 | confirmed | Wouters et al. 2013 (J Educ Psychol 105(2):249-265): serious games more effective for learning (d=0.29) and retention (d=0.36) but not more motivating (d=0.26) than conventional instruction; larger effects with supplementary instruction, multiple sessions and group play. | memory |
