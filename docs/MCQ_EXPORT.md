# Owner MCQ text export

The Mini App exposes the **Copy MCQs for AI** controls only after `/admin/capabilities` returns `can_export_mcqs: true`. The Worker verifies the Telegram Web App signature, requires an `auth_date` no older than 24 hours and no more than 60 seconds in the future, and compares the verified Telegram user ID only with `OWNER_TELEGRAM_ID`. `ADMIN_IDS` does not grant this capability.

The two export reads are private, `POST`, `no-store` endpoints:

- `/admin/mcq-export/catalog` pins a published book/version and returns the validated catalog snapshot hash.
- `/admin/mcq-export/chapter` accepts only the pinned book/version/chapter ID, re-reads the catalog, rejects a changed snapshot, validates the approved Content Worker origin, refuses redirects, and returns one bounded published chapter pack.

The browser requests chapters with a maximum concurrency of two, validates every manifest count and ordered permanent QID, rejects sample content, duplicate QIDs, missing chapters, and revision changes, then assembles the export. The original question objects are copied into `questions` without rewriting or answer shuffling.

## JSON contract

Each complete export is a UTF-8 JSON object with:

- `export_type: "kafu_mcq_text_export"` and `schema_version: 1`;
- `exported_at`, `source`, pinned catalog/chapter SHA-256 hashes, and published image-pack URLs;
- `scope`, complete `book` metadata, all actual `chapters`, and expected/exported counts;
- `questions`, containing the original published objects, including all supported question types and fields;
- `export_metadata.question_integrity`, with the exact QID, publisher fingerprint (authoritative when present, otherwise the implementation-equivalent `tools/publish.py` fingerprint), and a SHA-256 `content_hash` over the versioned canonical serialization of that complete question object;
- `export_metadata.image_bytes_embedded: false`, image entry filenames and checksums only when published, and an explicit statement that question hashes do not verify image bytes;
- `ai_instructions`, requiring future animation outputs to retain `book_id`, `book_version`, `chapter_id`, `qid`, `publisher_fingerprint`, and `content_hash`, and prohibiting guessed image content.

The canonicalization is `kafu-question-canonical-json-v1`: recursively sort object keys, preserve array order and JSON scalar values, serialize without whitespace, then hash UTF-8 bytes. Export metadata is excluded from this hash.

When the complete pretty-printed file exceeds 900,000 UTF-8 bytes, the UI also offers numbered parts. Parts split only between complete question objects and include their own book/version/scope, part index/count, total count, and QID list. The complete-file copy and download remain available.

The text export contains references to the real published image pack and its entry filenames; it does not embed image bytes or invent temporary/direct URLs.
