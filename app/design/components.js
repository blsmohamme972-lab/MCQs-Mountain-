/* Pure, escaped presentation helpers. They never read or write study state. */
(function(root){
  'use strict';
  const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attrs=data=>Object.entries(data||{}).filter(([key])=>/^[a-z][a-z0-9_-]*$/i.test(key)).map(([key,value])=>` data-${e(key)}="${e(value)}"`).join('');
  const button=(label,{action='',data={},variant='',disabled=false}={})=>`<button class="btn ${e(variant)}" data-a="${e(action)}"${attrs(data)}${disabled?' disabled':''}>${e(label)}</button>`;
  const chip=(label,kind='')=>`<span class="k-chip ${e(kind)}">${e(label)}</span>`;
  const empty=({title,body,action,label,icon=''})=>`<section class="k-empty">${icon?`<span class="k-empty-icon" aria-hidden="true">${icon}</span>`:''}<h2>${e(title)}</h2><p>${e(body)}</p>${action?button(label,{action}):''}</section>`;
  const percent=(value,total)=>Math.max(0,Math.min(100,Number.isFinite(value)&&Number.isFinite(total)&&total>0?Math.round(value/total*100):0));
  const progress=(value,total,label)=>`<div class="k-progress" role="progressbar" aria-label="${e(label)}" aria-valuemin="0" aria-valuemax="${e(Math.max(1,total))}" aria-valuenow="${e(Math.max(0,Math.min(value,total)))}"><span style="width:${percent(value,total)}%"></span></div>`;
  const ring=(value,total,label)=>{const pct=percent(value,total);return `<span class="k-ring" role="img" aria-label="${e(label)}: ${pct}%"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43"/><circle cx="50" cy="50" r="43" stroke-dasharray="${pct*2.702} 270.2"/></svg><strong>${pct}%</strong></span>`;};
  const skeleton=(label='Loading',card=false)=>`<div role="status" aria-label="${e(label)}"><span class="k-sr-only">${e(label)}</span><div aria-hidden="true" class="k-skeleton${card?' card':''}"></div></div>`;
  root.KafuDesign={e,attrs,button,chip,empty,percent,progress,ring,skeleton};
  if(typeof module==='object'&&module.exports)module.exports=root.KafuDesign;
})(globalThis);
