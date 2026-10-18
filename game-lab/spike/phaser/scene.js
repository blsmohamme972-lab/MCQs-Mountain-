'use strict';
/* Engine spike scene, Phaser 4 (D24). Same scene as spike/pixi/scene.js: 5 parallax layers, an animated hero from a
   sprite sheet, coins with particle bursts, a following camera. Phaser 4 has no renderer resolution setting, so the
   game runs at device pixels (CSS size x min(DPR, 2)) and the canvas is shown at CSS size; U converts CSS px to
   device px. Pixel art is scaled 3x with nearest filtering (pixelArt: true). */
window.SCENE = (function () {
  const S = 3, SPEED = 150;
  let game, scene, hero, layers = [], coins = [], emitter, running = false, camX = 0, heroX = 0, groundY = 0, env, U = 1;

  function preload() {
    const m = env.manifest, b = env.base;
    this.load.spritesheet('hero', b + m.hero.file, { frameWidth: m.hero.frameWidth, frameHeight: m.hero.frameHeight });
    this.load.spritesheet('coin', b + m.coin.file, { frameWidth: m.coin.frameWidth, frameHeight: m.coin.frameHeight });
    this.load.image('spark', b + 'spark.png');
    m.layers.forEach((l, i) => this.load.image('l' + i, b + l.file));
  }

  function create() {
    scene = this;
    const m = env.manifest, W = env.W * U, H = env.H * U;
    groundY = Math.round(env.H * 0.62) * U;
    const yOf = [groundY - (128 * S - 40) * U, groundY - (101 * S + 30) * U, 40 * U, groundY - (64 * S - 18) * U, groundY];
    m.layers.forEach((l, i) => {
      const src = this.textures.get('l' + i).getSourceImage(), h = i === 4 ? H - groundY : src.height * S * U;
      if (env.tileSprites) {
        // ?tile=sprites: plain images side by side (one batch) instead of a tiling shader.
        const tw = src.width * S * U, th = src.height * S * U, imgs = [];
        for (let y = 0; y < h; y += th) for (let x = 0; x < W + 2 * tw; x += tw) imgs.push(this.add.image(x, yOf[i] + y, 'l' + i).setOrigin(0, 0).setScrollFactor(0).setScale(S * U));
        const o = { factor: l.factor, set tilePositionX(v) { const off = -(((v * S * U) % tw) + tw) % tw; let k = 0; for (const im of imgs) { im.x = off + (k++ % Math.ceil((W + 2 * tw) / tw)) * tw; } } };
        layers.push(o); return;
      }
      const t = this.add.tileSprite(0, yOf[i], W, h, 'l' + i).setOrigin(0, 0).setScrollFactor(0).setTileScale(S * U, S * U);
      t.factor = l.factor; layers.push(t);
    });
    this.anims.create({ key: 'idle', frames: this.anims.generateFrameNumbers('hero', { start: m.hero.idle[0], end: m.hero.idle[1] }), frameRate: 12, repeat: -1 });
    this.anims.create({ key: 'run', frames: this.anims.generateFrameNumbers('hero', { start: m.hero.run[0], end: m.hero.run[1] }), frameRate: 12, repeat: -1 });
    this.anims.create({ key: 'spin', frames: this.anims.generateFrameNumbers('coin', { start: 0, end: m.coin.frames - 1 }), frameRate: 10, repeat: -1 });
    for (let i = 0; i < 6; i++) coins.push(this.add.sprite((260 + i * 220) * U, groundY - 40 * U, 'coin').setOrigin(0.5, 1).setScale(S * U).play('spin'));
    hero = this.add.sprite(0, groundY + 6 * U, 'hero').setOrigin(0.5, 1).setScale(S * U).play('idle');
    emitter = this.add.particles(0, 0, 'spark', {
      speed: { min: 80 * U, max: 220 * U }, angle: { min: 0, max: 360 }, gravityY: 420 * U, lifespan: 700,
      alpha: { start: 1, end: 0 }, scale: S * U, emitting: false,
    });
  }

  function update(time, delta) {
    const dt = Math.min(50, delta) / 1000;
    if (running) { heroX += SPEED * dt; if (hero.anims.getName() !== 'run') hero.play('run'); }
    else if (hero.anims.getName() !== 'idle') hero.play('idle');
    hero.x = heroX * U;
    camX += (heroX - env.W * 0.35 - camX) * (1 - Math.exp(-dt * 8));
    scene.cameras.main.scrollX = camX * U;
    for (const l of layers) l.tilePositionX = camX * l.factor / S;
    for (const c of coins) if (heroX * U > c.x - 10 * U) { emitter.explode(12, c.x, c.y - 24 * U); c.x += coins.length * 220 * U; }
  }

  function start(e) {
    env = e; U = e.R;
    return new Promise(res => {
      game = new Phaser.Game({
        type: e.renderer === 'canvas' ? Phaser.CANVAS : Phaser.WEBGL, parent: 'game', width: Math.round(e.W * U), height: Math.round(e.H * U),
        backgroundColor: '#8fd3ff', pixelArt: true, banner: false, audio: { noAudio: true },
        scale: { mode: Phaser.Scale.NONE },
        scene: { preload, create() { create.call(this); this.game.events.once('postrender', () => res()); }, update },
      });
    });
  }

  return {
    start,
    walk(on) { running = on; },
    sleep() { game.loop.sleep(); },
    wake() { if (!game.loop.running) game.loop.wake(); },
  };
})();
