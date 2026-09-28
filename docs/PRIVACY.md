# Privacy and educational-use copy

The app's Me → Privacy page describes current behavior, not an unimplemented data pipeline:

- Study history and downloads are local. Complete new answer-event history is device-local; compact progress, known correct counts, mistakes, stars, FSRS, time/active days and resume use Telegram CloudStorage when available.
- The current question-report button saves reports locally and does not yet transmit them to the owner. Owner bot flags/moderation are a separate implemented path.
- Cloudflare serves app/content and stores owner queue/moderation metadata in D1. Private GitHub releases hold publication archives/master state. Infrastructure providers and public font delivery necessarily process requests under their own services.
- Kafu never sells student data. Do not upload patient-identifiable information.
- Reset explicitly clears synced study progress after confirmation, retaining stars. Download deletion is device-local. Neither control is described as immediate erasure of provider backups or historical cloud checkpoints.

The exact notice **Educational use only — not for clinical decisions** appears until the user acknowledges it, once per local account/device, and remains permanently accessible in About/Me. Acknowledgement is stored with local settings and is not an authorization or medical-consent mechanism. It does not disable study or silently reset progress.

Physical acceptance: open the app, acknowledge the notice, reopen and confirm it stays dismissed; then Me → About Kafu and Privacy should still show the disclaimer and storage information. Review the wording as the service owner before inviting a wider audience.
