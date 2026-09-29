#!/usr/bin/env python3
"""Rebuild ABSITE v2 text state from an unpacked v1 package. Checkpoint branch helper."""
import json,re,sys
from pathlib import Path
V1=Path(sys.argv[1]); OUT=Path(sys.argv[2]); OUT.mkdir(parents=True,exist_ok=True)
qs=[json.loads(x) for x in open(V1/'questions.jsonl',encoding='utf-8')]
book=json.load(open(V1/'book.json',encoding='utf-8'))
ABBR={'Dr.','Mr.','Mrs.','Ms.','vs.','et al.','e.g.','i.e.','Fig.','Figs.','St.','Jr.','Sr.','No.'}
def clean(s): return re.sub(r'\s+',' ',s.split('\nReference:',1)[0].split('\nReferences:',1)[0]).strip()
def sentences(s):
 s=clean(s); out=[]; start=0
 for m in re.finditer(r'(?<=[.!?])\s+(?=[A-Z0-9“"]|\()',s):
  x=s[start:m.start()].strip()
  if any(x.endswith(a) for a in ABBR) or re.search(r'\b(?:[A-Z]|[A-Z][a-z])\.$',x): continue
  out.append(x); start=m.end()
 if s[start:].strip(): out.append(s[start:].strip())
 return out
def terms(q):
 i=ord(q['answer'])-65; opt=q['options'][i] if 0<=i<len(q['options']) else ''
 stop={'the','a','an','and','or','of','to','in','is','are','with','for','by','on','from','as','at','be','it','this','that','most','best','following','true','false'}
 return {w.lower() for w in re.findall(r'[A-Za-z0-9µβγ+-]{3,}',opt) if w.lower() not in stop}
def pick(q):
 ss=sentences(q['explanation']); best=None; tt=terms(q)
 for n in (2,3,4):
  for i in range(max(0,len(ss)-n+1)):
   t=' '.join(ss[i:i+n]); wc=len(t.split()); ov=sum(bool(re.search(r'(?i)\b'+re.escape(z)+r'\b',t)) for z in tt)
   rp=0 if 45<=wc<=80 else 1000+min(abs(wc-45),abs(wc-80))*10
   pp=100 if re.match(r'(?i)^(this|these|those|it |as above|see fig)',ss[i]) else 0
   c=(ov*18-abs(wc-60)-rp-pp-i*.3,t)
   if best is None or c[0]>best[0]: best=c
 return best[1]
MAN={
69:'The portal vein has no valves (A). It supplies approximately 75% of the blood flow to the liver compared with 25% by the hepatic arteries (B). It is formed by the confluence of the superior mesenteric and splenic veins (D). The normal pressure in the portal vein is 3 to 5 mm Hg (C). The portal vein is most commonly located posterior (Portal is Posterior) to the common bile duct and hepatic artery in the hepatoduodenal ligament.',
317:'External hemorrhoids originate below the dentate line, are covered with anoderm, and may cause discomfort such as itching but generally only cause severe pain if they become thrombosed. Treatment of thrombosed external hemorrhoids, as in this case, consists of incision and drainage of the thrombosed hemorrhoid with the patient under local anesthesia.',
382:'The synthesis of catecholamines is a complex process and is governed by various enzymes. Tyrosine hydroxylase is considered the rate limiting step and converts L-tyrosine to L-dopa, which is then converted to dopamine by dopa-decarboxylase (A). Dopamine is converted to norepinephrine by dopamine-beta-hydroxylase and norepinephrine is converted to epinephrine by PNMT (B, C).',
396:'Pheochromocytomas occur either sporadically, as part of multiple endocrine neoplasia (MEN) type 2A and MEN type 2B, in association with von Hippel-Lindau disease, and with von Recklinghausen disease. The diagnosis of a benign or a malignant pheochromocytoma cannot be accurately determined by the histologic appearance but rather is based on evidence of local invasion or the presence or absence of metastasis (B).',
427:'The thyroid gland is supplied by paired superior thyroid arteries from the external carotid arteries and the inferior thyroid arteries from the thyrocervical trunk. The superior thyroid artery is the first branch of the external carotid artery (B). During thyroidectomy, care must be taken when ligating the superior thyroid arteries to avoid injury to the external branch of the superior laryngeal nerve (D).',
479:'Hepatorenal syndrome is a functional renal problem that likely results from relative hypovolemia, splanchnic and peripheral arterial vasodilation, and intense vasoconstriction of the renal circulation (B, C). The syndrome is probably the final consequence of extreme underfilling of the arterial circulation secondary to arterial vasodilation in the splanchnic vascular bed. It is characterized by azotemia, oliguria, a very low urinary sodium (<10 mEq/day), and a high urine osmolarity.',
631:'The cricoid cartilage is the first complete cartilaginous ring of the airway and consists of an anterior arch and a posterior broad-based plate (E). The tracheal blood supply is segmental via the inferior thyroid and bronchial arteries (A). Each arterial branch supplies a 1- to 2-cm length of the trachea.',
636:'Stage 4 non–small cell lung cancer is treated primarily with chemotherapy and radiation therapy. There may be a role for surgical intervention for palliation of symptoms (e.g., thoracentesis or pleural window for recurrent pleural effusions), but, in general, stage 4 disease is not managed surgically. Of the aforementioned findings, malignant pleural effusion is a marker for stage 4 disease (an effusion with malignant cells is considered M1a disease) (A, B, D, E).',
836:'Metronidazole is effective against anaerobes and protozoa. It is used for perforated bowel, pelvic inflammatory disease, H. pylori infections, amebic dysentery, and amebic liver abscesses, among others. It has an Antabuse (disulfiram)-like reaction, so it cannot be used in conjunction with alcohol. It is cleared by the liver. Prolonged use has been associated with peripheral neuropathy. The remaining answer choices are not commonly associated with peripheral neuropathy (A, C–E).',
871:'Steroids are the mainstay of treatment for retroperitoneal fibrosis because this condition is thought to be related to an autoimmune process. Supporting this theory, circulating antibodies to ceroid are present in more than 90% of patients. It is important to first obtain a tissue diagnosis. Ureterolysis (C), ureteral stenting, or nephrostomy tubes are reserved for those who do not respond or those who have massive hydronephrosis with alteration of renal function.'}
for q in qs:
 if q['local_id']==272: q['options'][3]=q['options'][3].replace('preperation','preparation')
 q['explanation']=MAN.get(q['local_id'],pick(q))
label='Review of Surgery for ABSITE and Boards || Second Edition'
for q in qs:q['source']=label
book['version']=2; book['source_label']=label
with open(OUT/'questions.jsonl','w',encoding='utf-8') as f:
 for q in qs:f.write(json.dumps(q,ensure_ascii=False,separators=(',',':'))+'\n')
json.dump(book,open(OUT/'book.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
