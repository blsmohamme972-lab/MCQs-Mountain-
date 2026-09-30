# Question tables: verification and baseline provenance

The new browser flow checks stems, SBA/multi/EMQ/MTF options, and explanations
at 360, 390, and 430 pixels in light and dark themes, before and after answering.
It verifies actual local table scrolling, document/body width, an attempted
sideways page scroll, bold section rows, escaped source HTML, and unchanged
answer controls. It captures six table screenshots without changing the
existing snapshot set or comparison thresholds.

## Pre-existing Library reference mismatch

Main's owner-authored `de250de85294b72bdf99ab7805b4ae3b8e443b65` commit intentionally
hides unavailable specialties. Its Visual/Flow run **36704655470**, before this
table change, already failed the same 12 Library references. Artifact
**11092260080** contains its screenshots and candidate hashes.

This PR's run **36745912380**, artifact **11112591780**, passed every table and
overflow journey but failed those stale references. Eleven affected images
are pixel-identical to the earlier main artifact. The iPad light no-results
image differs in only 33 rasterized pixels, with identical dimensions and
layout; that snapshot already has documented exact-hash renderer variants.
Run **36747127200**, artifact **11113116832**, confirms two further iPad
no-results variants: 13 light-theme pixels and 39 dark-theme pixels compared
with main, limited to border rasterization. Both retain the same dimensions
and layout. All table, phone overflow and functional checks passed in both runs.
Run **36748799847**, artifact **11114300774**, records one further dark-theme
variant differing from main in 21 pixels at the search field's left border,
with the same dimensions. It is included by exact hash as well.

The 12 refreshed reference hashes come from the earlier **main** artifact,
not from accepting a changed Library in this PR. The four observed iPad
no-results variants are added by exact hash. All other reference entries,
pixel comparison rules, dimensions, budgets, and functional assertions remain
unchanged. No Library application code is changed by this PR.

Affected references: phone/iPad, light/dark, each of Library, Library search,
and Library no-results. These references now track main's three available
fixture specialties instead of the older unavailable-specialty layout.
