# Privacy and educational-use copy

The app's Me → Privacy page describes current behavior, not an unimplemented data pipeline:

- Study history and downloads are local. Complete new answer-event history is device-local; compact progress, known correct counts, mistakes, stars, FSRS, time/active days and resume use Telegram CloudStorage when available.
- The current question-report button saves reports locally and does not yet transmit them to the owner. Community comment reports are separate: authenticated reports about comments are stored online for moderation.
- Cloudflare serves app/content and stores owner queue/moderation metadata plus Community comments, Helpful votes, reports and moderation state in D1. Community is optional; study history remains separate and does not depend on Community. Private GitHub releases hold publication archives/master state. All app fonts, including the Arabic fallback used by Community text, are self-hosted.
- Community comments are shared with other authenticated Kafu students while the related question remains active. A comment shows the author's verified Telegram display name and Telegram profile photo when Telegram supplies one; Telegram username, numeric Telegram ID and phone number are not shown publicly. Kafu stores only the minimum verified presentation fields needed for historical comments plus a non-public derived ownership key.
- Comments are plain text. Helpful votes do not mean medically verified. Only owner-authorized moderation can label a reply “Verified by Kafu”. Do not post patient-identifiable information in Community.
- Deleting your own comment removes its body from normal public display and marks the record deleted for moderation/integrity purposes. Kafu does not promise instant erasure from infrastructure-provider backups or historical provider recovery copies.
- Kafu never sells student data. Do not upload patient-identifiable information.
- Reset explicitly clears synced study progress after confirmation, retaining stars. Download deletion is device-local. Neither control is described as immediate erasure of provider backups or historical cloud checkpoints.

The exact notice **Educational use only — not for clinical decisions** appears until the user acknowledges it, once per local account/device, and remains permanently accessible in About/Me. Acknowledgement is stored with local settings and is not an authorization or medical-consent mechanism. It does not disable study or silently reset progress.

Physical acceptance: open the app, acknowledge the notice, reopen and confirm it stays dismissed; then Me → About Kafu and Privacy should still show the disclaimer and storage information. Review the wording as the service owner before inviting a wider audience.
