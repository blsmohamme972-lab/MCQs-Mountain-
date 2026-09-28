# Invisible chapter downloads

Tap a chapter: its text is fetched, saved and opened without waiting for the image ZIP. Images then arrive in the background. A missing question image is clearly shown and prevents grading that image-dependent question until it is available; explanations can finish loading after the text.

Only the immediately following chapter is prefetched. Prefetch does not recursively download a book, is skipped offline/on Save-Data or 2G connections, and shares in-flight requests with foreground opens. The whole-book button processes chapters sequentially, shows progress and reports partial failures rather than claiming success.

**Available offline ✓** means the current catalog's text and all referenced question/explanation images have been saved to persistent IndexedDB. A partial image failure does not earn that mark. A storage-quota failure keeps online text readable but leaves the chapter incomplete. When IndexedDB is unavailable, the app says the content is available for this session rather than promising it will survive closing Telegram.

The size label uses published byte metadata and actual cached archive sizes. For older catalogs missing image sizes, at most eight HEAD requests are attempted when a book is opened; if a size still cannot be established, the label explicitly says **at least ... (some image sizes unavailable)**. No PDF/source file is downloaded. No guessed exact book sizes.

Published chapter URLs and versions are checked before reusing current cached content. A saved older copy remains usable offline if a newer version cannot be fetched. Failed refreshes do not delete the old copy or personal progress. Removing a chapter waits for its active write to settle, then removes its pack and image blobs so a late background task cannot silently recreate it.

The MIT fflate 0.8.3 decoder is version/hash-pinned and inlined with the app, replacing runtime CDN dependence. ZIP downloads are capped at 25 MiB; expected image names are filtered before decompression, individual and total expanded sizes are bounded, and missing/non-WebP images fail safely. Only approved content origins are fetched, without credentials.

Phone test: open KAFU Upload Test > tap its chapter > watch text then images > return to the book and wait for the offline mark. Turn on airplane mode and reopen the chapter. Try Save whole book for offline on a multipart fixture, then reopen it offline. Do not delete the protected production book using the bot; local downloaded copies may be removed in Me without changing publishing.
