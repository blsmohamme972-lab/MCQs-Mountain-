#!/usr/bin/env python3
"""Independent Poppler question/key parser, compared with coordinate-aware MuPDF."""
import collections,difflib,json,re
from pathlib import Path
from parse_oxford import BOUNDS, compact, join_lines
HERE=Path(__file__).resolve().parent
Q=re.compile(r'^(\d{1,2})\.(?=\s|$)\s*(.*)')
A=re.compile(r'^(\d{1,2})\.\s*Answer:\s*([A-Z])\b(.*)')
O=re.compile(r'^([A-Z])[.)]\s*(.*)')
TOPIC=re.compile(r'^(Basic sciences|Basic surgical skills|Common surgical conditions|Perioperative care|The assessment and management|Assessment and management of patients|Management of the dying patient|Organ and tissue transplantation|Professional behaviour and leadership)\b')


def body_text(record, mode, start=False):
    lines=[x.strip() for x in record[mode]['text'].splitlines() if x.strip() and x.strip() not in ('CLINICAL SKILLS | QUESTIONS','chapter')]
    printed=str(record['pdf_page']-19)
    lines=[s for i,s in enumerate(lines) if not (s==printed and (i<5 or i>=len(lines)-3))]
    if start:
        # Start-of-chapter chapter/number/banner is discarded up to first topic
        # for question pages, or first answer marker for answer pages.
        hit=next((i for i,x in enumerate(lines) if TOPIC.match(x) or A.match(x)),None)
        assert hit is not None,(record['pdf_page'],mode)
        lines=lines[hit:]
    else:
        while lines and re.fullmatch(r'(?:\d+\s*)?(?:QUESTIONS|ANSWERS)(?:\s*\d+)?|\d+',lines[0]):lines.pop(0)
    return [(record['pdf_page'],s) for s in lines if not re.fullmatch(r'(?:\d+\s*)?(?:QUESTIONS|ANSWERS)(?:\s*\d+)?',s) and s!='This page intentionally left blank']


def parse_poppler(data,mode='raw'):
    qs=[];answers=[];counts=[]
    for ch,(qfirst,afirst,nextfirst) in enumerate(BOUNDS,1):
        lines=[v for n in range(qfirst,afirst) for v in body_text(data[n-1],mode,n==qfirst)]
        rows=[];cur=None;topic=[];in_topic=False
        for page,text in lines:
            m=Q.match(text)
            if m:
                if cur:rows.append(cur)
                cur={'number':m[1],'page':page,'topic':join_lines(topic),'stem':[m[2]],'opts':[]};topic=[];in_topic=False
            elif TOPIC.match(text):
                topic.append(text);in_topic=True
            elif in_topic:topic.append(text)
            elif cur is not None and (m:=O.match(text)):
                cur['opts'].append({'label':m[1],'lines':[m[2]]})
            elif cur is not None:
                (cur['opts'][-1]['lines'] if cur['opts'] else cur['stem']).append(text)
        if cur:rows.append(cur)
        alines=[v for n in range(afirst,nextfirst) for v in body_text(data[n-1],mode,n==afirst)]
        aa=[];cur=None
        for page,text in alines:
            m=A.match(text)
            if m:
                if cur:aa.append(cur)
                cur={'number':m[1],'answer':m[2],'page':page,'lines':[]}
                if m[3].strip():cur['lines'].append(m[3].strip())
            elif cur is not None:cur['lines'].append(text)
        if cur:aa.append(cur)
        assert [int(x['number']) for x in rows]==list(range(1,51)),(ch,mode,[x['number'] for x in rows])
        assert [int(x['number']) for x in aa]==list(range(1,51)),(ch,mode,'answer numbering')
        for row in rows:
            key=[a for a in aa if a['number']==row['number']];assert len(key)==1
            assert 3<=len(row['opts'])<=8,(ch,row['number'],len(row['opts']))
            qs.append({'local_id':len(qs)+1,'chapter_id':ch,'source_number':row['number'],'source_page':row['page'],'topic':row['topic'],'stem':join_lines(row['stem']),'options':[join_lines(o['lines']) for o in row['opts']],'source_option_labels':[o['label'] for o in row['opts']],'answer':key[0]['answer'],'explanation_source_page':key[0]['page']})
            answers.append({'local_id':len(qs),'text':join_lines(key[0]['lines'])})
        counts.append({'chapter_id':ch,'questions':len(rows),'answers':len(aa)})
    return qs,answers,counts


def differences(a,b):
    aa=compact(a);bb=compact(b)
    out=[]
    for tag,i,j,k,l in difflib.SequenceMatcher(None,aa,bb,autojunk=False).get_opcodes():
        if tag!='equal':out.append({'op':tag,'pymupdf':aa[max(0,i-35):min(len(aa),j+35)],'poppler':bb[max(0,k-35):min(len(bb),l+35)],'pymupdf_difference':aa[i:j],'poppler_difference':bb[k:l]})
    return out


def main():
    parsed=json.loads((HERE/'work/parsed-initial.json').read_text()); raw=json.loads((HERE/'evidence/poppler-pages.json').read_text()); qs,ans,counts=parse_poppler(raw)
    result=[];explan=[]
    for m,p in zip(parsed['questions'],qs):
        details={}
        for field in ('stem','topic'):
            if compact(m[field])!=compact(p[field]):details[field]=differences(m[field],p[field])
        if len(m['options'])!=len(p['options']):details['option_count']={'pymupdf':len(m['options']),'poppler':len(p['options'])}
        for i,(a,b) in enumerate(zip(m['options'],p['options'])):
            if compact(a)!=compact(b):details[f'option_{chr(65+i)}']=differences(a,b)
        for field in ('answer','source_number','source_page','explanation_source_page','source_option_labels'):
            if m[field]!=p[field]:details[field]={'pymupdf':m[field],'poppler':p[field]}
        result.append({'local_id':m['local_id'],'chapter_id':m['chapter_id'],'source_number':m['source_number'],'source_page':m['source_page'],'equal':not details,'differences':details})
    for m,p in zip(parsed['evidence']['answers'],ans):
        dd=differences(m['full_explanation'],p['text']);explan.append({'local_id':m['local_id'],'equal':not dd,'differences':dd})
    payload={'initial_question_records_with_disagreements':sum(not r['equal'] for r in result),'initial_explanation_records_with_disagreements':sum(not r['equal'] for r in explan),'normalization':'Whitespace/Unicode numeral positioning/ligature expansion only. Case, numbers, punctuation and option order retained.','per_chapter':counts,'questions':result,'explanations':explan}
    (HERE/'evidence/dual-engine-initial.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    (HERE/'work/poppler-parsed.json').write_text(json.dumps({'questions':qs,'answers':ans},ensure_ascii=False,indent=2)+'\n')
    print('Initial question disagreements',payload['initial_question_records_with_disagreements']);print('Initial explanation disagreements',payload['initial_explanation_records_with_disagreements'])
    for row in result:
        if not row['equal']:print(json.dumps(row,ensure_ascii=False))

if __name__=='__main__':main()
