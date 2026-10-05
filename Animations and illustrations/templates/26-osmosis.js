MedicalMotion.register({
  id:'osmosis',category:'Cell physiology',title:'Water follows free-water gradient',
  description:'Show water crossing a semipermeable membrane while solute remains largely on one side.',
  caption:'In osmosis, free water moves across the membrane toward the side with lower free-water concentration.',
  keywords:["osmosis", "water", "semipermeable membrane", "aquaporin"],
  stages:["Compare both sides", "Open the water path", "Follow water movement"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/biology-2e/pages/5-2-passive-transport"],
  params:{"gradient": 0.65},parameterSchema:{"gradient": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Visual strength of the water gradient."}},
  labels:{"left": "More free water", "right": "Less free water", "membrane": "Semipermeable membrane"},
  render:function(c,p,t,S){const {C,rect,circle,text,arrow,flow,wrap}=S;let o='',q=c.params.gradient*(.35+.65*p);o+=rect(52,72,235,300,C.soft,24)+rect(353,72,235,300,C.tissue,24)+rect(300,55,53,334,C.paper,9,{stroke:C.line,'stroke-width':3})+text(170,105,c.labels.left,C.ink,18,'middle',750)+text(470,105,c.labels.right,C.ink,18,'middle',750)+text(326,420,c.labels.membrane,C.muted,16,'middle',750);for(let i=0;i<9;i++){let x=88+(i%3)*70,y=150+Math.floor(i/3)*62;o+=circle(x,y,7,C.teal)}for(let i=0;i<13;i++){let x=392+(i%4)*42,y=145+Math.floor(i/4)*62;o+=circle(x,y,8,C.red)}o+=arrow(255,255,395,255,C.teal,5)+flow([[255,255],[395,255]],q,C.teal,6,6)+wrap(320,36,'Water crosses; solute stays mostly in place',C.muted,15,540,1,'middle');return o;}
});

