"""Once-only welcome and additive-record migration in isolated browsers."""
FRESH="""async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('medmcq',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise((resolve,reject)=>{const tx=db.transaction('meta','readwrite');for(const key of ['ui_onboarding_user_browser','state_user_browser','state'])tx.objectStore('meta').delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
}"""
def run(browser,origin,pack,out,helpers):
    hashes={}
    for device in ('phone','ipad'):
        for theme in ('light','dark'):
            ctx=helpers['context'](browser,origin,device,theme)
            page,errors=helpers['open_app'](ctx,origin,pack)
            assert page.locator('.k-onboarding').count()==0
            saved=page.evaluate('JSON.stringify({answers:S.answers,fav:S.fav,dl:S.dl,fs:S.settings.fs})')
            page.reload(wait_until='load');page.wait_for_selector('nav')
            assert page.evaluate('JSON.stringify({answers:S.answers,fav:S.fav,dl:S.dl,fs:S.settings.fs})')==saved
            assert page.evaluate('KafuOnboarding.record.complete')
            page.goto(origin+'/seed/');page.evaluate(FRESH);page.goto(origin,wait_until='load')
            page.wait_for_selector('[data-onboarding-step="0"]');page.evaluate('document.fonts.ready')
            for step in range(3):
                name=f'{device}-{theme}-onboarding-{step+1}'
                hashes[name]=helpers['capture'](page,out/(name+'.png'))
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
                if step<2:page.locator('.actionbar [data-a="action"]').click()
            page.locator('[data-a="onboard-specialty"][data-s="Cardiology"]').click()
            page.locator('.actionbar [data-a="action"]').click()
            page.wait_for_selector('[data-a="open-book"][data-b="DESIGN-CARDIO"]')
            assert page.evaluate("KafuOnboarding.record.complete&&KafuOnboarding.specialty==='Cardiology'")
            page.wait_for_function('navigator.serviceWorker.controller!==null')
            ctx.set_offline(True);page.reload(wait_until='load');page.wait_for_selector('nav')
            assert page.locator('.k-onboarding').count()==0
            assert page.evaluate("KafuOnboarding.record.complete&&KafuOnboarding.specialty==='Cardiology'")
            assert not errors,errors
            ctx.close()
    ctx=helpers['context'](browser,origin);page,errors=helpers['open_app'](ctx,origin,pack)
    page.goto(origin+'/seed/');page.evaluate(FRESH);page.goto(origin,wait_until='load');page.wait_for_selector('.k-onboarding')
    page.locator('[data-a="onboard-skip"]').click();page.wait_for_selector('nav')
    page.reload(wait_until='load');page.wait_for_selector('nav')
    assert page.locator('.k-onboarding').count()==0 and page.evaluate('KafuOnboarding.record.complete')
    assert not errors,errors
    ctx.close()
    return{'hashes':hashes,'passed':['phone/iPad light/dark: three-screen welcome, specialty discovery, once-only completion and offline reload','skippable tour shown once; returning student answers/stars/downloads/text size preserved by additive migration']}
