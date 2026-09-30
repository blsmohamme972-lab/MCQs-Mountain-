"""Admin-only D1 usage, phone geometry and account isolation; no baseline edits."""
import importlib.util
import json
from pathlib import Path
spec=importlib.util.spec_from_file_location('account_sdk',Path(__file__).with_name('07_account_switch.py'))
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
SDK=mod.SDK
USAGE={'scope':'account','timezone':'UTC','reset':'00:00 UTC (03:00 Baghdad)',
 'fetched_at':'2026-09-30T12:00:00Z','limits':{'rows_read':5000000,'rows_written':100000},
 'today':{'date':'2026-09-30','rows_read':3500000,'rows_written':72000,'read_percent':70,'write_percent':72,'warning':True},
 'days':[{'date':'2026-09-30','rows_read':3500000,'rows_written':72000,'read_percent':70,'write_percent':72,'warning':True}]}
BOOKS=[{'book_id':'PRIVATE-BOOK-'+'LONG-'*30,'version':2,'questions':500,'chapters':15,'images':31,'active':1}]

def run(browser,origin,pack,out,helpers):
    passed=[]
    for width in (360,390,430):
      for theme in ('light','dark'):
        ctx=helpers['phone_context'](browser,origin,width,theme)
        def route_admin(route):
            user=route.request.post_data_json.get('initData')
            if user!='account-101':return route.fulfill(status=403,json={'error':'forbidden'})
            path=route.request.url.rsplit('/',1)[-1]
            route.fulfill(json={'books':True,'d1_usage':True} if path=='capabilities' else {'books':BOOKS} if path=='books' else USAGE)
        ctx.route(origin+'/admin/**',route_admin)
        page=ctx.new_page();errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.add_init_script(f'({SDK})(101);window.Telegram.WebApp.colorScheme="{theme}";')
        page.goto(origin,wait_until='load')
        page.wait_for_function("typeof KafuPersonal!=='undefined'&&!!KafuPersonal.replica&&CATALOG.books.some(b=>b.id==='DESIGN-CARDIO')")
        if page.locator('[data-a=onboard-skip]').count():page.locator('[data-a=onboard-skip]').click()
        page.wait_for_selector('nav')
        page.evaluate("go('me')");page.wait_for_selector('[data-a=admin-books-open]')
        page.locator('[data-a=admin-books-open]').click();page.wait_for_selector('.kafu-admin-warning')
        assert '70.0%' in page.locator('.kafu-admin').inner_text()
        assert '72.0%' in page.locator('.kafu-admin').inner_text()
        assert page.locator('.kafu-admin table').count()==2
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert page.evaluate("[...document.querySelectorAll('.kafu-admin progress')].every(x=>x.getAttribute('aria-label'))")
        page.evaluate('document.fonts.ready');page.screenshot(path=str(out/f'admin-usage-{width}-{theme}.png'),full_page=True)
        # Admin payloads never enter persistent student storage or public caches.
        assert not page.evaluate("DB.all('meta').then(x=>JSON.stringify(x).includes('PRIVATE-BOOK'))")
        page.evaluate("TG.initData='account-202';TG.initDataUnsafe.user.id=202;go('me')")
        assert page.locator('[data-a=admin-books-open]').count()==0
        page.evaluate("go('admin-books')")
        assert 'PRIVATE-BOOK' not in page.locator('main').inner_text()
        assert not errors,errors
        page.close();ctx.close()
        passed.append(f'Admin D1 panel {width}/{theme}: warnings, horizontal containment, secret-free persistence and account isolation')
    return {'passed':passed}
