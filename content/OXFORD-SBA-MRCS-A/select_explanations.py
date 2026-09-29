#!/usr/bin/env python3
"""Source-only, explicit sentence-window selection for Oxford explanations.

Every emitted word is copied through code from the measured source lines.
Selection windows are recorded and manually reviewed. Discretionary line-end
hyphen joins are logged separately from source spelling (none corrected).
"""
from pathlib import Path
import collections,hashlib,json,math,re,unicodedata
from nltk.tokenize.punkt import PunktParameters,PunktSentenceTokenizer
HERE=Path(__file__).resolve().parent
# Explicitly reviewed genuine/ambiguous source compounds: never dehyphenated.
KEEP={'blood-stained','broad-spectrum','cholecysto-choledochal','extra-adrenal',
 'first-degree','high-risk','intra-abdominal','left-sided','one-third','pre-existing',
 'rod-shaped','starch-iodine','three-and','and-a','two-thirds','ultrasound-guided',
 'anti-thrombin','delto-pectoral','hyper-calcaemia','micro-vasculature','para-colic',
 'para-mesonephric','sub-arachnoid','sub-mandibular','sub-scapular','vaso-constrictor',
 'vaso-pressor','infra-spinatus','inter-costal','out-flow'}
STOP=set('a an the of in on to for by with at is are was were be been being and or as from that this these those it its his her their most which following not all both other between than more less two three four five first second third either only also no one some such can may should would will has have had do does during under over into due very patient patients'.split())
PARAM=PunktParameters();PARAM.abbrev_types={'e.g','i.e','etc','fig','mr','dr','st','vs','al','approx'}
TOKENIZER=PunktSentenceTokenizer(PARAM)


def clean_source(entry):
    text='';origins=[];joins=[]
    for line in entry['lines']:
        value=line['text'].strip()
        if not value:continue
        if text:
            m=re.search(r'([A-Za-z]+)-$',text);n=re.match(r'([a-z]+)',value)
            if m and n and not line['bullet']:
                pair=(m[1]+'-'+n[1]).lower()
                if pair not in KEEP:
                    joins.append({'local_id':entry['local_id'],'pdf_page':origins[-1]['page'],
                       'printed_line_end':m[1]+'-','next_line_start':n[1],
                       'joined_word':m[1]+n[1],'kind':'discretionary_line_end_hyphen'})
                    text=text[:-1]
                    if origins:origins[-1]['end']-=1
                sep=''
            elif text.endswith(('/', '\u2013','\u2014')):sep=''
            elif line['bullet']:sep='\n\u2022 '
            elif re.match(r'^\d+\.\s',value):sep='\n'
            else:sep=' '
            text+=sep
        elif line['bullet']:text+='\u2022 '
        start=len(text);text+=value
        origins.append({'start':start,'end':len(text),'page':line['page'],'bbox':line['bbox'],'bullet':line['bullet']})
    return text,origins,joins


def words(s):return len(s.split())
def terms(s):
    s=unicodedata.normalize('NFKC',s).lower()
    return {w for w in re.findall(r'[a-z0-9]+',s) if len(w)>2 and w not in STOP}


def unit_spans(text):
    spans=[]
    # Numbered list markers are not sentence terminators. Keep lengths identical
    # so all recorded offsets still address the unmodified source string.
    masked=re.sub(r'(?m)(?<=\n)(\d+)\.(?=\s)',lambda m:m[0][:-1]+';',text)
    for begin,end in TOKENIZER.span_tokenize(masked):
        # The printed factor designation VIII:C. terminates a sentence here;
        # Punkt treats C. as a personal initial and otherwise merges two.
        cuts=[begin+m.end() for m in re.finditer(r'\b[A-Z]\.(?=\s+(?:It|Loss|Thrombin|Coagulation|The|Angiotensin|Serum)\b)|etc\.\)(?=\s+[A-Z])',text[begin:end])]
        cuts.extend(begin+m.start() for m in re.finditer(r'(?<!^)(?=This classification was published|Reproduced from|Reprinted from|Selective neck dissection:)',text[begin:end]))
        cuts=sorted(set(cuts))
        last=begin
        for cut in cuts:
            spans.append((last,cut));last=cut
            while last<end and text[last].isspace():last+=1
        spans.append((last,end))
    # Punkt can split at a reference decimal inside parentheses; merge until balanced.
    out=[]
    for start,end in spans:
        if out and text[out[-1][0]:out[-1][1]].count('(')>text[out[-1][0]:out[-1][1]].count(')'):
            out[-1]=(out[-1][0],end)
        else:out.append((start,end))
    return out


def start_penalty(s):
    return bool(re.match(r'^(?:This|These|Those|It|They|He|She|His|Her|Their|Such|However|Therefore|Hence|Consequently|In addition|In contrast|Similarly|Furthermore|Additionally|As above|In this|The latter|The former|Options?\b|Other\b)',s))


