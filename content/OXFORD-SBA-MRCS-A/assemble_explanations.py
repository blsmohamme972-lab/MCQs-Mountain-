#!/usr/bin/env python3
"""Freeze reviewed source selections and preserve printed paragraph/list layout.

Only whitespace is inserted at measured paragraph boundaries. No sentence,
medical wording, answer, number, punctuation or spelling is written by this tool.
The output is independently tied to source spans, source pages and source hashes.
"""
from pathlib import Path
import collections, hashlib, json, re, statistics
from select_explanations import clean_source
HERE=Path(__file__).resolve().parent

def norm(s): return re.sub(r'\s+',' ',s).strip()

def main():
    rows=json.loads((HERE/'work/explanation-candidates.json').read_text())
    entries=json.loads((HERE/'work/explanations-prose.json').read_text())
    assert len(rows)==len(entries)==350
    selections={};proof=[];layout_changes=[]
    for row,entry in zip(rows,entries):
        text,origins,joins=clean_source(entry)
        assert row['local_id']==entry['local_id'] and text==row['source_text']
        breaks=[]
        for previous,current in zip(origins,origins[1:]):
            if current['bullet'] or current['bbox'][0]>=48: continue
            list_end=previous['bbox'][0]>=50
            para_gap=current['page']==previous['page'] and current['bbox'][1]-previous['bbox'][1]>13.1
            if list_end or para_gap:breaks.append(current['start'])
        chosen=[row['source_units'][i] for i in row['selection']['indices']]
        parts=[]
        for unit in chosen:
            start,end=unit['start'],unit['end'];part=text[start:end]
            for position in sorted([b for b in breaks if start<b<end],reverse=True):
                p=position-start
                assert p>0 and part[p-1].isspace(),(row['local_id'],p,part)
                part=part[:p].rstrip()+'\n\n'+part[p:]
            assert norm(part)==norm(unit['text'])
            if parts and part.lstrip().startswith('\u2022'):parts.append('\n'+part.lstrip())
            else:parts.append((' ' if parts else '')+part)
        excerpt=''.join(parts).strip()
        assert norm(excerpt)==norm(row['excerpt']),(row['local_id'],'text changed')
        assert len(excerpt.split())==row['words']
        if excerpt!=row['excerpt']:layout_changes.append(row['local_id'])
        lid=row['local_id']
        selections[str(lid)]={'indices':row['selection']['indices'],'source_text_sha256':row['source_text_sha256'],
          'note':'Reviewed against the printed-key topic. Complete source sentence/list units only, in original order; no within-sentence splicing.'}
        proof.append({'local_id':lid,'chapter_id':row['chapter_id'],'source_number':row['source_number'],
            'printed_answer_letter':row['key'],'printed_answer_page':row['book_key_pdf_page'],
            'explanation_source_number':row['source_number'],'explanation_source_pages':row['excerpt_source_pages'],
            'explanation':excerpt,'word_count':row['words'],'source_unit_count':len(chosen),
            'contains_source_list':row['contains_list'],'selection_kind':row['selection']['kind'],
            'source_text_sha256':row['source_text_sha256'],'excerpt_sha256':hashlib.sha256(excerpt.encode()).hexdigest(),
            'source_units':[{'index':u['index'],'start':u['start'],'end':u['end'],'pages':u['pages'],
                             'text_sha256':hashlib.sha256(u['text'].encode()).hexdigest()} for u in chosen],
            'source_substrings_verified':True,'presentation_changes':'Whitespace at measured paragraph/list boundaries only; all selected letters/numbers/punctuation identical.'})
    (HERE/'explanation-selections.json').write_text(json.dumps(selections,ensure_ascii=False,indent=2)+'\n')
    (HERE/'evidence/explanation-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
    stats={'count':len(proof),'empty':sum(not x['explanation'] for x in proof),
       'word_min':min(x['word_count'] for x in proof),'word_max':max(x['word_count'] for x in proof),
       'word_average':statistics.mean(x['word_count'] for x in proof),
       'within_50_70':sum(50<=x['word_count']<=70 for x in proof),
       'outside_50_70':[{'local_id':x['local_id'],'words':x['word_count']} for x in proof if not 50<=x['word_count']<=70],
       'contains_source_lists':[x['local_id'] for x in proof if x['contains_source_list']],
       'source_unit_count_not_2_to_4':[{'local_id':x['local_id'],'units':x['source_unit_count']} for x in proof if not 2<=x['source_unit_count']<=4],
       'note':'Source units are complete prose sentences or intact source list blocks, not a claim that every list entry is a complete sentence. Source layout/list and word-count exceptions are preserved instead of inventing explanations.',
       'selection_kind_counts':dict(collections.Counter(x['selection_kind'] for x in proof)),
       'all_source_substrings_verified':all(x['source_substrings_verified'] for x in proof),
       'paragraph_layout_preserved_ids':layout_changes,'source_spelling_changes':0}
    (HERE/'evidence/explanation-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in stats.items() if not isinstance(v,list)},indent=2))

if __name__=='__main__':main()
