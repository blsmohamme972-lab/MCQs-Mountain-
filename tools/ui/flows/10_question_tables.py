"""Safe question tables and local horizontal scrolling at every phone width."""
from __future__ import annotations
import json

WIDTHS=(360,390,430)
TABLE='''Before the score table.
| Response | Score |
| --- | --- |
| Motor | |
| Obeys commands | 6 |
| <img src=x onerror="window.tableInjected=true"> | 1 |

After the score table.
'''
WIDE='| '+ ' | '.join(f'Column {i}' for i in range(8))+' |\n| '+ ' | '.join(['---']*8)+' |\n| '+ ' | '.join(['WideValueWithoutBreaks'*3]*8)+' |'
CONTENT=TABLE+WIDE

def inject(page,kind):
    page.evaluate("""({content,kind})=>{
      const q=QI['Q000001001'].q;
      Object.assign(q,{stem:content,options:[content,'Plain answer','Another answer'],explanation:content,
        type:kind,answer:kind==='mtf'?['T','F','T']:kind==='multi'?['A']:'A',no_shuffle:true});
      startSession({mode:'study',title:'Question table fixture',bookId:'DESIGN-CARDIO',chId:1,qids:[q.id]});
    }""",{'content':CONTENT,'kind':kind})
    page.wait_for_selector('.stem .k-question-table')

def assert_tables(page,label,answered=False):
    metrics=page.evaluate("""() => {
      const boxes=[...document.querySelectorAll('.k-table-box')];
      const wide=boxes.filter(el=>el.scrollWidth>el.clientWidth+1);
      const fixtures=boxes.filter(el=>el.querySelectorAll('thead th').length===8);
      const section=[...document.querySelectorAll('.k-table-section th')];
      return {viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,
        boxes:boxes.length,wide:wide.length,wideFixtures:fixtures.length,
        fixtureOverflow:fixtures.every(el=>el.scrollWidth>el.clientWidth+1),
        localScroll:wide.map(el=>{el.scrollLeft=100;return el.scrollLeft;}),
        bold:section.every(el=>Number(getComputedStyle(el).fontWeight)>=700),
        labels:section.map(el=>el.textContent),raw:boxes.some(el=>el.textContent.includes('| --- |')),
        injected:!!window.tableInjected,htmlElements:document.querySelectorAll('.k-question-table img,.k-question-table script').length,
        invalidParents:document.querySelectorAll('p .k-table-box').length,scrollX:window.scrollX};
    }""")
    assert metrics['document']<=metrics['viewport'] and metrics['body']<=metrics['viewport'],f'{label}: page overflow {metrics}'
    assert metrics['boxes']==(6 if answered else 4),f'{label}: missing table context {metrics}'
    assert metrics['wideFixtures']==(3 if answered else 2) and metrics['fixtureOverflow'],f'{label}: wide tables must scroll locally {metrics}'
    assert all(x>0 for x in metrics['localScroll']),f'{label}: cannot scroll tables {metrics}'
    assert metrics['bold'] and all(x=='Motor' for x in metrics['labels']),metrics
    assert not metrics['raw'] and not metrics['injected'] and not metrics['htmlElements'] and not metrics['invalidParents'],metrics
    page.evaluate('window.scrollTo(100,window.scrollY)')
    assert page.evaluate('window.scrollX')==0,f'{label}: document scrolled sideways'
    assert page.locator('.stem').inner_text().startswith('Before the score table.')
    assert '<img src=x onerror="window.tableInjected=true">' in page.locator('.stem').inner_text()
    return metrics

def run(browser,origin,pack,out,helpers):
    out.mkdir(parents=True,exist_ok=True)
    passed=[];metrics={}
    for width in WIDTHS:
        for theme in ('light','dark'):
            ctx=helpers['phone_context'](browser,origin,width,theme)
            page,errors=helpers['open_app'](ctx,origin,pack)
            for kind in ('sba','multi','emq','mtf'):
                label=f'{width}-{theme}-{kind}'
                inject(page,kind)
                metrics[label]=assert_tables(page,label)
                # Exercise the real answer controls, including a table-bearing choice.
                if kind=='mtf':
                    for index,value in enumerate(('T','F','T')):
                        page.locator(f'[data-a="tf"][data-i="{index}"][data-v="{value}"]').click()
                else:
                    page.locator('.opt[data-i="0"]').click()
                page.locator('[data-a="action"]').last.click()
                page.wait_for_selector('.explain .k-question-table')
                metrics[label+'-answered']=assert_tables(page,label+'-answered',True)
                assert page.locator('.opt.correct,.tf.correct').count()>0
                assert page.locator('.explain .k-question-table').count()==2
                if kind=='sba':
                    page.locator('.k-table-box').evaluate_all('boxes=>boxes.forEach(el=>el.scrollLeft=0)')
                    helpers['capture'](page,out/f'question-tables-{width}-{theme}.png')
                assert not errors,errors
            passed.append(f'{width}px {theme}: tables render safely in stem, SBA/multi/EMQ/MTF options and explanation; Motor section bold; wide tables scroll locally; no page overflow')
            ctx.close()
    (out/'question-table-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
    return {'passed':passed}
