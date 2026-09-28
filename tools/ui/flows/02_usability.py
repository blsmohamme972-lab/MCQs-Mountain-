"""Actual DOM safety checks for the usability layer, with synthetic data only."""
def run(browser,origin,pack,out,helpers):
    hashes={}
    for device in ('phone','ipad'):
        for theme in ('light','dark'):
            ctx=helpers['context'](browser,origin,device,theme)
            page,errors=helpers['open_app'](ctx,origin,pack)
            assert page.evaluate("typeof KafuUsability!=='undefined'")
            page.locator('[data-a="continue"]').click()
            page.wait_for_selector('.stem')
            assert page.evaluate("SESSION.bookId==='DESIGN-CARDIO'")
            page.locator('[data-a="report"]').click()
            assert page.locator('.sheet').get_attribute('aria-modal')=='true'
            page.locator('.sheet button').last.focus()
            page.keyboard.press('Tab')
            assert page.evaluate("document.activeElement===document.querySelector('.sheet button')")
            page.keyboard.press('Escape')
            assert page.locator('.sheet').count()==0
            assert page.evaluate("document.activeElement.dataset.a==='report'")
            page.evaluate("tab('me')")
            assert page.locator('.k-developer').count()==0
            assert page.locator('.kafu-diagnostic').count()==0
            for _ in range(6):page.locator('[data-a="developer-version"]').click()
            assert page.locator('.k-developer').count()==0
            page.locator('[data-a="developer-version"]').click()
            assert page.locator('.k-developer').count()==1
            saved=page.evaluate('JSON.stringify({answers:S.answers,fav:S.fav,dl:S.dl})')
            page.locator('[data-a="del-pack"]').first.click()
            assert not errors,errors
            assert page.evaluate("!!KafuUsability.undo.pending&&!!S.dl['DESIGN-CARDIO:1']")
            page.locator('[data-a="undo-change"]').wait_for(state='visible',timeout=2000)
            page.evaluate("toast('Saved on this device.')")
            name=f'{device}-{theme}-download-undo'
            hashes[name]=helpers['capture'](page,out/(name+'.png'))
            page.locator('[data-a="undo-change"]').click()
            assert page.evaluate('JSON.stringify({answers:S.answers,fav:S.fav,dl:S.dl})')==saved
            assert page.evaluate('!KafuUsability.undo.pending')
            assert page.locator('#kafu-undo-notice').count()==0
            page.on('dialog',lambda dialog:dialog.accept())
            page.locator('[data-a="reset"]').click()
            assert page.evaluate("KafuUsability.undo.pending?.meta.kind==='reset'")
            page.locator('[data-a="undo-change"]').click()
            assert page.evaluate('JSON.stringify({answers:S.answers,fav:S.fav,dl:S.dl})')==saved
            if device=='phone' and theme=='light':
                page.locator('[data-a="del-pack"]').first.click()
                page.evaluate("startChapter('DESIGN-CARDIO',1)")
                page.wait_for_selector('.stem')
                assert page.evaluate('!KafuUsability.undo.pending')
                assert page.locator('#kafu-undo-notice').count()==0
                page.evaluate("tab('me')")
                page.locator('[data-a="del-pack"]').first.click()
                page.wait_for_timeout(6300)
                assert page.evaluate("!S.dl['DESIGN-CARDIO:1']")
                assert page.evaluate('JSON.stringify({answers:S.answers,fav:S.fav})')==page.evaluate('(saved)=>JSON.stringify({answers:JSON.parse(saved).answers,fav:JSON.parse(saved).fav})',saved)
                assert page.locator('#kafu-undo-notice').count()==0
                assert page.evaluate("async()=>!await DB.get('packs','DESIGN-CARDIO:1')")
            assert not errors,errors
            ctx.close()
    return {'hashes':hashes,'passed':['phone/iPad light/dark: one-tap Continue; modal focus/Escape; undo download and synced reset before destructive writes; unrelated toast cannot erase Undo','download cancellation on opening chapter and confirmed expiry remove only download; saved answers and stars preserved','Me diagnostics stay hidden until the seventh version tap and unlocking does not touch student progress']}
