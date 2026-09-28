/* Text-first chapter delivery. I/O is injected for offline deterministic tests. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;root.KafuDownloadCore=api;})(globalThis,function(){
  "use strict";
  const MAX_TEXT=8*1024*1024,MAX_ZIP=25*1024*1024,MAX_EXPANDED=64*1024*1024;
  const keyOf=meta=>meta.book+":"+meta.chapter;
  const imageNames=pack=>[...new Set((pack.questions||[]).flatMap(q=>[...(q.images||[]),...(q.explanation_images||[])]))];
  function validPack(pack,meta){
    if(!pack||pack.book_id!==meta.book||String(pack.chapter_id)!==String(meta.chapter)||!Array.isArray(pack.questions))return false;
    if(meta.version!==undefined&&pack.version!==meta.version)return false;
    if(meta.questions!==undefined&&pack.questions.length!==meta.questions)return false;
    const ids=new Set();
    for(const q of pack.questions){if(!/^Q\d{9}$/.test(q.id||'')||ids.has(q.id)||!['sba','mtf','multi','emq'].includes(q.type)||!Array.isArray(q.options))return false;ids.add(q.id);}
    return imageNames(pack).every(name=>/^Q\d{9}_(?:e)?\d+\.webp$/.test(name));
  }
  function matches(pack,meta){
    return !!pack&&pack.book_id===meta.book&&String(pack.chapter_id)===String(meta.chapter)&&
      (meta.version===undefined||pack.version===meta.version)&&pack._source_url===(meta.url||null)&&pack._image_source_url===(meta.image_url||null);
  }
  function complete(pack,meta){return matches(pack,meta)&&pack._offline_complete===true;}
  function decodeImages(raw,expected,sdk){
    const bytes=raw instanceof Uint8Array?raw:new Uint8Array(raw);
    if(bytes.byteLength>MAX_ZIP)throw new Error('Image archive exceeds the download limit');
    const wanted=new Set(expected);let expanded=0,files=0;
    const result=sdk.unzipSync(bytes,{filter(file){
      if(!/^Q\d{9}_(?:e)?\d+\.webp$/.test(file.name)||!wanted.has(file.name))return false;
      if(!Number.isSafeInteger(file.originalSize)||file.originalSize<12||file.originalSize>MAX_ZIP)throw new Error('Invalid image size');
      expanded+=file.originalSize;files++;
      if(expanded>MAX_EXPANDED||files>2000)throw new Error('Image archive expands beyond the safe limit');
      return true;
    }});
    for(const name of wanted){
      const value=result[name];
      if(!value||value.byteLength<12||String.fromCharCode(...value.slice(0,4))!=='RIFF'||String.fromCharCode(...value.slice(8,12))!=='WEBP')throw new Error('Missing or invalid chapter image');
    }
    return result;
  }
  class Manager {
    constructor(io){this.io=io;this.jobs=new Map();this.errors=new Map();this.blocked=new Set();}
    isBusy(key){return this.jobs.has(key);}
    open(meta){
      const key=keyOf(meta);if(this.blocked.has(key))return Promise.reject(new Error('Chapter is being removed'));
      const existing=this.jobs.get(key);if(existing)return existing.text;
      const cached=this.io.cached(key);
      if(complete(cached,meta))return Promise.resolve(cached);
      if(!this.io.online())return cached?Promise.resolve(cached):Promise.reject(new Error('Chapter is not available offline'));
      const job={text:null,done:null};this.jobs.set(key,job);this.errors.delete(key);
      job.text=(async()=>{
        let pack=matches(cached,meta)?cached:await this.io.text(meta);
        if(!validPack(pack,meta))throw new Error('Chapter does not match the published catalog');
        pack._source_url=meta.url||null;pack._image_source_url=meta.image_url||null;pack._offline_complete=false;
        pack._text_bytes=new TextEncoder().encode(JSON.stringify(pack)).byteLength;
        if(pack._text_bytes>MAX_TEXT)throw new Error('Chapter text exceeds the download limit');
        // A text write failure need not prevent current online study, but cannot
        // earn an offline mark. The complete write will retry after images arrive.
        try{await this.io.saveText(key,pack);}catch(_){pack._storage_pending=true;}
        this.io.show(key,pack);return pack;
      })();
      job.done=(async()=>{
        const pack=await job.text;
        const expected=imageNames(pack);
        if(expected.length){
          if(!meta.image_url)throw new Error('Chapter image archive is missing');
          const images=await this.io.images(meta,expected);
          await this.io.saveImages(key,images.files,pack);
          pack._image_names=expected;pack._image_bytes=images.bytes;
        }else{pack._image_names=[];pack._image_bytes=0;}
        pack._offline_complete=true;delete pack._storage_pending;
        try{await this.io.saveText(key,pack);}catch(error){pack._offline_complete=false;throw error;}
        this.io.show(key,pack);return pack;
      })().catch(error=>{this.errors.set(key,error.message||'Download interrupted');return null;}).finally(()=>{
        if(this.jobs.get(key)===job)this.jobs.delete(key);this.io.changed(key);
      });
      this.io.changed(key);return job.text;
    }
    async finish(meta){
      const key=keyOf(meta),pack=await this.open(meta),job=this.jobs.get(key);
      if(job)await job.done;
      if(!complete(pack,meta))throw new Error(this.errors.get(key)||'Chapter is not completely saved');
      return pack;
    }
    async saveBook(metas,progress=()=>{}){
      let saved=0;const failed=[];
      // Bounded at one chapter/image archive at a time; foreground opens dedupe.
      for(const meta of metas){try{await this.finish(meta);saved++;}catch(_){failed.push(keyOf(meta));}progress(saved,failed.length,metas.length);}
      return{saved,failed,total:metas.length};
    }
    async remove(key,removeFiles){
      this.blocked.add(key);
      try{const job=this.jobs.get(key);if(job)await job.done;await removeFiles();this.errors.delete(key);}
      finally{this.blocked.delete(key);this.io.changed(key);}
    }
  }
  function bookSize(metas,cached){
    let bytes=0,unknown=false;
    for(const meta of metas){const pack=cached(keyOf(meta));if(complete(pack,meta)){bytes+=(pack._text_bytes||meta.bytes||0)+(pack._image_bytes||0);continue;}
      if(Number.isFinite(meta.bytes))bytes+=meta.bytes;else unknown=true;
      if(meta.image_url){if(Number.isFinite(meta.image_bytes))bytes+=meta.image_bytes;else unknown=true;}
    }
    return{bytes,exact:!unknown};
  }
  return{MAX_TEXT,MAX_ZIP,MAX_EXPANDED,keyOf,imageNames,validPack,matches,complete,decodeImages,Manager,bookSize};
});
