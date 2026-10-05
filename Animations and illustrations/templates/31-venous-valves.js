MedicalMotion.register({
  id:'venous-valves',category:'Circulation',title:'Valves keep venous flow one-way',
  description:'Show a venous valve opening toward the heart and closing against backflow.',
  caption:'Low-pressure veins use valves and muscle compression to support one-way return toward the heart.',
  keywords:["vein", "venous valve", "backflow", "circulation"],
  stages:["Open toward the heart", "Close against backflow", "Keep one-way flow"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-structure-and-function-of-blood-vessels"],
  params:{"progress": 0.65},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Blend between open and closed valve positions."}},
  labels:{"vein": "Vein", "valve": "Venous valve", "heart": "Toward heart", "backflow": "Backflow blocked"},
  render:function(c,p,t,S){
    const {C,rect,path,circle,text,arrow,flow,wrap,clamp}=S;
    // progress sets the manual valve position; p drives a repeatable compression/release cycle.
    const q=clamp(c.params.progress), cycle=(p*2)%1, compression=cycle<.5?cycle*2:2-cycle*2;
    const openness=clamp(q*.65+.35*(1-compression)), g=70-48*openness;
    let o='';
    o+=rect(220,48,200,344,C.tissue,52,{stroke:C.red,'stroke-width':5});
    o+=path('M 225 204 Q 292 '+(204-g)+' 320 244 Q 348 '+(204-g)+' 415 204',C.blue,10,'none');
    o+=path('M 225 204 Q 292 '+(204+g)+' 320 164 Q 348 '+(204+g)+' 415 204',C.blue,10,'none');
    o+=circle(320,204,11,C.paper,{stroke:C.ink,'stroke-width':3});
    const forward=clamp((p*1.35)%1);
    o+=arrow(320,350,320,280,C.teal,5)+flow([[320,350],[320,280]],forward,C.teal,5,6);
    if(openness<.55)o+=arrow(320,120,320,170,C.red,4)+flow([[320,120],[320,170]],(p+.4)%1,C.red,3,5);
    o+=arrow(320,120,320,55,C.gold,4)+text(320,30,c.labels.heart,C.gold,18,'middle',750);
    o+=wrap(320,425,openness<.55?c.labels.backflow:c.labels.valve,C.ink,17,350,1,'middle');
    return o;
  }
});
