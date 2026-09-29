#!/usr/bin/env python3
"""Deterministic Oxford SBA layout parser, task-local, not shared tooling.

Source is fingerprint-locked. Seven numbered question chapters have end-of-
chapter numbered answer sections. Curriculum labels immediately before each
question are topics, not independently numbered subchapters. Reader annotations
are never answer evidence. Only printed page text is read. Raw spans/coordinates
are retained in evidence. No correction of medicine, grammar or book typos.
"""
from __future__ import annotations
import argparse, collections, hashlib, json, re, unicodedata
from pathlib import Path
import fitz

HERE=Path(__file__).resolve().parent
SOURCE_HASH='00da079467ce8d8aecdb5dc65cab6b0d0b884bff17c9b6a00b03c69604de0ad6'
BOUNDS=[(20,36,50),(50,67,80),(80,97,112),(112,129,144),(144,160,176),(176,194,210),(210,229,246)]
LIGATURES={'\ufb00':'ff','\ufb01':'fi','\ufb02':'fl','\ufb03':'ffi','\ufb04':'ffl','\ufb05':'st','\ufb06':'st'}
SUPER=str.maketrans('0123456789+-=()', '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u207a\u207b\u207c\u207d\u207e')
SUB=str.maketrans('0123456789+-=()', '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089\u208a\u208b\u208c\u208d\u208e')
QSTART=re.compile(r'^(\d{1,2})\.(?=\s|$)\s*(.*)')
ASTART=re.compile(r'^(\d{1,2})\.\s*Answer:\s*([A-Z])\b(.*)')
OPT=re.compile(r'^([A-Z])[.)]\s*(.*)')
ORDER=re.compile(r'\b(all|none|both|neither) of the (above|following)\b|\b(a|b|c|d) (and|&) (b|c|d|e)\b|\bonly [a-e]\b',re.I)


def plain(s):
    for a,b in LIGATURES.items(): s=s.replace(a,b)
    return s


def compact(s):
    # Compare exact character sequences ignoring typesetting whitespace and
    # Unicode positioning of numerals. Letters/case/punctuation remain intact.
    return re.sub(r'\s+','',unicodedata.normalize('NFKC',plain(s)))


def get_lines(doc):
    pages=[]; changes=[]
    for page in doc:
        lines=[]
        for b in page.get_text('rawdict')['blocks']:
            for l in b.get('lines',[]):
                spans=l['spans']; main=max((s['size'] for s in spans),default=0)
                main_origins=[s['origin'][1] for s in spans if s['size']>=main*.9]
                base=max(main_origins,default=0); parts=[]; small=[]
                for s in spans:
                    chars=s['chars']; value=''; previous=None
                    for i,c in enumerate(chars):
                        if c['c']==' ' and previous and c['origin'][0]<previous['origin'][0]-.05:
                            changes.append({'page':page.number+1,'kind':'overlapping_ligature_space','bbox':c['bbox'],'context':''.join(v['c'] for v in chars[max(0,i-12):i+12])})
                            continue
                        value+=c['c']; previous=c
                    value=plain(value)
                    if s['size']<main*.85 and re.fullmatch(r'[\d+\-=() ]+',value or 'x'):
                        delta=s['origin'][1]-base
                        if abs(delta)>0.5:
                            converted=value.translate(SUB if delta>0 else SUPER)
                            small.append({'raw':value,'mapped':converted,'bbox':s['bbox'],'origin_delta':delta})
                            value=converted
                    parts.append(value)
                text=''.join(parts).strip()
                if text: lines.append({'text':text,'raw':''.join(c['c'] for s in spans for c in s['chars']).strip(),'bbox':l['bbox'],'page':page.number+1,'font':spans[0]['font'],'size':main,'positioned':small})
        # The PDF content stream can paint banner/header labels last. Coordinates
        # are authoritative for reading order on these single-column pages.
        lines.sort(key=lambda x:(round(x['bbox'][1],1),x['bbox'][0]))
        pages.append(lines)
    return pages,changes


def body(lines,chapter_start=False):
    result=[]
    for l in lines:
        s=l['text']
        if l['bbox'][1]<(150 if chapter_start else 60): continue
        if re.fullmatch(r'(?:\d+\s*)?(?:QUESTIONS|ANSWERS)(?:\s*\d+)?',s):continue
        if s in ('chapter','QUESTIONS','ANSWERS') or (re.fullmatch(r'\d+',s) and l['bbox'][1]<60): continue
        if re.search(r'Thrumurthy_.*\.indd',s):continue
        if s=='This page intentionally left blank':continue
        result.append(l)
    return result


def join_lines(lines):
    result=''
    for l in lines:
        text=l['text'] if isinstance(l,dict) else l
        if not result: result=text;continue
        if result.endswith(('-', '/', '\u2013', '\u2014')):
            result+=text.lstrip()
        else: result+=' '+text.strip()
    return re.sub(r'[ \t]+',' ',result).strip()


