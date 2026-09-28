/* Hidden visual gallery: render-only, no saved state and no study mutations. */
globalThis.KafuEnhancements.installers.push({name:'arcade-clean-gallery',install(){
  'use strict';
  const originalRender=render;
  let galleryWasActive=false,themeBeforeGallery=null;
  const e=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const button=(label,classes='btn')=>`<button type="button" class="${classes}">${e(label)}</button>`;
  const tokenNames=[
    '--brand-primary','--brand-accent-a','--brand-accent-b','--brand-secondary','--brand-accent',
    '--color-bg','--color-surface','--color-surface-alt','--color-surface-raised','--color-text','--color-muted','--color-outline','--color-border',
    '--color-primary','--color-primary-strong','--color-primary-hover','--color-primary-soft','--color-on-primary','--color-accent-a','--color-accent-b',
    '--color-success','--color-success-soft','--color-danger','--color-error','--color-danger-soft','--color-warning','--color-warning-soft','--color-focus','--color-on-result','--color-medical-image','--color-medical-text','--color-scrim',
    '--radius-xs','--radius-sm','--radius-md','--radius-lg','--radius-xl','--radius-pill','--outline-width','--outline-width-strong','--shadow-depth','--pressed-offset','--shadow-hard','--shadow-card','--shadow-float',
    '--font-display','--font-reading','--font-pixel','--font-ui','--text-xs','--text-sm','--text-base','--text-lg','--text-xl','--text-2xl','--text-3xl','--text-display','--leading-ui','--leading-reading','--measure','--layout-wide',
    '--space-1','--space-2','--space-3','--space-4','--space-5','--space-6','--space-8','--space-10','--space-12','--tap-target',
    '--duration-question','--duration-fast','--duration-base','--duration-delight','--ease-out','--ease-press'
  ];
  const tokenRegistry=()=>{
    const styles=getComputedStyle(document.documentElement);
    return tokenNames.map(name=>`<div class="gallery-token"><code>${e(name)}</code><span>${e(styles.getPropertyValue(name).trim())}</span></div>`).join('');
  };
  const gallery=()=>`<main class="gallery-shell" id="gallery" aria-label="Arcade-Clean design gallery">
    <header class="gallery-head">
      <span class="gallery-kicker">DESIGN 1/10 · ARCADE-CLEAN</span>
      <h1 class="gallery-title">Playful shell. Calm study core.</h1>
      <p class="gallery-sub">Chunky, pressable and bright where navigation benefits from energy. Quiet, neutral and highly readable where medicine is being studied.</p>
      <div class="gallery-toolbar">
        <button class="btn" data-gallery-theme="light">Light</button>
        <button class="btn quiet" data-gallery-theme="dark">Dark</button>
        <button class="btn quiet" data-gallery-sound>Sound: off</button>
        <a class="btn quiet" href="#">Exit gallery</a>
      </div>
    </header>

    <section class="gallery-section"><h2>Colour tokens</h2><div class="gallery-grid">
      <div class="gallery-swatch primary">Primary</div><div class="gallery-swatch accent-a">Accent A</div><div class="gallery-swatch accent-b">Accent B</div>
      <div class="gallery-swatch success">Success ✓</div><div class="gallery-swatch danger">Error ×</div><div class="gallery-swatch warning">Warning !</div>
      <div class="gallery-swatch surface">Surface</div><div class="gallery-swatch surface-alt">Surface alt</div><div class="gallery-swatch text">Text</div>
    </div></section>

    <section class="gallery-section"><h2>Type</h2><div class="gallery-type">
      <div class="gallery-display">Fredoka for headings & numbers</div>
      <div class="gallery-reading">Nunito is the reading face for questions, answers, explanations, controls and long study sessions. Study text never switches to the display or pixel font.</div>
      <div class="gallery-pixel">PIXELIFY · RARE ACCENT ONLY · +120 XP</div>
    </div></section>

    <section class="gallery-section"><h2>Shape, depth & spacing</h2>
      <div class="gallery-shapes"><div class="gallery-shape sm"></div><div class="gallery-shape md"></div><div class="gallery-shape lg"></div></div>
      <div class="gallery-row"><div class="gallery-space s1"><i></i>4</div><div class="gallery-space s2"><i></i>8</div><div class="gallery-space s3"><i></i>12</div><div class="gallery-space s4"><i></i>16</div><div class="gallery-space s6"><i></i>24</div><div class="gallery-space s8"><i></i>32</div><div class="gallery-space s12"><i></i>48</div></div>
    </section>

    <section class="gallery-section"><h2>Token registry</h2><p class="gallery-note">Computed from the single source of truth for the active theme.</p><div class="gallery-token-grid">${tokenRegistry()}</div></section>

    <section class="gallery-section"><h2>Buttons & interaction states</h2><div class="gallery-row">
      ${button('Primary action')}${button('Secondary','btn quiet')}${button('Destructive','btn danger')}${button('Pressed','btn is-pressed')}<button class="btn" disabled>Disabled</button>
    </div></section>

    <section class="gallery-section"><h2>Cards, chips & progress</h2><div class="gallery-grid">
      <article class="gallery-card"><span class="k-chip">Review due · 12</span><h3>Clinical Cardiology</h3><p class="gallery-note">Chapter 4 · saved offline</p><div class="k-progress"><span style="width:64%"></span></div></article>
      <article class="gallery-card"><span class="k-chip success">✓ Saved</span><h3>10-minute goal</h3><div class="gallery-display">7:24</div><p class="gallery-note">Calm progress, no shame language.</p></article>
    </div></section>

    <section class="gallery-section"><h2>Status states — icon + text + colour</h2><div class="gallery-grid">
      <div class="gallery-state success"><span class="gallery-icon">✓</span><div><strong>Correct</strong><span>Answer confirmed.</span></div></div>
      <div class="gallery-state error"><span class="gallery-icon">×</span><div><strong>Needs review</strong><span>Read the explanation.</span></div></div>
      <div class="gallery-state warning"><span class="gallery-icon">!</span><div><strong>Offline note</strong><span>Image not saved yet.</span></div></div>
    </div></section>

    <section class="gallery-section"><h2>Study core</h2><div class="gallery-card gallery-question">
      <span class="k-chip">Question 8 of 20</span>
      <p class="stem">A patient returns for follow-up. Which next step best matches the information provided?</p>
      <div class="gallery-option"><b>A</b><span>Readable answer option with no decorative display font.</span></div>
      <div class="gallery-option selected"><b>B</b><span>Selected — labelled and outlined, not colour-only.</span></div>
      <div class="gallery-option correct"><b>✓</b><span>Correct — icon, text and colour.</span></div>
      <div class="gallery-option wrong"><b>×</b><span>Incorrect — icon, text and colour.</span></div>
    </div></section>

    <section class="gallery-section"><h2>Medical image rule</h2><div class="gallery-medical"><strong>Neutral image stage</strong><br>Medical images always sit on a neutral white background and are never filtered or recoloured.</div></section>

    <section class="gallery-section"><h2>Motion & game feel</h2><div class="gallery-row"><div class="gallery-motion" aria-hidden="true"></div><p class="gallery-note">Transform/opacity only. Reduced-motion disables it. Key buttons use safe Telegram haptics. WebAudio tones contain no files and remain off by default.</p></div></section>
  </main>`;

  function renderGallery(){
    if(!galleryWasActive){themeBeforeGallery=document.documentElement.getAttribute('data-theme');galleryWasActive=true;}
    document.body.dataset.gallery='true';
    const app=document.getElementById('app');if(!app)return;
    app.innerHTML=gallery();
    app.querySelectorAll('[data-gallery-theme]').forEach(node=>node.addEventListener('click',()=>{
      document.documentElement.dataset.theme=node.dataset.galleryTheme;
      globalThis.KafuGameFeel?.haptic('light');
    }));
    app.querySelector('[data-gallery-sound]')?.addEventListener('click',event=>{
      const next=!globalThis.KafuGameFeel?.soundEnabled;
      globalThis.KafuGameFeel?.setSoundEnabled(next);
      event.currentTarget.textContent='Sound: '+(next?'on':'off');
      if(next)globalThis.KafuGameFeel?.tone('success');
    });
  }
  render=function(...args){
    if(location.hash==='#gallery'){renderGallery();return;}
    if(galleryWasActive){
      if(themeBeforeGallery===null)document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme',themeBeforeGallery);
      globalThis.KafuGameFeel?.setSoundEnabled(false);
      galleryWasActive=false;themeBeforeGallery=null;
    }
    delete document.body.dataset.gallery;
    return originalRender.apply(this,args);
  };
  addEventListener('hashchange',()=>render());
}});
