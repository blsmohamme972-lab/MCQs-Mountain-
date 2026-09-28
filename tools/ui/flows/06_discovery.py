"""Home/Library discovery is read-only, usable with one hand and offline."""
def run(browser,origin,pack,out,helpers):
    hashes={}
    for device in ('phone','ipad'):
        for theme in ('light','dark'):
            ctx=helpers['context'](browser,origin,device,theme)
            page,errors=helpers['open_app'](ctx,origin,pack)
            assert page.evaluate("KafuDownloads.available('DESIGN-CARDIO',1)") is False
            page.evaluate("async()=>{await KafuDownloads.manager.finish(KafuDownloads.metadata('DESIGN-CARDIO',1));}")
            before=page.evaluate('JSON.stringify([S.answers,S.fav,S.favBooks,S.dl,S.sync_v2])')
            assert page.locator('.k-streak').count()==1
            assert 'day streak' in page.locator('.k-streak').inner_text().lower()
            assert page.locator('[data-a=continue]').count()==1
            assert page.locator('.k-goal-ring').get_attribute('aria-label')=='7 of 10 daily study minutes'
            assert page.locator('.k-game-hud .k-level-badge').count()==1
            assert page.locator('.k-game-hud .k-xp-track').count()==1
            signature=page.evaluate("""() => {
              const hud=document.querySelector('.k-game-hud'),cont=document.querySelector('.k-continue'),cover=document.querySelector('.k-book-cover');
              const title=document.querySelector('.k-home h2'),flame=document.querySelector('.k-streak path');
              const css=el=>getComputedStyle(el);
              return {
                hud:!!hud, level:!!document.querySelector('.k-level-badge.k-pixel'), xp:!!document.querySelector('.k-xp-track'),
                filledFlame:!!flame&&css(flame).fill!=='none', outline:css(hud).borderTopWidth==='2px',
                hardShadow:css(hud).boxShadow!=='none', primary3d:!!cont&&css(cont).boxShadow!=='none',
                displayTitle:css(title).fontFamily.toLowerCase().includes('fredoka'),
                collectible:!!cover&&!!cover.querySelector('.k-cover-icon')&&!!cover.querySelector('.k-mastery-stars')
              };
            }""")
            assert all(signature.values()),f'Arcade-Clean signature missing: {signature}'
            assert page.locator('[data-a=review-due]').count()==1
            if theme=='dark':
                ratio=page.evaluate("""() => {const e=document.querySelector('.k-my-books h3.sec button'),p=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number),lum=c=>{c=c.map(v=>v/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]},s=getComputedStyle(e),bg=getComputedStyle(e.parentElement.parentElement).backgroundColor,a=lum(p(s.color)),b=lum(p(bg));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}""")
                assert ratio>=4.5,f'dark Browse all contrast {ratio}'
            page.evaluate("tab('library')")
            assert page.locator('#kafu-book-results .book-card').count()==3
            if device=='ipad':
                cols=page.evaluate("getComputedStyle(document.querySelector('.k-book-grid')).gridTemplateColumns.split(' ').length")
                assert 4<=cols<=5,f'iPad Library columns {cols}'
            cover=page.locator('.k-book-cover').first
            assert page.evaluate("""() => {const t=document.querySelector('.k-book-cover strong'),s=getComputedStyle(t);return t.scrollHeight<=parseFloat(s.lineHeight)*3.2}""")
            title_box=page.locator('.k-book-cover strong').first.bounding_box();stars_box=page.locator('.k-book-cover .k-mastery-stars').first.bounding_box()
            assert title_box and stars_box and title_box['y']+title_box['height']<=stars_box['y']+1
            if theme=='dark':
                ratio=page.evaluate("""() => {const e=document.querySelector('.k-book-cover strong'),cover=e.closest('.k-book-cover'),p=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number),lum=c=>{c=c.map(v=>v/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]},a=lum(p(getComputedStyle(e).color)),b=lum(p(getComputedStyle(cover).backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}""")
                assert ratio>=4.5,f'dark cover title contrast {ratio}'
            width=page.locator('#kafu-book-results .book-card').first.bounding_box()['width']
            search=page.locator('#kafu-book-search');search.fill('clinical')
            assert page.locator('#kafu-book-results .book-card').count()==1
            assert abs(page.locator('#kafu-book-results .book-card').first.bounding_box()['width']-width)<1
            assert search.evaluate('(el)=>el===document.activeElement')
            assert '2 of 4 answered' in page.locator('#kafu-book-results').inner_text()
            assert 'Available offline' in page.locator('#kafu-book-results').inner_text()
            page.evaluate('document.activeElement?.blur()')
            name=f'{device}-{theme}-library-search';hashes[name]=helpers['capture'](page,out/(name+'.png'))
            page.locator('#kafu-specialty-filter').select_option('Surgery')
            assert page.locator('#kafu-book-results .book-card').count()==0
            assert 'No matching books' in page.locator('#kafu-book-results').inner_text()
            page.evaluate("""async()=>{document.querySelector('#kafu-book-search')?.blur();document.activeElement?.blur();
              let style=document.getElementById('kafu-snapshot-stable');if(!style){style=document.createElement('style');style.id='kafu-snapshot-stable';style.textContent='*{animation:none!important;transition:none!important;caret-color:transparent!important}';document.head.appendChild(style);}
              await document.fonts.ready;
              const snap=el=>{if(!el)return;const r=el.getBoundingClientRect();el.style.position='relative';el.style.left=(Math.round(r.left)-r.left)+'px';el.style.top=(Math.round(r.top)-r.top)+'px';el.style.width=Math.round(r.width)+'px';el.style.height=Math.round(r.height)+'px';el.style.boxSizing='border-box';};
              snap(document.querySelector('.k-search-input'));snap(document.querySelector('.k-specialty-field select'));snap(document.querySelector('#kafu-book-results')?.firstElementChild);
              await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            }""")
            name=f'{device}-{theme}-library-no-results';hashes[name]=helpers['capture'](page,out/(name+'.png'))
            page.locator('[data-a=library-clear]').click()
            assert page.locator('#kafu-book-results .book-card').count()==3
            assert search.evaluate('(el)=>el===document.activeElement')
            page.locator('#kafu-specialty-filter').select_option('Cardiology')
            assert page.locator('#kafu-book-results .book-card').count()==1
            assert page.evaluate('JSON.stringify([S.answers,S.fav,S.favBooks,S.dl,S.sync_v2])')==before
            page.evaluate("tab('home')");page.locator('[data-a=continue]').click();page.wait_for_selector('.stem')
            assert page.evaluate('SESSION.qids[SESSION.index]')=='Q000001003'
            page.evaluate("tab('home')")
            page.wait_for_function('navigator.serviceWorker.controller!==null')
            ctx.set_offline(True);page.reload(wait_until='load');page.wait_for_selector('nav')
            assert page.locator('.offline-banner').count()==1
            page.evaluate("tab('library')")
            assert page.locator('.offline-banner').count()==1
            page.locator('#kafu-book-search').fill('cardiology')
            assert page.locator('#kafu-book-results .book-card').count()==1
            assert not errors,errors
            ctx.close()
    return {'hashes':hashes,'passed':['phone/iPad light/dark: Arcade-Clean signature proxy (HUD/level/XP/filled flame/2px outline/hard shadow/3D Continue/Fredoka/collectible cover), one-tap resume, derived daily goal and Review Due, 3-line non-overlapping cover titles + mastery pill, 4–5 iPad columns, stable cover sizes during title search + specialty filtering, focus retained, clear/no-results feedback, saved fields unchanged, offline discovery and notices preserved']}
