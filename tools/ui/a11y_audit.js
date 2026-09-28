() => {
  const errors=[],manual=[],stats={text:0,controls:0,pairs:0};
  const parse=value=>{
    if(/^#[0-9a-f]{6}$/i.test(value))return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)).concat(1);
    const a=value.match(/[\d.]+/g)?.map(Number);return a?.length>=3?[a[0],a[1],a[2],a[3]??1]:[0,0,0,0];
  };
  const blend=(a,b)=>{const alpha=a[3]+b[3]*(1-a[3]);return alpha?[0,1,2].map(i=>(a[i]*a[3]+b[i]*b[3]*(1-a[3]))/alpha).concat(alpha):[0,0,0,0];};
  const lum=c=>c.slice(0,3).map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const root=getComputedStyle(document.documentElement);
  const pairs=[['text','bg',4.5],['muted','bg',4.5],['text','surface',4.5],['muted','surface',4.5],['text','surface-alt',4.5],['muted','surface-alt',4.5],['success','success-soft',4.5],['danger','danger-soft',4.5],['primary','primary-soft',4.5],['focus','bg',3],['primary','surface-alt',3]];
  for(const [a,b,minimum] of pairs){const n=ratio(parse(root.getPropertyValue('--color-'+a).trim()),parse(root.getPropertyValue('--color-'+b).trim()));stats.pairs++;if(n<minimum)errors.push({kind:'token-contrast',a,b,ratio:n,minimum});}
  const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!el.closest('[hidden],[aria-hidden="true"],.k-sr-only,.k-skip-link');};
  const identify=el=>(el.getAttribute('aria-label')||el.textContent.trim()).slice(0,100);
  function background(el){let result=[255,255,255,1];const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);for(const p of chain){const s=getComputedStyle(p);if(s.backgroundImage!=='none')return null;result=blend(parse(s.backgroundColor),result);}return result;}
  for(const el of document.querySelectorAll('main *,header *,nav *,[role="dialog"] *,#kafu-undo-notice *')){
    if(!visible(el)||!Array.from(el.childNodes).some(n=>n.nodeType===3&&n.textContent.trim())||el.closest('svg'))continue;
    const disabled=el.closest('button:disabled');if(disabled&&!disabled.closest('.k-study'))continue;
    const bg=background(el);if(!bg){manual.push({kind:'gradient-text',label:identify(el)});continue;}
    const s=getComputedStyle(el),fg=blend(parse(s.color),bg),size=parseFloat(s.fontSize),bold=parseFloat(s.fontWeight)>=700,minimum=size>=24||(bold&&size>=18.6667)?3:4.5;
    const n=ratio(fg,bg);stats.text++;if(n<minimum)errors.push({kind:'text-contrast',label:identify(el),class:el.className,ratio:n,minimum,color:s.color,bg});
  }
  for(const el of document.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea,summary')){
    if(!visible(el))continue;stats.controls++;
    const name=el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')?.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ')||el.labels?.[0]?.textContent||el.textContent.trim();
    if(!name)errors.push({kind:'missing-name',tag:el.tagName,action:el.dataset.a});
    const rect=el.getBoundingClientRect();if(rect.width<44||rect.height<44)errors.push({kind:'target-size',label:name,width:rect.width,height:rect.height});
  }
  for(const img of document.querySelectorAll('img'))if(visible(img)&&!img.hasAttribute('alt'))errors.push({kind:'missing-alt'});
  if(document.documentElement.scrollWidth>innerWidth+1)errors.push({kind:'horizontal-overflow',width:innerWidth,scroll:document.documentElement.scrollWidth});
  return {errors,manual,stats};
}
