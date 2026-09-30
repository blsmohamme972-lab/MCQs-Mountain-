"""Deterministic parser for owner-supplied Rush Review of Surgery 6e (595 pages).

Two-column PDF, inline ANSWER(S)/COMMENTS, numbering restarts in subsections.
Question candidates require 9-point source text and a subsequent A option
before any answer/comments/reference marker. Captions/diagram label regions
are excluded from prose. Seven printed two-column matching blocks become
individual EMQ/multi items without inventing choices. The three shared trauma
answers are assigned in their printed order. Typography is normalized only for
ligatures, control artifacts and source-confirmed line-end word hyphenation.
The renderer uses source page crops for diagrams/tables, never generated art.
"""
from pathlib import Path
import re,json,io,hashlib
import fitz
from PIL import Image

ANSWER=re.compile(r'^A\s*N\s*S\s*W\s*E\s*R\s*(?:S\s*)?:\s*(.*)')
COMMENTS=re.compile(r'^COMMENTS?[^:]*:\s*(.*)')
OPTION=re.compile(r'^([A-Z])[.)]\s*(.*)')
FIG=re.compile(r'^Fig\.\s*(\d+[A-Z]?(?:-[A-Z])?\.\d+)\b')
TABLE_END={54:241,187:507,190:423,205:164,238:374,281:739,288:188,293:741,295:739,310:350,330:739,355:431,383:512,492:715,493:205,510:281,563:741,566:738,569:289,581:174}
FULL_TABLES={288,295,310,330,383,492,493}
SPECIAL_FIGS={
 '25.4':(400,(53,414,303,697)), '25.5':(406,(53,248,303,702)),
 '7.1':(119,(58,395,302,665)), '13.10':(238,(177,45,430,219)),
 '19.2':(303,(53,44,302,362)), '19.3':(303,(53,400,303,726)),
 '23A.2':(368,(175,475,457,699)), '23B.1':(382,(170,485,453,705)),
 '23B.2':(383,(175,43,457,279)), '31.1':(527,(172,43,441,489)),
 '31.3':(531,(56,43,558,207)), '30.2':(519,(58,44,559,244)),
}

def clean(s):
 s=str(s).replace('ﬁ','fi').replace('ﬂ','fl').replace('ﬀ','ff').replace('ﬃ','ffi').replace('ﬄ','ffl').replace('\xad','')
 return re.sub(r'[\x00-\x08\x0b-\x1f]','',s).strip()

def page_lines(page):
 out=[]
 for b in page.get_text('dict')['blocks']:
  for l in b.get('lines',[]):
   s=clean(''.join(a['text'] for a in l['spans']));x,y,x1,y1=l['bbox']
   if s and 39<y<754:
    out.append(dict(text=s,x=x,y=y,x1=x1,y1=y1,col=0 if x<310 else 1,page=page.number+1,size=max(a['size'] for a in l['spans']),qstart=bool(re.match(r'^\s*\d+\.',l['spans'][0]['text'])) and 'Bold' in l['spans'][0]['font']))
 return sorted(out,key=lambda l:(l['col'],round(l['y'],1),l['x']))

def join_text(lines,words):
 out=''
 for l in lines:
  s=clean(l['text'] if isinstance(l,dict) else l)
  if not s:continue
  if out.endswith('-') and re.match(r'^[a-z]',s):
   a=re.search(r'([A-Za-z]+)-$',out);b=re.match(r'[a-z]+',s)
   if a and b and (a[1]+b[0]).lower() in words:out=out[:-1]+s
   else:out+=s
  else:out+=(' ' if out else '')+s
 return re.sub(r'\s+',' ',out).strip()

def resources(doc,lines):
 out=[]
 for pg,ll in enumerate(lines,1):
  for ix,l in enumerate(ll):
   m=FIG.match(l['text'])
   # Captions use <=8 points; citations in prose use 9 points.
   if m and l['size']<=8:
    key=m[1]
    if key in SPECIAL_FIGS: rect=SPECIAL_FIGS[key][1]
    else:
     imgs=[fitz.Rect(x['bbox']) for x in doc[pg-1].get_image_info() if x['bbox'][2]-x['bbox'][0]>65 and x['bbox'][3]-x['bbox'][1]>40 and 0<=l['y']-x['bbox'][3]<30 ]
     if not imgs:raise ValueError(f'No source crop for Figure {key} page {pg}')
     rect=tuple(min(imgs,key=lambda r:abs(r.x0-l['x'])))
    cap=[l]
    for n in ll[ix+1:]:
     if n['col']!=l['col'] or n['y']-cap[-1]['y']>15 or n['size']>8:break
     cap.append(n)
    out.append(dict(kind='figure',key=key,page=pg,rect=rect,caption=cap,cut=tuple(rect)))
   if re.match(r'^TABLE\s*\d',l['text']):
    key=re.match(r'^TABLE\s*(\d+[A-Z]?\.\d+)',l['text'])[1]
    end=TABLE_END[pg];x0=53 if pg in FULL_TABLES or l['col']==0 else 311;x1=559 if pg in FULL_TABLES or l['col']==1 else 303
    rect=(x0,l['y']-2,x1,end)
    out.append(dict(kind='table',key=key,page=pg,rect=rect,caption=[l],cut=rect))
 return out

