"""Real pre-onboarding app -> new app -> old app, same isolated IndexedDB.

The reference is the main commit immediately before PR #31. No production
origin, Telegram account or user data is contacted by this test.
"""
import io
import re
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path
from tools.build_frontend import build
from tools.ui.check import INIT, SEED

ROOT = Path(__file__).resolve().parents[3]
LEGACY_COMMIT = '239c800452e11eb6d42873ad9d35a8e10e35d07a'

DUMP = """async()=>{
 async function value(v){
  if(v instanceof Blob)return {blob:Array.from(new Uint8Array(await v.arrayBuffer())),type:v.type};
  if(v instanceof ArrayBuffer)return {buffer:Array.from(new Uint8Array(v))};
  if(ArrayBuffer.isView(v))return {typed:v.constructor.name,bytes:Array.from(new Uint8Array(v.buffer))};
  if(Array.isArray(v))return Promise.all(v.map(value));
  if(v&&typeof v==='object'){const out={};for(const k of Object.keys(v).sort())out[k]=await value(v[k]);return out;}
  return v;
 }
 const db=await new Promise((ok,no)=>{const r=indexedDB.open('medmcq',2);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
 const out={version:db.version,stores:{}};
 for(const name of Array.from(db.objectStoreNames)){
  const rows=await new Promise((ok,no)=>{const tx=db.transaction(name),s=tx.objectStore(name),keys=s.getAllKeys(),vals=s.getAll();tx.oncomplete=()=>ok(keys.result.map((key,i)=>[key,vals.result[i]]));tx.onerror=()=>no(tx.error);});
  out.stores[name]={};for(const [k,v] of rows)out.stores[name][k]=await value(v);
 }
 db.close();return out;
}"""


def run(browser, origin, pack, out, helpers):
    with tempfile.TemporaryDirectory(prefix='kafu-compat-') as td:
        root = Path(td)
        archive = subprocess.run(['git', 'archive', LEGACY_COMMIT, 'app'], cwd=ROOT,
                                 check=True, capture_output=True).stdout
        with tarfile.open(fileobj=io.BytesIO(archive)) as tf:
            tf.extractall(root, filter='data')
        shutil.copytree(ROOT / 'app/vendor', root / 'app/vendor', dirs_exist_ok=True)
        build(root / 'app', root / 'legacy', 'd' * 40)
        old = (root / 'legacy/index.html').read_text()
        old = old.replace('https://kafu-content-1.blsmohamme97.workers.dev', origin)
        old = re.sub(r'<script src="https://telegram.org/[^\"]+"></script>', '<script>/* isolated */</script>', old)
        ctx = browser.new_context(viewport={'width':390, 'height':844}, ignore_https_errors=True,
                                  locale='en-GB', timezone_id='UTC', service_workers='block')
        ctx.add_init_script(INIT)
        page = ctx.new_page()
        page.goto(origin + '/seed/')
        page.evaluate(SEED, {'pack': pack, 'withProgress': True})
        phase = {'old': True}
        page.route(origin + '/', lambda route: route.fulfill(status=200, content_type='text/html', body=old)
                   if phase['old'] else route.continue_())
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        page.goto(origin, wait_until='load')
        page.wait_for_selector('nav')
        assert page.evaluate("typeof KafuOnboarding==='undefined'")
        page.evaluate("""async()=>{
          await DB.put('meta','state',S);
          await DB.put('meta','unrelated_future_record',{keep:true,payload:['unchanged',17]});
          await DB.put('images','compatibility-image',new Blob([new Uint8Array([0,1,2,250,255])],{type:'image/webp'}));
        }""")
        before = page.evaluate(DUMP)
        phase['old'] = False
        page.reload(wait_until='load');page.wait_for_selector('nav')
        page.wait_for_function("typeof KafuOnboarding!=='undefined'&&KafuOnboarding.record?.complete")
        page.evaluate("async()=>{await DB.put('meta','state',S);}")
        upgraded = page.evaluate(DUMP)
        assert upgraded['version'] == before['version'] == 2
        assert upgraded['stores'].keys() == before['stores'].keys()
        for store, rows in before['stores'].items():
            for key, value in rows.items():
                assert upgraded['stores'][store].get(key) == value, f'Upgrade modified {store}/{key}'
        added = set(upgraded['stores']['meta']) - set(before['stores']['meta'])
        assert added == {'ui_onboarding_user_browser'}, added
        assert page.locator('.k-onboarding').count() == 0
        phase['old'] = True
        page.reload(wait_until='load');page.wait_for_selector('nav')
        assert page.evaluate("typeof KafuOnboarding==='undefined'")
        page.evaluate("async()=>{await DB.put('meta','state',S);}")
        assert page.evaluate(DUMP) == upgraded, 'Rollback changed saved records'
        assert page.evaluate("S.fav.includes('Q000001002')&&S.favBooks.includes('DESIGN-CARDIO')")
        page.evaluate("async()=>{await startChapter('DESIGN-CARDIO',1,'Q000001003');}")
        page.wait_for_selector('.stem')
        assert page.evaluate("SESSION.qids.includes('Q000001003')")
        assert not errors, errors
        ctx.close()
    return {'passed': ['Actual pre-PR31 app -> upgraded app -> pre-PR31 app: every existing IndexedDB key/value, sync replica, answer, star, download and image preserved; only local onboarding key added; old app still opens the saved chapter']}
