# Telegram Mini App integration guide

This library is an offline-capable visual asset store. A Telegram Mini App should host the selected standalone scene or the library's own code on an HTTPS origin. Keep the template renderers independent from Telegram so the same scene can run in Chrome, a test harness, or Telegram.

## Host shell requirements

1. Load Telegram's official bridge before application code:

   ~~~html
   <script src="https://telegram.org/js/telegram-web-app.js?63"></script>
   ~~~

2. After the first usable frame, initialize the host:

   ~~~js
   const tg = window.Telegram && window.Telegram.WebApp;
   if (tg) {
     tg.ready();
     tg.expand(); // Use only when the product flow needs the expanded view.
     document.documentElement.dataset.telegram = 'true';
   }
   ~~~

3. Use Telegram's current theme values instead of hard-coding a second theme. Map tg.themeParams to CSS custom properties and update them when the themeChanged event fires.

4. Keep content inside the safe areas. Use safeAreaInset and contentSafeAreaInset when available, and provide CSS fallbacks:

   ~~~css
   .app-shell {
     padding-top: max(12px, var(--tg-safe-area-inset-top, 0px));
     padding-right: max(12px, var(--tg-safe-area-inset-right, 0px));
     padding-bottom: max(12px, var(--tg-safe-area-inset-bottom, 0px));
     padding-left: max(12px, var(--tg-safe-area-inset-left, 0px));
   }
   ~~~

5. Use a mobile-first layout, labeled controls, keyboard focus states and reduced-motion behavior. Keep the SVG artwork responsive and avoid placing labels at the edges of a 9:16 frame.

## Data and security

- Treat initDataUnsafe as display-only input. Never use it to authorize a user.
- Send tg.initData to the bot server and validate its signature there before accepting identity, entitlements or saved scenes.
- Do not put a bot token, private key or secret in this directory or in a standalone export.
- sendData is appropriate for small payloads from a keyboard-button Mini App. For a full editor or account-backed library, send a scene identifier to the server and persist the validated scene there.
- Keep the renderer deterministic and local. Do not fetch medical content or remote images while a scene is playing.

## Embedding a selected scene

A host page can load the core plus exactly one template, create a validated scene, and connect its own save/share controls:

~~~html
<div id="scene"></div>
<script src="https://telegram.org/js/telegram-web-app.js?63"></script>
<script src="core/medical-motion.js"></script>
<script src="templates/11-bacterial-morphology.js"></script>
<script>
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) tg.ready();

  const scene = MedicalMotion.defaultConfig('bacterial-morphology');
  const player = MedicalMotion.create(document.getElementById('scene'), scene);
  player.seek(3);
</script>
~~~

The standalone export is an interactive HTML scene, not an MP4. If a future Mini App needs a video file, render the validated scene in a controlled export pipeline and keep the scene JSON as the source of truth.

## Release checklist

- Serve the host over HTTPS and configure the Mini App URL in BotFather.
- Test the same scene in portrait, square and landscape layouts.
- Test light and dark Telegram themes, safe-area padding, reduced motion and a low-performance Android device.
- Validate every imported scene with MedicalMotion.validate(scene) before rendering.
- Review labels, arrows, direction and limitations with a clinician before teaching deployment.

Official reference: https://core.telegram.org/bots/webapps
