"""Study completion must use this session, not historical or skipped answers."""
IDS = ['Q000001001','Q000001002','Q000001003','Q000001004']

def run(browser, origin, pack, out, helpers):
    hashes = {}
    for device in ('phone','ipad'):
        for theme in ('light','dark'):
            ctx = helpers['context'](browser, origin, device, theme)
            page, errors = helpers['open_app'](ctx, origin, pack)
            favorites = page.evaluate('JSON.stringify([S.fav,S.favBooks])')
            page.evaluate("ids=>startSession({mode:'study',title:'A focused practice session',bookId:'DESIGN-CARDIO',chId:1,qids:ids})", IDS)
            for i in range(4):
                assert page.locator('[role="progressbar"][aria-label="Question progress"]').get_attribute('aria-valuenow') == str(i+1)
                helpers['study_answer'](page, i != 1)
                assert page.locator('.explain').get_attribute('role') == 'status'
                if i==0:
                    assert page.locator('.k-feedback-correct').count()==1
                    assert 'Correct' in page.locator('.k-feedback-correct').inner_text() and 'Kafu' in page.locator('.k-feedback-correct').inner_text()
                if i==1:
                    assert page.evaluate("getComputedStyle(document.querySelector('.opt.wrong .l')).backgroundColor===getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim()")
                page.locator('[data-a="action"]').last.click()
            page.wait_for_selector('[data-session-complete]')
            assert page.locator('[data-session-complete]').get_attribute('data-score') == '75'
            result = page.evaluate('KafuStudy.last')
            assert result['answered'] == 4 and result['correct'] == 3 and result['skipped'] == 0
            assert result['mistakes'] == [IDS[1]] and not result['perfect']
            assert page.locator('.k-complete-mascot svg').count() == 1
            assert page.locator('.k-victory-stars svg.earned').count() == 2
            assert '+40 XP' in page.locator('.k-xp-gained').inner_text()
            if theme=='dark':
                ratio=page.evaluate("""() => {const e=document.querySelector('.k-xp-gained span'),p=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number),lum=c=>{c=c.map(v=>v/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]},s=getComputedStyle(e),a=lum(p(s.color)),b=lum(p(s.backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}""")
                assert ratio>=4.5,f'dark XP label contrast {ratio}'
            footer=page.locator('.k-complete-footer')
            assert footer.count()==1
            assert footer.locator('[data-a="next-chapter"]').count()==1
            assert footer.locator('[data-a="session-mistakes"]').count()==1
            if device == 'phone':
                box=footer.bounding_box();viewport=page.viewport_size
                assert box and viewport and box['y']+box['height'] <= viewport['height']+1
            assert page.evaluate('JSON.stringify([S.fav,S.favBooks])') == favorites
            name = f'{device}-{theme}-chapter-complete-mixed'
            hashes[name] = helpers['capture'](page, out/(name+'.png'))
            page.locator('[data-a="session-mistakes"]').click()
            assert page.evaluate('SESSION.qids') == [IDS[1]]
            page.evaluate("ids=>{tab('home');startSession({mode:'study',title:'Resumed session',qids:ids,index:3});}", IDS)
            assert page.locator('header h1').inner_text().startswith('Chapter · Q 4/4')
            assert float(page.locator('header h1').evaluate("e=>parseFloat(getComputedStyle(e).fontSize)"))<=16.1
            helpers['study_answer'](page, True)
            page.locator('[data-a="action"]').last.click()
            assert page.evaluate('KafuStudy.last.skipped===3&&!KafuStudy.last.perfect')
            assert 'Session complete' in page.locator('header').inner_text()
            assert page.locator('.k-complete-footer [data-a="find-library"]').count()==1
            page.locator('header [data-a="back"]').click();page.wait_for_selector('nav')
            assert page.locator('nav [aria-current="page"]').inner_text().strip()=='Home'
            page.evaluate("async()=>{await DB.put('meta','state',S);}")
            saved = page.evaluate('JSON.stringify(S.answers)')
            page.wait_for_function('navigator.serviceWorker.controller!==null')
            ctx.set_offline(True);page.reload(wait_until='load');page.wait_for_selector('nav')
            assert page.evaluate('JSON.stringify(S.answers)') == saved
            assert page.evaluate('JSON.stringify([S.fav,S.favBooks])') == favorites
            assert not errors, errors
            ctx.close()
    return {'hashes':hashes,'passed':['phone/iPad light/dark: 4-question victory shows SVG mascot, 2/3 stars and +40 XP; calm 16px Chapter · Q header, one-line Correct — Kafu feedback, wrong badge red, dark XP label >=4.5:1; phone/iPad completion keeps Next chapter + Review/Browse in sticky footer and back arrow returns Home; session-only Review mistakes, resumed/skipped questions never earn perfect, unchanged stars and offline-persistent answers']}
