/* A cancellable grace period, deliberately kept in memory only. */
(function(root){
  'use strict';
  class UndoWindow {
    constructor({delay=6000,setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimer=id=>globalThis.clearTimeout(id)}={}){this.delay=delay;this.setTimer=setTimer;this.clearTimer=clearTimer;this.pending=null;}
    stage(work,meta={}){
      this.cancel();
      const item={work,meta,timer:null};this.pending=item;
      item.timer=this.setTimer(async()=>{if(this.pending!==item)return;this.pending=null;await item.work();},this.delay);
      return item;
    }
    cancel(){if(!this.pending)return false;this.clearTimer(this.pending.timer);this.pending=null;return true;}
  }
  root.KafuUndoWindow=UndoWindow;
  if(typeof module==='object'&&module.exports)module.exports={UndoWindow};
})(globalThis);
