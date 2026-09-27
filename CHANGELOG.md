# CHANGELOG

## Unreleased

### M2 Step 2
- Added synthetic all-types, v2, multipart, and broken fixture generation.
- Added real publishing-path fixture proof through the Publish Kafu Book workflow.
- Added duplicate package state helper.
- Added static catalog takedown helper.
- Added Cloudflare live-catalog polling for deploy/rollback/takedown proof.
- Proved stable permanent IDs across v2 and preserved progress keys.
- Proved multipart publishing.
- Proved broken-package repair_report.md generation.
- Proved live rollback and takedown semantics.
- Fixed Library behavior so an empty published catalog falls back to built-in samples.

### M2 Step 1
- Connected Kafu to the published content Worker.
- Added offline image ZIP extraction/storage/rendering.
- Added scalable permanent-question deep-link routing.
- Added app↔publisher contract tests.
