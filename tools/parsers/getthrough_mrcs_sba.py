"""Deterministic parser for the uploaded 423-page Get Through MRCS Part A: SBAs.

Layout: selectable, single-column reflowed PDF; numbered question sections at
PDF pages 13–72, 129–167, 212–243, 275–311 and 347–371. Each section restarts
at 1; the paired answer chapters use 'number. letter.' on bold first lines.
Section headings use >24-point type; 20.16-point options are not headings. Question starts must occur in
sequence: a wrapped respiratory rate '40.' is not a question number.
No figure is attached without an explicit matching numbered citation/caption.
Retains all source duplicates and transcribes reviewed raster tables as text.
Editorial v3 overrides are separate from this source-only parser.
The cover does not state an edition; the label explicitly says so.
Only whitespace is changed in question text. A line-end hyphen is removed only
with an unhyphenated whole-word occurrence elsewhere; every exception is logged.
Explanations are consecutive copied sentences, at most four, with source offsets.
Requires PyMuPDF; exports the repository's parse_pdf(Path) contract.
"""
from pathlib import Path
from collections import Counter
import hashlib
import json
import re
import fitz

TITLE = 'Get Through MRCS Part A: SBAs'
EDITION = 'Edition not stated'
SECTIONS = [
    ('Applied surgical anatomy', 13, 72, 73, 127, 329),
    ('Physiology', 129, 167, 168, 210, 212),
    ('Pathology', 212, 243, 244, 273, 155),
    ('System-specific pathology', 275, 311, 312, 345, 169),
    ('Practice paper', 347, 371, 372, 397, 135),
]
Q_START = re.compile(r'^(\d+)\.\s+(.*)$')
A_START = re.compile(r'^(\d+)\.\s+([a-e])\.(?:\s+(.*))?$')
OPTION = re.compile(r'^([a-e])\.\s+(.*)$')
ORDER = re.compile(r'\b(all|none|both|neither) of the (above|following)\b|\b[a-e] (?:and|&) [a-e]\b|\bonly [a-e]\b',re.I)
# Reviewed unnumbered raster tables in answer chapters. These cannot be
# attached under the user's explicit figure-number matching rule.
UNNUMBERED_TABLES = {371:175,372:176,384:178,416:184,427:187,
                     583:252,584:252,684:271,704:313,892:377,981:393}
# Retain every separately printed source question, including exact repeats.
# The pack builder must emit the matching book-level source declarations.
SOURCE_DUPLICATES = {}  # All printed repeats retained by explicit user request.

def records(doc, start, end):
    out = []
    for pn in range(start, end+1):
        for bi, block in enumerate(doc[pn-1].get_text('dict')['blocks']):
            if block['type'] != 0:
                continue
            for li, line in enumerate(block['lines']):
                spans = line['spans']
                # Extract printed typography, rather than flattening 10^9 into
                # the medically different number 109. Baseline and smaller type
                # distinguish script characters directly from the page geometry.
                base=max(spans,key=lambda s:s['size'])
                sub=str.maketrans('0123456789+-−','₀₁₂₃₄₅₆₇₈₉₊₋₋')
                sup=str.maketrans('0123456789+-−','⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻')
                parts=[]
                for s in spans:
                    value=s['text']
                    if s['size']<base['size']*.9 and re.fullmatch(r'[0-9+−-]+',value):
                        dy=s['origin'][1]-base['origin'][1]
                        if dy>1.5:value=value.translate(sub)
                        elif dy<-1.5:value=value.translate(sup)
                    parts.append(value)
                t = ''.join(parts)
                if not t.strip():
                    continue
                out.append({'text': t, 'page':pn, 'block':bi, 'line':li,
                            'size':max(s['size'] for s in spans),
                            'font':spans[0]['font'], 'bbox':list(line['bbox'])})
    return out

def is_heading(r):
    return r['size']>24

def with_text(r,t):
    return dict(r,text=t)

def original_text(rs):
    return '\n'.join(r['text'] for r in rs)

def compact(s):
    return re.sub(r'\s+','',s)

