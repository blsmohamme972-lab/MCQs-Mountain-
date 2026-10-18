'use strict';
/* Engine spike (D24): the part both scenes share. Loads the engine script, owns the DOM MCQ sheet and the harness
   object window.__spike. Each scene file defines window.SCENE = { start(env) -> Promise, walk(on), sleep(), wake() }. */
(function () {
  const P = new URLSearchParams(location.search);
  // ?res=1 renders at CSS pixels (pixel art upscaled by the browser, same look); ?r=canvas uses the Canvas 2D renderer.
  const R = P.has('res') ? Number(P.get('res')) : Math.min(2, window.devicePixelRatio || 1);
  const env = { R, W: innerWidth, H: innerHeight, base: '../../assets-test/spike/', manifest: null, renderer: P.get('r') === 'canvas' ? 'canvas' : 'webgl', tileSprites: P.get('tile') === 'sprites' };
  const mark = n => { try { performance.mark(n); } catch (e) {} };
  const spike = window.__spike = { state: 'loading', engine: document.documentElement.dataset.engine, version: 1 };
  const sheet = document.getElementById('sheet');
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

  spike.walk = ms => new Promise(res => { window.SCENE.wake(); window.SCENE.walk(true); setTimeout(() => { window.SCENE.walk(false); res(); }, ms); });
  // Open: the loop sleeps once the sheet covers the world (D8). Close: wake the loop first, then slide the sheet away.
  spike.sheet = open => new Promise(res => {
    if (!open) window.SCENE.wake();
    sheet.classList.toggle('open', open);
    setTimeout(async () => { await nextFrame(); if (open) window.SCENE.sleep(); res(); }, open ? 200 : 140);
  });

  fetch(env.base + 'manifest.json').then(r => r.json()).then(m => {
    env.manifest = m;
    mark('lab:game-load');
    const s = document.createElement('script');
    s.src = document.documentElement.dataset.src;
    s.onload = () => window.SCENE.start(env).then(() => { mark('lab:game-ready'); spike.state = 'ready'; });
    s.onerror = e => { throw new Error('engine failed to load'); };
    document.head.appendChild(s);
  });
})();
