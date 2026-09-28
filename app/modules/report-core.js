/* Personal report queue contract: additive fields in the existing local reports array. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KafuReportCore=api;})(globalThis,function(){
  'use strict';
  const reasons=new Set(['Wrong answer','Wrong explanation','Typo','Missing image','Duplicate','Outdated information']);
  const valid=x=>x&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x.id||'')&&/^Q\d{9}$/.test(x.q||'')&&/^[A-Z0-9][A-Z0-9-]*$/.test(x.book||'')&&Number.isSafeInteger(x.version)&&x.version>0&&reasons.has(x.reason)&&typeof x.note==='string'&&x.note.length<=300;
  const create=(id,q,book,version,reason,note,t)=>({id,q,book,version,reason,note:String(note||'').replace(/\s+/g,' ').trim().slice(0,300),t});
  return{valid,create};
});
