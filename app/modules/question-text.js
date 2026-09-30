/* Narrow Markdown table renderer. Source content is always escaped text. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.KafuQuestionText=api;
})(globalThis,function(){
  'use strict';
  const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function row(line){
    const cells=[];let cell='',pipes=0,lastPipe=-1;
    for(let i=0;i<line.length;i++){
      if(line[i]==='\\'&&(line[i+1]==='|'||line[i+1]==='\\')){cell+=line[++i];continue;}
      if(line[i]==='|'){cells.push(cell.trim());cell='';pipes++;lastPipe=i;}
      else cell+=line[i];
    }
    if(!pipes)return null;
    cells.push(cell.trim());
    if(line.trimStart().startsWith('|'))cells.shift();
    if(!line.slice(lastPipe+1).trim())cells.pop();
    return cells.length>=1?cells:null;
  }
  function render(value){
    const text=String(value??''),lines=text.replace(/\r\n?/g,'\n').split('\n');
    const blocks=[],plain=[];let hasTables=false;
    const flush=()=>{if(plain.length){blocks.push({text:plain.splice(0).join('\n')});}};
    for(let i=0;i<lines.length;){
      const headers=row(lines[i]),separator=i+1<lines.length?row(lines[i+1]):null;
      if(!headers||!separator||headers.length!==separator.length||!separator.every(c=>/^:?-{3,}:?$/.test(c))){
        plain.push(lines[i++]);continue;
      }
      flush();hasTables=true;i+=2;
      const rows=[];
      while(i<lines.length){const cells=row(lines[i]);if(!cells||cells.length!==headers.length)break;rows.push(cells);i++;}
      const heading=headers.map(c=>`<th scope="col">${escape(c)}</th>`).join('');
      const body=rows.map(cells=>cells.length>1&&cells[0]&&cells.slice(1).every(c=>!c)
        ?`<tr class="k-table-section"><th scope="row" colspan="${headers.length}">${escape(cells[0])}</th></tr>`
        :`<tr>${cells.map(c=>`<td>${escape(c)}</td>`).join('')}</tr>`).join('');
      blocks.push({html:`<div class="k-table-box"><table class="k-question-table"><thead><tr>${heading}</tr></thead><tbody>${body}</tbody></table></div>`});
    }
    flush();
    // Preserve existing plain-text output byte for byte, including line breaks.
    if(!hasTables)return {html:escape(text).replace(/\n/g,'<br>'),hasTables:false};
    return {html:blocks.map(b=>b.html??(b.text.trim()?`<p>${escape(b.text).replace(/\n/g,'<br>')}</p>`:'')).join(''),hasTables:true};
  }
  return {render};
});
