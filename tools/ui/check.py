"""Isolated Playwright journeys and deliberately approved screenshot hashes.

CI never updates baselines. Phone/iPad are Chromium viewports, not physical
Telegram/iOS certification. All study fixtures use a local HTTPS server.
"""
from __future__ import annotations
import argparse
import contextlib
import functools
import gzip
import hashlib
import http.server
import json
import importlib.util
import os
from pathlib import Path
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import threading

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from tools.build_frontend import build
from PIL import Image
from playwright.sync_api import sync_playwright

FIXED_TIME='2026-09-28T09:30:00.000Z'
QIDS=[f'Q00000100{i}' for i in range(1,5)]
DEVICES={'phone':{'width':390,'height':844},'ipad':{'width':820,'height':1180}}
VISUAL_HASH_VARIANTS={}


def fixtures(origin):
    questions=[
        {'id':QIDS[0],'type':'sba','stem':'Which approach makes a focused study session easier?','options':['Choose one clear goal','Open every chapter at once','Skip the explanation'],'answer':'A','explanation':'One clear goal makes it easier to begin. Read the explanation before moving on.','source_page':12},
        {'id':QIDS[1],'type':'mtf','stem':'Mark each statement about this practice chapter true or false.','options':['Saved chapters can be studied offline.','A saved image requires a new download for every question.','Your explanation appears after checking an answer.'],'answer':['T','F','T'],'explanation':'This is synthetic test content, not clinical advice.','source_page':13},
        {'id':QIDS[2],'type':'multi','stem':'Choose two helpful ways to review a difficult question.','options':['Read its explanation','Star it for later','Delete all your progress','Ignore the source'],'answer':['A','B'],'explanation':'Explanations and saved questions support a thoughtful review session.','source_page':14},
        {'id':QIDS[3],'type':'emq','lead_in':'Match the study action to its purpose.','stem':'Which action saves a question for another session?','options':['Start a mock exam','Open a chapter','Star the question','Change text size','Check a source'],'answer':'C','explanation':'Starred questions are available from Review. Download the chapter for offline use.','source_page':15},
    ]
    for q in questions:q.update(book_id='DESIGN-CARDIO',chapter_id=1,version=1,no_shuffle=True,status='source_verified',images=[],explanation_images=[])
    pack={'schema':1,'book_id':'DESIGN-CARDIO','chapter_id':1,'version':1,'questions':questions}
    books=[]
    for bid,title,specialty,description in [('DESIGN-CARDIO','Clinical Cardiology','Cardiology','A focused practice session'),('DESIGN-SURGERY','Surgery Essentials','Surgery','Build your foundations'),('DESIGN-PHARMA','Pharmacology Review','Pharmacology','Small steps, lasting recall')]:
        books.append({'id':bid,'title':title,'authors':['Kafu Practice Series'],'field':'medicine','specialty':specialty,'collection_type':'textbook','version':1,'questions':4,'chapters':[{'id':1,'title':description,'questions':4,'qids':QIDS if bid=='DESIGN-CARDIO' else [],'url':origin+'/packs/'+bid+'/v1/chapter.json','image_url':None,'bytes':len(json.dumps(pack)),'image_bytes':0}]})
    return {'schema':1,'books':books,'removed_books':[],'fields':[{'id':'medicine','title':{'en':'Medicine'}}],'specialties':[{'id':s,'field':'medicine'} for s in ['Cardiology','Surgery','Pharmacology']]},pack


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        super().end_headers()


