const BASE="https://kafu-content-1.blsmohamme97.workers.dev";
const BOOK_ID="ANATOMY-MRCS-WOOD-BLACKBURN";
const VERSION=2, QUESTIONS=209;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const safeUrl=(raw)=>{const u=new URL(raw,BASE);if(u.protocol!=="https:"||u.origin!==new URL(BASE).origin)throw new Error("content_url_invalid");return u;};
async function get(env,url){
  const u=safeUrl(url);
  const r=await env.CONTENT_SERVICE.fetch(new Request(u.href,{headers:{"user-agent":"kafu-binding-smoke/1.0"}}));
  const meta={status:r.status,content_type:r.headers.get("content-type")||"",cf_ray:r.headers.get("cf-ray")||""};
  if(!r.ok)throw Object.assign(new Error("upstream_"+r.status),{meta});
  return{data:await r.json(),meta};
}
export default{async fetch(_request,env){
  try{
    const catalog=await get(env,BASE+"/catalog.json");
    const book=(catalog.data.books||[]).find(b=>b.id===BOOK_ID&&Number(b.version)===VERSION);
    if(!book||Number(book.questions)!==QUESTIONS||!Array.isArray(book.chapters)||!book.chapters.length)throw new Error("book_manifest_mismatch");
    const catalogIds=book.chapters.flatMap(ch=>(ch.qids||[]).map(String));
    if(catalogIds.length!==QUESTIONS||new Set(catalogIds).size!==QUESTIONS)throw new Error("catalog_qids_mismatch");
    if(book.index_url){
      const idx=(await get(env,book.index_url)).data;
      if(idx.book_id!==BOOK_ID||Number(idx.version)!==VERSION||Number(idx.question_count)!==QUESTIONS)throw new Error("index_mismatch");
    }
    const fetched=[];
    for(const chapter of book.chapters){
      const pack=(await get(env,chapter.url)).data;
      if(pack.book_id!==BOOK_ID||Number(pack.version)!==VERSION||String(pack.chapter_id)!==String(chapter.id)||!Array.isArray(pack.questions))throw new Error("chapter_identity_mismatch");
      const ids=pack.questions.map(q=>String(q.id||""));
      if(ids.length!==Number(chapter.questions)||JSON.stringify(ids)!==JSON.stringify((chapter.qids||[]).map(String)))throw new Error("chapter_qids_mismatch");
      fetched.push(...ids);
    }
    if(fetched.length!==QUESTIONS||new Set(fetched).size!==QUESTIONS||JSON.stringify(fetched)!==JSON.stringify(catalogIds))throw new Error("whole_book_mismatch");
    return json({ok:true,book_id:BOOK_ID,version:VERSION,questions:fetched.length,chapters:book.chapters.length,catalog_status:catalog.meta.status,catalog_content_type:catalog.meta.content_type});
  }catch(error){return json({ok:false,error:String(error.message||error),...(error.meta||{})},502);}
}};