def parse_sections(pages):
    questions=[]; answers=[]; reconciliation=[]
    for ch,(qfirst,afirst,nextfirst) in enumerate(BOUNDS,1):
        # Numbered bold stems are preceded by repeated curriculum topic labels.
        qlines=[l for p in range(qfirst,afirst) for l in body(pages[p-1],p==qfirst)]
        chunks=[]; current=None; pending_topic=[]
        for l in qlines:
            text=l['text']; match=QSTART.match(text)
            if match and 'Bold' in l['font']:
                if current: chunks.append(current)
                current={'number':match.group(1),'source_page':l['page'],'topic':join_lines(pending_topic),'stem':[dict(l,text=match.group(2))],'options':[],'all_lines':[l]}
                pending_topic=[]
            elif current is not None and OPT.match(text) and 'Bold' not in l['font']:
                m=OPT.match(text);current['options'].append({'letter':m.group(1),'lines':[dict(l,text=m.group(2))]});current['all_lines'].append(l)
            elif 'Bold' in l['font'] and (current is None or len(current['options'])>=3):
                pending_topic.append(l)
            elif current is None:
                pending_topic.append(l)
            else:
                if current['options']: current['options'][-1]['lines'].append(l)
                else: current['stem'].append(l)
                current['all_lines'].append(l)
        if current:chunks.append(current)
        alines=[l for p in range(afirst,nextfirst) for l in body(pages[p-1],p==afirst)]
        achunks=[]; current=None
        for l in alines:
            match=ASTART.match(l['text'])
            if match:
                if current:achunks.append(current)
                current={'number':match.group(1),'answer':match.group(2),'page':l['page'],'key_line':l,'lines':[]}
                if match.group(3).strip():current['lines'].append(dict(l,text=match.group(3).strip()))
            elif current is not None:current['lines'].append(l)
        if current:achunks.append(current)
        numbers=[int(q['number']) for q in chunks]; anumbers=[int(a['number']) for a in achunks]
        reconciliation.append({'chapter_id':ch,'chapter_title':f'Chapter {ch}','question_pdf_pages':[qfirst,afirst-1],'answer_pdf_pages':[afirst,nextfirst-1],'question_numbers':numbers,'answer_numbers':anumbers,'source_count':len(numbers),'extracted_count':len(chunks),'answer_count':len(achunks),'missing_questions':[n for n in range(1,51) if n not in numbers],'duplicate_questions':[n for n,v in collections.Counter(numbers).items() if v>1],'numbering_order_correct':numbers==list(range(1,51)) and anumbers==list(range(1,51))})
        for raw in chunks:
            n=raw['number']; matches=[a for a in achunks if a['number']==n]
            assert len(matches)==1,(ch,n,'ambiguous or missing key'); a=matches[0]
            assert 3<=len(raw['options'])<=8,(ch,n,'bad option boundaries',[v['letter'] for v in raw['options']])
            opts=[join_lines(v['lines']) for v in raw['options']]
            question={'local_id':len(questions)+1,'chapter_id':ch,'topic':raw['topic'],'type':'sba','source_number':n,'lead_in':'','stem':join_lines(raw['stem']),'options':opts,'answer':a['answer'],'answer_source':'book_key','explanation':'','images':[],'explanation_images':[],'group_id':'','no_shuffle':True,'source_page':raw['source_page'],'flag':'','source_label':'SBA MCQs for the MRCS Part A || Edition not stated','explanation_source_page':a['page'],'explanation_source_number':a['number'],'source_pages':sorted({l['page'] for l in raw['all_lines']})}
            question['source_option_labels']=[v['letter'] for v in raw['options']]
            if question['source_option_labels']!=list('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[:len(opts)]):
                question['flag']='Source prints option labels '+', '.join(question['source_option_labels'])+'; original labels retained in source_option_labels. Option text/order and book key unchanged.'
            questions.append(question)
            answers.append({'local_id':question['local_id'],'chapter_id':ch,'source_number':n,'key':a,'question':raw,'full_explanation':join_lines(a['lines'])})
    assert all(r['numbering_order_correct'] for r in reconciliation),reconciliation
    return questions,answers,reconciliation


def parse_pdf(pdf_path: Path)->dict:
    raw=Path(pdf_path).read_bytes();assert hashlib.sha256(raw).hexdigest()==SOURCE_HASH and len(raw)==2736487,'Source fingerprint mismatch'
    doc=fitz.open(pdf_path);assert len(doc)==256
    pages,changes=get_lines(doc)
    qs,answers,counts=parse_sections(pages)
    return {'questions':qs,'chapters':[{'id':i,'title':f'Chapter {i}'} for i in range(1,8)],'skipped':[],'notes':['Only printed answer sections used; reader annotations excluded. Edition not stated on source.'],'evidence':{'answers':answers,'reconciliation':counts,'geometric_text_resolutions':changes,'lines':pages}}


def main():
    ap=argparse.ArgumentParser();ap.add_argument('pdf',type=Path);a=ap.parse_args()
    fitz.TOOLS.mupdf_display_errors(False);fitz.TOOLS.mupdf_display_warnings(False)
    result=parse_pdf(a.pdf);(HERE/'work').mkdir(exist_ok=True)
    (HERE/'work/parsed-initial.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    (HERE/'work/questions-initial.jsonl').write_text(''.join(json.dumps(q,ensure_ascii=False)+'\n' for q in result['questions']))
    print('questions',len(result['questions']));print('chapter counts',[(r['chapter_id'],r['source_count'],r['answer_count']) for r in result['evidence']['reconciliation']]);print('position corrections',len(result['evidence']['geometric_text_resolutions']))

if __name__=='__main__':main()
