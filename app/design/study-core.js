/* Session summaries are derived in memory; no student record is rewritten. */
(function(root){
  'use strict';
  function summarize(ids,responses){
    const qids=[...new Set(ids||[])],answered=qids.filter(id=>responses?.[id]?.done===true);
    const correct=answered.filter(id=>responses[id].correct===true);
    const mistakes=answered.filter(id=>responses[id].correct!==true);
    return Object.freeze({total:qids.length,answered:answered.length,correct:correct.length,
      skipped:qids.length-answered.length,mistakes:Object.freeze(mistakes),
      percent:answered.length?Math.round(100*correct.length/answered.length):0,
      perfect:qids.length>0&&answered.length===qids.length&&correct.length===qids.length});
  }
  root.KafuStudyCore={summarize};
  if(typeof module==='object'&&module.exports)module.exports=root.KafuStudyCore;
})(globalThis);
