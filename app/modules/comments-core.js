/* Question comments, pure part: checks the published index and shards (tools/comments.py writes them) and turns
   one question's comments into what the view shows. Authors are Kafu characters, looked up with `person`. */
(function(root){
  'use strict';
  const HEX=/^[a-f0-9]{64}$/,SHARD=/^Q\d{6}$/;
  const KINDS={tip:'Tip',mnemonic:'Mnemonic',clinical:'Clinical pearl',exam:'Exam tip'};
  const VISIBLE=3,MAX_TOP=12,MAX_REPLIES=6,MAX_TEXT=600;
  const shardOf=qid=>String(qid).slice(0,7);
  function validIndex(d,book){
    if(!d||d.schema!==1||d.book_id!==book||!d.shards||typeof d.shards!=='object'||Array.isArray(d.shards))return false;
    const prefix='/packs/_comments/'+book+'/';
    return Object.entries(d.shards).every(([key,e])=>SHARD.test(key)&&!!e&&HEX.test(String(e.sha256||''))&&
      e.url===prefix+key+'.'+e.sha256.slice(0,12)+'.json');
  }
  function validShard(d,book,key){
    return !!d&&d.schema===1&&d.book_id===book&&d.shard===key&&!!d.questions&&typeof d.questions==='object'&&!Array.isArray(d.questions);
  }
  // Anything malformed, or by someone who is not a Kafu character, is left out rather than shown.
  function clean(list,person){
    if(!Array.isArray(list))return[];
    const one=(c,reply)=>{
      if(!c||typeof c.text!=='string'||!c.text.trim())return null;
      const who=person(c.author);if(!who)return null;
      const out={who,text:c.text.trim().slice(0,MAX_TEXT),kind:Object.prototype.hasOwnProperty.call(KINDS,c.kind)?c.kind:null};
      if(!reply)out.replies=(Array.isArray(c.replies)?c.replies:[]).slice(0,MAX_REPLIES).map(r=>one(r,true)).filter(Boolean);
      return out;
    };
    return list.slice(0,MAX_TOP).map(c=>one(c,false)).filter(Boolean);
  }
  const count=list=>list.reduce((n,c)=>n+1+(c.replies?c.replies.length:0),0);
  // The first three threads show; the rest open with "Show N more".
  function view(list,expanded){
    const shown=expanded?list:list.slice(0,VISIBLE);
    return{shown,hidden:count(list.slice(shown.length)),total:count(list)};
  }
  const api={KINDS,VISIBLE,shardOf,validIndex,validShard,clean,count,view};
  root.KafuCommentsCore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
