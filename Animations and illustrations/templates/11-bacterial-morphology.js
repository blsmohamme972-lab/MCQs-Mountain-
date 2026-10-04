MedicalMotion.register({
  id:'bacterial-morphology',category:'Microbiology',title:'Three bacterial shapes',
  description:'Compare cocci, bacilli and spirilla with clean, original schematic geometry.',
  caption:'Shape is a descriptive clue. Identification also depends on staining, physiology, genetics and clinical context.',
  keywords:['bacteria','cocci','bacilli','spirilla','microbiology','cell shape'],
  stages:['Name the three shapes','Compare their geometry','Keep morphology in context'],
  limitations:'Conceptual silhouettes only. Size, staining, motility and species identification are not represented.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK8406/','https://openstax.org/books/microbiology/pages/4-1-prokaryotic-cells'],
  params:{mode:'all'},parameterSchema:{mode:{type:'enum',values:['all','cocci','bacilli','spirilla'],description:'Highlight one morphology or show all three.'}},
  labels:{cocci:'Cocci',bacilli:'Bacilli',spirilla:'Spirilla',active:'Selected morphology'},
  render:function(c,p,t,S){
    const {C,rect,circle,path,text,wrap}=S; let out='';
    const active=c.params.mode;
    const chosen=k=>active==='all'||active===k;
    const cards=[['cocci',108,c.labels.cocci],['bacilli',258,c.labels.bacilli],['spirilla',408,c.labels.spirilla]];
    out+=text(320,28,c.labels.active,C.muted,16,'middle',650);
    cards.forEach(([key,y,label])=>{
      const hi=chosen(key); out+=rect(42,y-40,556,112,hi?C.soft:C.paper,20,{stroke:hi?C.teal:C.line,'stroke-width':hi?3:2});
      out+=text(78,y-8,label,C.ink,21,'start',750);
      if(key==='cocci'){
        for(let i=0;i<5;i++) out+=circle(300+i*43,y+10,18,C.red,{opacity:.85});
        out+=circle(386,y+10,18,C.red,{opacity:.45});
      }else if(key==='bacilli'){
        for(let i=0;i<4;i++) out+=rect(285+i*58,y-8,43,36,C.gold,17,{opacity:.9});
      }else{
        out+=path('M 282 '+(y+12)+' C 305 '+(y-30)+' 330 '+(y+52)+' 353 '+(y+12)+' S 401 '+(y-30)+' 424 '+(y+12) ,C.blue,6,'none');
      }
    });
    out+=wrap(320,416,'Use shape as a starting descriptor, never as a stand-alone diagnosis.',C.muted,16,530,2,'middle');
    return out;
  }
});
