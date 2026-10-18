/* Diagnostics deliberately expose only allowlisted public platform fields. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KafuUXCore=api;})(globalThis,function(){
  'use strict';
  const clean=(value,fallback='unknown')=>typeof value==='string'&&/^[A-Za-z0-9_. -]{1,80}$/.test(value)?value:fallback;
  const errorCode=error=>{
    const value=typeof error==='string'?error:error?.error||error?.name;
    return clean(value,'UNSPECIFIED_ERROR');
  };
  // A tablet: Telegram for iOS or Android on a screen at least 600 px on its short side (iPad, Android tablets).
  const isTablet=(tg,screen)=>!!tg&&/^(ios|android)/.test(String(tg.platform||''))&&Math.min(Number(screen?.width)||0,Number(screen?.height)||0)>=600;
  class FullscreenDiagnostic {
    // The browser's timers must be called as plain functions (a detached setTimeout throws "Illegal invocation").
    constructor(tg,{changed=()=>{},timer=(fn,ms)=>setTimeout(fn,ms),clear=id=>clearTimeout(id)}={}){
      this.tg=tg;this.changed=changed;this.timer=timer;this.clear=clear;this.timeout=null;this.pending=false;this.auto=false;
      this.result='Not requested';this.returned='not called';
      this.onChanged=()=>{this.pending=false;this.clear(this.timeout);this.result=tg?.isFullscreen?'Fullscreen confirmed by Telegram':'Not fullscreen (Telegram event)';this.changed();};
      this.onFailed=event=>{this.pending=false;this.clear(this.timeout);this.result='Telegram error: '+errorCode(event);this.changed();};
      try{tg?.onEvent?.('fullscreenChanged',this.onChanged);tg?.onEvent?.('fullscreenFailed',this.onFailed);}catch(_){}
    }
    supported(){
      if(typeof this.tg?.requestFullscreen!=='function')return false;
      try{return typeof this.tg.isVersionAtLeast==='function'?this.tg.isVersionAtLeast('8.0'):parseFloat(this.tg.version)>=8;}catch(_){return false;}
    }
    snapshot(){return{telegramVersion:clean(this.tg?.version),platform:clean(this.tg?.platform),isFullscreen:!!this.tg?.isFullscreen,
      supported:this.supported(),automatic:this.auto,returned:this.returned,result:this.result};}
    // On a tablet the app asks Telegram for full screen by itself, once, at start-up (owner, 2026-10-18): otherwise
    // Telegram shows it in a phone-sized window on an iPad. Phones and desktops stay as Telegram opens them.
    autoTablet(screen){
      if(this.auto||!isTablet(this.tg,screen)||!this.supported()||this.tg.isFullscreen)return false;
      this.auto=true;this.request(false);return true;
    }
    request(exit=false){
      if(this.pending)return;
      const method=exit?'exitFullscreen':'requestFullscreen';
      if(!this.supported()||typeof this.tg?.[method]!=='function'){
        this.result='UNSUPPORTED: this Telegram version or platform has no fullscreen API';this.returned='not called';this.changed();return;
      }
      if(!exit&&this.tg.isFullscreen){this.result='ALREADY_FULLSCREEN';this.returned='not called';this.changed();return;}
      this.pending=true;this.result='Request sent; waiting for Telegram';this.returned='pending';this.changed();
      try{
        // Synchronous invocation preserves the user's tap gesture; the only automatic call is autoTablet().
        const result=this.tg[method]();
        this.returned=result===undefined?'void (request sent)':typeof result==='object'?'object (not logged)':typeof result;
        if(result&&typeof result.then==='function')result.catch(error=>this.onFailed(error));
        if(this.pending)this.timeout=this.timer(()=>{this.pending=false;this.result=this.tg.isFullscreen?'Fullscreen state is true':'No fullscreen confirmation received; state is still false';this.changed();},5000);
      }catch(error){this.onFailed(error);}
      this.changed();
    }
    dispose(){this.clear(this.timeout);try{this.tg?.offEvent?.('fullscreenChanged',this.onChanged);this.tg?.offEvent?.('fullscreenFailed',this.onFailed);}catch(_){} }
  }
  const sourceLabel=value=>value==='published'?'Published catalog':value==='sample'?'Built-in sample catalog':'Catalog source not yet available';
  const buildInfo=value=>({version:clean(value?.version,'development'),commit:typeof value?.commit==='string'&&/^[a-f0-9]{7,40}$/.test(value.commit)?value.commit:'development'});
  return{FullscreenDiagnostic,isTablet,sourceLabel,buildInfo,errorCode};
});
