#!/usr/bin/env python3
"""Task-local, visually measured figure/table crops from the unchanged Oxford PDF."""
from pathlib import Path
import hashlib,json
import fitz
from PIL import Image
HERE=Path(__file__).resolve().parent
# Includes source captions/attribution where present, never adjacent prose.
ASSETS=[
 {'local_id':38,'pdf_page':46,'kind':'table','source_label':'Table 1.1','bbox':[92,68,350,245]},
 {'local_id':119,'pdf_page':103,'kind':'table','source_label':'Table 3.1','bbox':[46,68,397,218]},
 {'local_id':221,'pdf_page':167,'kind':'figure','source_label':'Figure 5.1','bbox':[40,68,400,227]},
 {'local_id':233,'pdf_page':170,'kind':'table','source_label':'Table 5.1','bbox':[44,466,399,578]},
 {'local_id':234,'pdf_page':171,'kind':'table','source_label':'Table 5.2','bbox':[40,168,400,252]},
 {'local_id':265,'pdf_page':199,'kind':'figure','source_label':'Figure 6.1','bbox':[40,174,400,490]},
 {'local_id':324,'pdf_page':236,'kind':'table','source_label':'Table 7.1','bbox':[40,275,401,460]},
]

def build_assets(pdf: Path, out: Path) -> list[dict]:
 raw=pdf.read_bytes()
 assert len(raw)==2736487 and hashlib.sha256(raw).hexdigest()=='00da079467ce8d8aecdb5dc65cab6b0d0b884bff17c9b6a00b03c69604de0ad6'
 out.mkdir(parents=True,exist_ok=True); (out/'images').mkdir(exist_ok=True)
 fitz.TOOLS.mupdf_display_errors(False);fitz.TOOLS.mupdf_display_warnings(False)
 doc=fitz.open(pdf); manifest=[]
 for spec in ASSETS:
  rect=fitz.Rect(spec['bbox']);scale=1200/rect.width
  pix=doc[spec['pdf_page']-1].get_pixmap(matrix=fitz.Matrix(scale,scale),clip=rect,alpha=False,annots=False)
  im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
  if im.width>1200:im=im.resize((1200,round(im.height*1200/im.width)),Image.Resampling.LANCZOS)
  name=f"L{spec['local_id']:04d}_e1.webp"; dest=out/'images'/name
  im.save(dest,'WEBP',quality=90,method=6)
  assert dest.stat().st_size<1500000
  manifest.append(dict(spec,filename=name,width=im.width,height=im.height,bytes=dest.stat().st_size,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),question_images=False,explanation_images=True))
 pix=doc[0].get_pixmap(matrix=fitz.Matrix(600/doc[0].rect.width,600/doc[0].rect.width),alpha=False,annots=False)
 im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples);im.save(out/'cover.webp','WEBP',quality=90,method=6)
 assert (out/'cover.webp').stat().st_size<400000
 assert pdf.read_bytes()==raw
 return manifest

if __name__=='__main__':
 import argparse
 ap=argparse.ArgumentParser();ap.add_argument('pdf',type=Path);ap.add_argument('--out',type=Path,default=HERE/'pack');a=ap.parse_args()
 m=build_assets(a.pdf,a.out)
 (HERE/'evidence/asset-manifest.json').write_text(json.dumps(m,indent=2)+'\n')
 print(json.dumps(m,indent=2))