@contextlib.contextmanager
def site(source,output,port,cert,key,vendor):
    if vendor.is_dir() and vendor.resolve()!=(source/'app/vendor').resolve():
        shutil.copytree(vendor,source/'app/vendor',dirs_exist_ok=True)
    build(source/'app',output,'d'*40)
    origin=f'https://localhost:{port}'
    html=(output/'index.html').read_text()
    html=html.replace('https://kafu-content-1.blsmohamme97.workers.dev',origin)
    html=re.sub(r'<script src="https://telegram.org/[^"]+"></script>','<script>/* Isolated browser fixture: no Telegram connection */</script>',html)
    html=re.sub(r'<link[^>]+href="https://fonts\.[^"]+"[^>]*>','',html)
    if not (source/'app/design/components.css').exists():
        fonts=''.join(f"@font-face{{font-family:{name.title()};font-style:normal;font-weight:{weight};font-display:swap;src:url('/vendor/{name}-latin-{weight}.woff2') format('woff2')}}" for name in ['poppins','lora'] for weight in [400,500,600])
        html=html.replace('</head>','<style>'+fonts+'</style></head>')
    (output/'index.html').write_text(html)
    sw=output/'sw.js'
    if sw.exists():sw.write_text(sw.read_text().replace('https://kafu-content-1.blsmohamme97.workers.dev',origin))
    catalog,pack=fixtures(origin)
    (output/'catalog.json').write_text(json.dumps(catalog))
    (output/'seed').mkdir(exist_ok=True)
    (output/'seed/index.html').write_text('<!doctype html><title>Isolated test data setup</title>')
    for b in catalog['books']:
        path=output/'packs'/b['id']/'v1';path.mkdir(parents=True,exist_ok=True)
        (path/'chapter.json').write_text(json.dumps(pack))
    server=http.server.ThreadingHTTPServer(('127.0.0.1',port),functools.partial(QuietHandler,directory=str(output)))
    tls=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);tls.load_cert_chain(cert,key)
    server.socket=tls.wrap_socket(server.socket,server_side=True)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:yield origin,pack
    finally:server.shutdown();server.server_close()


INIT="""(() => {
  const OriginalDate=Date,fixed=+new OriginalDate('2026-09-28T09:30:00.000Z');
  class TestDate extends OriginalDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
  window.Date=TestDate;Math.random=()=>0.42;
  const nativeInterval=window.setInterval;
  window.setInterval=(fn,ms,...args)=>ms===5000?0:nativeInterval(fn,ms,...args);
})();"""
SEED="""async ({pack,withProgress})=>{
 const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('medmcq',2);req.onupgradeneeded=()=>{for(const n of ['packs','meta','images'])if(!req.result.objectStoreNames.contains(n))req.result.createObjectStore(n);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 const now=Date.now();
 const state={answers:withProgress?{Q000001001:{c:true,n:2,t:now,b:'DESIGN-CARDIO'},Q000001002:{c:false,n:1,t:now,b:'DESIGN-CARDIO'}}:{},fav:withProgress?['Q000001002']:[],favBooks:withProgress?['DESIGN-CARDIO']:[],resume:withProgress?{b:'DESIGN-CARDIO',ch:1,q:'Q000001003',t:now}:null,time:withProgress?{'2026-09-28':420}:{},active:withProgress?{'2026-09-26':true,'2026-09-27':true,'2026-09-28':true}:{},reports:[],dl:withProgress?{'DESIGN-CARDIO:1':{v:1,size:2100,at:now,complete:true}}:{},settings:{fs:1,education_ack:'education-2026-09-28'}};
 await new Promise((resolve,reject)=>{const tx=db.transaction(['meta','packs'],'readwrite');tx.objectStore('meta').put(state,'state_user_browser');if(withProgress)tx.objectStore('packs').put({...pack,_offline_complete:true,_text_bytes:2100,_image_bytes:0,img:{}},'DESIGN-CARDIO:1');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
}"""


