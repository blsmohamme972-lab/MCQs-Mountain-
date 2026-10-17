/* Question comments, pure part: checks the published index and shards (tools/comments.py writes them) and turns
   one question's comments into what the view shows. Authors are Kafu characters, looked up with `person`. Each
   comment may carry a posting time, likes (0–20) and up to three reactions; older packs without them still show. */
(function(root){
  'use strict';
  const HEX=/^[a-f0-9]{64}$/,SHARD=/^Q\d{6}$/,AT=/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
  const KINDS={tip:'Tip',mnemonic:'Mnemonic',clinical:'Clinical pearl',exam:'Exam tip'};
  const REACTIONS=['👍','❤️','🔥','💯','🧠','👏','😂','😮'];
  const VISIBLE=3,REPLIES=2,MAX_TOP=12,MAX_REPLIES=6,MAX_TEXT=600,MAX_LIKES=20;
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
  // A short, stable name for one comment (FNV-1a of author and text), for the student's own like.
  function hash(s){let h=0x811c9dc5;for(const ch of s){h^=ch.codePointAt(0);h=Math.imul(h,0x01000193)>>>0;}return h.toString(36);}
  // Anything malformed, or by someone who is not a Kafu character, is left out rather than shown.
  function clean(list,person,qid=''){
    if(!Array.isArray(list))return[];
    const one=(c,reply)=>{
      if(!c||typeof c.text!=='string'||!c.text.trim())return null;
      const who=person(c.author);if(!who)return null;
      const text=c.text.trim().slice(0,MAX_TEXT),at=typeof c.at==='string'&&AT.test(c.at)?Date.parse(c.at):NaN;
      const out={who,text,kind:Object.prototype.hasOwnProperty.call(KINDS,c.kind)?c.kind:null,key:qid+':'+hash(c.author+'\n'+text),
        at:Number.isFinite(at)?at:null,likes:Number.isInteger(c.likes)&&c.likes>=0&&c.likes<=MAX_LIKES?c.likes:0,
        react:Array.isArray(c.react)?[...new Set(c.react.filter(e=>REACTIONS.includes(e)))].slice(0,3):[]};
      if(!reply)out.replies=(Array.isArray(c.replies)?c.replies:[]).slice(0,MAX_REPLIES).map(r=>one(r,true)).filter(Boolean);
      return out;
    };
    return list.slice(0,MAX_TOP).map(c=>one(c,false)).filter(Boolean);
  }
  const count=list=>list.reduce((n,c)=>n+1+(c.replies?c.replies.length:0),0);
  const all=list=>list.flatMap(c=>[c,...(c.replies||[])]);
  // How long ago, the way social apps write it: now, 5m, 3h, 2d, 4w, 1y. A time ahead of the phone's clock is "now".
  function ago(at,now){
    if(!Number.isFinite(at))return'';
    const m=Math.floor(Math.max(0,now-at)/60000);
    return m<1?'now':m<60?m+'m':m<1440?Math.floor(m/60)+'h':m<10080?Math.floor(m/1440)+'d':m<525600?Math.floor(m/10080)+'w':Math.floor(m/525600)+'y';
  }
  // Likes and reaction icons as shown, with the student's own like (a 👍) added.
  function reactions(c,liked){
    const icons=liked&&!c.react.includes('👍')?['👍',...c.react].slice(0,3):c.react.slice();
    return{count:c.likes+(liked?1:0),icons:icons.length?icons:liked?['👍']:[]};
  }
  // The activity line: comments, reactions, the three most used reactions, the newest time and three faces.
  function stats(list,isLiked=()=>false){
    const items=all(list),used=new Map(),faces=[];
    let total=0,last=null;
    for(const c of items){
      const r=reactions(c,isLiked(c.key));total+=r.count;
      r.icons.forEach((e,i)=>used.set(e,(used.get(e)||0)+r.count/(i+1)));
      if(c.at!==null&&(last===null||c.at>last))last=c.at;
      if(faces.length<3&&!faces.some(w=>w.name===c.who.name))faces.push(c.who);
    }
    const icons=[...used].sort((a,b)=>b[1]-a[1]||REACTIONS.indexOf(a[0])-REACTIONS.indexOf(b[0])).slice(0,3).map(e=>e[0]);
    return{comments:items.length,reactions:total,icons,last,faces};
  }
  // The first three threads show, then "Show N more"; a thread shows two replies, then "View N more replies".
  function view(list,expanded,openThreads=new Set()){
    const shown=(expanded?list:list.slice(0,VISIBLE)).map(c=>{
      const open=openThreads.has(c.key)||c.replies.length<=REPLIES+1;
      return{...c,shownReplies:open?c.replies:c.replies.slice(0,REPLIES),hiddenReplies:open?0:c.replies.length-REPLIES};
    });
    return{shown,hidden:count(list.slice(shown.length)),total:count(list)};
  }
  const api={KINDS,REACTIONS,VISIBLE,REPLIES,shardOf,validIndex,validShard,hash,clean,count,ago,reactions,stats,view};
  root.KafuCommentsCore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
