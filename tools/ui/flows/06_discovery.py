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
            assert page.locator('[data-a=continue]').count()==1
            assert page.locator('[aria-label="Daily study goal"]').get_attribute('aria-valuenow')=='420'
            assert page.locator('[data-a=review-due]').count()==1
            page.evaluate("tab('library')")
            assert page.locator('#kafu-book-results .book-card').count()==3
            width=page.locator('#kafu-book-results .book-card').first.bounding_box()['width']
            search=page.locator('#kafu-book-search');search.fill('clinical')
            assert page.locator('#kafu-book-results .book-card').count()==1
            assert abs(page.locator('#kafu-book-results .book-card').first.bounding_box()['width']-width)<1
            assert search.evaluate('(el)=>el===document.activeElement')
            assert '2 of 4 answered' in page.locator('#kafu-book-results').inner_text()
            assert 'Available offline' in page.locator('#kafu-book-results').inner_text()
            name=f'{device}-{theme}-library-search';hashes[name]=helpers['capture'](page,out/(name+'.png'))
            page.locator('#kafu-specialty-filter').select_option('Surgery')
            assert page.locator('#kafu-book-results .book-card').count()==0
            assert 'No matching books' in page.locator('#kafu-book-results').inner_text()
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
    return {'hashes':hashes,'passed':['phone/iPad light/dark: one-tap resume, derived daily goal and Review Due, stable cover sizes during title search + specialty filtering, focus retained, clear/no-results feedback, saved fields unchanged, offline discovery and notices preserved']}