def context(browser,origin,device='phone',theme='light'):
    ctx=browser.new_context(viewport=DEVICES[device],device_scale_factor=1,color_scheme=theme,reduced_motion='reduce',ignore_https_errors=True,locale='en-GB',timezone_id='UTC')
    ctx.add_init_script(INIT)
    ctx.route('https://telegram.org/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body='/* No Telegram connection in fixtures */'))
    ctx.route('https://fonts.googleapis.com/**',lambda route:route.abort())
    ctx.route('https://fonts.gstatic.com/**',lambda route:route.abort())
    ctx.route('https://kafu*.workers.dev/**',lambda route:route.abort())
    return ctx


def open_app(ctx,origin,pack,progress=True):
    page=ctx.new_page();page.goto(origin+'/seed/')
    page.evaluate(SEED,{'pack':pack,'withProgress':progress})
    errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.goto(origin,wait_until='load')
    page.wait_for_selector("nav[aria-label='Main']",timeout=15000)
    page.wait_for_function("typeof CATALOG!=='undefined'&&CATALOG.books.some(b=>b.id==='DESIGN-CARDIO')")
    page.evaluate('document.fonts.ready')
    failures=page.evaluate('KafuEnhancements.failures')
    if failures:raise AssertionError(f'Installer failures: {failures}')
    return page,errors


def capture(page,path):
    page.evaluate("() => {for(const t of document.querySelectorAll('.toast'))t.hidden=true;window.scrollTo(0,0);}")
    page.wait_for_timeout(150)
    page.screenshot(path=str(path),full_page=True,animations='disabled')
    with Image.open(path) as image:
        raw=image.convert('RGBA')
        return {'sha256':hashlib.sha256(raw.tobytes()).hexdigest(),'width':raw.width,'height':raw.height}

def viewport_capture(page,path,scroll=False):
    page.evaluate("() => {for(const t of document.querySelectorAll('.toast'))t.hidden=true;}")
    if scroll:
        page.evaluate("() => window.scrollTo(0,Math.min(Math.max(0,document.documentElement.scrollHeight-innerHeight),Math.round(innerHeight*.65)))")
    else:
        page.evaluate("() => window.scrollTo(0,0)")
    page.wait_for_timeout(100)
    page.screenshot(path=str(path),full_page=False,animations='disabled')

def contact_sheet(paths,out,device,theme):
    if not paths:return
    target=280 if device=='phone' else 350
    label_h=28;gap=12
    prepared=[]
    for label,path in paths:
        with Image.open(path) as im:
            img=im.convert('RGB');h=round(img.height*target/img.width);img=img.resize((target,h))
            prepared.append((label,img.copy()))
    row_h=max(img.height for _,img in prepared)+label_h
    sheet=Image.new('RGB',(target*2+gap*3,row_h*((len(prepared)+1)//2)+gap*((len(prepared)+1)//2+1)),'white')
    from PIL import ImageDraw
    draw=ImageDraw.Draw(sheet)
    for i,(label,img) in enumerate(prepared):
        col=i%2;row=i//2;x=gap+col*(target+gap);y=gap+row*(row_h+gap)
        draw.text((x,y),label,fill='black');sheet.paste(img,(x,y+label_h))
    sheet.save(out/f'contact-{device}-{theme}.png')


def study_answer(page,correct=True):
    q=page.evaluate('QI[SESSION.qids[SESSION.index]].q')
    if q['type']=='mtf':
        for i,answer in enumerate(q['answer']):
            selected=answer if correct or i else ('F' if answer=='T' else 'T')
            page.locator(f'[data-a="tf"][data-i="{i}"][data-v="{selected}"]').click()
    elif q['type']=='multi':
        choices=[ord(x)-65 for x in q['answer']]
        if not correct:choices[-1]=next(i for i in range(len(q['options'])) if i not in choices)
        for i in choices:page.locator(f'[data-a="pick"][data-i="{i}"]').click()
    else:
        selected=ord(q['answer'])-65
        if not correct:selected=(selected+1)%len(q['options'])
        page.locator(f'[data-a="pick"][data-i="{selected}"]').click()
    page.locator('[data-a="action"]').last.click();page.wait_for_selector('.explain')
    assert page.evaluate('SESSION.resp[SESSION.qids[SESSION.index]].correct') is correct


def snapshots(browser,origin,pack,destination,include_gallery=True):
    destination.mkdir(parents=True,exist_ok=True);hashes={}
    for device in DEVICES:
        for theme in ['light','dark']:
            ctx=context(browser,origin,device,theme);page,errors=open_app(ctx,origin,pack)
            contact=[]
            for screen in ['home','library','study-correct','study-wrong','chapter-complete','me']:
                if screen in {'home','library','me'}:page.evaluate('v=>tab(v)',screen)
                else:
                    page.evaluate("() => {tab('home');startSession({mode:'study',title:'A focused practice session',bookId:'DESIGN-CARDIO',chId:1,qids:['Q000001001']});}")
                    study_answer(page,screen!='study-wrong')
                    if screen=='chapter-complete':page.locator('[data-a="action"]').last.click()
                name=f'{device}-{theme}-{screen}';hashes[name]=capture(page,destination/(name+'.png'))
                if include_gallery:
                    top=destination/(name+'-viewport-top.png');viewport_capture(page,top,False);contact.append((screen+' · top',top))
                    scrolled=destination/(name+'-viewport-scrolled.png');viewport_capture(page,scrolled,True);contact.append((screen+' · scrolled',scrolled))
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'Overflow: {name}'
            assert not errors,errors
            if page.request.get(origin+'/styleguide/').status==200:
                page.goto(origin+'/styleguide/?theme='+theme);page.evaluate('document.fonts.ready')
                page.locator('#show-sheet').click();page.locator('#demo-sheet button').click()
                name=f'{device}-{theme}-styleguide';hashes[name]=capture(page,destination/(name+'.png'))
            if include_gallery:
                contact_sheet(contact,destination,device,theme)
                page.goto(origin+'/#gallery',wait_until='load');page.wait_for_selector('#gallery');page.evaluate('document.fonts.ready')
                page.locator(f'[data-gallery-theme="{theme}"]').click()
                name=f'{device}-{theme}-gallery';hashes[name]=capture(page,destination/(name+'.png'))
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'Overflow: {name}'
            ctx.close()
    return hashes


def flows(browser,origin,pack):
    results=[];ctx=context(browser,origin);page,errors=open_app(ctx,origin,pack,False)
    page.locator('[data-a="tab"][data-v="library"]').last.click()
    if page.locator('[data-a="open-spec"][data-s="Cardiology"]').count():page.locator('[data-a="open-spec"][data-s="Cardiology"]').click()
    page.locator('[data-a="open-book"][data-b="DESIGN-CARDIO"]').first.click()
    page.locator('[data-a="study-ch"]').first.click();page.wait_for_selector('.stem')
    results.append('open app / library / book / chapter');elapsed=[]
    for index,kind in enumerate(['sba','mtf','multi','emq']):
        assert page.evaluate('QI[SESSION.qids[SESSION.index]].q.type')==kind
        study_answer(page,index!=1)
        if index==0:page.locator('[data-a="fav-q"]').click()
        if index<3:
            elapsed.append(page.evaluate("() => new Promise(resolve=>{const begin=performance.now();document.querySelector('[data-a=action]').click();requestAnimationFrame(()=>resolve(performance.now()-begin));})"))
        else:page.locator('[data-a="action"]').last.click()
    results.append('four question types / correct and wrong grading / chapter finish')
    saved=page.evaluate('({answers:JSON.parse(JSON.stringify(S.answers)),fav:S.fav.slice()})')
    assert len(saved['answers'])==4 and QIDS[0] in saved['fav']
    page.evaluate("tab('review')");page.locator('[data-a="practice"][data-list="mistakes"]').click();page.wait_for_selector('.stem')
    assert page.evaluate("SESSION.qids.includes('Q000001002')")
    results.append('review mistakes / favourites persist')
    page.evaluate("async()=>{await DB.put('meta','state',S);await KafuDownloads.manager.finish(KafuDownloads.metadata('DESIGN-CARDIO',1));}")
    page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=15000)
    assert page.evaluate('KafuShell.status') in {'ready','waiting'}
    ctx.set_offline(True);page.reload(wait_until='load');page.wait_for_selector('nav')
    assert page.evaluate("S.fav.includes('Q000001001')&&Object.keys(S.answers).length===4")
    page.evaluate("async()=>{await startChapter('DESIGN-CARDIO',1,'Q000001001');}");page.wait_for_selector('.stem');study_answer(page,True)
    results.append('offline shell reload / downloaded chapter / saved progress unchanged')
    assert not errors,errors
    ctx.close()
    return {'passed':results,'next_question_ms':elapsed,'next_question_budget_pass':max(elapsed,default=0)<=100}


def budget(output):
    html=(output/'index.html').read_text()
    scripts=re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>',html,re.I)
    styles=re.findall(r'<style(?:\s[^>]*)?>([\s\S]*?)</style>',html,re.I)
    js=sum(len(gzip.compress(s.encode(),mtime=0)) for s in scripts if s.strip())
    css=sum(len(gzip.compress(s.encode(),mtime=0)) for s in styles if s.strip())
    app_total=js+css
    fonts=list((output/'vendor').glob('*.woff2'))
    font_total=sum(path.stat().st_size for path in fonts)
    return {
        'app_js_gzip_bytes':js,
        'app_css_gzip_bytes':css,
        'app_js_css_gzip_bytes':app_total,
        'app_limit_bytes':150*1024,
        'font_woff2_bytes':font_total,
        'font_limit_bytes':100*1024,
        'font_files':[path.name for path in sorted(fonts)],
        'method':'Sum of independently gzipped executable inline scripts + inline style blocks in assembled app; Telegram host SDK excluded. Font budget is raw shipped WOFF2 bytes.',
        'passed':app_total<=150*1024 and font_total<=100*1024
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--source',type=Path,default=ROOT);ap.add_argument('--before',type=Path)
    ap.add_argument('--out',type=Path,default=ROOT/'evidence/ui');ap.add_argument('--browser',default=os.environ.get('KAFU_BROWSER'))
    ap.add_argument('--approve',action='store_true');ap.add_argument('--baseline',type=Path,default=ROOT/'tools/ui/visual-baselines.json')
    ap.add_argument('--capture-only',action='store_true');args=ap.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='kafu-ui-') as td:
        temp=Path(td);cert,key=temp/'cert.pem',temp/'key.pem'
        subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(cert),'-days','1','-subj','/CN=localhost'],check=True,capture_output=True)
        with site(args.source,temp/'after',8765,cert,key,args.source/'app/vendor') as (origin,pack),sync_playwright() as pw:
            launch={'args':['--no-sandbox','--ignore-certificate-errors']}
            if args.browser:launch['executable_path']=args.browser
            browser=pw.chromium.launch(**launch)
            hashes=snapshots(browser,origin,pack,args.out/'after')
            checks={} if args.capture_only else flows(browser,origin,pack)
            if not args.capture_only:
                helpers={'context':context,'open_app':open_app,'capture':capture,'study_answer':study_answer}
                for path in sorted((ROOT/'tools/ui/flows').glob('*.py')):
                    spec=importlib.util.spec_from_file_location('extra_'+path.stem,path)
                    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
                    extra=module.run(browser,origin,pack,args.out/'after',helpers)
                    checks.setdefault('passed',[]).extend(extra.get('passed',[]))
                    hashes.update(extra.get('hashes',{}))
            checks['javascript']=budget(temp/'after')
            if args.before:
                with site(args.before,temp/'before',8766,cert,key,args.source/'app/vendor') as (prior,priorpack):snapshots(browser,prior,priorpack,args.out/'before',False)
            browser.close()
    (args.out/'candidate-baselines.json').write_text(json.dumps(hashes,indent=2)+'\n')
    print('CANDIDATE_BASELINES='+json.dumps(hashes,sort_keys=True))
    if args.approve:
        args.baseline.parent.mkdir(parents=True,exist_ok=True);args.baseline.write_text(json.dumps(hashes,indent=2)+'\n')
    expected=json.loads(args.baseline.read_text()) if args.baseline.exists() else {}
    differences=[]
    for name,value in hashes.items():
        if value==expected.get(name):continue
        variant_hashes=VISUAL_HASH_VARIANTS.get(name,set())
        expected_value=expected.get(name) or {}
        if (value.get('width')==expected_value.get('width')
            and value.get('height')==expected_value.get('height')
            and value.get('sha256') in variant_hashes
            and expected_value.get('sha256') in variant_hashes):
            continue
        differences.append(name)
    checks.update(visual_differences=differences,visual_pass=not differences,evidence_environment={'browser':'Chromium viewport emulation','playwright':'1.57.0','date':FIXED_TIME,'devices':DEVICES,'themes':['light','dark']})
    (args.out/'results.json').write_text(json.dumps(checks,indent=2)+'\n');print(json.dumps(checks,indent=2))
    if not args.capture_only and (differences or not checks['javascript']['passed'] or not checks.get('next_question_budget_pass',False)):return 1
    return 0

if __name__=='__main__':raise SystemExit(main())