def main():
    parsed=json.loads((HERE/'work/parsed-initial.json').read_text())
    entries=json.loads((HERE/'work/explanations-prose.json').read_text())
    if (HERE/'explanation-selections.json').exists():
        overrides=json.loads((HERE/'explanation-selections.json').read_text())
    else:
        indices=json.loads((HERE/'explanation-selection-indices.json').read_text())
        assert len(indices)==350, 'Missing reviewed source selections'
        overrides={str(i+1):{'indices':v} for i,v in enumerate(indices)}
    rows=[];alljoins=[]
    frequencies=collections.Counter(w for e in entries for w in terms(e['source_prose']))
    for q,e in zip(parsed['questions'],entries):
        text,origins,joins=clean_source(e);alljoins.extend(joins)
        spans=unit_spans(text)
        units=[{'index':i,'start':s,'end':t,'text':text[s:t],
                'pages':sorted({o['page'] for o in origins if o['start']<t and o['end']>s}),
                'words':words(text[s:t])} for i,(s,t) in enumerate(spans)]
        key=q['options'][ord(q['answer'])-65]
        kt=terms(key);st=terms(q['stem'])
        candidates=[]
        for i in range(len(units)):
            for k in range(2,5):
                if i+k>len(units):continue
                start,end=units[i]['start'],units[i+k-1]['end'];s=text[start:end];wc=words(s)
                tt=terms(s)
                relevance=sum(math.log(352/(1+frequencies[t])) for t in kt&tt)
                relevance+=.10*sum(math.log(352/(1+frequencies[t])) for t in st&tt)
                if key.lower() in s.lower():relevance+=3
                distance=max(50-wc,0,wc-70)
                score=relevance*2-distance*.18-abs(wc-60)*.015
                score-=8 if start_penalty(s) else 0
                score-=3 if '\u2022' in s else 0
                score-=2 if re.search(r'(see\s+(?:Fig|Table)|as (?:above|mentioned))',s,re.I) else 0
                score-=i*.03
                candidates.append((score,i,k,wc))
        if candidates:
            best=max(candidates);i,k=best[1:3]
        else:i,k=0,len(units)
        selection=overrides.get(str(q['local_id']))
        indices=list(range(i,i+k))
        if selection:
            indices=selection.get('indices',list(range(selection.get('start',0),selection.get('start',0)+selection.get('count',1))))
        assert indices and indices==sorted(set(indices)) and min(indices)>=0 and max(indices)<len(units),(q['local_id'],indices,len(units))
        chosen=[units[j] for j in indices];i=indices[0];k=len(indices)
        # Only whole source units in source order. No within-sentence stitching.
        excerpt=' '.join(u['text'] for u in chosen)
        selection_kind='contiguous' if indices==list(range(i,i+k)) else 'whole_sentences_source_order'
        if selection_kind=='contiguous':excerpt=text[chosen[0]['start']:chosen[-1]['end']]
        rows.append({'local_id':q['local_id'],'chapter_id':q['chapter_id'],'source_number':q['source_number'],
           'key':q['answer'],'correct_option':key,'question_last_part':q['stem'][-280:],
           'source_text':text,'source_units':units,'selection':{'start':i,'count':k,'indices':indices,'kind':selection_kind},
           'excerpt':excerpt,'words':words(excerpt),'sentence_units':k,
           'excerpt_source_pages':sorted({p for u in chosen for p in u['pages']}),
           'book_key_pdf_page':e['answer_page'],'starts_context_dependent':start_penalty(excerpt),
           'contains_list':'\u2022' in excerpt,'source_text_sha256':hashlib.sha256(text.encode()).hexdigest(),
           'selection_note':(selection or {}).get('note','')})
    (HERE/'work/explanation-candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    (HERE/'evidence/explanation-linewrap-joins.json').write_text(json.dumps(alljoins,ensure_ascii=False,indent=2)+'\n')
    for start in range(0,350,25):
        lines=[]
        for r in rows[start:start+25]:
            lines.append(f"\nID {r['local_id']} Ch{r['chapter_id']} Q{r['source_number']} KEY {r['key']}: {r['correct_option']}\nQUESTION: {r['question_last_part']}\nSELECT {r['selection']} | {r['words']} words | pages {r['excerpt_source_pages']}\n{r['excerpt']}\n")
        (HERE/f"work/explanation-review-{start+1:03d}-{min(start+25,350):03d}.txt").write_text('\n'.join(lines))
    print('Selected',len(rows),'within 50-70:',sum(50<=r['words']<=70 for r in rows),
          'context first:',sum(r['starts_context_dependent'] for r in rows),
          'lists:',sum(r['contains_list'] for r in rows),
          'min/max',min(r['words'] for r in rows),max(r['words'] for r in rows),
          'linewrap joins',len(alljoins))

if __name__=='__main__':main()
