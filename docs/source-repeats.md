# Printed source repeats

Ordinary exact duplicates remain errors. A separately printed repeat can be
retained with `question.source_duplicate_of` and a matching `book.source_duplicates`
entry: `{"local_id": 283, "duplicate_of": 193, "reason": "Printed source repeat"}`.
The target must already appear in this ZIP. Both questions must have book-key
answers, equal types, equal stems/options after whitespace removal, equal answers,
and different PDF pages and source identities (chapter, printed number, page).
Missing, invalid, altered, or unused declarations are errors.

For separately printed questions sharing a stem but having different options,
use `question.source_variant_of` and `book.source_variants` entries with
`local_id`, `variant_of`, and `reason`. The target must already appear, the stems
must agree after whitespace removal, options must differ, types must agree,
answers must come from book keys, and source identities must differ. A shared
page is permitted for distinct printed numbers. Undeclared variants still warn.

Record all retained repeats and any authorized editorial corrections in report.md.
Declarations do not bypass the source audit, ZIP safety checks, answer validation,
or release checks. Do not invent declarations to conceal extraction duplicates.

Numeric option signs are significant: +70 mV and −70 mV are distinct. Suspended
hyphens such as “high- or low-velocity” are valid; “hypo- thermia” still warns.
