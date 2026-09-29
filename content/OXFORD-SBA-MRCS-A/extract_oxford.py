#!/usr/bin/env python3
"""Task-local, fingerprint-locked Oxford extraction and page-health audit.

Never writes the source PDF. Replaces only binary leaves with length/SHA256
metadata; retains image blocks, text/spans, coordinates, and transforms.
Poppler and MuPDF are independent extraction engines. Diagnostic rendering
is not manual visual verification and is never counted as such.
"""
from __future__ import annotations
import argparse, hashlib, io, json, re, subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
import fitz
from PIL import Image

EXPECTED_SHA = '00da079467ce8d8aecdb5dc65cab6b0d0b884bff17c9b6a00b03c69604de0ad6'
EXPECTED_BYTES = 2736487
EXPECTED_PAGES = 256


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sanitize_binary(value: Any) -> Any:
    if isinstance(value, (bytes, bytearray)):
        return {'binary_payload_removed': True, 'byte_length': len(value),
                'sha256': sha(bytes(value))}
    if isinstance(value, dict):
        return {key: sanitize_binary(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [sanitize_binary(item) for item in value]
    return value


def binary_count(value: Any) -> int:
    if isinstance(value, (bytes, bytearray)):
        return 1
    if isinstance(value, dict):
        return sum(binary_count(v) for v in value.values())
    if isinstance(value, (tuple, list)):
        return sum(binary_count(v) for v in value)
    return 0


def text_signature(value: dict) -> list:
    return [(b['type'], b.get('bbox'), [(l.get('bbox'), l.get('dir'),
             [(s.get('text'), s.get('bbox'), s.get('origin'), s.get('font'),
               s.get('flags'), s.get('size')) for s in l.get('spans',[])])
             for l in b.get('lines',[])])
            for b in value.get('blocks',[]) if b.get('type') == 0]


def struct_text(value: dict) -> str:
    return '\n'.join(''.join(s.get('text','') for s in line.get('spans',[]))
                     for b in value.get('blocks',[]) if b.get('type') == 0
                     for line in b.get('lines',[]))


def warnings() -> list[str]:
    return [x for x in fitz.TOOLS.mupdf_warnings(reset=True).splitlines() if x]


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def compact(text: str) -> str:
    for a,b in [('\ufb01','fi'),('\ufb02','fl'),('\ufb00','ff'),
                ('\ufb03','ffi'),('\ufb04','ffl')]:
        text=text.replace(a,b)
    return re.sub(r'\s+','',text)


def poppler_page(pdf: Path, n: int) -> dict:
    result={'pdf_page':n}
    for name,flags in [('normal',[]),('raw',['-raw']),('layout',['-layout'])]:
        args=['pdftotext','-f',str(n),'-l',str(n),'-enc','UTF-8',*flags,str(pdf),'-']
        try:
            p=subprocess.run(args,capture_output=True,timeout=20)
            result[name]={'pass':p.returncode==0,'returncode':p.returncode,
                          'text':p.stdout.decode('utf-8','strict'),
                          'warnings':p.stderr.decode('utf-8','replace').splitlines()}
        except Exception as e:
            result[name]={'pass':False,'error':repr(e),'text':'','warnings':[]}
    args=['pdftoppm','-f',str(n),'-l',str(n),'-scale-to','384',
          '-singlefile','-png',str(pdf)]
    try:
        p=subprocess.run(args,capture_output=True,timeout=20)
        im=Image.open(io.BytesIO(p.stdout)); im.load()
        result['render']={'pass':p.returncode==0,'returncode':p.returncode,
                          'width':im.width,'height':im.height,'png_sha256':sha(p.stdout),
                          'warnings':p.stderr.decode('utf-8','replace').splitlines()}
    except Exception as e:
        result['render']={'pass':False,'error':repr(e),
                          'warnings':p.stderr.decode('utf-8','replace').splitlines() if 'p' in locals() else []}
    return result


def main() -> None:
    ap=argparse.ArgumentParser(); ap.add_argument('pdf',type=Path)
    ap.add_argument('--out',type=Path,default=Path(__file__).parent/'evidence')
    args=ap.parse_args(); out=args.out; out.mkdir(parents=True,exist_ok=True)
    pdf=args.pdf; raw=pdf.read_bytes()
    if len(raw)!=EXPECTED_BYTES or sha(raw)!=EXPECTED_SHA:
        raise ValueError('SOURCE FINGERPRINT MISMATCH; no extraction performed')
    fitz.TOOLS.mupdf_display_errors(False); fitz.TOOLS.mupdf_display_warnings(False)
    warnings(); doc=fitz.open(pdf); open_warnings=warnings()
    assert len(doc)==EXPECTED_PAGES, 'PDF PAGE COUNT MISMATCH'
    image_pages=[n+1 for n in range(len(doc)) if doc[n].get_images(full=True)]
    discovery_warnings=warnings()
    representative=sorted(set([1,4,7,20,36]+image_pages[:2]+image_pages[-2:]))
    tests=[]
    for n in representative:
        page=doc[n-1]; before=page.get_text('text'); original=page.get_text('dict')
        cleaned=sanitize_binary(original); encoded=json.dumps(cleaned,ensure_ascii=False)
        restored=json.loads(encoded); after=page.get_text('text')
        assert before==after
        assert struct_text(original)==struct_text(restored)
        assert json.dumps(text_signature(original))==json.dumps(text_signature(restored))
        assert binary_count(restored)==0
        assert len(original.get('blocks',[]))==len(restored.get('blocks',[]))
        tests.append({'pdf_page':n,'serialization_pass':True,
            'page_text_identical':before==after,'structured_text_identical':True,
            'text_spans_coordinates_fonts_preserved':True,
            'all_blocks_preserved':True,'binary_fields_before':binary_count(original),
            'binary_fields_after':binary_count(restored),
            'image_blocks':sum(b['type']==1 for b in original.get('blocks',[])),
            'text_blocks':sum(b['type']==0 for b in original.get('blocks',[])),
            'text_sha256':sha(before.encode()),'json_bytes':len(encoded.encode()),
            'warnings':warnings()})
    synthetic={'block':{'bbox':[0,1,2,3],'image':bytearray(b'test'),'text':'unchanged'}}
    assert sanitize_binary(synthetic)['block']['text']=='unchanged'
    assert binary_count(sanitize_binary(synthetic))==0
    write_json(out/'sanitizer-tests.json',{'representative_pages':tests,'bytearray_test_pass':True})
    pages=[]; health=[]
    for n in range(1,len(doc)+1):
        h={'pdf_page':n,'pymupdf_page_open':False,'pymupdf_text_extraction':False,
           'pymupdf_render':False,'pymupdf_warnings':{},'manual_visual_inspection':False}
        try:
            warnings(); page=doc[n-1]; h['pymupdf_page_open']=True
            h['pymupdf_warnings']['open']=warnings()
            text=page.get_text('text'); structured=page.get_text('dict')
            cleaned=sanitize_binary(structured)
            assert struct_text(structured)==struct_text(cleaned)
            assert binary_count(cleaned)==0
            json.dumps(cleaned,ensure_ascii=False)
            h['pymupdf_text_extraction']=True
            h['pymupdf_warnings']['text']=warnings()
            pages.append({'pdf_page':n,'text':text,'dict':cleaned})
            pix=page.get_pixmap(matrix=fitz.Matrix(.6,.6),alpha=False)
            png=pix.tobytes('png')
            h['pymupdf_render']=pix.width>0 and pix.height>0
            h['pymupdf_warnings']['render']=warnings()
            h['render_dimensions']=[pix.width,pix.height]
            h['render_png_sha256']=sha(png)
            h['text_characters']=len(text.strip())
        except Exception as e:
            h['error']=repr(e); h['pymupdf_warnings']['failure']=warnings()
        health.append(h)
    write_json(out/'pymupdf-pages.json',pages)
    write_json(out/'pymupdf-page-health.json',health)
    with ThreadPoolExecutor(max_workers=4) as pool:
        poppler=list(pool.map(lambda n: poppler_page(pdf,n),range(1,len(doc)+1)))
    write_json(out/'poppler-pages.json',poppler)
    by_page={p['pdf_page']:p for p in pages}
    for h,p in zip(health,poppler):
        n=h['pdf_page']; text=by_page.get(n,{}).get('text','')
        h['poppler_extraction']=all(p[m]['pass'] for m in ['normal','raw','layout'])
        h['poppler_render']=p['render']['pass']
        h['poppler_warnings']={m:p[m].get('warnings',[]) for m in ['normal','raw','layout','render']}
        h['poppler_text_characters']={m:len(p[m]['text'].strip()) for m in ['normal','raw','layout']}
        h['poppler_normal_compact_equal']=compact(text)==compact(p['normal']['text'])
        h['poppler_raw_compact_equal']=compact(text)==compact(p['raw']['text'])
        lengths=[len(compact(t)) for t in [text,p['normal']['text']]]
        reasons=[]
        if min(lengths)<10 and n not in [1,256] and 'intentionally left blank' not in text.lower():
            reasons.append('very little extracted text; inspect whether intentional')
        if max(lengths)>100 and min(lengths)/max(lengths)<.90:
            reasons.append('engine text lengths differ by more than 10%')
        if '\ufffd' in text or '\ufffd' in p['normal']['text']:
            reasons.append('replacement glyph in extracted text')
        h['suspiciously_empty_or_truncated']=bool(reasons)
        h['suspicious_reasons']=reasons
    write_json(out/'page-health.json',health)
    summary={'source':{'filename':pdf.name,'bytes':len(raw),'sha256':sha(raw),'pages':len(doc)},
             'pymupdf_version':fitz.VersionBind,'pdf_open_warnings':open_warnings,
             'image_inventory_warnings':discovery_warnings,'embedded_image_pages':image_pages,
             'sanitizer_test_pages':representative,'pages':len(health),
             'failures':{k:[h['pdf_page'] for h in health if not h[k]] for k in
                         ['pymupdf_page_open','pymupdf_text_extraction','pymupdf_render','poppler_extraction','poppler_render']},
             'suspicious_pages':[h['pdf_page'] for h in health if h['suspiciously_empty_or_truncated']],
             'warning_context_pages':[h['pdf_page'] for h in health if any(h['pymupdf_warnings'].values()) or any(h['poppler_warnings'].values())],
             'page_compact_equal_normal':sum(h['poppler_normal_compact_equal'] for h in health),
             'page_compact_equal_raw':sum(h['poppler_raw_compact_equal'] for h in health),
             'parser_offset_note':'Numbers in parser diagnostics are byte offsets, not PDF page numbers. Warnings are associated only with the operation that emitted them.',
             'manual_visual_inspection_pages':0,'repair_performed':False}
    assert pdf.read_bytes()==raw, 'ORIGINAL PDF CHANGED'
    write_json(out/'extraction-summary.json',summary)
    print(json.dumps(summary,indent=2))

if __name__=='__main__':
    main()
