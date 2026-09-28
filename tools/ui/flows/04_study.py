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
                page.locator('[data-a="action"]').last.click()
            page.wait_for_selector('[data-session-complete]')
            assert page.locator('[data-session-complete]').get_attribute('data-score') == '75'
            result = page.evaluate('KafuStudy.last')
            assert result['answered'] == 4 and result['correct'] == 3 and result['skipped'] == 0
            assert result['mistakes'] == [IDS[1]] and not result['perfect']
            assert page.evaluate('JSON.stringify([S.fav,S.favBooks])') == favorites
            name = f'{device}-{theme}-chapter-complete-mixed'
            hashes[name] = helpers['capture'](page, out/(name+'.png'))
            page.locator('[data-a="session-mistakes"]').click()
            assert page.evaluate('SESSION.qids') == [IDS[1]]
            page.evaluate("ids=>{tab('home');startSession({mode:'study',title:'Resumed session',qids:ids,index:3});}", IDS)
            helpers['study_answer'](page, True)
            page.locator('[data-a="action"]').last.click()
            assert page.evaluate('KafuStudy.last.skipped===3&&!KafuStudy.last.perfect')
            assert 'Session complete' in page.locator('header').inner_text()
            page.locator('[data-a="action"]').last.click();page.wait_for_selector('nav')
            page.evaluate("async()=>{await DB.put('meta','state',S);}")
            saved = page.evaluate('JSON.stringify(S.answers)')
            page.wait_for_function('navigator.serviceWorker.controller!==null')
            ctx.set_offline(True);page.reload(wait_until='load');page.wait_for_selector('nav')
            assert page.evaluate('JSON.stringify(S.answers)') == saved
            assert page.evaluate('JSON.stringify([S.fav,S.favBooks])') == favorites
            assert not errors, errors
            ctx.close()
    return {'hashes':hashes,'passed':['phone/iPad light/dark: 4-question session score 75%, session-only Review mistakes, resumed/skipped questions never earn perfect, unchanged stars and offline-persistent answers']}
