# Offline app shell

The optional root `/sw.js` caches the assembled index.html (all application JavaScript is inlined atomically), the Kafu icon, and allowlisted public static assets. Fonts/Google Fonts CSS and Telegram's public SDK are cached when loaded or warmed after an online visit. Runtime public-asset entries are bounded; question packs and images remain in IndexedDB rather than being duplicated in the shell cache.

The published `/catalog.json` is **network-first**, with a bounded network wait and last valid JSON fallback. HTTP errors, HTML challenge pages and malformed catalog JSON cannot replace a good cached catalog. A cache miss while offline returns a real 503; it never fabricates a successful empty library.

No request to `/api`, `/internal` or `/bot` is intercepted/cached. POSTs, authorization/Telegram secret headers, range requests, credential-bearing URLs and unapproved origins bypass the cache. The Worker does not store any personal sync data. Cache cleanup only touches Kafu's own obsolete shell caches and never deletes IndexedDB study history, downloaded chapters or another application's caches.

New cache names are stamped with the deployment commit. The service worker does not call skipWaiting or force a reload while a study session is active. Me reports when an update is waiting; close and reopen Kafu to activate it. The app's entire HTML+inline-code response is cached together, avoiding mixed scheduler/sync module versions.

## Telegram on iPhone/iPad

Registration is feature-detected, caught and never awaited by app boot. A browser that refuses service workers still opens Kafu online and can use its IndexedDB chapters after opening. **A cold offline launch cannot be guaranteed in a Telegram webview that forbids service workers.** Me says so rather than claiming the shell is cached. System fonts remain a readable fallback if external fonts were not cached.

## Phone acceptance

1. While online, open Kafu, then Me. Wait for the offline shell status to say saved, if supported.
2. Open and fully save a chapter. Confirm Available offline ✓.
3. Close/reopen Kafu while still online once, then turn on airplane mode and reopen. Check the shell, Library and saved chapter.
4. Answer a downloaded question and verify Review Due remains usable. Restore connectivity and Sync now.
5. On iPad, also record whether Me reports shell support. An unsupported shell is not a reason to delete local progress or change account settings.

Automated tests use a fake CacheStorage/network and the real policy/response handlers, including API exclusion, offline shell, network-first catalogs, corrupt-response protection, quota failure and non-disruptive registration. Physical Telegram/iOS restrictions still require the owner test.

References: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register and https://developer.mozilla.org/en-US/docs/Web/API/Cache/put (checked 2026-09-28).
