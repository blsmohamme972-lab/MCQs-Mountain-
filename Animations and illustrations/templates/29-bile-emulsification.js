MedicalMotion.register({
  id:'bile-emulsification',category:'Digestion',title:'Bile breaks fat into droplets',
  description:'Animate large lipid globules becoming smaller droplets that expose more surface to digestive enzymes.',
  caption:'Bile disperses hydrophobic fat into smaller droplets; it does not chemically digest the lipid itself.',
  keywords:["bile", "emulsification", "fat digestion", "gallbladder"],
  stages:["Start with a fat globule", "Add bile action", "Reveal smaller droplets"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/anatomy-and-physiology-2e/pages/23-6-accessory-organs-in-digestion-the-liver-pancreas-and-gallbladder"],
  params:{"progress": 0.62},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Visual breakup of one large fat globule."}},
  labels:{"fat": "Fat", "bile": "Bile salts", "droplets": "Smaller droplets"},
  render:function(c,p,t,S){const {C,circle,path,text,arrow,wrap}=S;let o='',q=c.params.progress,R=92-48*q;o+=circle(170,225,R,C.gold,{stroke:C.ink,'stroke-width':3})+text(170,225,c.labels.fat,C.ink,18,'middle',750)+arrow(270,225,340,225,C.teal,4);let n=3+Math.round(8*q);for(let i=0;i<n;i++){let a=i*6.283/n,rr=55+25*(i%2),x=445+Math.cos(a)*rr,y=225+Math.sin(a)*rr;o+=circle(x,y,10+4*(1-q),C.gold,{stroke:C.ink,'stroke-width':2})+path('M '+(x-15)+' '+(y-12)+' Q '+x+' '+(y-27)+' '+(x+15)+' '+(y-12),C.teal,3,'none')}o+=text(445,360,c.labels.droplets,C.ink,18,'middle',750)+text(320,70,c.labels.bile,C.teal,19,'middle',750)+wrap(320,414,'More surface area available for digestive enzymes',C.muted,16,500,1,'middle');return o;}
});
