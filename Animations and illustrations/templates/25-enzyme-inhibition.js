MedicalMotion.register({
  id:'enzyme-inhibition',category:'Biochemistry',title:'The active site has a competitor',
  description:'Animate substrate binding and competitive inhibitor occupancy of an enzyme active site.',
  caption:'A competitive inhibitor uses the active site, so substrate and inhibitor compete for the same opening.',
  keywords:["enzyme", "competitive inhibition", "active site", "substrate"],
  stages:["Show the active site", "Let molecules compete", "Compare binding outcomes"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/biology-2e/pages/6-5-enzymes"],
  params:{"mode": "competitive", "progress": 0.6},parameterSchema:{"mode": {"type": "enum", "values": ["competitive", "allosteric"], "description": "Binding mode to illustrate."}, "progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Presentation progress through binding."}},
  labels:{"enzyme": "Enzyme", "site": "Active site", "substrate": "Substrate", "inhibitor": "Inhibitor"},
  render:function(c,p,t,S){
    const {C,path,circle,text,arrow,wrap,clamp}=S;
    const all=c.params.mode==='allosteric', q=clamp(p*c.params.progress);
    let o='';
    const shape=all?18*Math.sin(Math.PI*q):0;
    o+=path('M 150 200 C 180 110 330 110 390 180 C 450 250 390 335 255 325 C 165 318 110 270 150 200 Z',C.blue,6,C.soft,{transform:'rotate('+shape+' 280 220)'});
    o+=circle(282,168,28,C.paper,{stroke:C.red,'stroke-width':5,opacity:all?.45+.4*q:1})+text(282,174,c.labels.site,C.red,12,'middle',750);
    o+=text(268,380,c.labels.enzyme,C.ink,18,'middle',750);
    // The manual progress parameter controls the endpoint; p animates the molecules toward it.
    const sx=all?170:70+260*q, ix=all?420:570-260*q;
    o+=circle(sx,95,25,C.teal,{stroke:C.ink,'stroke-width':2})+text(sx,101,c.labels.substrate,C.ink,11,'middle',750);
    o+=circle(ix,95,25,C.gold,{stroke:C.ink,'stroke-width':2})+text(ix,101,c.labels.inhibitor,C.ink,11,'middle',750);
    if(all)o+=circle(394,230,23,C.gold,{stroke:C.ink,'stroke-width':2,opacity:.35+.65*q})+arrow(ix,120,394,207,C.gold,4);
    else {
      o+=arrow(sx,122,282,140,C.teal,4)+arrow(ix,122,282,140,C.gold,4);
      o+=circle(282,140,8,q>.58?C.teal:C.gold,{opacity:.5+.5*q});
    }
    o+=wrap(320,430,all?'Allosteric site changes the enzyme shape':'Both molecules compete for one active site',C.muted,16,500,1,'middle');
    return o;
  }
});
