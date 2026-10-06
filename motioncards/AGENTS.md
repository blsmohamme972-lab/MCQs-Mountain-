# Agent instructions — Kafu MotionCards

> **SEPARATION WARNING:** Never modify, import, copy, rebrand, or depend on `Animations and illustrations/` (Medical Motion), DNAgens, or unrelated projects. MotionCards is a clean independent implementation.

## Development agents
- Read `PROJECT_BRIEF.md`, `MASTER_PROMPT.md`, and `HANDOFF.md` first.
- Inspect current main before continuing; preserve unrelated changes.
- Keep all new MotionCards namespaced as documented.
- Update `HANDOFF.md` after every meaningful milestone and before risky/long operations.
- Keep visual/infrastructure PRs open for owner review. Do not merge, apply production migrations, create production services or deploy without this project's owner approval.
- Never test by operating the real book publish queue.
- Do not weaken existing book/export/download/sync/leaderboard/legacy tests.

## Content-generation agents
- Use the exported question objects exactly as supplied.
- Never rewrite questions, allocate QIDs, infer missing records, or change correct answers.
- Use only the requested/selected QIDs and recorded durations.
- Run the provided scaffold/preview/validate/package commands.
- Do not hand-type hashes or checksums; tooling generates them.
- If a figure is essential and its bytes were not inspected through the approved workflow, mark the item blocked.
- A blocked explicit QID is never silently substituted.

## Runtime rules
- Scene code is deterministic against one host-controlled timeline.
- No independent timers/CSS animation loops that ignore pause/seek.
- No eval/new Function, network dependencies, Telegram SDK or app credentials.
- Final panel derives its answer text from validated source data.
