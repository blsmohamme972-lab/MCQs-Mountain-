"""Tasteful encouragement and local, additive achievement persistence."""
import importlib.util
import io
import re
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path
from tools.build_frontend import build
ROOT=Path(__file__).resolve().parents[3]
OLD='87eb5e544afe7b39bd952323cd385f06d6df9e74'
IDS=['Q000001001','Q000001002','Q000001003','Q000001004']

def run(browser,origin,pack,out,helpers):
    hashes={}
    for device in ('phone','ipad'):
        for theme in ('light','dark'):
            ctx=helpers['context'](browser,origin,device,theme)
            page,errors=helpers['open_app'](ctx,origin,pack)
            assert page.locator('.k-streak').count()==1
            assert page.evaluate('KafuDelight.motion()') is False
            page.evaluate("ids=>startSession({mode:'study',title:'A focused practice session',bookId:'DESIGN-CARDIO',chId:1,qids:ids})",IDS)
            for _ in IDS:
                helpers['study_answer'](page,True)
                assert 'Kafu!' in page.locator('.explain h4').inner_text()
                page.locator('[data-a="action"]').last.click()
            page.wait_for_selector('[data-session-complete]')
            page.evaluate('KafuDelight.settled()')
            assert page.evaluate("!!KafuDelight.record.earned.first_chapter&&!!KafuDelight.record.earned.first_perfect")
            assert page.locator('.k-complete-kafu').count()==1
            page.locator('[data-a="action"]').last.click()
            page.evaluate("tab('me')")
            assert page.locator('[data-badge="first_perfect"].earned').count()==1
            name=f'{device}-{theme}-badges-earned'
            hashes[name]=helpers['capture'](page,out/(name+'.png'))
            page.evaluate("async()=>{await DB.put('meta','state',S);}")
            saved=page.evaluate('JSON.stringify([S.answers,S.fav,S.dl,S.sync_v2])')
            page.wait_for_function('navigator.serviceWorker.controller!==null')
            ctx.set_offline(True);page.reload(wait_until='load');page.wait_for_selector('nav')
            assert page.evaluate('JSON.stringify([S.answers,S.fav,S.dl,S.sync_v2])')==saved
            assert page.evaluate("!!KafuDelight.record.earned.first_perfect")
            page.evaluate("ids=>startSession({mode:'review',title:'Try again',qids:ids.slice(0,1)})",IDS)
            helpers['study_answer'](page,False)
            assert 'Kafu!' not in page.locator('.explain').inner_text()
            assert not errors,errors
            ctx.close()
    with tempfile.TemporaryDirectory(prefix='delight-compat-') as td:
        root=Path(td)
        raw=subprocess.run(['git','archive',OLD,'app'],cwd=ROOT,check=True,capture_output=True).stdout
        with tarfile.open(fileobj=io.BytesIO(raw)) as tf:tf.extractall(root,filter='data')
        shutil.copytree(ROOT/'app/vendor',root/'app/vendor',dirs_exist_ok=True)
        build(root/'app',root/'old','d'*40)
        html=(root/'old/index.html').read_text().replace('https://kafu-content-1.blsmohamme97.workers.dev',origin)
        html=re.sub(r'<script src="https://telegram.org/[^\"]+"></script>','<script>/* isolated */</script>',html)
        spec=importlib.util.spec_from_file_location('database_dump',ROOT/'tools/ui/flows/03_compatibility.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
        from tools.ui.check import INIT,SEED
        ctx=browser.new_context(viewport={'width':390,'height':844},ignore_https_errors=True,service_workers='block',locale='en-GB',timezone_id='UTC');ctx.add_init_script(INIT)
        page=ctx.new_page();page.goto(origin+'/seed/');page.evaluate(SEED,{'pack':pack,'withProgress':True})
        old={'active':True};page.route(origin+'/',lambda r:r.fulfill(status=200,content_type='text/html',body=html) if old['active'] else r.continue_())
        page.goto(origin,wait_until='load');page.wait_for_selector('nav');page.evaluate("async()=>{await DB.put('meta','state',S);}")
        before=page.evaluate(mod.DUMP)
        old['active']=False;page.reload(wait_until='load');page.wait_for_selector('nav')
        assert page.evaluate('typeof KafuDelight!=="undefined"')
        assert page.evaluate(mod.DUMP)==before,'Loading delight changed preexisting records'
        page.evaluate("async()=>{const record=KafuDelightCore.earn(KafuDelightCore.migrate(null).record,['first_chapter'],'2026-09-28');await DB.put('meta',KafuDelight.storageKey,record);}")
        added=page.evaluate(mod.DUMP)
        for store,rows in before['stores'].items():
            for key,value in rows.items():assert added['stores'][store][key]==value
        assert set(added['stores']['meta'])-set(before['stores']['meta'])=={'ui_delight_user_browser'}
        old['active']=True;page.reload(wait_until='load');page.wait_for_selector('nav');page.evaluate("async()=>{await DB.put('meta','state',S);}")
        assert page.evaluate('typeof KafuDelight==="undefined"')
        assert page.evaluate(mod.DUMP)==added,'Old version did not preserve additive badge key'
        page.evaluate("async()=>{await startChapter('DESIGN-CARDIO',1,'Q000001001');}");page.wait_for_selector('.stem')
        ctx.close()
    return {'hashes':hashes,'passed':['phone/iPad both themes: tasteful correct/complete moments, earned badges persist offline, wrong answers never celebrated, reduced motion obeyed','Actual pre-delight -> new -> pre-delight app preserves every old DB key/value, sync, packs and new additive local badge key; old app still studies downloaded chapter']}
