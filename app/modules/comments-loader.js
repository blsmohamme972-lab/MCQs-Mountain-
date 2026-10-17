/* Lazy: modules/comments.js loads on the first study screen or finished download (start-up budget). */
globalThis.KafuEnhancements.installers.push({name:'comments-loader',install(){
  'use strict';
  let p;
  const need=()=>p||(p=new Promise((ok,no)=>{const s=Object.assign(document.createElement('script'),{src:'modules/comments.js',onload:ok,onerror:()=>{s.remove();p=null;no()}});document.head.appendChild(s)}));
  const r=render;render=function(...a){const out=r.apply(this,a);if(document.querySelector('.k-study'))need().then(()=>KafuComments.place(),()=>{});return out};
  const D=globalThis.KafuDownloads?.manager?.io;
  if(D){const show=D.show;D.show=(key,pack)=>{show(key,pack);if(pack?._offline_complete)need().then(()=>KafuComments.save(pack),()=>{})}}
}});
