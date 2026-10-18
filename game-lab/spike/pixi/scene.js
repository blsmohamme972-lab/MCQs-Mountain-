'use strict';
/* Engine spike scene, PixiJS 8 (D24). Same scene as spike/phaser/scene.js: 5 parallax layers, an animated hero from a
   sprite sheet, coins with particle bursts, a following camera. World units are CSS px; the renderer resolution is
   min(DPR, 2). Pixel art is scaled 3x with nearest filtering. */
window.SCENE = (function () {
  const S = 3, SPEED = 150;
  let app, hero, world, layers = [], coins = [], parts = [], running = false, camX = 0, heroX = 0, groundY = 0, env;

  function frames(tex, fw, fh, a, b) {
    const out = [];
    for (let i = a; i <= b; i++) out.push(new PIXI.Texture({ source: tex.source, frame: new PIXI.Rectangle(i * fw, 0, fw, fh) }));
    return out;
  }

  function burst(x, y) {
    let n = 0;
    for (const p of parts) {
      if (p.visible) continue;
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 140;
      p.visible = true; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 140; p.t = 0; p.alpha = 1;
      if (++n === 12) break;
    }
  }

  function tick(t) {
    const dt = Math.min(50, t.deltaMS) / 1000;
    if (running) {
      heroX += SPEED * dt;
      if (hero.textures !== hero.runT) { hero.textures = hero.runT; hero.play(); }
    } else if (hero.textures !== hero.idleT) { hero.textures = hero.idleT; hero.play(); }
    hero.x = heroX;
    camX += (heroX - env.W * 0.35 - camX) * (1 - Math.exp(-dt * 8));
    world.x = -camX;
    for (const l of layers) l.tilePosition.x = -camX * l.factor;
    for (const c of coins) if (heroX > c.x - 10) { burst(c.x, c.y - 24); c.x += coins.length * 220; }
    for (const p of parts) {
      if (!p.visible) continue;
      p.t += dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.alpha = 1 - p.t / 0.7;
      if (p.t > 0.7) p.visible = false;
    }
  }

  async function start(e) {
    env = e;
    const m = e.manifest, b = e.base;
    PIXI.TextureSource.defaultOptions.scaleMode = 'nearest';
    app = new PIXI.Application();
    await app.init({ width: e.W, height: e.H, resolution: e.R, autoDensity: true, antialias: false, background: '#8fd3ff', preference: e.renderer });
    document.getElementById('game').appendChild(app.canvas);
    const urls = [m.hero.file, m.coin.file, 'spark.png', ...m.layers.map(l => l.file)].map(f => b + f);
    const tex = await PIXI.Assets.load(urls);
    groundY = Math.round(e.H * 0.62);
    const yOf = [groundY - 128 * S + 40, groundY - 101 * S - 30, 40, groundY - 64 * S + 18, groundY];
    m.layers.forEach((l, i) => {
      const t = tex[b + l.file], h = i === 4 ? e.H - groundY : t.height * S;
      if (e.tileSprites) {
        // ?tile=sprites: plain sprites side by side (one batch) instead of a tiling shader.
        const c = new PIXI.Container(), tw = t.width * S, th = t.height * S;
        for (let y = 0; y < h; y += th) for (let x = 0; x < e.W + 2 * tw; x += tw) { const sp = new PIXI.Sprite(t); sp.scale.set(S); sp.x = x; sp.y = y; c.addChild(sp); }
        c.y = yOf[i]; c.factor = l.factor; c.tw = tw; c.tilePosition = { set x(v) { c.x = ((v % tw) + tw) % tw - tw; } };
        layers.push(c); app.stage.addChild(c); return;
      }
      const s = new PIXI.TilingSprite({ texture: t, width: e.W, height: h });
      s.tileScale.set(S); s.y = yOf[i]; s.factor = l.factor;
      layers.push(s); app.stage.addChild(s);
    });
    world = new PIXI.Container();
    app.stage.addChild(world);
    const ht = tex[b + m.hero.file];
    hero = new PIXI.AnimatedSprite(frames(ht, m.hero.frameWidth, m.hero.frameHeight, m.hero.idle[0], m.hero.idle[1]));
    hero.idleT = hero.textures; hero.runT = frames(ht, m.hero.frameWidth, m.hero.frameHeight, m.hero.run[0], m.hero.run[1]);
    hero.anchor.set(0.5, 1); hero.scale.set(S); hero.y = groundY + 6; hero.animationSpeed = 12 / 60; hero.play();
    const ct = frames(tex[b + m.coin.file], m.coin.frameWidth, m.coin.frameHeight, 0, m.coin.frames - 1);
    for (let i = 0; i < 6; i++) {
      const c = new PIXI.AnimatedSprite(ct); c.anchor.set(0.5, 1); c.scale.set(S); c.x = 260 + i * 220; c.y = groundY - 40;
      c.animationSpeed = 10 / 60; c.play(); coins.push(c); world.addChild(c);
    }
    world.addChild(hero);
    for (let i = 0; i < 36; i++) {
      const p = new PIXI.Sprite(tex[b + 'spark.png']); p.anchor.set(0.5); p.scale.set(S); p.visible = false; parts.push(p); world.addChild(p);
    }
    app.ticker.add(tick);
    return new Promise(res => app.ticker.addOnce(() => res(), null, PIXI.UPDATE_PRIORITY.UTILITY));
  }

  return {
    start,
    walk(on) { running = on; },
    sleep() { app.ticker.stop(); },
    wake() { if (!app.ticker.started) app.ticker.start(); },
  };
})();
