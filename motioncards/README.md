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

## Owner management

Published MotionCards are managed through the existing private owner bot; do not edit hashes, release assets, or D1 rows manually.

- Send `/motioncards Q000000001` to inspect the current card.
- **Preview** opens the trusted Kafu host player, not the raw child HTML entry.
- **Replace** tells you to upload a ZIP containing only the intended replacement card(s). The candidate is fully validated first; if it would replace active cards, the bot lists the exact QIDs and requires an expiring confirmation bound to the owner/private chat, candidate digest, and expected active package/revision/digest.
- **Remove from students** is a reversible soft-unpublish. It removes only that card from the published availability mapping.
- **Restore previous compatible version** revalidates the current published question binding before restoring only that QID. It does not roll back unrelated later uploads.

The student availability index is served with a 30-second cache and the app performs a bounded refresh cycle (35 seconds by default), so a removed card disappears from an already-open compatible question within that documented window after a successful publication. This does not promise deletion of bytes already present on an offline client.

Replacement, removal, and restoration use the same candidate/state/deployment pipeline as ordinary MotionCards publishing. Same-package recovery is a no-op and must not reactivate a removed card or overwrite a newer replacement.

## Local preview

`python tools/motioncards.py preview --workspace work/my-batch --port 8767` serves a loopback-only trusted preview host. The index links to host pages with Play/Pause/Restart/Seek and the final Takeaway/Correct answer panel; it does not link directly to handshake-dependent child HTML.

Loopback HTTP is accepted only by the explicit preview compiler mode. Production scene compilation remains HTTPS-origin restricted.

