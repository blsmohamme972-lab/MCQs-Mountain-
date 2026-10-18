# iPad full-screen diagnostic (temporary)

1. Open Telegram on the iPad, open Kafu, then tap **Me**.
2. Scroll to **App information**. Confirm the app version starts with `night1-` and a commit is shown. Catalog should say **Published catalog**; built-in fallback is now explicitly labelled.
3. Scroll to **Temporary full-screen diagnostic**. Take a screenshot of Telegram version, platform and isFullscreen before touching the button.
4. Tap **Try full screen** once. Wait up to five seconds. The page shows the call's return type and the Telegram result/error. `void (request sent)` means only that the request was sent, not that fullscreen succeeded.
5. Take another screenshot including the result and top of the app. Check that the title and back controls remain reachable in portrait and landscape.
6. Tap **Exit full screen**. Confirm isFullscreen becomes false. If the client reports UNSUPPORTED, keep using the normal app; no BotFather or account change is required by this diagnostic.

**Automatic on tablets (owner, 2026-10-18).** Telegram shows a Mini App in a phone-sized window on an iPad, so Kafu now asks
for full screen by itself, once at start-up, when it runs in Telegram for iOS or Android on a screen whose short side is
at least 600 px (iPads, Android tablets) and the client supports Bot API 8.0. Phones, desktops and older Telegram clients
are left as Telegram opens them (`autoTablet()` in `app/modules/ux-core.js`). In full screen Telegram's own Close and menu
buttons float over the top of the app, so the content starts below Telegram's `safeAreaInset.top` plus
`contentSafeAreaInset.top` (`--kafu-tg-safe-top`, class `tg-fs` on the root), with a strip in the page colour behind those
buttons (`app/modules/ux.css`). On the iPad, check that the app fills the screen in portrait and landscape and that the
title, back and star buttons sit below Telegram's buttons.

The diagnostic never displays initData, bot tokens, user IDs or other private Telegram objects. It uses the official Bot API 8.0+ requestFullscreen/exitFullscreen, fullscreenChanged and fullscreenFailed APIs; platform support can still vary. The supported failure labels include UNSUPPORTED and ALREADY_FULLSCREEN. This diagnostic can be removed after the iPad test.

Offline test: save a chapter first, enable airplane mode, and check the banner **Offline — your downloaded chapters still work**. This indicates the browser's connectivity hint, not a guaranteed proof of internet reachability.

Reference: https://core.telegram.org/bots/webapps (checked 2026-09-28).