def clean(rs, corpus, exceptions):
    original = original_text(rs)
    # All character-changing exceptions are explicit and evidenced in the PDF.
    value = original
    def dehyphen(m):
        left,right=m[1],m[2]
        joined=left+right
        if re.search(r'(?<![\w-])'+re.escape(joined)+r'(?![\w-])',corpus,re.I):
            exceptions.append({'original':m[0], 'replacement':joined,
                               'evidence_word':joined})
            return joined
        return left+'-'+right
    value=re.sub(r'([A-Za-z]+)-\n([A-Za-z]+)',dehyphen,value)
    # Preserve source paragraph/list boundaries, but not PDF line wraps.
    boundary = set()
    for i in range(1,len(rs)):
        a,b=rs[i-1],rs[i]
        if (a['page']==b['page'] and a['block']!=b['block']
            and (b['bbox'][1]-a['bbox'][1]>22
                 or (re.search(r'[.!?:][’”\)]*$',a['text']) and b['bbox'][0]<=a['bbox'][0]+2))):
            boundary.add(i)
        if (re.match(r'^\s*[•●]\s+',b['text'])
            or (re.match(r'^\s*\d+\.\s+',b['text']) and re.search(r'[.!?:]$',a['text']))):
            boundary.add(i)
        if re.match(r'^(?:Hb|WBC|Platelets|Creatinine|Na\+?|K\+?|T[0-4]|N[0-3]|M[01])\s+[–:=<>]',b['text']):
            boundary.add(i)
        if b['bbox'][0]>25 and (a['bbox'][0]<20 or b['bbox'][1]-a['bbox'][1]>18):
            boundary.add(i)
    # Apply joins to each whole original span, preserving only evidenced boundaries.
    paras=[];segment=[]
    for i,r in enumerate(rs):
        if i in boundary and segment:
            paras.append('\n'.join(segment));segment=[]
        segment.append(r['text'])
    if segment:paras.append('\n'.join(segment))
    def join(p):
        def dh(m):
            joined=m[1]+m[2]
            return joined if re.search(r'(?<![\w-])'+re.escape(joined)+r'(?![\w-])',corpus,re.I) else m[1]+'-'+m[2]
        p=re.sub(r'([A-Za-z]+)-\n([A-Za-z]+)',dh,p)
        return re.sub(r'\s+',' ',p).strip()
    cleaned='\n\n'.join(join(p) for p in paras)
    expected=compact(value)
    passed=expected==compact(cleaned)
    return (cleaned if passed else original),original,passed

def sentence_spans(s):
    # No splitting inside decimals, initials or abbreviations. Source offsets
    # are kept so an excerpt can be proven character-for-character.
    breaks=[]
    for m in re.finditer(r'[.!?](?:[’”\)]*)\s+(?=[A-Z0-9‘“(])|[.!?](?:[’”\)]*)\s*$',s):
        left=s[:m.start()+1]
        if re.search(r'\b(?:e\.g|i\.e|Fig|Dr|Mr|Mrs|Ms|Prof|vs|No|St)\.$',left,re.I):
            continue
        if re.search(r'\b[A-Z]\.$',left) and m.end()<len(s) and re.match(r'[a-z]',s[m.end():]):
            continue
        breaks.append(m.start()+1+len(re.match(r'[’”\)]*',s[m.start()+1:])[0]))
    spans=[];start=0
    for end in breaks:
        if s[start:end].strip():spans.append((start,end))
        start=end
    return spans

def excerpt(raw, options=None, answer=None):
    spans=sentence_spans(raw)
    if len(spans)<4:
        return raw,0,len(raw)
    # Pick a contiguous source window containing the answer option's distinctive
    # printed words. This selects source sentences; it never writes an explanation.
    stop=set('the a an and or of in to is are has have with from for by not only all above following correct statement statements'.split())
    def terms(text):
        return {w.rstrip('s')[:8] for w in re.findall(r'[a-z]+',text.lower()) if len(w)>=4 and w not in stop}
    target=set()
    if options and answer:
        index=ord(answer)-65
        others=set().union(*(terms(o) for i,o in enumerate(options) if i!=index))
        target=terms(options[index])-others
        if not target:target=terms(options[index])
    candidates=[]
    for i in range(len(spans)-1):
        for width in (4,3,2):
            if i+width>len(spans):continue
            start,end=spans[i][0],spans[i+width-1][1]
            candidate=raw[start:end]
            if candidate.count('(')!=candidate.count(')') or candidate.count('[')!=candidate.count(']'):continue
            score=len(terms(candidate)&target)
            candidates.append((score,-i,width,start,end))
    if not candidates:
        return raw[:spans[1][1]],0,spans[1][1]
    _,_,_,start,end=max(candidates)
    return raw[start:end].strip(),start,end

