"""Optional browser QA. Requires Python Playwright and Chromium; no website dependencies.
Run from any directory: python tests/browser_smoke.py
Set CHROMIUM_PATH when Chromium is not installed at /usr/bin/chromium.
"""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests' / 'output'
OUT.mkdir(parents=True, exist_ok=True)
errors = []
with sync_playwright() as pw:
    launch = {'headless': True, 'args': ['--no-sandbox']}
    if os.environ.get('CHROMIUM_PATH'):
        launch['executable_path'] = os.environ['CHROMIUM_PATH']
    browser = pw.chromium.launch(**launch)
    page = browser.new_page(viewport={'width': 1440, 'height': 1100}, device_scale_factor=1)
    page.on('pageerror', lambda error: errors.append(str(error)))
    requests = []
    page.on('request', lambda req: requests.append(req.url) if req.url.startswith(('https:', 'http:')) else None)
    page.context.set_offline(True)
    page.set_content((ROOT / 'dist' / 'medical-template-studio.html').read_text())
    assert page.locator('[data-template]').count() == 35
    ids = page.evaluate('MedicalMotion.list().map(d=>d.id)')
    page.screenshot(path=str(OUT / 'studio-desktop.png'), full_page=True)
    for tid in ids:
        page.locator(f'[data-template="{tid}"]').click()
        assert page.locator('#stage svg').count() == 1
        page.screenshot(path=str(OUT / (tid + '-studio.png')), full_page=True)
        for fmt in ('portrait', 'square', 'landscape'):
            page.select_option('#format', fmt)
            assert page.evaluate("document.querySelector('#stage svg').getAttribute('viewBox')") in ('0 0 720 1280', '0 0 960 960', '0 0 1280 720')
        page.select_option('#theme', 'night')
        page.locator('#play').click()
        page.wait_for_timeout(140)
        assert 'Pause' in page.locator('#play').inner_text()
        page.locator('#play').click()
        page.locator('#reset').click()
        assert page.locator('#clock').inner_text().startswith('0.0')
    page.locator('[data-template="alveolar-exchange"]').click()
    for button, suffix in [('svg', '.svg'), ('png', '.png'), ('html', '.html'), ('json-save', '.json')]:
        with page.expect_download() as info:
            page.locator('#' + button).click()
        download = info.value
        assert download.suggested_filename.endswith(suffix)
        download.save_as(str(OUT / ('export' + suffix)))
    page.set_input_files('#file', str(OUT / 'export.json'))
    page.wait_for_function("document.getElementById('status').textContent.startsWith('Ready.')")
    page.locator('summary').click()
    page.locator('#json').fill('{"templateId":"missing"}')
    page.locator('#apply-json').click()
    assert 'Unknown templateId' in page.locator('#status').inner_text()
    assert page.locator('#stage svg').count() == 1
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(OUT / 'studio-mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.emulate_media(reduced_motion='reduce')
    page.set_content((ROOT / 'dist' / 'medical-template-studio.html').read_text())
    assert page.locator('#play').inner_text() == 'Play'
    assert 'Reduced motion' in page.locator('#motion-note').inner_text()
    page.context.set_offline(True)
    page.set_content((OUT / 'export.html').read_text())
    assert page.locator('#scene svg').count() == 1
    page.locator('#play').click()
    page.wait_for_timeout(160)
    assert page.locator('#play').inner_text() == 'Pause'
    page.locator('#play').click()
    page.set_content((ROOT / 'dist' / 'medical-template-studio.html').read_text())
    assert page.locator('[data-template]').count() == 35
    # Parse all formats at five instants, in both themes.
    parsed = page.evaluate('''() => {
      let count=0; const parser=new DOMParser();
      for(const d of MedicalMotion.list()) for(const format of ['portrait','square','landscape']) for(const theme of ['clinical','night']) for(const p of [0,.25,.5,.75,1]) {
        const c={...MedicalMotion.defaultConfig(d.id),format,theme};
        const doc=parser.parseFromString(MedicalMotion.renderSVG(c,p*c.duration),'image/svg+xml');
        if(doc.querySelector('parsererror')) throw new Error(d.id+' invalid SVG');count++;
      } return count;
    }''')
    # Every generated single-template HTML must execute in its own clean context.
    for tid in ids:
        isolated = browser.new_page()
        isolated.context.set_offline(True)
        isolated.on('pageerror', lambda error: errors.append(str(error)))
        isolated.set_content((ROOT / 'dist' / 'templates' / (tid + '.html')).read_text())
        assert isolated.locator('#scene svg').count() == 1
        isolated.locator('#play').click()
        isolated.wait_for_timeout(70)
        assert isolated.locator('#play').inner_text() == 'Pause'
        isolated.locator('#reset').click()
        assert isolated.locator('#clock').inner_text().startswith('0.0')
        isolated.close()
    # Composed exports include the parts engine and their playback controls.
    composed_ids = ['vessel-narrowing-flow', 'clot-formation', 'wound-repair']
    for cid in composed_ids:
        composed = browser.new_page(viewport={'width':390,'height':844})
        composed.context.set_offline(True)
        composed.set_content((ROOT / 'dist' / 'composed' / (cid + '.html')).read_text())
        assert composed.locator('#scene svg').count() == 1
        composed.locator('#play').click(); composed.wait_for_timeout(90)
        assert composed.locator('#play').inner_text() == 'Pause'
        composed.locator('#reset').click()
        assert composed.locator('#clock').inner_text().startswith('0.0')
        assert composed.evaluate('document.documentElement.scrollWidth <= innerWidth')
        composed.close()
    parts_page = browser.new_page(viewport={'width':390,'height':844})
    parts_page.context.set_offline(True)
    parts_page.set_content((ROOT / 'dist' / 'parts' / 'index.html').read_text())
    assert parts_page.locator('.card').count() == 37
    assert parts_page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    parts_page.close()
    # Save diagram-only overview for human visual review.
    page.set_viewport_size({'width':1440,'height':1400})
    page.evaluate('''() => {document.querySelector('.shell').style.display='none';document.body.insertAdjacentHTML('afterbegin','<main id="review" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:20px"></main>');for(const d of MedicalMotion.list()){const section=document.createElement('section');section.style='background:white;padding:10px;border:1px solid #ddd';const h=document.createElement('h2');h.style='font:16px system-ui';h.textContent=d.id;section.append(h);const art=document.createElement('div');art.innerHTML=MedicalMotion.renderSVG(MedicalMotion.defaultConfig(d.id),3,{diagramOnly:true});art.firstChild.style='width:100%;height:auto';section.append(art);document.getElementById('review').append(section);}}''')
    page.screenshot(path=str(OUT / 'all-templates.png'),full_page=True)
    assert not requests, requests
    assert not errors, errors
    browser.close()
print(json.dumps({'templates':35,'parts':37,'composedScenes':3,'svgDocumentsParsed':parsed,'exports':['SVG','PNG','HTML','JSON'],'viewportChecks':['1440px','390px'],'reducedMotion':True,'externalNetworkRequests':len(requests),'standaloneOffline':True,'individualStandaloneScenes':35,'browserErrors':errors},indent=2))

