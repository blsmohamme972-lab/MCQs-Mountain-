/* Optional device-local encouragement. Unknown records and study data are preserved. */
(function(root){
  'use strict';
  const IDS=['first_chapter','week_streak','hundred_questions','first_perfect'];
  const key=owner=>'ui_delight_user_'+(/^\d+$/.test(String(owner))?String(owner):'browser');
  const valid=record=>!!record&&record.schema===1&&record.earned&&typeof record.earned==='object'&&!Array.isArray(record.earned)&&Object.values(record.earned).every(v=>typeof v==='string');
  function migrate(record){return record==null?{record:{schema:1,earned:{}},writable:true,write:false}:valid(record)?{record:{...record,earned:{...record.earned}},writable:true,write:false}:{record:null,writable:false,write:false};}
  function earn(record,ids,date){
    if(!valid(record))throw new Error('Unknown delight record; preserved');
    const earned={...record.earned};for(const id of ids)if(IDS.includes(id)&&!earned[id])earned[id]=date;
    return{...record,earned};
  }
  function qualify(summary,chapterIds){
    const ids=[...new Set(chapterIds||[])];
    if(summary?.mode!=='study'||!ids.length||summary.total!==ids.length||summary.answered!==ids.length||summary.skipped!==0||!Array.isArray(summary.qids)||summary.qids.length!==ids.length||!summary.qids.every(id=>ids.includes(id)))return[];
    return summary.perfect?['first_chapter','first_perfect']:['first_chapter'];
  }
  function phrase(qid,attempt){const choices=['Kafu! \ud83d\udc4f','Kafu! Nicely reasoned.','Kafu! One step further.'];let hash=Number(attempt)||0;for(const c of String(qid))hash=(hash+c.charCodeAt(0))%997;return choices[hash%choices.length];}
  const api={IDS,key,valid,migrate,earn,qualify,phrase};root.KafuDelightCore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
