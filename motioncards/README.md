# Kafu MotionCards

> ## ⛔ Independent project — do not use the legacy animation library
> Kafu MotionCards is **not** `Animations and illustrations/` / Medical Motion. Do not modify it, import it, copy components from it, rename it, rebrand it, or make MotionCards depend on it.

This directory contains the authoring contract, schemas, runtime protocol, CLI tooling, fixtures, examples, validation rules and durable handoff for Kafu MotionCards.

The intended owner workflow is:

1. Export published MCQs from Kafu.
2. Give an AI agent that JSON plus exact QIDs/count and durations.
3. The agent reads `MASTER_PROMPT.md`, scaffolds MotionCards, previews and validates them.
4. The tooling calculates source/artifact hashes and builds `MCARDS_<PACKAGE-ID>_r<N>.zip`.
5. The owner uploads that ZIP to `@KafuMcqsbot`.
6. The isolated MotionCards publisher validates source provenance and publishes immutable assets/indexes.
7. The Kafu study screen shows MotionCards only when the current unchanged question matches the published binding.

Development and content authoring are deliberately separate. Content-generation agents must not modify platform code merely to author a batch.

See `PROJECT_BRIEF.md`, `AGENTS.md`, `MASTER_PROMPT.md`, and `HANDOFF.md`.