def inside(l,rect):
 x0,y0,x1,y1=rect
 return x0-1<=l['x']<x1 and y0-1<=l['y']<y1

def is_question(ll,ix):
 l=ll[ix];m=re.match(r'^(\d+)\.\s+(.+)',l['text'])
 if not m or l['size']!=9 or not (l['x']<65 or 310<l['x']<323):return None
 for n in ll[ix+1:ix+90]:
  if re.match(r'^A[.)]\s*',n['text']):return m
  if re.match(r'^(?:COMMENTS:|A\s*N\s*S\s*W\s*E\s*R|Ref\.?\s*:)',n['text']) or re.sub(r'\s+','',n['text'])=='REFERENCES':break
  if re.match(r'^\d+\.\s+',n['text']) and n['qstart']:break
 return None

def excerpt(s):
 # Four complete copied sentences; protected initialisms/abbreviations.
 protected=re.sub(r'\b(?:[A-Z]\.\s*)+(?=[a-z])',lambda m:m[0].replace('.','\uFFF0'),s)
 protected=re.sub(r'\b(?:Fig|Table|Dr|Mr|Mrs|et al|spp|vs|Ref)\.',lambda m:m[0].replace('.','\uFFF0'),protected)
 chunks=re.split(r'(?<=[.!?])\s+(?=[A-Z0-9“])',protected)
 return ' '.join(chunks[:4]).replace('\uFFF0','.')

