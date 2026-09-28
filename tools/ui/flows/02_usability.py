"""Actual DOM safety checks for the usability layer."""
def run(browser,origin,pack,out,helpers):
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
            saved=page.evaluate('JSON.stringify({answers:S.answers,fav:S.fav,dl:S.dl})')
            page.locator('[data-a="del-pack"]').first.click()
            assert page.evaluate("!!KafuUsability.undo.pending&&!!S.dl['DESIGN-CARDIO:1']")
            page.locator('[data-a="undo-change"]').click()
            assert page.evaluate('JSON.stringify({answers:S.answers,fav:S.fav,dl:S.dl})')==saved
            assert page.evaluate('!KafuUsability.undo.pending')
            page.on('dialog',lambda dialog:dialog.accept())
            page.locator('[data-a="reset"]').click()
            assert page.evaluate("KafuUsability.undo.pending?.meta.kind==='reset'")
            page.locator('[data-a="undo-change"]').click()
            assert page.evaluate('JSON.stringify({answers:S.answers,fav:S.fav,dl:S.dl})')==saved
            assert not errors,errors
            ctx.close()
    return {'passed':['phone/iPad light/dark: one-tap Continue, sheet focus trap and Escape, undo download and synced reset BEFORE any destructive write']}
