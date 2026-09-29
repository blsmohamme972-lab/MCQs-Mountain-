#!/usr/bin/env python3
"""Prepare verbatim source prose, independently compare Poppler positioned text.

Only measured visual/caption rectangles are moved into their linked assets.
Printed Wingdings bullet glyphs are interpreted as list formatting, not letters.
Source sentence selection is a later, explicit, reviewable operation.
"""
from pathlib import Path
import collections,json,re,xml.etree.ElementTree as ET
from parse_oxford import BOUNDS,ASTART,body,compact,join_lines
from package_assets import ASSETS
HERE=Path(__file__).resolve().parent


def in_asset(page,bbox):
 x=(bbox[0]+bbox[2])/2;y=(bbox[1]+bbox[3])/2
 return any(a['pdf_page']==page and a['bbox'][0]<=x<=a['bbox'][2] and a['bbox'][1]<=y<=a['bbox'][3] for a in ASSETS)


def clean_marker(s):
 # These control glyphs are positively identified in Wingdings-Regular spans.
 return re.sub(r'^[\x02\x03\x04]+\s*','',s).strip()


def poppler_positioned():
 xml=(HERE/'evidence/poppler-bbox.html').read_text()
 # Poppler exports non-XML control glyphs from the source Wingdings font.
 xml=re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]','',xml)
 root=ET.fromstring(xml)
 for e in root.iter(): e.tag=e.tag.split('}')[-1]
 pages=[]
 for n,page in enumerate(root.findall('.//page'),1):
  ls=[]
  for line in page.findall('.//line'):
   words=[]
   for word in line.findall('word'):
    text=word.text or ''
    x=float(word.get('xMin'))
    # Visually established dots: z at x=52.0185, nested dot at x=60.5225.
    if text in ('z','\x8b','\x03') and 51.8<=x<=61.0:continue
    words.append({'text':text,'bbox':[float(word.get(k)) for k in ('xMin','yMin','xMax','yMax')]})
   s=' '.join(w['text'] for w in words).strip()
   bb=[float(line.get(k)) for k in ('xMin','yMin','xMax','yMax')]
   if not s or in_asset(n,bb):continue
   ls.append({'text':s,'bbox':bb,'page':n,'words':words})
  # Small superscripts can be separate Poppler lines with nearly the same
  # top coordinate. Rejoin by geometric overlap and horizontal position.
  removed=[]
  for small in ls:
   if not re.fullmatch(r'[0-9]+',small['text']):continue
   sb=small['bbox']
   candidates=[base for base in ls if base is not small and len(base['text'])>20
     and base['bbox'][0]<sb[0]<base['bbox'][2]
     and abs(base['bbox'][1]-sb[1])<3
     and sb[3]-sb[1]<(base['bbox'][3]-base['bbox'][1])*.8]
   if len(candidates)==1:
    base=candidates[0];base['words'].extend(small['words'])
    base['words'].sort(key=lambda w:w['bbox'][0])
    base['text']=' '.join(w['text'] for w in base['words'])
    removed.append(id(small))
  ls=[l for l in ls if id(l) not in removed]
  pages.append(sorted(ls,key=lambda l:(round(l['bbox'][1],1),l['bbox'][0])))
 return pages


def main():
 data=json.loads((HERE/'work/parsed-initial.json').read_text());pp=poppler_positioned()
 pop=[]
 for ch,(qf,af,nf) in enumerate(BOUNDS,1):
  current=None;ach=[]
  for p in range(af,nf):
   for l in body(pp[p-1],p==af):
    m=ASTART.match(l['text'])
    if m:
     if current:ach.append(current)
     current={'number':m[1],'key':m[2],'page':p,'lines':[]}
     if m[3].strip():current['lines'].append(dict(l,text=m[3].strip()))
    elif current:current['lines'].append(l)
  if current:ach.append(current)
  assert [int(a['number']) for a in ach]==list(range(1,51)),(ch,[a['number'] for a in ach])
  pop.extend(ach)
 results=[];prepared=[]
 for q,a,p in zip(data['questions'],data['evidence']['answers'],pop):
  lines=[dict(l,text=clean_marker(l['text']),bullet=l['text'].startswith(('\x02','\x04'))) for l in a['key']['lines'] if not in_asset(l['page'],l['bbox'])]
  mtext=join_lines(lines);ptext=join_lines(p['lines'])
  equal=compact(mtext)==compact(ptext)
  results.append({'local_id':q['local_id'],'source_number':q['source_number'],'key_equal':a['key']['answer']==p['key'],'prose_equal':equal})
  prepared.append({'local_id':q['local_id'],'source_number':q['source_number'],'answer':q['answer'],'answer_page':a['key']['page'],'lines':lines,'source_prose':mtext,'poppler_prose':ptext})
  if not equal:
   from compare_engines import differences
   results[-1]['differences']=differences(mtext,ptext)
 summary={'questions':len(prepared),'matching_printed_keys':sum(r['key_equal'] for r in results),'matching_prose':sum(r['prose_equal'] for r in results),'results':results}
 (HERE/'work/explanations-prose.json').write_text(json.dumps(prepared,ensure_ascii=False,indent=2)+'\n')
 (HERE/'evidence/positioned-explanation-comparison.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 print({k:v for k,v in summary.items() if k!='results'})
 for r in results:
  if not r['prose_equal']:print(json.dumps(r,ensure_ascii=False))

if __name__=='__main__':main()
