# iPad full-screen diagnostic (temporary)

1. Open Telegram on the iPad, open Kafu, then tap **Me**.
2. Scroll to **App information**. Confirm the app version starts with `night1-` and a commit is shown. Catalog should say **Published catalog**; built-in fallback is now explicitly labelled.
3. Scroll to **Temporary full-screen diagnostic**. Take a screenshot of Telegram version, platform and isFullscreen before touching the button.
4. Tap **Try full screen** once. Wait up to five seconds. The page shows the call's return type and the Telegram result/error. `void (request sent)` means only that the request was sent, not that fullscreen succeeded.
5. Take another screenshot including the result and top of the app. Check that the title and back controls remain reachable in portrait and landscape.
6. Tap **Exit full screen**. Confirm isFullscreen becomes false. If the client reports UNSUPPORTED, keep using the normal app; no BotFather or account change is required by this diagnostic.

The feature never requests fullscreen automatically and never displays initData, bot tokens, user IDs or other private Telegram objects. It uses the official Bot API 8.0+ requestFullscreen/exitFullscreen, fullscreenChanged and fullscreenFailed APIs; platform support can still vary. The supported failure labels include UNSUPPORTED and ALREADY_FULLSCREEN. This diagnostic can be removed after the iPad test.

Offline test: save a chapter first, enable airplane mode, and check the banner **Offline — your downloaded chapters still work**. This indicates the browser's connectivity hint, not a guaranteed proof of internet reachability.

Reference: https://core.telegram.org/bots/webapps (checked 2026-09-28).