def parse_pdf(pdf_path):
 doc=fitz.open(pdf_path);all_lines=[page_lines(pg) for pg in doc]
 words=set(re.findall(r'[A-Za-z]+',' '.join(pg.get_text() for pg in doc).lower()))
 res=resources(doc,all_lines)
 # Prose extraction excludes cropped diagram/table regions and figure captions.
 lines=[]
 for pg,ll in enumerate(all_lines,1):
  rr=[r for r in res if r['page']==pg]
  lines.append([l for l in ll if not any(inside(l,r['cut']) or l in r['caption'] for r in rr)])
 chapter_specs=[(int(re.match(r'(\d+)',t)[1]),clean(re.sub(r'^\d+\s*-\s*','',t)),pg) for lv,t,pg in doc.get_toc() if lv==2 and re.match(r'\d+',t)]
 raw=[]
 for ch,title,pg in chapter_specs:
  end=next((p-1 for c,t,p in chapter_specs if c==ch+1),len(doc));ll=[l for i in range(pg-1,end) for l in lines[i]]
  current=None;sub=0;previous=0
  for ix,l in enumerate(ll):
   if re.sub(r'\s+','',l['text'])=='REFERENCES':
    if current:raw.append(current);current=None
    continue
   m=is_question(ll,ix)
   if m:
    if current:raw.append(current)
    n=int(m[1]);sub+=int(n==1)
    current=dict(ch=ch,sub=sub,number=n,title=title,lines=[dict(l,text=m[2])]);previous=n
   elif current:current['lines'].append(l)
  if current:raw.append(current)
 # Shared trauma answer line supplies three explicit answers for Q10-Q12.
 for i,r in enumerate(raw):
  ai=next((j for j,l in enumerate(r['lines']) if ANSWER.match(l['text'])),None)
  if ai is not None:
   r['answer_lines']=[r['lines'][ai]]
   for l in r['lines'][ai+1:]:
    if COMMENTS.match(l['text']):break
    r['answer_lines'].append(l)
   r['answer_text']=join_text(r['answer_lines'],words);r['answer_index']=ai
  else:r['answer_text']=''
 for i,r in enumerate(raw):
  if r['ch']==11 and r['number']==12:
   vals=ANSWER.match(r['answer_text'])[1].replace(' ','').split(',')
   if vals!=['C','E','B']:raise ValueError('Shared trauma key changed')
   for j,a in zip([i-2,i-1,i],vals):
    raw[j]['answer_text']=r['answer_text'];raw[j]['shared_answer']=a;raw[j]['shared_explanation']=r;raw[j]['answer_lines']=r['answer_lines']
 for i,r in enumerate(raw):
  for l in r['lines']:
   m=re.match(r'^COMMENTS?[^:]*?QUESTIONS?\s*([\d, –-]+)',l['text'],re.I)
   if m:
    nums=[int(n) for n in re.findall(r'\d+',m[1])]
    wanted=set(range(min(nums),max(nums)+1)) if re.search('[–-]',m[1]) else set(nums)
    for rr in raw:
     if rr['ch']==r['ch'] and rr['sub']==r['sub'] and rr['number'] in wanted:rr['shared_explanation']=r
 questions=[];skipped=[];assets={};evidence=[];source_map=[]
 for r in raw:
  ll=r['lines'];ai=r.get('answer_index',len(ll));body=ll[:ai]
  exp_owner=r.get('shared_explanation',r)
  exp_lines=[];started=False
  for l in exp_owner['lines'][exp_owner.get('answer_index',len(ll))+1:]:
   if COMMENTS.match(l['text']):started=True;l=dict(l,text=COMMENTS.match(l['text'])[1])
   if started:
    if re.match(r'^Ref\.?\s*:',l['text']):break
    exp_lines.append(l)
  full_exp=join_text(exp_lines,words)
  stem_lines=[];opts=[];option_lines=[];answer=r.get('shared_answer')
  if not answer:
   m=ANSWER.match(r.get('answer_text',''));answer=m[1].strip() if m else ''
  # Explicit parallel matching lists are independently read by x coordinates.
  matching=bool(re.search(r'[A-E]\s*[-–]\s*(?:[a-e]|I)',answer))
  rows=[]
  if matching:
   for l in body:
    m=OPTION.match(l['text'])
    if m:option_lines.append(l)
   first=option_lines[0];split=min(l['x'] for l in body if (re.match(r'^[a-e]\.\s',l['text']) or re.match(r'^[IVX]+:',l['text'])))
   left=[l for l in body if l['y']>=first['y']-2 and l['x']<split-1 and l['page']==first['page']]
   right=[l for l in body if l['x']>=split-1 and l['page']==first['page'] and l['y']>=first['y']-2]
   stem_lines=[l for l in body if l['page']<first['page'] or (l['page']==first['page'] and l['y']<first['y']-2)]
   def split_list(ll,pattern):
    out=[];labels=[]
    for l in ll:
     m=re.match(pattern,l['text'])
     if m:labels.append(m[1]);out.append([dict(l,text=m[2])])
     elif out:out[-1].append(l)
    return labels,[join_text(x,words) for x in out]
   la,items=split_list(left,r'^([A-E])\.\s*(.*)')
   lb,opts=split_list(right,r'^([a-e]|[IVX]+)[.:]\s*(.*)')
   compact=re.sub(r'\s+','',answer)
   pairs=dict(re.findall(r'([A-E])-((?:[a-e]|[IVX]+)(?:,(?:[a-e]|[IVX]+))*)',compact))
   if len(items)!=5 or len(opts)!=5 or set(pairs)!=set(la):raise ValueError(f'Matching layout unresolved {r["ch"]}:{r["number"]}')
   for label,item in zip(la,items):
    aa=[chr(65+lb.index(v)) for v in pairs[label].split(',')]
    rows.append((item,opts,aa[0] if len(aa)==1 else aa,'emq' if len(aa)==1 else 'multi',label))
  else:
   for l in body:
    m=OPTION.match(l['text'])
    if m and (not opts or ord(m[1])-65==len(opts)):
     opts.append([dict(l,text=m[2])]);option_lines.append(l)
    elif opts:opts[-1].append(l)
    else:stem_lines.append(l)
   if option_lines and OPTION.match(option_lines[0]['text'])[2]=='':
    # Two printed option matrices: keep column headers with every row.
    first=option_lines[0];head=[l for l in stem_lines if l['page']==first['page'] and l['col']==first['col'] and l['y']<first['y'] and l['x']>first['x']+5]
    if not head:raise ValueError('Option matrix lacks header cells')
    anchors=sorted(set(round(l['x'],0) for l in head))
    header=[join_text([l for l in head if abs(l['x']-x)<2],words) for x in anchors]
    stem_lines=[l for l in stem_lines if l not in head]
    matrix_opts=[]
    for oo in opts:
     cells=[join_text([l for l in oo if l['text'] and abs(l['x']-x)<2],words) for x in anchors]
     matrix_opts.append('| '+' | '.join(header)+' |\n| '+' | '.join('---' for _ in header)+' |\n| '+' | '.join(cells)+' |')
    opts=matrix_opts
   else:opts=[join_text(o,words) for o in opts]
   rows=[(join_text(stem_lines,words),opts,answer,'sba','')]
  lead=join_text(stem_lines,words) if matching else ''
  alltext=join_text(body,words)
  for stem,opts,ans,typ,itemlabel in rows:
   lid=len(questions)+len(skipped)+1
   q=dict(local_id=lid,chapter_id=r['ch'],topic=('Subsection '+chr(64+r['sub'])) if sum(1 for rr in raw if rr['ch']==r['ch'] and rr['number']==1)>1 else '',type=typ,source_number=str(r['number']),source_item=itemlabel,lead_in=lead,stem=(lead+'\n\n'+stem) if matching and len(stem)<10 else stem,options=opts,answer=ans,answer_source='inline_marked',explanation=excerpt(full_exp),images=[],explanation_images=[],group_id=f'C{r["ch"]}-S{r["sub"]}-Q{r["number"]}' if matching else '',no_shuffle=matching or bool(re.search(r'\b(all|none) of (the )?(above|following)|\b(both|only)\s+[A-E]\b|\b[A-E] and [A-E]\b', ' '.join(opts),re.I)),source_page=body[0]['page'],source_pages=sorted(set(l['page'] for l in body)),answer_pages=sorted(set(l['page'] for l in r.get('answer_lines',[]))),flag='',source_label='Rush University Medical Center Review of Surgery || 6th edition')
   if typ=='sba' and not re.fullmatch('[A-H]',str(ans)):raise ValueError(f'Unresolved answer {r["ch"]}:{r["number"]}: {ans}')
   if not 3<=len(opts)<=8:raise ValueError(f'Unresolved options {r["ch"]}:{r["number"]}: {len(opts)}')
   # Figure associations require numbered source citations. Tables are included
   # when cited or when the table physically belongs to this question block.
   for rs in res:
    ref_re=re.compile(r'\b(?:Figs?\.?|Figures?|Tables?)\s*(?:\d+[A-Z]?(?:-[A-Z])?\.\d+(?:\s*(?:,|and|to|[–-])\s*))*'+re.escape(rs['key'])+r'\b',re.I)
    instem=bool(ref_re.search(alltext));inexp=bool(ref_re.search(full_exp))
    if not instem and not inexp:continue
    field='images' if instem else 'explanation_images';ix=len(q[field])+1
    name=f'L{lid:04d}_{"e" if field=="explanation_images" else ""}{ix}.webp'
    q[field].append(name)
    # Ensure retained explanation still includes figure/table reference.
    if inexp and not ref_re.search(q['explanation']):
     sentence=next((s for s in re.split(r'(?<=[.!?])\s+(?=[A-Z])',full_exp) if ref_re.search(s)),full_exp)
     q['explanation']+='\n\n'+sentence
    if rs['page'] not in q['source_pages'] and instem:q['source_pages'].append(rs['page']);q['source_pages'].sort()
    if name not in assets:
     rect=fitz.Rect(rs['rect']);pix=doc[rs['page']-1].get_pixmap(matrix=fitz.Matrix(min(2.4,1200/rect.width),min(2.4,1200/rect.width)),clip=rect,alpha=False)
     im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
     if im.width>1200:im=im.resize((1200,round(im.height*1200/im.width)))
     buf=io.BytesIO();im.save(buf,'WEBP',quality=80,method=6);assets[name]=buf.getvalue()
    evidence.append(dict(local_id=lid,field=field,file=name,kind=rs['kind'],key=rs['key'],page=rs['page'],rect=rs['rect']))
   questions.append(q);source_map.append(dict(local_id=lid,chapter=r['ch'],subsection=r['sub'],source_number=r['number'],item=itemlabel,page=q['source_page'],answer=ans,answer_evidence=r.get('answer_text',''),full_explanation=full_exp))
 return dict(questions=questions,chapters=[dict(id=c,title=t.title()) for c,t,pg in chapter_specs],skipped=skipped,notes=[f'Source: {len(raw)} numbered question blocks in 35 chapters; matching blocks expanded into individual items.', 'Inline source answers only. Four copied explanation sentences plus relevant figure/table citation sentences.'],images=assets,source_map=source_map,image_map=evidence,source_block_count=len(raw),resources=res)

if __name__=='__main__':
 import sys
 data=parse_pdf(Path(sys.argv[1]));out=Path(sys.argv[2] if len(sys.argv)>2 else 'work/parsed');out.mkdir(parents=True,exist_ok=True)
 for k in ['questions','source_map','image_map','resources']:(out/(k+'.json')).write_text(json.dumps(data[k],ensure_ascii=False,indent=2))
 (out/'images').mkdir(exist_ok=True)
 for name,b in data['images'].items():(out/'images'/name).write_bytes(b)
 print('Questions',len(data['questions']),'source blocks',data['source_block_count'],'assets',len(data['images']))