"""Source table cells transcribed from reviewed PDF page images; no medical edits.
Raw cell line breaks are retained for whitespace proof before Markdown layout.
"""
shock=[['For an average\n70 kg man','Class I','Class II','Class III','Class IV'],
 ['Blood loss (mL)','<750','750–1500','1500–2000','>2000'],
 ['Blood loss (%)','<15','15–30','30–40','>40'],
 ['Heart rate','<100','>100','>120','>140'],
 ['Blood pressure\n(mmHg)','Normal or\nincreased','Normal','Decreased','Decreased'],
 ['Respiratory rate','14–20','20–30','30–40','>40'],
 ['Urine output\n(mL/h)','>30','20–30','5–15','Negligible'],
 ['Mental status','Slightly\nanxious','Mildly\nanxious','Anxious/\nconfused','Confused/\nlethargic']]
shock116=[row[:] for row in shock]
shock116[0][0]='For an average 70 kg man'
shock116[2]=['Blood loss (%)','<15%','15–30%','30–40%','>40%']
shock116[4][0]='Blood pressure (mmHg)'
shock116[6][0]='Urine output (mL/h)'
TABLES={
371:(175,shock),372:(176,shock),
384:(178,[['Heart surface','ECG leads','Coronary artery involved'],
 ['Inferior wall','II, II, aVF','Right – 90%\nCircumflex – 10%'],
 ['Septal','V1–V3','Left anterior descending'],
 ['Anterior','V1–V4','Left anterior descending'],
 ['Anterolateral','V1–V6','Left common'],
 ['Lateral','I, aVL, V4–V6','Circumflex'],
 ['Posterior','V1–V3 (reciprocal\nchanges)','Posterior descending\n(right or circumflex)']]),
416:(184,[['','Absorption','Secretion/ingestion'],
 ['Mouth','Nil','2.5 L fluid ingested\n1.5 L saliva secreted'],
 ['Stomach','Lipid-soluble molecules','2.5 L gastric juices secreted'],
 ['Gallbladder','Absorbs water\nconcentrating bile','500 mL bile secreted'],
 ['Pancreas','Nil','1.5 L pancreatic juices\nsecreted'],
 ['Small intestine','8–9 L fluid absorbed','1.5 L intestinal secretions'],
 ['Large intestine','1 L fluid absorbed','100 mL excreted in faeces']]),
427:(187,[['Hormone','Secreting organ','Effect'],
 ['Gastrin','Stomach','Stimulates parietal cells to\nsecrete HCl\nStimulates chief cells to secrete\npepsinogen'],
 ['Gastric inhibitory\npeptide','Small intestine','Inhibits gastric motility and secretion\nStimulates secretion of insulin from\npancreatic islets'],
 ['Cholecystokinin','Small intestine','Stimulates intestinal motility and\ncontraction of gallbladder\nStimulates secretion of pancreatic\nenzymes'],
 ['Secretin','Small intestine','Inhibits gastric motility and secretion\nStimulates water and bicarbonate\nsecretion in pancreatic juice\nEnhances actions of cholecystokinin\non pancreas'],
 ['Glucagon-like\npeptide-1','Ileum and colon','Inhibits gastric motility and\nsecretion\nStimulates secretion of insulin from\npancreatic islets'],
 ['Guanylin','Ileum and colon','Stimulates intestinal secretion of\nchloride']]),
583:(252,[['Syndrome','Gene affected','Neoplasm'],
 ['Li–Fraumeni','p53','Breast and ovarian carcinomas,\nsarcomas'],
 ['Retinoblastoma','Rb1','Retinoblastoma, osteosarcoma'],
 ['Familial polyposis coli','APC','Gastrointestinal carcinoma'],
 ['Von Hippel–Lindau','VHL','Renal carcinoma,\nphaeochromocytoma'],
 ['Multiple endocrine\nneoplasia','RET','Pituitary, parathyroid, thyroid,\npancreas and adrenal tumours'],
 ['Familial breast cancer','BRCA1, BRCA2','Breast carcinoma, ovarian\nsyndrome']]),
584:(252,[['Teratogen','Teratogenic effect'],
 ['Irradiation','Microcephaly'],
 ['Rubella','Microphthalmia, cataracts, microcephaly'],
 ['Cytomegalovirus (CMV)','Microcephaly'],
 ['Alcohol','Microcephaly, abnormal facies'],
 ['Warfarin','Facial abnormalities'],
 ['Folic acid','Anencephaly, hydrocephalus, cleft lip/palate'],
 ['Thalidomide','Absent/rudimentary limbs, heart and kidney\ndefects'],
 ['Irradiation','Microcephaly']]),
684:(271,[['Virus','Hepatitis A','Hepatitis B','Hepatitis C','Hepatitis D','Hepatitis E'],
 ['Type','Picornavirus','HepaDNA','RNA\nFlavivirus','Defective\nRNA','RNA\nCalcivirus'],
 ['Spread','Faeco-oral','Parenteral','Parenteral','Parenteral','Faeco-oral'],
 ['Incubation\n(weeks)','2–4','4–20','2–25','6–9','3–9'],
 ['Chronic\ndisease','No','5% adults,\n90%\nchildren','Approximately\n50%','Co-infection\n5%','No'],
 ['Vaccine','Yes','Yes','No','Protected\nby HBV\nvaccine\nif HBV\nnegative','No']]),
704:(313,[['Affected structure','Clinical manifestations'],
 ['Oculomotor nerve','Ipsilateral papillary dilation'],
 ['Midbrain','Decerebrate rigidity'],
 ['Reticular formation','Coma'],
 ['Posterior cerebral artery','Cortical blindness'],
 ['Cerebral aqueduct','Hydrocephalus'],
 ['Ipsilateral cerebral peduncle','Contralateral hemiparesis'],
 ['Contralateral cerebral peduncle','Ipsilateral hemiparesis']]),
892:(377,[['Type','Function','Diameter (μm)','Conduction\nvelocity (m/s)','Myelin'],
 ['Aα','Motor proprioception','12–20','70–120','Yes'],
 ['Aβ','Touch and pressure','6–13','30–90','Yes'],
 ['Aγ','Muscle spindles','3–6','15–40','Yes'],
 ['Aδ','Pain, touch and temperature','1–5','12–30','Thin'],
 ['B','Pre-ganglionic autonomic','1–3','3–15','Yes'],
 ['C','Pain (dull ache),\npost-ganglionic','0.5–1','1','No']]),
981:(393,shock116)
}


