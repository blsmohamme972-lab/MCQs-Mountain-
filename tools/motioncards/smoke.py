#!/usr/bin/env python3
from __future__ import annotations
import argparse,json
from urllib.parse import urlsplit
from tools.http_client import request_bytes,request_json

CSP_REQUIRED=["default-src 'none'","connect-src 'none'","worker-src 'none'","form-action 'none'","sandbox allow-scripts"]
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--url",required=True);ap.add_argument("--result",required=True);a=ap.parse_args()
    base=a.url.rstrip("/");meta=json.load(open(a.result))
    build=request_json(base+"/build-info.json?state="+meta["state_sha256"],step="motioncards.smoke.build")
    if build.get("state_sha256")!=meta["state_sha256"]:raise ValueError("motioncards_state_not_live")
    s=meta["sample"];idx=request_json(base+"/indexes/"+s["book_id"]+"/v"+str(s["book_version"])+"/index.json",step="motioncards.smoke.index")
    row=idx.get("animations",{}).get(s["qid"])
    if not row or row.get("content_hash") is None:raise ValueError("motioncards_index_sample_missing")
    # Use the immutable path from the index but force this staged/production host.
    path=urlsplit(row["entry_url"]).path
    import urllib.request
    req=urllib.request.Request(base+path,method="GET",headers={"User-Agent":"kafu-motioncards-smoke/1.0"})
    with urllib.request.urlopen(req,timeout=20) as r:
        raw=r.read(2*1024*1024+1);headers=r.headers
        if r.status!=200 or len(raw)>2*1024*1024:raise ValueError("motioncards_entry_invalid")
        csp=headers.get("Content-Security-Policy","")
        for token in CSP_REQUIRED:
            if token not in csp:raise ValueError("motioncards_csp_missing:"+token)
        if headers.get("X-Content-Type-Options")!="nosniff":raise ValueError("motioncards_nosniff_missing")
    print(json.dumps({"motioncards_smoke":"PASS","state_sha256":meta["state_sha256"],"qid":s["qid"],"entry_bytes":len(raw)}))
if __name__=="__main__":main()
