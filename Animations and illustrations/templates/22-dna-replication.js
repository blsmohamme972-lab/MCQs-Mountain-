MedicalMotion.register({
  id:'dna-replication',category:'Molecular biology',title:'DNA opens; two copies form',
  description:'Show a simplified replication fork with complementary strands extending from a parental template.',
  caption:'Replication preserves one parental strand in each daughter double helix.',
  keywords:["DNA", "replication", "replication fork", "semiconservative"],
  stages:["Open the helix", "Add complements", "Finish two daughter helices"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/biology-2e/pages/14-3-basics-of-dna-replication"],
  params:{"progress": 0.62},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Presentation progress from fork opening to daughter strands."}},
  labels:{"parental": "Parental strands", "new": "New complementary strands", "fork": "Replication fork"},
  render:function(c,p,t,S){const {C,path,line,circle,text,arrow,wrap}=S;let o='',q=c.params.progress,sp=18+92*q;o+=path('M 250 72 C 350 110 290 150 390 190 S 290 270 250 338',C.blue,7,'none')+path('M 390 72 C 290 110 350 150 250 190 S 350 270 390 338',C.blue,7,'none')+circle(320,188,13,C.gold)+text(320,42,c.labels.fork,C.ink,19,'middle',750);for(let i=0;i<6;i++){let yy=92+i*43,dx=(i%2?1:-1)*sp;o+=line(320+dx,yy,320-dx,yy,C.line,3)+circle(320+dx,yy,5,C.teal)+circle(320-dx,yy,5,C.red)}o+=arrow(120,360,235,360,C.blue,4)+wrap(320,386,c.labels.parental,C.muted,16,180,1,'middle')+arrow(405,360,520,360,C.teal,4)+wrap(320,426,c.labels.new,C.muted,16,220,1,'middle');return o;}
});
