/* Revalidate a persistent offline claim when cached image blobs are hydrated. */
globalThis.KafuEnhancements.installers.push({name:"offline-image-integrity",install(){
  const Core=globalThis.KafuDownloadCore,hydrate=hydratePackImages,downloads=globalThis.KafuDownloads;
  hydratePackImages=async function(key,pack){
    await hydrate(key,pack);
    if(Core.imageNames(pack).some(name=>!pack.img?.[name]))pack._offline_complete=false;
    return pack;
  };
  const cached=downloads.manager.io.cached;
  downloads.manager.io.cached=key=>{
    const pack=cached(key);
    if(pack?._offline_complete&&Core.imageNames(pack).some(name=>!pack.img?.[name]))pack._offline_complete=false;
    return pack;
  };
  const saveImages=downloads.manager.io.saveImages;
  downloads.manager.io.saveImages=async(key,files,pack)=>{
    // Track expected names before any blob write, so an interrupted/partial save
    // can be cleaned up by the existing local Delete chapter control.
    pack._image_names=Object.keys(files);pack._offline_complete=false;
    await downloads.manager.io.saveText(key,pack);
    return saveImages(key,files,pack);
  };
  const available=downloads.available;
  downloads.available=(book,ch)=>available(book,ch)&&!Core.imageNames(PACKS[book+":"+ch]||{}).some(name=>!PACKS[book+":"+ch]?.img?.[name]);
}});