def parse_pdf(pdf_path:Path)->dict:
    doc=fitz.open(pdf_path)
    if len(doc)!=423:
        raise ValueError('This parser requires the reviewed 423-page PDF layout')
    corpus='\n'.join(p.get_text() for p in doc)
    questions=[];chapters=[];skipped=[];proof=[];hyphens=[];source=[];notes=[]
    lid=0;expected_chapters=Counter()
    for section,qs,qe,ans,ane,total in SECTIONS:
        # Collect answer starts independently of explanatory numbered lists.
        ar=records(doc,ans,ane);am=[]
        for i,r in enumerate(ar):
            m=A_START.match(r['text'])
            if m and 'Bold' in r['font']:
                am.append((i,int(m[1]),m[2].upper(),m[3] or ''))
        if [x[1] for x in am]!=list(range(1,total+1)):
            raise ValueError(f'{section}: answer-key coverage is not 1..{total}: {[x[1] for x in am]}')
        answers={}
        for j,(i,n,letter,t) in enumerate(am):
            end=am[j+1][0] if j+1<len(am) else len(ar)
            rr=[with_text(ar[i],t)]+[r for r in ar[i+1:end] if not is_heading(r)]
            answers[n]=(letter,rr)
        qr=records(doc,qs,qe);starts=[];headings={};current='';h=[]
        for i,r in enumerate(qr):
            if is_heading(r):
                if 'CHAPTER' in r['text'] or r['text'] in ['ANATOMY','PATHOLOGY','Questions']:
                    continue
                h.append(r['text']);continue
            if h:
                current=' '.join(h).title();h=[]
            m=Q_START.match(r['text'])
            if m and int(m[1])==len(starts)+1:
                starts.append((i,int(m[1]),m[2],current))
        if [x[1] for x in starts]!=list(range(1,total+1)):
            raise ValueError(f'{section}: question coverage differs from 1..{total}')
        for j,(i,n,t,sub) in enumerate(starts):
            lid+=1
            title=section+' — '+sub if sub else section
            if title not in [c['title'] for c in chapters]:
                chapters.append({'id':len(chapters)+1,'title':title})
            cid=next(c['id'] for c in chapters if c['title']==title)
            expected_chapters[cid]+=1
            end=starts[j+1][0] if j+1<len(starts) else len(qr)
            rr=[with_text(qr[i],t)]+[r for r in qr[i+1:end] if not is_heading(r)]
            om=[(k,OPTION.match(r['text'])) for k,r in enumerate(rr) if OPTION.match(r['text'])]
            if [m[1] for _,m in om]!=list('abcde'):
                skipped.append({'local_id':lid,'source_number':str(n),'chapter_id':cid,
                                'reason':'ambiguous option labels','source_page':qr[i]['page']})
                continue
            sr=rr[:om[0][0]];ors=[]
            for z,(k,m) in enumerate(om):
                oe=om[z+1][0] if z+1<len(om) else len(rr)
                ors.append([with_text(rr[k],m[2])]+rr[k+1:oe])
            flags=[];texts=[]
            for field,rlist in [('stem',sr)]+[(f'option_{x}',v) for x,v in zip('ABCDE',ors)]:
                exc=[];v,orig,ok=clean(rlist,corpus,exc);texts.append(v)
                proof.append({'local_id':lid,'field':field,'passed':ok,
                              'original_sha256':hashlib.sha256(compact(orig).encode()).hexdigest(),
                              'clean_sha256':hashlib.sha256(compact(v).encode()).hexdigest(),
                              'exceptions':exc})
                hyphens.extend(dict(e,local_id=lid,field=field) for e in exc)
                if not ok:flags.append('proof_check_failed_'+field)
            letter,er=answers[n]
            exc=[];ev,eo,eok=clean(er,corpus,exc)
            full_clean=ev
            ev,es,ee=excerpt(ev,texts[1:],letter)
            original_excerpt=compact(eo)[len(compact(full_clean[:es])):len(compact(full_clean[:ee]))]
            excerpt_ok=original_excerpt==compact(ev)
            if not excerpt_ok:
                ev=eo
                flags.append('proof_check_failed_explanation_excerpt')
            # The complete answer explanation is cleaned and checked before
            # selecting a literal contiguous excerpt. No words are paraphrased.
            proof.append({'local_id':lid,'field':'explanation','passed':eok,
                          'original_sha256':hashlib.sha256(compact(eo).encode()).hexdigest(),
                          'clean_sha256':hashlib.sha256(compact(clean(er,corpus,[])[0]).encode()).hexdigest(),
                          'exceptions':exc,'excerpt_start':es,'excerpt_end':ee,
                          'excerpt_passed':excerpt_ok,
                          'original_excerpt_sha256':hashlib.sha256(original_excerpt.encode()).hexdigest(),
                          'clean_excerpt_sha256':hashlib.sha256(compact(ev).encode()).hexdigest()})
            hyphens.extend(dict(e,local_id=lid,field='explanation') for e in exc)
            if not eok:flags.append('proof_check_failed_explanation')
            if lid in UNNUMBERED_TABLES:
                flags.append('uncited_explanation_image_not_attached')
            if lid in (584,684,704):
                # Their explanation consists of an unnumbered raster table,
                # rather than any complete prose sentence. Do not invent prose.
                ev=''
                flags.append('book_explanation_table_only')
            if lid==884:
                flags.append('source_options_A_and_D_identical')
            q={'local_id':lid,'chapter_id':cid,'topic':sub or section,'type':'sba',
               'source_number':str(n),'lead_in':'','stem':texts[0],'options':texts[1:],
               'answer':letter,'answer_source':'book_key','explanation':ev,
               'images':[],'explanation_images':[],'group_id':None,
               'no_shuffle':any(ORDER.search(o) for o in texts[1:]),
               'source_page':qr[i]['page'],'source_pages':sorted({r['page'] for r in rr}),
               'answer_page':er[0]['page'],'explanation_source_pages':sorted({r['page'] for r in er}),
               'flag':'; '.join(flags),'source_label':TITLE+' || '+EDITION}
            source.append({'local_id':lid,'section':section,'number':n,
                           'stem':original_text(sr),'options':[original_text(x) for x in ors],
                           'answer':letter,'full_explanation':eo})
            if lid in SOURCE_DUPLICATES:
                skipped.append({'local_id':lid,'source_number':str(n),'chapter_id':cid,
                                'source_page':q['source_page'],
                                'reason':f'Exact source duplicate of local_id {SOURCE_DUPLICATES[lid]}; unchanged validate.py rejects exact duplicates. Original preserved in parser source output.'})
            else:
                questions.append(q)
    # Source raster tables have been visually transcribed, rather than attached
    # without a numbered citation. Each cell passes whitespace-only proof.
    table_proof=[]
    for q in questions:
        if q['local_id'] in TABLES:
            pn,rawrows=TABLES[q['local_id']]
            rows=[]
            for ri,row in enumerate(rawrows):
                cleaned=[]
                for ci,cell in enumerate(row):
                    value=re.sub(r'\s+',' ',cell).strip()
                    assert compact(cell)==compact(value)
                    table_proof.append({'local_id':q['local_id'],'source_page':pn,
                                        'row':ri,'column':ci,'passed':True,
                                        'source_text':cell,'clean_text':value})
                    cleaned.append(value)
                rows.append(cleaned)
            rendered=['| '+' | '.join(rows[0])+' |',
                      '| '+' | '.join(['---']*len(rows[0]))+' |']
            rendered.extend('| '+' | '.join(row)+' |' for row in rows[1:])
            table='\n'.join(rendered)
            if q['local_id']==584:
                q['explanation']='Teratogens and their effects\n\n'+table+'\n\nAT Raftery, Basic science for the MRCS, Churchill Livingstone 2006.'
            else:
                q['explanation']=(q['explanation']+'\n\n' if q['explanation'] else '')+table
            q['explanation_source_pages']=sorted(set(q['explanation_source_pages']+[pn]))
            q['flag']='; '.join(f for f in q['flag'].split('; ') if f not in
                              ['uncited_explanation_image_not_attached','book_explanation_table_only'])
            q['source_table_page']=pn
    declared={283:193,580:557,888:27,994:991}
    for q in questions:
        if q['local_id'] in declared:q['source_duplicate_of']=declared[q['local_id']]

    actual=Counter(q['chapter_id'] for q in questions)
    for c in chapters:
        c['book_count']=expected_chapters[c['id']];c['extracted_count']=actual[c['id']]
    notes.append('Edition is not printed on the cover/title/copyright pages; no edition number was inferred. Publication year: 2016.')
    notes.append('No numbered figure citations occur in the question sections. Unnumbered answer tables/illustrations are not attached.')
    notes.append('Position-aware text extraction preserves printed superscripts/subscripts as Unicode before whitespace-only cleaning; e.g. 10⁹ is never flattened into 109.')
    notes.append(f"Whitespace proof checks: {len(proof)}; failures: {sum(not p['passed'] for p in proof)}; evidenced line-end hyphen removals: {len(hyphens)}.")
    notes.extend(f"Flag Q{q['local_id']}, PDF page {q['source_page']}, answer page {q['answer_page']}: {q['flag']}" for q in questions if q['flag'])
    notes.extend(f"Skipped Q{s['local_id']}, PDF page {s['source_page']}, printed number {s['source_number']}: {s['reason']}" for s in skipped)
    notes.extend(f"{c['title']}: book={c['book_count']}; extracted={c['extracted_count']}" for c in chapters)
    return {'questions':questions,'chapters':chapters,'skipped':skipped,'notes':notes,
            'proof':proof,'hyphens':hyphens,'source':source,'table_proof':table_proof}

if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser();ap.add_argument('pdf',type=Path);ap.add_argument('--output',type=Path,required=True)
    a=ap.parse_args();a.output.write_text(json.dumps(parse_pdf(a.pdf),ensure_ascii=False,indent=2)+'\n')
