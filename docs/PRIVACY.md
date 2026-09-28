# Privacy and educational-use copy

The app's Me → Privacy page describes current behavior, not an unimplemented data pipeline:

- Study history and downloads are local. Complete new answer-event history is device-local; compact progress, known correct counts, mistakes, stars, FSRS, time/active days and resume use Telegram CloudStorage when available.
- A question report saves to the account-scoped local queue first, then sends when online with signed Telegram Mini App data. It contains question ID, book ID/version, reason and an optional note of at most 300 characters. The queue is removed only after server acknowledgment; reports are not part of Telegram CloudStorage backup. The owner's private `/reports` command lists pending reports and `/reports resolve REPORT-ID` deletes a resolved live D1 report. Existing weekly private D1 backups may retain an earlier copy.
- Telegram user ID is verified, then a pseudonymous key is stored only for rate limiting; the raw ID is not stored in D1. Expired rate-limit records are pruned on subsequent submissions. No progress, favorites or answer history is sent with a report. Do not include patient information in notes.
- Cloudflare serves app/content and stores owner queue/moderation metadata plus pending question reports and rate-limit keys in D1. Private GitHub releases hold publication archives/master state. Infrastructure providers and public font delivery necessarily process requests under their own services.
- Kafu never sells student data. Do not upload patient-identifiable information.
- Reset explicitly clears synced study progress after confirmation, retaining stars. Download deletion is device-local. Neither control is described as immediate erasure of provider backups or historical cloud checkpoints.

The exact notice **Educational use only — not for clinical decisions** appears until the user acknowledges it, once per local account/device, and remains permanently accessible in About/Me. Acknowledgement is stored with local settings and is not an authorization or medical-consent mechanism. It does not disable study or silently reset progress.

Physical acceptance: open the app, acknowledge the notice, reopen and confirm it stays dismissed; then Me → About Kafu and Privacy should still show the disclaimer and storage information. Review the wording as the service owner before inviting a wider audience.
