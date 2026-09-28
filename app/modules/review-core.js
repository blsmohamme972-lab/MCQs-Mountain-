/* Adapter around the unmodified MIT ts-fsrs 5.4.2 scheduler. */
(function(root,factory){
  const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;root.KafuReviewCore=api;
})(globalThis,function(){
  "use strict";
  const VERSION="5.4.2",QID=/^Q\d{9}$/;
  const NUMBERS=["stability","difficulty","elapsed_days","scheduled_days","learning_steps","reps","lapses","state"];
  function valid(card){
    return card&&typeof card==="object"&&Number.isFinite(Date.parse(card.due))&&
      NUMBERS.every(k=>Number.isFinite(card[k])&&card[k]>=0)&&[0,1,2,3].includes(card.state)&&
      (!card.last_review||Number.isFinite(Date.parse(card.last_review)));
  }
  function hydrate(card,now,sdk){
    if(!card)return sdk.createEmptyCard(now);
    if(!valid(card))throw new Error("Saved review state needs repair; it was not overwritten");
    return {...card,due:new Date(card.due),last_review:card.last_review?new Date(card.last_review):undefined};
  }
  function serialize(card){
    const result={due:new Date(card.due).toISOString(),engine:"ts-fsrs",engine_version:VERSION};
    for(const key of NUMBERS)result[key]=card[key];
    if(card.last_review)result.last_review=new Date(card.last_review).toISOString();
    if(!valid(result))throw new Error("Scheduler returned invalid review state");
    return result;
  }
  function create(sdk){
    if(!sdk?.fsrs||!sdk?.createEmptyCard)throw new Error("Pinned scheduler unavailable");
    const scheduler=sdk.fsrs({request_retention:0.9,maximum_interval:36500,enable_fuzz:false,enable_short_term:true,learning_steps:["1m","10m"],relearning_steps:["10m"]});
    return {
      version:VERSION,
      grade(card,rating,now=new Date()){
        if(![1,2,3,4].includes(rating))throw new Error("Invalid review rating");
        now=new Date(now);if(!Number.isFinite(now.getTime()))throw new Error("Invalid review time");
        const previous=hydrate(card,now,sdk);
        if(previous.last_review&&now<previous.last_review)now=new Date(previous.last_review);
        return serialize(scheduler.next(previous,now,rating).card);
      },
      preview(card,now=new Date()){
        const result={};for(const rating of [1,2,3,4])result[rating]=this.grade(card,rating,now);return result;
      }
    };
  }
  function dueIds(cards,now=Date.now()){
    return Object.entries(cards||{}).filter(([id,card])=>QID.test(id)&&valid(card)&&Date.parse(card.due)<=now)
      .sort((a,b)=>Date.parse(a[1].due)-Date.parse(b[1].due)||a[0].localeCompare(b[0])).map(([id])=>id);
  }
  function delayLabel(due,now=Date.now()){
    const seconds=Math.max(0,Math.round((Date.parse(due)-now)/1000));
    if(seconds<60)return "now";if(seconds<3600)return Math.round(seconds/60)+"m";
    if(seconds<86400)return Math.round(seconds/3600)+"h";return Math.round(seconds/86400)+"d";
  }
  return {VERSION,valid,create,dueIds,delayLabel};
});
